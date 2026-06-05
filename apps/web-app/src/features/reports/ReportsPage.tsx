import { useState } from 'react'
import { 
  FileText, 
  Download, 
  Trash2, 
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { Card, CardContent } from '@clausync/ui'
import { Button } from '@clausync/ui'
import { Skeleton } from '@clausync/ui'
import { Badge } from '@clausync/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@clausync/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@clausync/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@clausync/ui'
import { useReports, useGenerateReport, useDeleteReport } from '@/lib/api-hooks'
import { toast } from 'sonner'
import { cn } from '@clausync/ui'
import type { Report, GenerateReportPayload } from '@/types'

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  ready: { label: 'Ready', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  expired: { label: 'Expired', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
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

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
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

interface ReportCardProps {
  report: Report
  onDelete: (id: string) => void
  onDownload: (id: string) => void
  isDeleting: boolean
  isDownloading: boolean
}

function ReportCard({ report, onDelete, onDownload, isDeleting, isDownloading }: ReportCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const status = statusConfig[report.status]

  return (
    <>
      <Card className="hover:border-border/80 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium capitalize">
                {report.type} Report ({report.format.toUpperCase()})
              </p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{formatDate(report.createdAt)}</span>
                {report.expiresAt && (
                  <>
                    <span>•</span>
                    <span>Expires: {formatDate(report.expiresAt)}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className={cn('border', status.color)}>
              {status.label}
            </Badge>
            <div className="flex gap-2">
              {report.status === 'ready' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onDownload(report.id)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              )}
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
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(report.id)
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

export function ReportsPage() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  
  // Form state for generating reports
  const [reportType, setReportType] = useState<'risk_summary' | 'change_history' | 'compliance'>('risk_summary')
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf')
  const [reportPeriod, setReportPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const { data: reportsResponse, isLoading, error, refetch } = useReports()
  const generateReport = useGenerateReport()
  const deleteReport = useDeleteReport()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reports = (reportsResponse as any)?.data ?? []

  const handleGenerate = async () => {
    try {
      const payload: GenerateReportPayload = {
        type: reportType,
        format: reportFormat,
        period: reportPeriod,
      }
      await generateReport.mutateAsync(payload)
      toast.success('Report generation started')
      setIsGenerateDialogOpen(false)
    } catch {
      toast.error('Failed to generate report')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteReport.mutateAsync(id)
      toast.success('Report deleted')
    } catch {
      toast.error('Failed to delete report')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (id: string) => {
    setDownloadingId(id)
    try {
      // Use apiClient which handles auth properly
      const { data } = await import('@/lib/api-client').then(m => 
        m.apiClient.get<{ downloadUrl: string; filename: string }>(`/reports/${id}/download`)
      )
      if (data.downloadUrl) {
        // Use programmatic anchor click for reliable download
        const link = document.createElement('a')
        link.href = data.downloadUrl
        link.download = data.filename || 'report'
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch {
      toast.error('Failed to get download link')
    } finally {
      setDownloadingId(null)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load reports</p>
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
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download reports for your monitors
          </p>
        </div>
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
              <DialogDescription>
                Select the type and format for your report.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type</label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk_summary">Risk Summary Report</SelectItem>
                    <SelectItem value="change_history">Change History Report</SelectItem>
                    <SelectItem value="compliance">Compliance Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <Select value={reportFormat} onValueChange={(v) => setReportFormat(v as typeof reportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as typeof reportPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={generateReport.isPending}
                className="w-full"
              >
                {generateReport.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Report'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <ReportsSkeleton />
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-medium text-lg mb-1">No reports yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Generate your first report to analyze your monitored resources
            </p>
            <Button onClick={() => setIsGenerateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report: Report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={handleDelete}
              onDownload={handleDownload}
              isDeleting={deletingId === report.id}
              isDownloading={downloadingId === report.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
