import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
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
import { trpc } from "@/lib/trpc";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type LocationForm = { name: string; latitude: string; longitude: string };
const EMPTY_FORM: LocationForm = { name: "", latitude: "", longitude: "" };

export default function Locations() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: locations = [], isLoading } = trpc.locations.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const canManage = user?.role === "admin";
  const invalidate = () => {
    void utils.locations.list.invalidate();
    void utils.plan.evaluate.invalidate();
    void utils.prep.list.invalidate();
    void utils.dashboard.stats.invalidate();
  };
  const create = trpc.locations.create.useMutation({
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast.success("Ort angelegt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.locations.update.useMutation({
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast.success("Ort aktualisiert");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.locations.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Ort gelöscht; bestehende Zuordnungen wurden entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (location: (typeof locations)[number]) => {
    setEditingId(location.id);
    setForm({
      name: location.name,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    });
    setOpen(true);
  };
  const submit = () => {
    const latitude = Number(form.latitude.replace(",", "."));
    const longitude = Number(form.longitude.replace(",", "."));
    if (!form.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast.error("Bitte Ortsname sowie gültige Breiten- und Längengrade eingeben.");
      return;
    }
    if (editingId) update.mutate({ id: editingId, name: form.name.trim(), latitude, longitude });
    else create.mutate({ name: form.name.trim(), latitude, longitude });
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MapPin className="size-6 text-blue-700" aria-hidden="true" />
            Orte & Standorte
          </h1>
          <p className="text-muted-foreground">
            Zentral gepflegte Orte stehen in Schichten und Vorbereitungen zur Auswahl und erscheinen auf der Live-Standortkarte.
          </p>
        </div>
        {canManage && (
          <Button type="button" className="min-h-11" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" /> Ort anlegen
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>Ort / Standort</span><span>Breitengrad</span><span>Längengrad</span><span className="text-right">Aktionen</span>
        </div>
        {isLoading ? <p className="p-4 text-muted-foreground">Lade Orte …</p> : locations.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Noch keine Orte angelegt. Erfasse zuerst einen Standort mit Koordinaten.</p>
        ) : locations.map(location => (
          <div key={location.id} className="grid grid-cols-[minmax(0,1fr)_120px_120px_auto] items-center gap-3 border-b px-4 py-3 last:border-0">
            <span className="min-w-0 truncate font-medium text-slate-900" title={location.name}>{location.name}</span>
            <span className="tabular-nums text-sm text-slate-700">{location.latitude.toFixed(5)}</span>
            <span className="tabular-nums text-sm text-slate-700">{location.longitude.toFixed(5)}</span>
            <span className="flex justify-end gap-1">
              {canManage && <Button variant="ghost" size="icon" aria-label={`${location.name} bearbeiten`} onClick={() => openEdit(location)}><Pencil className="size-4" /></Button>}
              {canManage && <Button variant="ghost" size="icon" className="text-red-700 hover:text-red-800" aria-label={`${location.name} löschen`} onClick={() => setDeleteTarget(location)}><Trash2 className="size-4" /></Button>}
            </span>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ort bearbeiten" : "Neuen Ort anlegen"}</DialogTitle>
            <DialogDescription>Koordinaten im Dezimalformat eingeben, zum Beispiel 50.3569 und 6.9458.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-1.5 text-sm font-medium">Ortsname
              <Input autoFocus value={form.name} placeholder="z. B. VP8 – Pumptrack" onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">Breitengrad (Latitude)
                <Input inputMode="decimal" value={form.latitude} placeholder="50.3569" onChange={event => setForm(current => ({ ...current, latitude: event.target.value }))} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">Längengrad (Longitude)
                <Input inputMode="decimal" value={form.longitude} placeholder="6.9458" onChange={event => setForm(current => ({ ...current, longitude: event.target.value }))} />
              </label>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="button" onClick={submit} disabled={create.isPending || update.isPending}>{editingId ? "Speichern" : "Ort anlegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminPasswordDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Ort löschen"
        description={deleteTarget ? `„${deleteTarget.name}“ wird gelöscht. Zugeordnete Schichten und Vorbereitungen behalten ihre Daten, aber ohne Ortsbezug.` : ""}
        confirmLabel="Ort löschen"
        destructive
        busy={remove.isPending}
        onConfirm={adminPassword => {
          if (deleteTarget) remove.mutate({ id: deleteTarget.id, adminPassword });
        }}
      />
    </div>
  );
}
