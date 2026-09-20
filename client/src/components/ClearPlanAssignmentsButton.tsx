import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Entfernt ausschließlich Helferzuweisungen der aktuellen Veranstaltung.
 * Schichten, Bereiche und Bereichsansprechpartner bleiben unverändert erhalten.
 */
export function ClearPlanAssignmentsButton({ onCleared }: { onCleared: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const clearAssignments = trpc.plan.clearAssignments.useMutation({
    onSuccess: async result => {
      setOpen(false);
      onCleared();
      await Promise.all([
        utils.plan.evaluate.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);
      toast.success(
        result.cleared
          ? `${result.cleared} Helferzuweisung(en) wurden entfernt. Die Schichten bleiben bestehen.`
          : "Es waren keine Helferzuweisungen vorhanden. Die Schichten bleiben bestehen."
      );
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="inline-flex items-center gap-2 whitespace-nowrap border-rose-200 bg-rose-50 text-rose-700 px-3 py-1.5 shadow-xs has-[>svg]:px-3 hover:bg-rose-100"
        onClick={() => setOpen(true)}
      >
        <UserMinus className="h-4 w-4" />
        Belegungen leeren
      </Button>
      <AdminPasswordDialog
        open={open}
        onOpenChange={setOpen}
        title="Helfer aus dem Einsatzplan austragen?"
        description="Alle eingeteilten Helfer werden aus den Schichten der aktuell gewählten Veranstaltung entfernt. Die Schichten, Bereiche, Aufgaben und Bereichsansprechpartner bleiben vollständig erhalten und können anschließend neu eingeteilt werden."
        confirmLabel="Nur Helfer austragen"
        busy={clearAssignments.isPending}
        onConfirm={adminPassword =>
          clearAssignments.mutate({ adminPassword })
        }
      />
    </>
  );
}
