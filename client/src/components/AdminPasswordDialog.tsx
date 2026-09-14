import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AdminPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy = false,
  destructive = true,
  responsibleContacts,
  requireResponsibleContact = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  responsibleContacts?: Array<{ id: number; name: string }>;
  requireResponsibleContact?: boolean;
  onConfirm: (adminPassword: string, responsibleContactId?: number) => void;
}) {
  const [password, setPassword] = useState("");
  const [responsibleContactId, setResponsibleContactId] = useState<
    number | null
  >(null);
  const submitLocked = useRef(false);
  useEffect(() => {
    if (!open) {
      setPassword("");
      setResponsibleContactId(null);
      submitLocked.current = false;
    }
  }, [open]);
  useEffect(() => {
    if (!busy) submitLocked.current = false;
  }, [busy]);
  const canConfirm =
    !busy &&
    Boolean(password) &&
    (!requireResponsibleContact || Boolean(responsibleContactId));

  const confirm = () => {
    if (!canConfirm || submitLocked.current) return;
    submitLocked.current = true;
    onConfirm(password, responsibleContactId ?? undefined);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        aria-busy={busy}
        showCloseButton={!busy}
        onEscapeKeyDown={event => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={event => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="admin-confirm-password">Administratorpasswort</Label>
          <Input
            id="admin-confirm-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") confirm();
            }}
          />
        </div>
        {requireResponsibleContact && responsibleContacts && (
          <div className="space-y-2">
            <Label>Wer führt die Löschung durch?</Label>
            <Select
              value={responsibleContactId ? String(responsibleContactId) : ""}
              disabled={busy}
              onValueChange={value => setResponsibleContactId(Number(value))}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-900">
                <SelectValue placeholder="Ansprechpartner auswählen …" />
              </SelectTrigger>
              <SelectContent>
                {responsibleContacts.map(contact => (
                  <SelectItem key={contact.id} value={String(contact.id)}>
                    {contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Der Name wird für jede gelöschte Helferzeile protokolliert.
            </p>
          </div>
        )}
        <DialogFooter className="sticky bottom-0 -mx-2 -mb-2 rounded-b-lg border-t bg-white px-2 pb-2 pt-4 dark:bg-slate-950">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className={cn(
              "w-full min-w-[150px] shadow-sm sm:w-auto",
              destructive &&
                "border border-red-700 !bg-red-600 !text-white hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-100 disabled:!text-red-800 disabled:opacity-100"
            )}
            disabled={!canConfirm}
            onClick={confirm}
          >
            {destructive && <Trash2 className="h-4 w-4" />}
            {busy ? "Wird ausgeführt …" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
