import { useState } from 'react'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAnalyticsDashboard, useChangeAnalytics, useTopResources } from '@/lib/api-hooks'
import type { AnalyticsPeriod } from '@/types'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-20 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useAnalyticsDashboard(period)
  const { data: changesData, isLoading: changesLoading } = useChangeAnalytics(period)
  const { data: topResourcesData, isLoading: topResourcesLoading } = useTopResources(period)

  // Extract data with fallbacks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDashboard = dashboardData as any
  const dashboard = rawDashboard?.data ?? rawDashboard ?? {}
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChanges = changesData as any
  const changesTrend = rawChanges?.data ?? rawChanges ?? []
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTopResources = topResourcesData as any
  const topResources = rawTopResources?.data ?? rawTopResources ?? []

  const isLoading = dashboardLoading || changesLoading || topResourcesLoading

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  if (dashboardError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load analytics</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  // Build stats from dashboard data
  const stats = [
    {
      label: 'Total Changes',
      value: dashboard?.totalChanges?.toString() || '0',
      change: dashboard?.changesTrend >= 0 ? `+${dashboard?.changesTrend || 0}%` : `${dashboard?.changesTrend || 0}%`,
      trend: (dashboard?.changesTrend || 0) >= 0 ? 'up' : 'down',
      icon: Activity,
    },
    {
      label: 'High Risk',
      value: dashboard?.highRiskCount?.toString() || '0',
      change: dashboard?.highRiskTrend >= 0 ? `+${dashboard?.highRiskTrend || 0}%` : `${dashboard?.highRiskTrend || 0}%`,
      trend: (dashboard?.highRiskTrend || 0) > 0 ? 'up' : 'down',
      icon: AlertTriangle,
    },
    {
      label: 'Avg Risk Score',
      value: dashboard?.avgRiskScore?.toFixed(1) || '0.0',
      change: dashboard?.avgRiskTrend >= 0 ? `+${(dashboard?.avgRiskTrend || 0).toFixed(1)}` : `${(dashboard?.avgRiskTrend || 0).toFixed(1)}`,
      trend: (dashboard?.avgRiskTrend || 0) >= 0 ? 'up' : 'down',
      icon: BarChart3,
    },
  ]

  // Build risk distribution from dashboard
  const riskDistribution = [
    { level: 'Low', count: dashboard?.lowRiskCount || 0, color: '#2ED573' },
    { level: 'Medium', count: dashboard?.mediumRiskCount || 0, color: '#FDCB6E' },
    { level: 'High', count: dashboard?.highRiskCount || 0, color: '#FF4757' },
  ]

  // Get max changes for progress bar calculation
  const maxChanges = Math.max(...topResources.map((r: { changeCount?: number }) => r.changeCount || 0), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track change trends and risk patterns
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
          <SelectTrigger className="w-36">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      stat.trend === 'up' ? 'text-emerald-500' : 'text-red-500'
                    )}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-muted-foreground">vs last period</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Changes Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Change Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {changesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={changesTrend}>
                    <defs>
                      <linearGradient id="colorChanges" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A17CFF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#A17CFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#ffffff40" 
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#ffffff40" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#110C2A',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="changes"
                      stroke="#A17CFF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorChanges)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                  <XAxis type="number" stroke="#ffffff40" fontSize={12} tickLine={false} />
                  <YAxis 
                    type="category" 
                    dataKey="level" 
                    stroke="#ffffff40" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#110C2A',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]}
                    fill="#5814BA"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Most Active Resources</CardTitle>
        </CardHeader>
        <CardContent>
          {topResources.length > 0 ? (
            <div className="space-y-4">
              {topResources.slice(0, 5).map((resource: { resourceId: string; name: string; changeCount: number }, i: number) => (
                <div key={resource.resourceId} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{resource.name}</span>
                      <span className="text-sm text-muted-foreground">{resource.changeCount} changes</span>
                    </div>
                    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        style={{ width: `${(resource.changeCount / maxChanges) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No resource data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
