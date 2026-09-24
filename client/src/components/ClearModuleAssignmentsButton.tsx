import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { Button } from "@/components/ui/button";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { trpc } from "@/lib/trpc";
import { UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ModuleAssignmentArea = "prep" | "post" | "materials";

const RESET_DETAILS: Record<
  ModuleAssignmentArea,
  { description: string; successNoun: string; emptyMessage: string }
> = {
  prep: {
    description:
      "Alle Verantwortlichen und Fristen werden geleert, der Status aller Vorbereitungsaufgaben auf „Offen“ gesetzt und alle Logbucheinträge entfernt. Die Aufgaben selbst bleiben vollständig erhalten.",
    successNoun: "Vorbereitungsaufgabe(n)",
    emptyMessage: "Es waren keine Vorbereitungsaufgaben vorhanden.",
  },
  post: {
    description:
      "Alle Verantwortlichen und Fristen werden geleert, der Status aller Nachbereitungsaufgaben auf „Offen“ gesetzt und alle Logbucheinträge entfernt. Die Aufgaben selbst bleiben vollständig erhalten.",
    successNoun: "Nachbereitungsaufgabe(n)",
    emptyMessage: "Es waren keine Nachbereitungsaufgaben vorhanden.",
  },
  materials: {
    description:
      "Alle Verantwortlichen werden geleert und der Stand sämtlicher Materialartikel auf „Offen“ zurückgesetzt. Die Artikel, Mengen, Orte und Bemerkungen bleiben vollständig erhalten.",
    successNoun: "Materialartikel",
    emptyMessage: "Es waren keine Materialartikel vorhanden.",
  },
};

/**
 * Setzt nur die operativen Belegungsfelder eines Moduls zurück. Anders als der
 * globale Bereichsreset werden dabei keine Aufgaben oder Artikel gelöscht.
 */
export function ClearModuleAssignmentsButton({
  area,
  label,
}: {
  area: ModuleAssignmentArea;
  label: string;
}) {
  const { isTenantAdmin } = useTenantAdministration();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const details = RESET_DETAILS[area];

  const clearAssignments = trpc.moduleAssignments.clear.useMutation({
    onSuccess: async result => {
      setOpen(false);
      if (area === "prep") await utils.prep.list.invalidate();
      if (area === "post") await utils.post.list.invalidate();
      if (area === "materials") await utils.materials.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(
        result.cleared
          ? `${result.cleared} ${details.successNoun} wurden zurückgesetzt. Die Einträge bleiben erhalten.`
          : details.emptyMessage
      );
    },
    onError: error => toast.error(error.message),
  });

  if (!isTenantAdmin) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="inline-flex items-center gap-2 whitespace-nowrap border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 shadow-xs has-[>svg]:px-3 hover:bg-rose-100"
        onClick={() => setOpen(true)}
      >
        <UserMinus className="h-4 w-4" />
        Belegungen leeren
      </Button>
      <AdminPasswordDialog
        open={open}
        onOpenChange={setOpen}
        title="Möchtest du wirklich alle Belegungen leeren?"
        description={`${details.description} Diese Aktion betrifft nur die aktuell gewählte Veranstaltung.`}
        confirmLabel={`${label} zurücksetzen`}
        busy={clearAssignments.isPending}
        onConfirm={adminPassword => clearAssignments.mutate({ area, adminPassword })}
      />
    </>
  );
}
