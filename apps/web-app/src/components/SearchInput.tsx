/**
 * Search Input Component
 * 
 * Reusable search input with debounce support and consistent styling.
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@clausync/ui'
import { Button } from '@clausync/ui'
import { cn } from '@clausync/ui'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
  isLoading?: boolean
}

export function SearchInput({
  value: externalValue,
  onChange,
  placeholder = 'Search...',
  className,
  debounceMs = 300,
  isLoading = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? '')

  // Sync internal value with external value
  useEffect(() => {
    if (externalValue !== undefined) {
      setInternalValue(externalValue)
    }
  }, [externalValue])

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(internalValue)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [internalValue, debounceMs, onChange])

  const handleClear = useCallback(() => {
    setInternalValue('')
    onChange('')
  }, [onChange])

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
      <Input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 h-9 bg-surface-2/50 border-white/5 focus-visible:bg-surface-2 transition-all"
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      ) : internalValue ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  )
}
