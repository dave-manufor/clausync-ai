import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, File, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>
  isUploading?: boolean
  className?: string
}

export function FileUpload({ onUpload, isUploading = false, className }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setError(null)
    
    if (rejectedFiles.length > 0) {
      const firstError = rejectedFiles[0].errors[0]
      if (firstError.message.includes('larger')) {
        setError('File too large. Maximum size is 20MB.')
      } else {
        setError('Invalid file type. Accepted: PDF, DOCX, TXT, MD')
      }
      return
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading,
  })

  const handleUpload = async () => {
    if (!selectedFile) return
    
    try {
      await onUpload(selectedFile)
      setSelectedFile(null)
    } catch {
      setError('Upload failed. Please try again.')
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setError(null)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={className}>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-surface-2/50',
            isUploading && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {isDragActive ? 'Drop your file here' : 'Drag & drop a file here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD • Max 20MB
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 bg-surface-2/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <File className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 w-0">
              <p className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" title={selectedFile.name}>{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {!isUploading && (
              <button
                onClick={clearSelection}
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            {!isUploading && (
              <Button variant="outline" onClick={clearSelection}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
