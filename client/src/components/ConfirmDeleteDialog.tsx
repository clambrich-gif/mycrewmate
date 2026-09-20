import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row">
          <AlertDialogCancel className="w-full sm:w-auto" disabled={busy}>
            Nein, abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(
              buttonVariants({ variant: "destructive" }),
              "w-full min-w-[140px] border border-red-700 !bg-red-600 !text-white shadow-sm hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-100 disabled:!text-red-800 disabled:opacity-100 sm:w-auto"
            )}
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Wird gelöscht …" : "OK, löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
