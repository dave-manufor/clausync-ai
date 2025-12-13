import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  RefreshCw, 
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useChanges } from '@/lib/api-hooks'
import { getRiskLevel, type RiskLevel } from '@/types'

const severityColors = {
  high: 'bg-[#FF4757]/10 text-[#FF4757] border-[#FF4757]/20',
  medium: 'bg-[#FDCB6E]/10 text-[#FDCB6E] border-[#FDCB6E]/20',
  low: 'bg-[#2ED573]/10 text-[#2ED573] border-[#2ED573]/20',
}

type SortField = 'resource' | 'risk' | 'date' | null
type SortDirection = 'asc' | 'desc'
type DateRange = '7d' | '30d' | '90d' | 'all'

export function ChangesListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<RiskLevel | 'all'>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: changes, isLoading, error, refetch } = useChanges()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (field === 'date') {
        // For date, just toggle between asc/desc
        setSortDirection('asc')
      } else {
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
    setCurrentPage(1)
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />
  }

  // Filter, sort, and paginate
  const processedChanges = useMemo(() => {
    let result = changes ?? []

    // Search filter
    result = result.filter((c) =>
      (c.resource?.urlNormalized?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
      (c.displayName?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
      (c.globalAiSummary?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
    )

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(c => getRiskLevel(c.globalRiskScore) === severityFilter)
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      const cutoff = new Date()
      switch (dateRange) {
        case '7d':
          cutoff.setDate(now.getDate() - 7)
          break
        case '30d':
          cutoff.setDate(now.getDate() - 30)
          break
        case '90d':
          cutoff.setDate(now.getDate() - 90)
          break
      }
      result = result.filter(c => new Date(c.createdAt) >= cutoff)
    }

    // Sort
    if (sortField) {
      result = [...result].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
          case 'resource':
            comparison = (a.resource?.urlNormalized || '').localeCompare(b.resource?.urlNormalized || '')
            break
          case 'risk':
            comparison = (a.globalRiskScore || 0) - (b.globalRiskScore || 0)
            break
          case 'date':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            break
        }
        return sortDirection === 'desc' ? -comparison : comparison
      })
    }

    return result
  }, [changes, searchQuery, severityFilter, dateRange, sortField, sortDirection])

  // Stats
  const highRisk = processedChanges.filter(c => getRiskLevel(c.globalRiskScore) === 'high').length
  const mediumRisk = processedChanges.filter(c => getRiskLevel(c.globalRiskScore) === 'medium').length
  const lowRisk = processedChanges.filter(c => getRiskLevel(c.globalRiskScore) === 'low').length

  // Pagination
  const totalPages = Math.ceil(processedChanges.length / pageSize)
  const paginatedChanges = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return processedChanges.slice(start, start + pageSize)
  }, [processedChanges, currentPage, pageSize])

  const clearFilters = () => {
    setSearchQuery('')
    setSeverityFilter('all')
    setDateRange('all')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchQuery || severityFilter !== 'all' || dateRange !== 'all'

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load changes</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Changes</h1>
          <p className="text-muted-foreground">
            All detected changes across your monitored documents
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search changes..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            
            {/* Severity Filter */}
            <Select
              value={severityFilter}
              onValueChange={(value) => {
                setSeverityFilter(value as RiskLevel | 'all')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select
              value={dateRange}
              onValueChange={(value) => {
                setDateRange(value as DateRange)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">
              {isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : processedChanges.length}
            </p>
            <p className="text-sm text-muted-foreground">Total Changes</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-[#FF4757]/50 transition-colors"
              onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#FF4757]">
              {isLoading ? <Skeleton className="h-9 w-8 mx-auto" /> : highRisk}
            </p>
            <p className="text-sm text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-[#FDCB6E]/50 transition-colors"
              onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#FDCB6E]">
              {isLoading ? <Skeleton className="h-9 w-8 mx-auto" /> : mediumRisk}
            </p>
            <p className="text-sm text-muted-foreground">Medium Risk</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-[#2ED573]/50 transition-colors"
              onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#2ED573]">
              {isLoading ? <Skeleton className="h-9 w-8 mx-auto" /> : lowRisk}
            </p>
            <p className="text-sm text-muted-foreground">Low Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Changes Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Recent Changes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-4"></TableHead>
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('resource')}
                >
                  <div className="flex items-center">
                    Resource
                    {getSortIcon('resource')}
                  </div>
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Change Type</TableHead>
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('risk')}
                >
                  <div className="flex items-center">
                    Risk
                    {getSortIcon('risk')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    {getSortIcon('date')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-2 w-2 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedChanges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {hasActiveFilters ? 'No changes match your filters' : 'No changes detected yet'}
                    {hasActiveFilters && (
                      <Button variant="link" onClick={clearFilters} className="ml-2">
                        Clear filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedChanges.map((change) => {
                  const riskLevel = getRiskLevel(change.globalRiskScore)
                  return (
                    <TableRow 
                      key={change.id} 
                      className="cursor-pointer"
                      onClick={() => navigate(`/changes/${change.id}`)}
                    >
                      <TableCell className="w-4">
                        <span
                          className={`block h-2 w-2 rounded-full ${
                            riskLevel === 'high'
                              ? 'bg-[#FF4757] animate-pulse'
                              : riskLevel === 'medium'
                              ? 'bg-[#FDCB6E]'
                              : 'bg-[#2ED573]'
                          }`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium hover:text-[#A17CFF]">
                          {change.displayName || change.resource?.urlNormalized || 'Unknown Resource'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {change.globalAiSummary || 'No summary available'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{change.riskKeywords?.join(', ') || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={severityColors[riskLevel]}
                        >
                          {riskLevel} ({change.globalRiskScore ?? 0}/10)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(change.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {paginatedChanges.length} of {processedChanges.length} changes
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                {currentPage} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
