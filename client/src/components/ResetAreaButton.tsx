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
  mobileButtonLabel,
}: {
  area: ResetArea;
  label: string;
  onReset?: () => void;
  compact?: boolean;
  mobileButtonLabel?: string;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
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
        className="border-rose-200 bg-rose-50 text-rose-700 shadow-xs hover:bg-rose-100"
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {mobileButtonLabel ? (
          <>
            <span className="sm:hidden">{mobileButtonLabel}</span>
            <span className="hidden sm:inline">
              {compact ? "Zurücksetzen" : `${label} zurücksetzen`}
            </span>
          </>
        ) : (
          (compact ? "Zurücksetzen" : `${label} zurücksetzen`)
        )}
      </Button>
      <AdminPasswordDialog
        open={open}
        onOpenChange={setOpen}
        title={`${label} zurücksetzen?`}
        description={`Alle Einträge im Bereich „${label}“ werden ausschließlich für das aktuell gewählte Veranstaltungsjahr dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Daten endgültig löschen"
        busy={reset.isPending}
        onConfirm={adminPassword => reset.mutate({ area, adminPassword })}
      />
    </>
  );
}
