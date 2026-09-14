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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  busy = false,
  contacts,
  responsibleContactId,
  onResponsibleContactChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy?: boolean;
  contacts?: Array<{ id: number; name: string }>;
  responsibleContactId?: number | null;
  onResponsibleContactChange?: (contactId: number) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {contacts && onResponsibleContactChange && (
          <div className="space-y-2">
            <Label>Wer führt die Löschung durch?</Label>
            <Select
              value={responsibleContactId ? String(responsibleContactId) : ""}
              onValueChange={value => onResponsibleContactChange(Number(value))}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-900">
                <SelectValue placeholder="Ansprechpartner auswählen …" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map(contact => (
                  <SelectItem key={contact.id} value={String(contact.id)}>
                    {contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Diese Auswahl wird zusammen mit der Löschung im Protokoll
              gespeichert.
            </p>
          </div>
        )}
        <AlertDialogFooter className="flex-col sm:flex-row">
          <AlertDialogCancel className="w-full sm:w-auto" disabled={busy}>
            Nein, abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || Boolean(contacts && !responsibleContactId)}
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
