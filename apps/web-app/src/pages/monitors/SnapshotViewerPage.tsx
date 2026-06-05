import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, FileText, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@clausync/ui'
import { Button } from '@clausync/ui'
import { Skeleton } from '@clausync/ui'
import { useSnapshot, useSnapshotContent, useMonitor } from '@/lib/api-hooks'

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function SnapshotViewerPage() {
  const { id: monitorId, sid: snapshotId } = useParams()
  
  const { data: monitorResponse, isLoading: monitorLoading } = useMonitor(monitorId || '')
  const { data: snapshotResponse, isLoading: snapshotLoading } = useSnapshot(monitorId || '', snapshotId || '')
  const { data: contentResponse, isLoading: contentLoading, error: contentApiError, refetch: refetchContent } = useSnapshotContent(monitorId || '', snapshotId || '')
  
  // State for fetching HTML content from downloadUrl
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlError, setHtmlError] = useState<Error | null>(null)
  
  // Fetch HTML content when downloadUrl is available
  useEffect(() => {
    if (!contentResponse?.downloadUrl) return
    
    const fetchHtml = async () => {
      setHtmlLoading(true)
      setHtmlError(null)
      try {
        const response = await fetch(contentResponse.downloadUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`)
        }
        const text = await response.text()
        setHtmlContent(text)
      } catch (err) {
        setHtmlError(err instanceof Error ? err : new Error('Failed to load content'))
      } finally {
        setHtmlLoading(false)
      }
    }
    
    fetchHtml()
  }, [contentResponse?.downloadUrl])
  
  const isLoading = monitorLoading || snapshotLoading || contentLoading || htmlLoading
  const contentError = contentApiError || htmlError
  
  const handleRetry = () => {
    refetchContent()
    setHtmlContent('')
    setHtmlError(null)
  }
  
  if (isLoading) {
    return <SnapshotSkeleton />
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monitor = (monitorResponse as any)?.data ?? monitorResponse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = snapshotResponse as any
  
  const monitorName = monitor?.displayName || monitor?.resource?.urlNormalized || 'Monitor'

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to={`/monitors/${monitorId}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {monitorName}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          Snapshot Viewer
        </h1>
        {snapshot && (
          <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDate(snapshot.scrapedAt)}
            </span>
            {snapshot.contentHash && (
              <span>Hash: {snapshot.contentHash.slice(0, 12)}...</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Snapshot Content</CardTitle>
        </CardHeader>
        <CardContent>
          {contentError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-muted-foreground mb-4">Failed to load snapshot content</p>
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : htmlContent ? (
            <div 
              className="prose prose-invert max-w-none p-4 rounded-lg bg-surface-2/50 border border-border overflow-auto max-h-[600px]"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No content available for this snapshot</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

