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
  const { year } = useEventYear();
  const utils = trpc.useUtils();
  const { data: years = [] } = trpc.years.list.useQuery();
  const sourceYears = useMemo(
    () =>
      years
        .map(item => item.year)
        .filter(item => item !== year)
        .sort((a, b) => b - a),
    [years, year]
  );
  const [open, setOpen] = useState(false);
  const [sourceYear, setSourceYear] = useState(year - 1);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    const previous = sourceYears.find(item => item < year) ?? sourceYears[0];
    if (previous) setSourceYear(previous);
  }, [sourceYears, year]);

  const copy = trpc.years.copyPlan.useMutation({
    onSuccess: async result => {
      setOpen(false);
      setAdminPassword("");
      await utils.invalidate();
      toast.success(
        `Übernommen: ${result.shiftsCreated} Schichten, ${result.helpersCreated} Helfer und ${result.assignmentsCreated} Zuordnungen`
      );
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!sourceYears.length}
      >
        <Copy className="mr-2 h-4 w-4" /> Vorjahr übernehmen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einsatzplanung nach {year} übernehmen</DialogTitle>
            <DialogDescription>
              Schichten, benötigte Ansprechpartner, Helfer und vorhandene
              Zuordnungen werden aus dem gewählten Jahr ergänzt. Bereits
              vorhandene Einträge werden nicht doppelt angelegt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Quelljahr</Label>
              <Select
                value={String(sourceYear)}
                onValueChange={value => setSourceYear(Number(value))}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceYears.map(item => (
                    <SelectItem key={item} value={String(item)}>
                      {item}
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
              disabled={!adminPassword || copy.isPending}
              onClick={() => copy.mutate({ sourceYear, adminPassword })}
            >
              {copy.isPending ? "Wird übernommen …" : `Nach ${year} übernehmen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
