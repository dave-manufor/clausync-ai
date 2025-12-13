import { cn } from '@/lib/utils'

interface DiffViewerProps {
  before: string
  after: string
  className?: string
}

export function DiffViewer({ before, after, className }: DiffViewerProps) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  return (
    <div className={cn('font-mono text-sm rounded-lg border border-border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex border-b border-border bg-surface-2/50">
        <div className="flex-1 px-4 py-2 text-xs font-medium text-muted-foreground border-r border-border flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500/50" />
          Before
        </div>
        <div className="flex-1 px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
          After
        </div>
      </div>
      
      {/* Side by side view */}
      <div className="flex max-h-[500px] overflow-auto">
        {/* Before column */}
        <div className="flex-1 border-r border-border bg-surface-1 min-w-0">
          {beforeLines.map((line, i) => {
            const afterLine = afterLines[i]
            const isRemoved = afterLine === undefined || afterLine !== line
            return (
              <div
                key={i}
                className={cn(
                  'flex px-4 py-1 min-h-[28px] border-b border-white/5 transition-colors',
                  isRemoved && 'bg-red-500/10'
                )}
              >
                <span className="text-muted-foreground/40 select-none w-8 flex-shrink-0 text-right pr-4 text-xs">
                  {i + 1}
                </span>
                <span className={cn(
                  'break-all',
                  isRemoved && 'text-red-400 line-through decoration-red-500/50'
                )}>
                  {line || '\u00A0'}
                </span>
              </div>
            )
          })}
        </div>
        
        {/* After column */}
        <div className="flex-1 bg-surface-1 min-w-0">
          {afterLines.map((line, i) => {
            const beforeLine = beforeLines[i]
            const isAdded = beforeLine === undefined || beforeLine !== line
            return (
              <div
                key={i}
                className={cn(
                  'flex px-4 py-1 min-h-[28px] border-b border-white/5 transition-colors',
                  isAdded && 'bg-emerald-500/10'
                )}
              >
                <span className="text-muted-foreground/40 select-none w-8 flex-shrink-0 text-right pr-4 text-xs">
                  {i + 1}
                </span>
                <span className={cn(
                  'break-all',
                  isAdded && 'text-emerald-400 font-medium'
                )}>
                  {line || '\u00A0'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
