import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// Mock data
const monitorData = {
  id: '1',
  name: 'AWS Terms of Service',
  url: 'https://aws.amazon.com/service-terms/',
  selector: 'main article',
  status: 'active',
  createdAt: 'Dec 1, 2024',
  lastChecked: '2 hours ago',
  checkFrequency: 'Every 6 hours',
  totalChanges: 12,
  riskLevel: 'high',
}

const changeHistory = [
  {
    id: '1',
    date: 'Dec 10, 2024',
    type: 'Liability Clause Modified',
    severity: 'high',
    summary: 'Updated indemnification language in Section 7.2',
  },
  {
    id: '2',
    date: 'Dec 5, 2024',
    type: 'Pricing Terms Updated',
    severity: 'medium',
    summary: 'Added new usage-based pricing tiers',
  },
  {
    id: '3',
    date: 'Nov 28, 2024',
    type: 'Data Processing Terms',
    severity: 'low',
    summary: 'Minor clarification on data retention periods',
  },
]

const severityColors = {
  high: 'bg-[#FF4757]/10 text-[#FF4757] border-[#FF4757]/20',
  medium: 'bg-[#FDCB6E]/10 text-[#FDCB6E] border-[#FDCB6E]/20',
  low: 'bg-[#2ED573]/10 text-[#2ED573] border-[#2ED573]/20',
}

export function MonitorDetailPage() {
  const { id } = useParams()

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
            <h1 className="text-2xl font-bold">{monitorData.name}</h1>
            <Badge
              variant="outline"
              className="bg-[#2ED573]/10 text-[#2ED573] border-[#2ED573]/20"
            >
              Active
            </Badge>
          </div>
          <a
            href={monitorData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-[#A17CFF] inline-flex items-center gap-1 mt-1"
          >
            {monitorData.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex gap-2">
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
              <p className="font-medium">{monitorData.lastChecked}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#A17CFF]/10">
              <Activity className="h-5 w-5 text-[#A17CFF]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Changes</p>
              <p className="font-medium">{monitorData.totalChanges}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FF4757]/10">
              <AlertTriangle className="h-5 w-5 text-[#FF4757]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className="font-medium capitalize">{monitorData.riskLevel}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#2ED573]/10">
              <RefreshCw className="h-5 w-5 text-[#2ED573]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check Frequency</p>
              <p className="font-medium">{monitorData.checkFrequency}</p>
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
                {monitorData.selector}
              </code>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{monitorData.createdAt}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{monitorData.status}</p>
            </div>
          </CardContent>
        </Card>

        {/* Change History */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Change History</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/changes?monitor=${id}`} className="text-[#A17CFF]">
                View all changes
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {changeHistory.map((change, index) => (
                <div key={change.id}>
                  <Link
                    to={`/changes/${change.id}`}
                    className="block p-4 rounded-lg border border-border hover:border-[#A17CFF]/50 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{change.type}</span>
                          <Badge
                            variant="outline"
                            className={severityColors[change.severity as keyof typeof severityColors]}
                          >
                            {change.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {change.summary}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {change.date}
                      </span>
                    </div>
                  </Link>
                  {index < changeHistory.length - 1 && (
                    <div className="h-4 w-px bg-border ml-6" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
