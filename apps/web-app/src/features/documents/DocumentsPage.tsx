import { useState } from 'react'
import { 
  FileText, 
  Upload, 
  Trash2, 
  AlertCircle,
  FileType,
  Loader2,
  Search,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/lib/api-hooks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Document } from '@/types'

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  ready: { label: 'Ready', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

const fileTypeIcons: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'text/plain': '📃',
  'text/markdown': '📋',
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface DocumentCardProps {
  document: Document
  onDelete: (id: string) => void
  isDeleting: boolean
}

function DocumentCard({ document, onDelete, isDeleting }: DocumentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const status = statusConfig[document.status]
  const icon = fileTypeIcons[document.mimeType] || '📄'

  return (
    <>
      <Card className="hover:border-border/80 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{document.filename}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <span>{formatDate(document.createdAt)}</span>
                {document.chunkCount && (
                  <>
                    <span>•</span>
                    <span>{document.chunkCount} chunks</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className={cn('border', status.color)}>
              {status.label}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(document.id)
                setShowDeleteDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: documentsResponse, isLoading, error, refetch } = useDocuments()
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documents = (documentsResponse as any)?.data ?? []

  const filteredDocuments = documents.filter((doc: Document) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUpload = async (file: File) => {
    try {
      await uploadDocument.mutateAsync(file)
      toast.success('Document uploaded successfully')
      setIsUploadDialogOpen(false)
    } catch {
      toast.error('Failed to upload document')
      throw new Error('Upload failed')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteDocument.mutateAsync(id)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load documents</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Upload documents for personalized AI analysis
          </p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a document to enable personalized contract analysis.
              </DialogDescription>
            </DialogHeader>
            <FileUpload
              onUpload={handleUpload}
              isUploading={uploadDocument.isPending}
              className="mt-4"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Documents List */}
      {isLoading ? (
        <DocumentsSkeleton />
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <FileType className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-medium text-lg mb-1">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Upload your first document to enable personalized AI analysis'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc: Document) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              isDeleting={deletingId === doc.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
