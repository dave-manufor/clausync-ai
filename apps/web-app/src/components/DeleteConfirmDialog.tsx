/**
 * Delete Confirmation Dialog
 * 
 * Reusable confirmation dialog for destructive actions.
 * Follows SOC 2 best practices for requiring explicit confirmation.
 */
import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  itemName?: string
  onConfirm: () => Promise<void> | void
  isDeleting?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = 'Delete Item',
  description = 'This action cannot be undone.',
  itemName,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false)

  const handleConfirm = async () => {
    setIsPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsPending(false)
    }
  }

  const loading = isDeleting || isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {description}
            {itemName && (
              <span className="block mt-2 font-medium text-foreground">
                "{itemName}"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
