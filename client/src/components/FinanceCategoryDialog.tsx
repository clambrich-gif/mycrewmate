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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { toast } from "sonner";

export type FinanceCategory = {
  id: number;
  category: string;
  income: number;
  expense: number;
  note: string | null;
};

/** Decimal input stays in euros; only integer cents cross the API boundary. */
export function financeInputCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 2_147_483_647
    ? cents
    : null;
}

export function FinanceCategoryDialog({
  row,
  onClose,
  canWrite,
}: {
  row: FinanceCategory | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState(row?.category ?? "");
  const [income, setIncome] = useState(
    ((row?.income ?? 0) / 100).toFixed(2).replace(".", ",")
  );
  const [expense, setExpense] = useState(
    ((row?.expense ?? 0) / 100).toFixed(2).replace(".", ",")
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const create = trpc.finances.create.useMutation();
  const update = trpc.finances.update.useMutation();

  const save = async () => {
    if (!canWrite || requestInFlight.current) return;
    const incomeCents = financeInputCents(income);
    const expenseCents = financeInputCents(expense);
    if (!category.trim()) {
      setError("Bitte eine Kategorie eingeben.");
      return;
    }
    if (incomeCents === null || expenseCents === null) {
      setError(
        "Bitte nichtnegative Euro-Werte mit höchstens zwei Nachkommastellen eingeben (z. B. 12,50)."
      );
      return;
    }
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const values = { category: category.trim(), incomeCents, expenseCents };
      if (row) {
        // Editing amounts never replaces the append-only notebook.
        await update.mutateAsync({ id: row.id, ...values });
      } else {
        await create.mutateAsync({
          ...values,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      await utils.finances.list.invalidate();
      void utils.dashboard.invalidate();
      toast.success(row ? "Kategorie gespeichert" : "Kategorie angelegt");
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Kategorie konnte nicht gespeichert werden."
      );
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !requestInFlight.current) onClose();
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>
            {row ? "Kategorie bearbeiten" : "Neue Kategorie"}
          </DialogTitle>
          <DialogDescription>
            Kategorie sowie Einnahmen und Ausgaben gemeinsam speichern. Der
            Saldo wird automatisch berechnet.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="finance-category">Kategorie</Label>
            <Input
              id="finance-category"
              value={category}
              onChange={event => setCategory(event.target.value)}
              maxLength={160}
              disabled={busy || !canWrite}
              autoFocus
              required
              className="text-base"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="finance-income">Einnahmen (€)</Label>
              <Input
                id="finance-income"
                inputMode="decimal"
                value={income}
                onChange={event => setIncome(event.target.value)}
                disabled={busy || !canWrite}
                className="text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-expense">Ausgaben (€)</Label>
              <Input
                id="finance-expense"
                inputMode="decimal"
                value={expense}
                onChange={event => setExpense(event.target.value)}
                disabled={busy || !canWrite}
                className="text-base"
              />
            </div>
          </div>
          {!row && (
            <div className="space-y-1.5">
              <Label htmlFor="finance-first-note">Erste Notiz (optional)</Label>
              <Textarea
                id="finance-first-note"
                value={note}
                onChange={event => setNote(event.target.value)}
                disabled={busy || !canWrite}
                maxLength={9_000}
                className="min-h-24 text-base"
              />
              <p className="text-xs text-muted-foreground">
                Wird mit Datum, Uhrzeit und deinem Namen im Notizbuch abgelegt.
              </p>
            </div>
          )}
          {row && (
            <p className="text-xs text-muted-foreground">
              Weitere Notizen ergänzt du im Notizbuch der Kategorie. Bestehende
              Einträge bleiben erhalten.
            </p>
          )}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !canWrite || !category.trim()}
            >
              {busy ? "Speichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
