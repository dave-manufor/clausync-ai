import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Settings,
  Trash2,
  Loader2,
  FileX,
  Pause,
  Play,
} from 'lucide-react'
import { Button } from '@clausync/ui'
import { Badge } from '@clausync/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@clausync/ui'
import { Separator } from '@clausync/ui'
import { Skeleton } from '@clausync/ui'
import { useMonitor, useMonitorChanges, usePauseMonitor, useResumeMonitor, useSnapshots } from '@/lib/api-hooks'
import { cn } from '@clausync/ui'
import { toast } from 'sonner'

const severityColors = {
  high: 'bg-critical/10 text-critical border-critical/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-safe/10 text-safe border-safe/20',
}

function getRiskLevel(score: number | null | undefined): 'low' | 'medium' | 'high' {
  if (!score) return 'low'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Never'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'Never'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(date)
}

// Loading skeleton component
function MonitorDetailSkeleton() {
  return (
    <div className="space-y-6" data-testid="monitor-loading">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// 404 Not Found component
function MonitorNotFound() {
  const navigate = useNavigate()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="p-4 rounded-full bg-destructive/10">
        <FileX className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Monitor Not Found</h2>
      <p className="text-muted-foreground text-center max-w-md">
        The monitor you're looking for doesn't exist or you don't have permission to view it.
      </p>
      <Button variant="outline" onClick={() => navigate('/monitors')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Monitors
      </Button>
    </div>
  )
}

export function MonitorDetailPage() {
  const { id } = useParams()
  
  const { data: monitorResponse, isLoading: monitorLoading, error: monitorError } = useMonitor(id || '')
  const { data: changes, isLoading: changesLoading } = useMonitorChanges(id || '', { limit: 5 })
  const { data: snapshotsResponse } = useSnapshots(id || '', { limit: 5 })
  
  const pauseMonitor = usePauseMonitor()
  const resumeMonitor = useResumeMonitor()
  
  // Handle loading state
  if (monitorLoading) {
    return <MonitorDetailSkeleton />
  }
  
  // Handle error / not found
  if (monitorError || !monitorResponse) {
    return <MonitorNotFound />
  }
  
  // Extract monitor data from response  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = monitorResponse as any
  const monitor = rawData?.data ?? rawData
  
  // Pause/Resume state
  const isPaused = !!monitor?.pausedAt
  const isPauseLoading = pauseMonitor.isPending || resumeMonitor.isPending
  
  const handlePauseToggle = async () => {
    if (!id) return
    try {
      if (isPaused) {
        await resumeMonitor.mutateAsync(id)
        toast.success('Monitor resumed')
      } else {
        await pauseMonitor.mutateAsync(id)
        toast.success('Monitor paused')
      }
    } catch {
      toast.error(isPaused ? 'Failed to resume monitor' : 'Failed to pause monitor')
    }
  }
  
  // Extract snapshots
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshots = (snapshotsResponse as any)?.data ?? []
  
  // Derive display values with safe access
  const monitorName = monitor?.displayName || monitor?.resource?.urlNormalized || 'Unnamed Monitor'
  const monitorUrl = monitor?.resource?.urlNormalized || ''
  const selector = monitor?.resource?.selector || 'body'
  const lastChecked = formatRelativeTime(monitor?.resource?.lastScrapedAt)
  const createdAt = formatDate(monitor?.createdAt)
  const totalChanges = changes?.length || 0
  
  // Use the actual latestRiskScore from the monitor, or calculate from recent change
  const latestRiskScore = monitor?.latestRiskScore ?? 
    (changes?.[0]?.globalRiskScore) ?? 
    0
  const riskLevel = getRiskLevel(latestRiskScore)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/monitors"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Monitors
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{monitorName}</h1>
            <Badge
              variant="outline"
              className={cn(
                isPaused
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              )}
            >
              {isPaused ? 'Paused' : 'Active'}
            </Badge>
          </div>
          {monitorUrl && (
            <a
              href={monitorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 mt-1"
            >
              {monitorUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handlePauseToggle}
            disabled={isPauseLoading}
          >
            {isPauseLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isPaused ? (
              <Play className="h-4 w-4 mr-2" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Now
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Checked</p>
              <p className="font-medium">{lastChecked}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Activity className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Changes</p>
              <p className="font-medium">{totalChanges}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              riskLevel === 'high' && 'bg-critical/10',
              riskLevel === 'medium' && 'bg-warning/10',
              riskLevel === 'low' && 'bg-safe/10'
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                riskLevel === 'high' && 'text-critical',
                riskLevel === 'medium' && 'text-warning',
                riskLevel === 'low' && 'text-safe'
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className="font-medium capitalize">{riskLevel}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-safe/10">
              <RefreshCw className="h-5 w-5 text-safe" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check Frequency</p>
              <p className="font-medium">Every 6 hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitor Details & Change History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Monitor Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">CSS Selector</p>
              <code className="text-sm bg-surface-2 px-2 py-1 rounded font-mono">
                {selector}
              </code>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{createdAt}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">Active</p>
            </div>
          </CardContent>
        </Card>

        {/* Change History */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Change History</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/changes?monitor=${id}`} className="text-accent">
                View all changes
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {changesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : changes && changes.length > 0 ? (
              <div className="space-y-4">
                {changes.map((change, index) => {
                  const severity = getRiskLevel(change.globalRiskScore)
                  return (
                    <div key={change.id}>
                      <Link
                        to={`/changes/${change.id}`}
                        className="block p-4 rounded-lg border border-border hover:border-accent/50 hover:bg-surface-2 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {change.globalAiSummary?.slice(0, 50) || 'Change detected'}
                                {(change.globalAiSummary?.length || 0) > 50 && '...'}
                              </span>
                              <Badge
                                variant="outline"
                                className={severityColors[severity]}
                              >
                                {severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Risk score: {change.globalRiskScore || 0}/10
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(change.createdAt)}
                          </span>
                        </div>
                      </Link>
                      {index < changes.length - 1 && (
                        <div className="h-4 w-px bg-border ml-6" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No changes detected yet</p>
                <p className="text-sm">Changes will appear here once detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Snapshots Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots && snapshots.length > 0 ? (
            <div className="space-y-3">
              {snapshots.slice(0, 5).map((snapshot: { id: string; scrapedAt: string; contentHash: string }) => (
                <Link
                  key={snapshot.id}
                  to={`/monitors/${id}/snapshots/${snapshot.id}`}
                  className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        Snapshot {formatDate(snapshot.scrapedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hash: {snapshot.contentHash?.slice(0, 8)}...
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      View
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No snapshots yet</p>
              <p className="text-sm">Snapshots will appear after the first check</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
