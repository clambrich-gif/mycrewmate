import type { FinanceCategory } from "@/components/FinanceCategoryDialog";
import { TaskLogbookHistory } from "@/components/TaskLogbookHistory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function FinanceNotebookDialog({
  row,
  canWrite,
  onClose,
}: {
  row: FinanceCategory;
  canWrite: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const append = trpc.finances.appendNote.useMutation();

  const save = async () => {
    if (!canWrite || !text.trim() || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await append.mutateAsync({ id: row.id, text: text.trim() });
      setText("");
      await utils.finances.list.invalidate();
      toast.success("Notizbuch-Eintrag gespeichert");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Notiz konnte nicht gespeichert werden."
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
      <DialogContent className="sm:max-w-xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="break-words">
            Notizbuch: {row.category}
          </DialogTitle>
          <DialogDescription>
            Hinweise zur Kategorie bleiben mit Datum, Uhrzeit und Autor
            nachvollziehbar. Bestehende Einträge werden nicht überschrieben.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">Bisherige Notizen</p>
          <TaskLogbookHistory
            logbook={row.note}
            emptyMessage="Noch keine Notiz zu dieser Kategorie vorhanden."
          />
        </div>
        {canWrite && (
          <form
            onSubmit={event => {
              event.preventDefault();
              void save();
            }}
            className="space-y-3 border-t pt-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="finance-notebook-entry">
                Neuen Eintrag ergänzen
              </Label>
              <Textarea
                id="finance-notebook-entry"
                value={text}
                onChange={event => setText(event.target.value)}
                maxLength={9_000}
                disabled={busy}
                className="min-h-28 text-base"
                placeholder="Hinweis oder aktueller Sachstand …"
              />
              <p className="text-xs text-muted-foreground">
                Datum, Uhrzeit und dein Name werden beim Speichern automatisch
                ergänzt.
              </p>
            </div>
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
                Schließen
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={busy || !text.trim()}
              >
                {busy ? "Speichert …" : "Eintrag speichern"}
              </Button>
            </DialogFooter>
          </form>
        )}
        {!canWrite && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
