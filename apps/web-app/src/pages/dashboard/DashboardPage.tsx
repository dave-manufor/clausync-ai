import { Link } from 'react-router-dom'
import {
  FileSearch,
  Activity,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@clausync/ui'
import { Button } from '@clausync/ui'
import { Badge } from '@clausync/ui'
import { Skeleton } from '@clausync/ui'
import { useMonitors, useChanges, useAnalyticsDashboard } from '@/lib/api-hooks'
import { getRiskLevel } from '@/types'

const severityColors = {
  high: 'bg-critical/10 text-critical border-critical/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-safe/10 text-safe border-safe/20',
}

export function DashboardPage() {
  const { data: monitors, isLoading: monitorsLoading } = useMonitors()
  const { data: changes, isLoading: changesLoading, refetch: refetchChanges } = useChanges({ limit: 5 })
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsDashboard('30d')

  const activeMonitors = monitors?.filter(m => m.resource?.currentHash).length ?? 0
  const recentChanges = changes?.slice(0, 4) ?? []
  const highRiskCount = changes?.filter(c => getRiskLevel(c.globalRiskScore) === 'high').length ?? 0

  const stats = [
    {
      title: 'Active Monitors',
      value: monitorsLoading ? null : String(activeMonitors),
      change: '+3',
      trend: 'up' as const,
      icon: FileSearch,
    },
    {
      title: 'Changes (30d)',
      value: analyticsLoading ? null : String(analytics?.changesThisPeriod ?? 0),
      change: '+12%',
      trend: 'up' as const,
      icon: Activity,
    },
    {
      title: 'High Risk Alerts',
      value: changesLoading ? null : String(highRiskCount),
      change: '-2',
      trend: 'down' as const,
      icon: AlertTriangle,
    },
    {
      title: 'Avg Risk Score',
      value: analyticsLoading ? null : (analytics?.avgRiskScore?.toFixed(1) ?? '0.0'),
      change: '-0.3',
      trend: 'down' as const,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your contracts and stay informed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchChanges()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/monitors/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Monitor
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {stat.value === null ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="h-4 w-4 text-safe" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-critical" />
                    )}
                    <span
                      className={`text-sm ${
                        stat.trend === 'up' ? 'text-safe' : 'text-critical'
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-sm text-muted-foreground">vs last month</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Change Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Change Activity</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                7d
              </Button>
              <Button variant="secondary" size="sm">
                30d
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                90d
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-lg">
              <div className="text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Change trend chart</p>
                <p className="text-sm">
                  <Link to="/analytics" className="text-accent hover:underline">
                    View full analytics →
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Changes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Recent Changes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/changes" className="text-accent">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {changesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))
            ) : recentChanges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No changes detected yet</p>
              </div>
            ) : (
              recentChanges.map((change) => {
                const riskLevel = getRiskLevel(change.globalRiskScore)
                const isInitial = (change.diffJson as { is_initial_baseline?: boolean })?.is_initial_baseline
                return (
                  <Link
                    key={change.id}
                    to={`/changes/${change.id}`}
                    className="block p-3 rounded-lg hover:bg-surface-2 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {change.displayName || change.resource?.urlNormalized || 'Unknown Resource'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {isInitial ? 'Initial Analysis' : 'Change Detected'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={severityColors[riskLevel]}
                      >
                        {riskLevel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(change.createdAt).toLocaleString()}
                    </p>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/monitors/new">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Add New Monitor</p>
                <p className="text-sm text-muted-foreground">
                  Track a new service agreement
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/changes">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Activity className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium">View All Changes</p>
                <p className="text-sm text-muted-foreground">
                  Browse detected changes
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/analytics">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-safe/10">
                <TrendingUp className="h-6 w-6 text-safe" />
              </div>
              <div>
                <p className="font-medium">View Analytics</p>
                <p className="text-sm text-muted-foreground">
                  See trends and reports
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
