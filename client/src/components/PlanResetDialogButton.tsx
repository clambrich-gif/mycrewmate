import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { Button } from "@/components/ui/button";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { RotateCcw, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type ConsolidatedResetArea =
  | "helpers"
  | "shifts"
  | "prep"
  | "post"
  | "materials";
type ResetChoice = "assignments" | "all";

type ResetCopy = {
  clearChoiceLabel: string;
  clearDescription: string;
  clearConfirmLabel: string;
  clearSuccess: (count: number) => string;
  clearEmpty: string;
  deleteDescription: string;
  deleteSuccess: string;
};

export const CONSOLIDATED_RESET_COPY: Record<ConsolidatedResetArea, ResetCopy> = {
  helpers: {
    clearChoiceLabel: "Komplette Belegung leeren",
    clearDescription:
      "Alle Helfer bleiben bestehen. Ansprechpartner, Hinweise für PDF und zusätzliche Begleitungen werden entfernt. Helfen wird auf „Ja“, alle Tagesverfügbarkeiten auf „Vielleicht“ und Bestätigt auf „Nein“ zurückgesetzt. Namen, Telefon, E-Mail und bestehende Einsatzplan-Schichten bleiben erhalten.",
    clearConfirmLabel: "Helfer zurücksetzen",
    clearSuccess: count =>
      `${count} Helfer wurden auf den Ausgangszustand zurückgesetzt. Die Helferliste bleibt erhalten.`,
    clearEmpty: "Es waren keine Helfer vorhanden.",
    deleteDescription:
      "Alle Helfer der aktuell gewählten Veranstaltung werden dauerhaft gelöscht. Ansprechpartner und alle übrigen Planungsdaten bleiben erhalten.",
    deleteSuccess: "Der komplette Helferplan wurde gelöscht.",
  },
  shifts: {
    clearChoiceLabel: "Belegungen leeren",
    clearDescription:
      "Alle eingeteilten Helfer werden aus den Schichten der aktuell gewählten Veranstaltung entfernt. Schichten, Bereiche, Aufgaben und Bereichsansprechpartner bleiben erhalten.",
    clearConfirmLabel: "Helfer austragen",
    clearSuccess: count =>
      `${count} Helferzuweisung(en) wurden entfernt. Die Schichten bleiben erhalten.`,
    clearEmpty:
      "Es waren keine Helferzuweisungen vorhanden. Die Schichten bleiben erhalten.",
    deleteDescription:
      "Alle Schichten, Bereichsansprechpartner und Helferzuweisungen der aktuell gewählten Veranstaltung werden dauerhaft gelöscht.",
    deleteSuccess: "Der komplette Einsatzplan wurde gelöscht.",
  },
  prep: {
    clearChoiceLabel: "Belegungen leeren",
    clearDescription:
      "Alle Verantwortlichen und Fristen werden geleert, der Status aller Vorbereitungsaufgaben auf „Offen“ gesetzt und alle Logbucheinträge entfernt. Die Aufgaben selbst bleiben erhalten.",
    clearConfirmLabel: "Belegungen leeren",
    clearSuccess: count =>
      `${count} Vorbereitungsaufgabe(n) wurden zurückgesetzt. Die Aufgaben bleiben erhalten.`,
    clearEmpty: "Es waren keine Vorbereitungsaufgaben vorhanden.",
    deleteDescription:
      "Alle Vorbereitungsaufgaben der aktuell gewählten Veranstaltung werden dauerhaft gelöscht.",
    deleteSuccess: "Die komplette Vorbereitung wurde gelöscht.",
  },
  post: {
    clearChoiceLabel: "Belegungen leeren",
    clearDescription:
      "Alle Verantwortlichen und Fristen werden geleert, der Status aller Nachbereitungsaufgaben auf „Offen“ gesetzt und alle Logbucheinträge entfernt. Die Aufgaben selbst bleiben erhalten.",
    clearConfirmLabel: "Belegungen leeren",
    clearSuccess: count =>
      `${count} Nachbereitungsaufgabe(n) wurden zurückgesetzt. Die Aufgaben bleiben erhalten.`,
    clearEmpty: "Es waren keine Nachbereitungsaufgaben vorhanden.",
    deleteDescription:
      "Alle Nachbereitungsaufgaben der aktuell gewählten Veranstaltung werden dauerhaft gelöscht.",
    deleteSuccess: "Die komplette Nachbereitung wurde gelöscht.",
  },
  materials: {
    clearChoiceLabel: "Belegungen leeren",
    clearDescription:
      "Alle Verantwortlichen werden geleert und der Stand sämtlicher Materialartikel auf „Offen“ zurückgesetzt. Artikel, Mengen, Orte und Bemerkungen bleiben erhalten.",
    clearConfirmLabel: "Belegungen leeren",
    clearSuccess: count =>
      `${count} Materialartikel wurden zurückgesetzt. Die Artikel bleiben erhalten.`,
    clearEmpty: "Es waren keine Materialartikel vorhanden.",
    deleteDescription:
      "Alle Materialartikel der aktuell gewählten Veranstaltung werden dauerhaft gelöscht.",
    deleteSuccess: "Der komplette Materialplan wurde gelöscht.",
  },
};

/**
 * Bündelt die beiden Resetwege der operativen Module. Erst wird eine
 * Wahl getroffen; die Datenänderung folgt ausschließlich nach Passwortbestätigung.
 */
export function PlanResetDialogButton({
  area,
  label,
  onCompleted,
  triggerClassName = "",
}: {
  area: ConsolidatedResetArea;
  label: string;
  onCompleted?: () => void;
  triggerClassName?: string;
}) {
  const { isTenantAdmin } = useTenantAdministration();
  const utils = trpc.useUtils();
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<ResetChoice | null>(
    null
  );
  const copy = CONSOLIDATED_RESET_COPY[area];

  const finish = async (message: string) => {
    setSelectedChoice(null);
    await utils.invalidate();
    onCompleted?.();
    toast.success(message);
  };

  const clearPlanAssignments = trpc.plan.clearAssignments.useMutation({
    onSuccess: result =>
      finish(
        result.cleared ? copy.clearSuccess(result.cleared) : copy.clearEmpty
      ),
    onError: error => toast.error(error.message),
  });
  const clearModuleAssignments = trpc.moduleAssignments.clear.useMutation({
    onSuccess: result =>
      finish(
        result.cleared ? copy.clearSuccess(result.cleared) : copy.clearEmpty
      ),
    onError: error => toast.error(error.message),
  });
  const deleteEntirePlan = trpc.reset.area.useMutation({
    onSuccess: () => finish(copy.deleteSuccess),
    onError: error => toast.error(error.message),
  });

  if (!isTenantAdmin) return null;

  const busy =
    clearPlanAssignments.isPending ||
    clearModuleAssignments.isPending ||
    deleteEntirePlan.isPending;
  const isAssignmentChoice = selectedChoice === "assignments";

  const choose = (choice: ResetChoice) => {
    setChoiceDialogOpen(false);
    setSelectedChoice(choice);
  };

  const confirm = (adminPassword: string) => {
    if (selectedChoice === "assignments") {
      if (area === "shifts") {
        clearPlanAssignments.mutate({ adminPassword });
      } else {
        clearModuleAssignments.mutate({ area, adminPassword });
      }
      return;
    }
    if (selectedChoice === "all") {
      deleteEntirePlan.mutate({ area, adminPassword });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`inline-flex items-center gap-2 whitespace-nowrap border-rose-200 bg-rose-50 px-3.5 py-1.5 text-rose-700 shadow-xs has-[>svg]:px-3.5 hover:bg-rose-100 ${triggerClassName}`}
        onClick={() => setChoiceDialogOpen(true)}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Zurücksetzen
      </Button>

      <Dialog
        open={choiceDialogOpen}
        onOpenChange={nextOpen => {
          if (!busy) setChoiceDialogOpen(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{label} zurücksetzen</DialogTitle>
            <DialogDescription>
              Wähle aus, ob nur die operativen Belegungen zurückgesetzt oder
              alle Einträge dieses Moduls dauerhaft gelöscht werden sollen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-32 items-start justify-start whitespace-normal border-amber-200 bg-amber-50 p-4 text-left text-amber-950 hover:bg-amber-100"
              onClick={() => choose("assignments")}
            >
              <UserMinus
                className="mt-0.5 size-5 shrink-0 text-amber-700"
                aria-hidden="true"
              />
              <span className="space-y-1.5">
                <span className="block font-semibold">
                  {copy.clearChoiceLabel}
                </span>
                <span className="block text-xs font-normal leading-relaxed">
                  {copy.clearDescription}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-32 items-start justify-start whitespace-normal border-red-200 bg-red-50 p-4 text-left text-red-900 hover:bg-red-100"
              onClick={() => choose("all")}
            >
              <Trash2
                className="mt-0.5 size-5 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span className="space-y-1.5">
                <span className="block font-semibold">Kompletten Plan löschen</span>
                <span className="block text-xs font-normal leading-relaxed">
                  {copy.deleteDescription}
                </span>
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setChoiceDialogOpen(false)}
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={selectedChoice !== null}
        onOpenChange={open => {
          if (!open && !busy) setSelectedChoice(null);
        }}
        title={
          isAssignmentChoice
            ? `${copy.clearChoiceLabel}?`
            : `Kompletten ${label} löschen?`
        }
        description={
          isAssignmentChoice
            ? copy.clearDescription
            : `${copy.deleteDescription} Diese Aktion kann nicht rückgängig gemacht werden.`
        }
        confirmLabel={
          isAssignmentChoice ? copy.clearConfirmLabel : "Kompletten Plan löschen"
        }
        busy={busy}
        onConfirm={confirm}
      />
    </>
  );
}
