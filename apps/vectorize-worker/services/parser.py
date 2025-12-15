import logging
import io
import re
from pypdf import PdfReader
from docx import Document
from google.cloud import storage
import config

logger = logging.getLogger(__name__)

# Patterns that may indicate prompt injection attempts
SUSPICIOUS_PATTERNS = [
    r'\bignore\s+(previous|above|all)\s+instructions?\b',
    r'\bforget\s+(everything|all|your)\b',
    r'\bact\s+as\s+(a|an|if)\b',
    r'\bpretend\s+(you\s+are|to\s+be)\b',
    r'\byou\s+are\s+now\b',
    r'\bsystem\s*:\s*\b',
    r'\buser\s*:\s*\b',
    r'\bassistant\s*:\s*\b',
    r'\b(execute|run|eval)\s*\(',
    r'<\s*(script|system|prompt)',
]


def scan_for_prompt_patterns(text: str) -> dict:
    """
    Scan text for patterns that may indicate prompt injection attempts.
    Returns a dict with is_suspicious flag and matched patterns.
    """
    if not text:
        return {"is_suspicious": False, "patterns": [], "sanitized_text": text}
    
    found_patterns = []
    text_lower = text.lower()
    
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            found_patterns.append(pattern)
    
    if found_patterns:
        logger.warning(f"Detected {len(found_patterns)} suspicious pattern(s) in text chunk",
                      extra={"patterns": found_patterns[:3]})  # Log first 3
    
    # Sanitize: remove control characters
    sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    
    return {
        "is_suspicious": len(found_patterns) > 0,
        "patterns": found_patterns,
        "sanitized_text": sanitized
    }


def download_file_from_gcs(gcs_uri: str) -> bytes | None:
    """Download a file from GCS and return its bytes."""
    try:
        # Parse gs://bucket/path format
        if not gcs_uri.startswith("gs://"):
            logger.error(f"Invalid GCS URI: {gcs_uri}")
            return None
            
        parts = gcs_uri[5:].split("/", 1)
        bucket_name = parts[0]
        blob_path = parts[1] if len(parts) > 1 else ""
        
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        return blob.download_as_bytes()
        
    except Exception as e:
        logger.error(f"Error downloading from GCS: {e}")
        return None

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        reader = PdfReader(io.BytesIO(content))
        text_parts = []
        
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        
        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} characters from PDF ({len(reader.pages)} pages)")
        return full_text
        
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

def extract_text_from_docx(content: bytes) -> str:
    """Extract text from a Word document."""
    try:
        doc = Document(io.BytesIO(content))
        text_parts = []
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        
        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} characters from DOCX")
        return full_text
        
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        return ""

def extract_text(gcs_uri: str, file_type: str) -> str:
    """Download and extract text from a document."""
    content = download_file_from_gcs(gcs_uri)
    if not content:
        return ""
    
    if file_type in ["pdf", "application/pdf"]:
        return extract_text_from_pdf(content)
    elif file_type in ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        return extract_text_from_docx(content)
    else:
        # Try as plain text
        try:
            return content.decode("utf-8")
        except:
            logger.error(f"Unsupported file type: {file_type}")
            return ""

def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> list[str]:
    """
    Split text into overlapping chunks for embedding.
    Also scans each chunk for suspicious prompt-like patterns (security).
    """
    chunk_size = chunk_size or config.settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or config.settings.CHUNK_OVERLAP
    
    if len(text) <= chunk_size:
        # Scan single chunk
        scan_result = scan_for_prompt_patterns(text)
        return [scan_result["sanitized_text"]]
    
    chunks = []
    suspicious_count = 0
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # Try to break at sentence or paragraph boundary
        if end < len(text):
            # Look for paragraph break
            para_break = text.rfind("\n\n", start, end)
            if para_break > start + chunk_size // 2:
                end = para_break + 2
            else:
                # Look for sentence break
                sentence_break = text.rfind(". ", start, end)
                if sentence_break > start + chunk_size // 2:
                    end = sentence_break + 2
        
        chunk = text[start:end].strip()
        if chunk:
            # Scan chunk for suspicious patterns
            scan_result = scan_for_prompt_patterns(chunk)
            if scan_result["is_suspicious"]:
                suspicious_count += 1
            chunks.append(scan_result["sanitized_text"])
        
        start = end - chunk_overlap
    
    if suspicious_count > 0:
        logger.warning(f"Document contains {suspicious_count} chunks with suspicious patterns",
                      extra={"total_chunks": len(chunks)})
    
    logger.info(f"Split text into {len(chunks)} chunks")
    return chunks

