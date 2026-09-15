import { useAuth } from "@/_core/hooks/useAuth";
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
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function CopyPreviousPlanButton() {
  const { user } = useAuth();
  const { year, eventId } = useEventYear();
  const utils = trpc.useUtils();
  const { data: allEvents = [] } = trpc.events.all.useQuery();
  const sourceEvents = useMemo(
    () =>
      allEvents
        .filter(item => item.id !== eventId)
        .sort((left, right) =>
          right.year === left.year
            ? left.name.localeCompare(right.name, "de")
            : right.year - left.year
        ),
    [allEvents, eventId]
  );
  const [open, setOpen] = useState(false);
  const [sourceEventId, setSourceEventId] = useState(0);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    const previous =
      sourceEvents.find(item => item.year < year) ?? sourceEvents[0];
    setSourceEventId(previous?.id ?? 0);
  }, [sourceEvents, year]);

  const copy = trpc.years.copyPlan.useMutation({
    onSuccess: async result => {
      setOpen(false);
      setAdminPassword("");
      await utils.invalidate();
      toast.success(
        `Aus „${result.sourceEvent}“ übernommen: ${result.shiftsCreated} Schichten, ${result.helpersCreated} Helfer und ${result.assignmentsCreated} Zuordnungen`
      );
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return null;
  return (
    <>
      <Button
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100"
        onClick={() => setOpen(true)}
        disabled={!sourceEvents.length}
      >
        <Copy className="mr-2 h-4 w-4" /> Plan übernehmen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle>
              Planung in die aktuelle Veranstaltung übernehmen
            </DialogTitle>
            <DialogDescription>
              Schichten, Bereichsansprechpartner, Helfer und Zuordnungen werden
              aus der gewählten Veranstaltung ergänzt. Vorhandene Einträge
              werden nicht doppelt angelegt. Enthält die Quelle Schichten an
              Tagen, die in der Zielveranstaltung nicht aktiv sind, wird die
              Übernahme vollständig abgebrochen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Quellveranstaltung</Label>
              <Select
                value={sourceEventId ? String(sourceEventId) : undefined}
                onValueChange={value => setSourceEventId(Number(value))}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Veranstaltung auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {sourceEvents.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.year} · {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copy-admin-password">Administratorpasswort</Label>
              <Input
                id="copy-admin-password"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={event => setAdminPassword(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!adminPassword || !sourceEventId || copy.isPending}
              onClick={() => copy.mutate({ sourceEventId, adminPassword })}
            >
              {copy.isPending
                ? "Wird übernommen …"
                : "In aktuelle Veranstaltung übernehmen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
