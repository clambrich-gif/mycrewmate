import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ResetArea =
  | "contacts"
  | "helpers"
  | "shifts"
  | "prep"
  | "post"
  | "materials"
  | "marketing"
  | "approvals"
  | "cakes"
  | "finances"
  | "all";

export function ResetAreaButton({
  area,
  label,
  onReset,
  compact = false,
}: {
  area: ResetArea;
  label: string;
  onReset?: () => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const deletesHelpers = area === "helpers" || area === "all";
  const { data: contacts = [] } = trpc.contacts.list.useQuery(undefined, {
    enabled: user?.role === "admin" && deletesHelpers,
  });
  const reset = trpc.reset.area.useMutation({
    onSuccess: async () => {
      setOpen(false);
      await utils.invalidate();
      onReset?.();
      toast.success(`${label} wurde für das gewählte Jahr zurückgesetzt`);
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return null;
  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {compact ? "Zurücksetzen" : `${label} zurücksetzen`}
      </Button>
      <AdminPasswordDialog
        open={open}
        onOpenChange={setOpen}
        title={`${label} zurücksetzen?`}
        description={`Alle Einträge im Bereich „${label}“ werden ausschließlich für das aktuell gewählte Veranstaltungsjahr dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Daten endgültig löschen"
        busy={reset.isPending}
        responsibleContacts={contacts}
        requireResponsibleContact={deletesHelpers}
        onConfirm={(adminPassword, responsibleContactId) =>
          reset.mutate({ area, adminPassword, responsibleContactId })
        }
      />
    </>
  );
}
