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
import { useEffect, useState } from "react";

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
  useEffect(() => {
    if (!open) {
      setPassword("");
      setResponsibleContactId(null);
    }
  }, [open]);
  const canConfirm =
    Boolean(password) &&
    (!requireResponsibleContact || Boolean(responsibleContactId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && canConfirm)
                onConfirm(password, responsibleContactId ?? undefined);
            }}
          />
        </div>
        {requireResponsibleContact && responsibleContacts && (
          <div className="space-y-2">
            <Label>Wer führt die Löschung durch?</Label>
            <Select
              value={responsibleContactId ? String(responsibleContactId) : ""}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!canConfirm || busy}
            onClick={() =>
              onConfirm(password, responsibleContactId ?? undefined)
            }
          >
            {busy ? "Wird ausgeführt …" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
