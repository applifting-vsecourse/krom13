import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type DeleteQuackDialogProps = {
  quackId: string
  hasPoll: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteQuackDialog({
  quackId,
  hasPoll,
  isOpen,
  onOpenChange,
}: DeleteQuackDialogProps) {
  const deleteQuack = useDeleteQuack()

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this quack?</DialogTitle>
          <DialogDescription>
            {hasPoll
              ? "The quack, its poll and everyone's votes will be deleted. This can't be undone."
              : "The quack will be deleted. This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        {deleteQuack.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={() => deleteQuack.mutate(quackId, { onSuccess: () => onOpenChange(false) })}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
