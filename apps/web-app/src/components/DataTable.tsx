/**
 * DataTable Component
 * 
 * A reusable table component with built-in sorting and pagination.
 * Designed for Phase 1 requirements: sortable, paginated tables.
 */
import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc' | null

export interface Column<T> {
  id: string
  header: string
  accessorKey?: keyof T
  accessorFn?: (row: T) => React.ReactNode
  sortable?: boolean
  sortFn?: (a: T, b: T) => number
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  pageSizeOptions?: number[]
  onRowClick?: (row: T) => void
  getRowId?: (row: T) => string
  emptyMessage?: string
}

export function DataTable<T>({
  data,
  columns,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  onRowClick,
  getRowId,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Handle sorting
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(columnId)
      setSortDirection('asc')
    }
  }

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data

    const column = columns.find(c => c.id === sortColumn)
    if (!column) return data

    return [...data].sort((a, b) => {
      let comparison = 0

      if (column.sortFn) {
        comparison = column.sortFn(a, b)
      } else if (column.accessorKey) {
        const aVal = a[column.accessorKey]
        const bVal = b[column.accessorKey]

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal)
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime()
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }
      }

      return sortDirection === 'desc' ? -comparison : comparison
    })
  }, [data, sortColumn, sortDirection, columns])

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  // Reset to page 1 when data changes
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4" />
    }
    return <ChevronDown className="h-4 w-4" />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.sortable && 'cursor-pointer select-none hover:bg-muted/50',
                    column.className
                  )}
                  onClick={column.sortable ? () => handleSort(column.id) : undefined}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && getSortIcon(column.id)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow
                  key={getRowId ? getRowId(row) : index}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.accessorFn
                        ? column.accessorFn(row)
                        : column.accessorKey
                        ? String(row[column.accessorKey] ?? '')
                        : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
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
        Showing {paginatedData.length} of {data.length} results
      </div>
    </div>
  )
}
