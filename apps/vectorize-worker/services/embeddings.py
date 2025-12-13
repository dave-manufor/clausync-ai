import logging
import vertexai
from vertexai.language_models import TextEmbeddingModel
import config

logger = logging.getLogger(__name__)

# Initialize Vertex AI
vertexai.init(project=config.settings.GCP_PROJECT_ID, location=config.settings.GCP_REGION)

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of text chunks using Vertex AI.
    Returns list of embedding vectors.
    """
    try:
        model = TextEmbeddingModel.from_pretrained(config.settings.EMBEDDING_MODEL)
        
        # Vertex AI has limits on batch size, process in batches of 5
        all_embeddings = []
        batch_size = 5
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = model.get_embeddings(batch)
            
            for embedding in embeddings:
                all_embeddings.append(embedding.values)
        
        logger.info(f"Generated {len(all_embeddings)} embeddings")
        return all_embeddings
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return []

def generate_single_embedding(text: str) -> list[float] | None:
    """Generate embedding for a single text."""
    embeddings = generate_embeddings([text])
    return embeddings[0] if embeddings else None
