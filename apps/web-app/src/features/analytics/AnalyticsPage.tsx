import { useState } from 'react'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { AnalyticsPeriod } from '@/types'

// Mock data
const changesTrend = [
  { date: 'Dec 1', changes: 12, avgRisk: 4.2 },
  { date: 'Dec 2', changes: 8, avgRisk: 3.8 },
  { date: 'Dec 3', changes: 15, avgRisk: 5.1 },
  { date: 'Dec 4', changes: 6, avgRisk: 3.2 },
  { date: 'Dec 5', changes: 21, avgRisk: 6.8 },
  { date: 'Dec 6', changes: 9, avgRisk: 4.5 },
  { date: 'Dec 7', changes: 14, avgRisk: 5.0 },
  { date: 'Dec 8', changes: 18, avgRisk: 5.5 },
  { date: 'Dec 9', changes: 11, avgRisk: 4.0 },
  { date: 'Dec 10', changes: 16, avgRisk: 4.8 },
]

const riskDistribution = [
  { level: 'Low', count: 45, color: '#2ED573' },
  { level: 'Medium', count: 28, color: '#FDCB6E' },
  { level: 'High', count: 12, color: '#FF4757' },
]

const topResources = [
  { name: 'AWS Terms', changes: 24, trend: 'up' },
  { name: 'Stripe Agreement', changes: 18, trend: 'up' },
  { name: 'GitHub Terms', changes: 12, trend: 'down' },
  { name: 'Google Cloud TOS', changes: 9, trend: 'stable' },
  { name: 'Azure SLA', changes: 7, trend: 'up' },
]

const stats = [
  {
    label: 'Total Changes',
    value: '156',
    change: '+23%',
    trend: 'up',
    icon: Activity,
  },
  {
    label: 'High Risk',
    value: '12',
    change: '-5%',
    trend: 'down',
    icon: AlertTriangle,
  },
  {
    label: 'Avg Risk Score',
    value: '4.8',
    change: '+0.3',
    trend: 'up',
    icon: BarChart3,
  },
]

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

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
          <div className="space-y-4">
            {topResources.map((resource, i) => (
              <div key={resource.name} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{resource.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{resource.changes} changes</span>
                      {resource.trend === 'up' && (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      )}
                      {resource.trend === 'down' && (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${(resource.changes / 24) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
