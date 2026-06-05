/**
 * Empty State Component
 * 
 * Reusable component for displaying empty/no-data states consistently.
 * Supports icon, title, description, and optional action button.
 */
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@clausync/ui'
import { cn } from '@clausync/ui'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionButton = action ? (
    <Button
      onClick={action.onClick}
      className="mt-4"
      asChild={!!action.href}
    >
      {action.href ? (
        <Link to={action.href}>
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Link>
      ) : (
        <>
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </>
      )}
    </Button>
  ) : null

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-surface-2/50 border border-border/50">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {ActionButton}
    </div>
  )
}
