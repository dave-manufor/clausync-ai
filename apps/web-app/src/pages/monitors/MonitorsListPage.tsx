import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  MoreHorizontal,
  ExternalLink,
  Pause,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { useMonitors, useDeleteMonitor } from '@/lib/api-hooks'
import { toast } from 'sonner'

const statusColors = {
  active: 'bg-[#2ED573]/10 text-[#2ED573]',
  inactive: 'bg-muted text-muted-foreground',
}

type SortField = 'url' | 'status' | 'lastChecked' | null
type SortDirection = 'asc' | 'desc'

function getDisplayName(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function MonitorsListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  })
  
  const { data: monitors, isLoading, error, refetch } = useMonitors()
  const deleteMonitor = useDeleteMonitor()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
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

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name })
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteMonitor.mutateAsync(deleteConfirm.id)
      toast.success('Monitor deleted successfully')
    } catch {
      toast.error('Failed to delete monitor')
    }
  }

  // Filter, sort, and paginate
  const processedMonitors = useMemo(() => {
    let result = monitors?.filter((m) =>
      (m.resource?.urlNormalized?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       m.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
    ) ?? []

    // Sort
    if (sortField) {
      result = [...result].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
          case 'url':
            const aName = a.displayName || a.resource?.urlNormalized || ''
            const bName = b.displayName || b.resource?.urlNormalized || ''
            comparison = aName.localeCompare(bName)
            break
          case 'status':
            const aActive = !!a.resource?.currentHash
            const bActive = !!b.resource?.currentHash
            comparison = aActive === bActive ? 0 : aActive ? -1 : 1
            break
          case 'lastChecked':
            const aDate = a.resource?.lastScrapedAt ? new Date(a.resource.lastScrapedAt).getTime() : 0
            const bDate = b.resource?.lastScrapedAt ? new Date(b.resource.lastScrapedAt).getTime() : 0
            comparison = aDate - bDate
            break
        }
        return sortDirection === 'desc' ? -comparison : comparison
      })
    }

    return result
  }, [monitors, searchQuery, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(processedMonitors.length / pageSize)
  const paginatedMonitors = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return processedMonitors.slice(start, start + pageSize)
  }, [processedMonitors, currentPage, pageSize])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load monitors</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-muted-foreground">
            Track changes in your service agreements
          </p>
        </div>
        <Button asChild>
          <Link to="/monitors/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Monitor
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search monitors..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitors Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">
            All Monitors {isLoading ? '' : `(${processedMonitors.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('url')}
                >
                  <div className="flex items-center">
                    Name / URL
                    {getSortIcon('url')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Selector</TableHead>
                <TableHead 
                  className="text-xs uppercase text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('lastChecked')}
                >
                  <div className="flex items-center">
                    Last Checked
                    {getSortIcon('lastChecked')}
                  </div>
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedMonitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery ? 'No monitors match your search' : 'No monitors yet'}
                    </div>
                    {!searchQuery && (
                      <Button asChild variant="outline" className="mt-4">
                        <Link to="/monitors/new">
                          <Link to="/monitors/new">
                            <Plus className="h-4 w-4 mr-2" />
                            Add your first monitor
                          </Link>
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMonitors.map((monitor) => {
                  const isActive = !!monitor.resource?.currentHash
                  return (
                    <TableRow 
                      key={monitor.id} 
                      className="cursor-pointer"
                      onClick={() => navigate(`/monitors/${monitor.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium hover:text-[#A17CFF]">
                          {monitor.displayName || getDisplayName(monitor.resource?.urlNormalized || '')}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          {monitor.resource?.urlNormalized}
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={isActive ? statusColors.active : statusColors.inactive}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                            isActive ? 'bg-[#2ED573]' : 'bg-muted-foreground'
                          }`} />
                          {isActive ? 'active' : 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {monitor.resource?.selector || 'body'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {monitor.resource?.lastScrapedAt
                          ? new Date(monitor.resource.lastScrapedAt).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Check Now
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pause className="h-4 w-4 mr-2" />
                              {isActive ? 'Pause' : 'Resume'} Monitor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(
                                  monitor.id,
                                  monitor.resource?.urlNormalized || 'this monitor'
                                )
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      {totalPages > 1 && (
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
              Page {currentPage} of {totalPages}
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
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show total count */}
      <div className="text-sm text-muted-foreground">
        Showing {paginatedMonitors.length} of {processedMonitors.length} monitors
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Monitor"
        description="This will permanently delete this monitor and all its change history. This action cannot be undone."
        itemName={deleteConfirm.name}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMonitor.isPending}
      />
    </div>
  )
}
