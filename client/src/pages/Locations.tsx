import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { PageTitle } from "@/components/PageTitle";
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
import { trpc } from "@/lib/trpc";
import {
  locationLogoMimeType,
  MAX_LOCATION_LOGO_BYTES,
  optimizeLocationLogo,
  readFileAsBase64,
  readFileAsDataUrl,
} from "@/lib/location-logo";
import { FileImage, FileUp, MapPin, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

type LocationForm = { name: string; latitude: string; longitude: string };
const EMPTY_FORM: LocationForm = { name: "", latitude: "", longitude: "" };
const MAX_GPX_BYTES = 6_000_000;

function baseName(filename: string) {
  return filename.replace(/\.gpx$/i, "").trim() || "Strecke";
}

export default function Locations() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: locations = [], isLoading } = trpc.locations.list.useQuery();
  const { data: gpxTracks = [], isLoading: tracksLoading } = trpc.gpxTracks.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [trackDeleteTarget, setTrackDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [trackName, setTrackName] = useState("");
  const [trackColor, setTrackColor] = useState("#2563eb");
  const [selectedTrackFile, setSelectedTrackFile] = useState<File | null>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const canManage = user?.role === "admin";
  const invalidate = () => {
    void utils.locations.list.invalidate();
    void utils.gpxTracks.list.invalidate();
    void utils.plan.evaluate.invalidate();
    void utils.prep.list.invalidate();
    void utils.materials.list.invalidate();
    void utils.dashboard.stats.invalidate();
  };
  const create = trpc.locations.create.useMutation();
  const update = trpc.locations.update.useMutation();
  const uploadLogo = trpc.locations.uploadLogo.useMutation();
  const clearLogo = trpc.locations.clearLogo.useMutation();
  const remove = trpc.locations.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Ort gelöscht; bestehende Zuordnungen wurden entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const uploadTrack = trpc.gpxTracks.upload.useMutation({
    onSuccess: () => {
      invalidate();
      setTrackName("");
      setTrackColor("#2563eb");
      setSelectedTrackFile(null);
      if (trackInputRef.current) trackInputRef.current.value = "";
      toast.success("GPX-Strecke wurde auf der Live-Karte eingeblendet");
    },
    onError: error => toast.error(error.message),
  });
  const removeTrack = trpc.gpxTracks.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setTrackDeleteTarget(null);
      toast.success("GPX-Strecke wurde aus der Karte entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedLogoFile(null);
    setLogoPreviewUrl(null);
    setRemoveExistingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
    setOpen(true);
  };
  const openEdit = (location: (typeof locations)[number]) => {
    setEditingId(location.id);
    setForm({
      name: location.name,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    });
    setSelectedLogoFile(null);
    setLogoPreviewUrl(location.logoUrl ?? null);
    setRemoveExistingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
    setOpen(true);
  };
  const onLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const mimeType = locationLogoMimeType(file);
    if (!mimeType) {
      toast.error("Bitte ein PNG-, SVG- oder JPEG-Logo auswählen.");
      event.target.value = "";
      return;
    }
    try {
      const optimizedLogo = await optimizeLocationLogo(file, mimeType);
      if (optimizedLogo.size > MAX_LOCATION_LOGO_BYTES) {
        toast.error("Das Standort-Logo darf höchstens 3 MB groß sein.");
        event.target.value = "";
        return;
      }
      setSelectedLogoFile(optimizedLogo);
      setLogoPreviewUrl(await readFileAsDataUrl(optimizedLogo));
      setRemoveExistingLogo(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bilddatei konnte nicht gelesen werden");
      event.target.value = "";
    }
  };
  const removeLogoSelection = () => {
    setSelectedLogoFile(null);
    setLogoPreviewUrl(null);
    setRemoveExistingLogo(true);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };
  const submit = async () => {
    const latitude = Number(form.latitude.replace(",", "."));
    const longitude = Number(form.longitude.replace(",", "."));
    if (!form.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast.error("Bitte Ortsname sowie gültige Breiten- und Längengrade eingeben.");
      return;
    }
    try {
      const created = editingId
        ? null
        : await create.mutateAsync({ name: form.name.trim(), latitude, longitude });
      const locationId = editingId ?? created!.id;
      if (created) setEditingId(locationId);
      if (editingId)
        await update.mutateAsync({ id: editingId, name: form.name.trim(), latitude, longitude });
      if (selectedLogoFile) {
        const mimeType = locationLogoMimeType(selectedLogoFile);
        const base64 = await readFileAsBase64(selectedLogoFile);
        if (!mimeType) throw new Error("Die Bilddatei hat kein unterstütztes Format");
        await uploadLogo.mutateAsync({ id: locationId, base64, mimeType });
      } else if (removeExistingLogo && editingId) {
        await clearLogo.mutateAsync({ id: editingId });
      }
      invalidate();
      setOpen(false);
      toast.success(editingId ? "Ort aktualisiert" : "Ort angelegt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ort konnte nicht gespeichert werden");
    }
  };
  const onTrackFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!/\.gpx$/i.test(file.name)) {
      toast.error("Bitte eine Datei im GPX-Format auswählen.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_GPX_BYTES) {
      toast.error("Die GPX-Datei darf höchstens 6 MB groß sein.");
      event.target.value = "";
      return;
    }
    setSelectedTrackFile(file);
    if (!trackName.trim()) setTrackName(baseName(file.name));
  };
  const submitTrack = async () => {
    if (!selectedTrackFile) {
      toast.error("Bitte zuerst eine GPX-Datei auswählen.");
      return;
    }
    if (!trackName.trim()) {
      toast.error("Bitte eine Bezeichnung für die Strecke eingeben.");
      return;
    }
    try {
      const base64 = await readFileAsBase64(selectedTrackFile);
      uploadTrack.mutate({ name: trackName.trim(), base64, color: trackColor });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GPX-Datei konnte nicht gelesen werden");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTitle icon="locations">Orte & Standorte</PageTitle>
          <p className="text-muted-foreground">
            Zentral gepflegte Orte stehen in Schichten, Vorbereitungen und Material zur Auswahl und erscheinen auf der Live-Standortkarte.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            className="h-10 border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-950 sm:ml-auto"
            onClick={openCreate}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" /> Ort anlegen
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
            <span className="flex min-w-0 items-center gap-2">
              {location.logoUrl && (
                <img
                  data-slot="location-logo-thumbnail"
                  src={location.logoUrl}
                  alt=""
                  title={`Logo für ${location.name}`}
                  className="size-7 shrink-0 rounded-full border-2 border-slate-300 bg-white object-cover shadow-sm"
                />
              )}
              <span className="min-w-0 truncate font-medium text-slate-900" title={location.name}>{location.name}</span>
            </span>
            <span className="tabular-nums text-sm text-slate-700">{location.latitude.toFixed(5)}</span>
            <span className="tabular-nums text-sm text-slate-700">{location.longitude.toFixed(5)}</span>
            <span className="flex justify-end gap-1">
              {canManage && <Button variant="ghost" size="icon" aria-label={`${location.name} bearbeiten`} onClick={() => openEdit(location)}><Pencil className="size-4" /></Button>}
              {canManage && <Button variant="ghost" size="icon" className="text-red-700 hover:text-red-800" aria-label={`${location.name} löschen`} onClick={() => setDeleteTarget(location)}><Trash2 className="size-4" /></Button>}
            </span>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Route className="size-5 text-blue-700" /> GPX-Streckenoverlays</h2>
            <p className="text-sm text-slate-600">GPX-Dateien werden als Streckenlinien in der Live-Standortkarte angezeigt. Maximal 6 MB je Datei.</p>
          </div>
        </div>
        {canManage && (
          <div className="grid gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Label className="grid gap-1.5 text-sm font-medium">GPX-Datei
              <Input ref={trackInputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={onTrackFileChange} />
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2">
              <Label className="grid gap-1.5 text-sm font-medium">Streckenbezeichnung
                <Input value={trackName} placeholder="z. B. Marathonrunde 2027" onChange={event => setTrackName(event.target.value)} />
              </Label>
              <Label className="grid gap-1.5 text-sm font-medium">Farbe
                <Input aria-label="Streckenfarbe" type="color" value={trackColor} className="h-10 w-12 p-1" onChange={event => setTrackColor(event.target.value)} />
              </Label>
            </div>
            <Button type="button" className="min-h-11" disabled={!selectedTrackFile || uploadTrack.isPending} onClick={submitTrack}>
              <FileUp className="mr-2 size-4" />{uploadTrack.isPending ? "Wird hochgeladen …" : "GPX hochladen"}
            </Button>
          </div>
        )}
        <div className="mt-4 divide-y rounded-lg border bg-white">
          {tracksLoading ? <p className="p-3 text-sm text-muted-foreground">Lade Strecken …</p> : gpxTracks.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Noch keine GPX-Strecke hinterlegt.</p>
          ) : gpxTracks.map(track => (
            <div key={track.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-900"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />{track.name}</span>
              {canManage && <Button variant="ghost" size="icon" className="shrink-0 text-red-700 hover:text-red-800" aria-label={`${track.name} löschen`} onClick={() => setTrackDeleteTarget(track)}><Trash2 className="size-4" /></Button>}
            </div>
          ))}
        </div>
      </section>

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
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <Label htmlFor="location-logo-upload" className="flex items-center gap-2 text-sm font-medium">
                <FileImage className="size-4 text-blue-700" aria-hidden="true" />
                Standort-Logo / Marker-Icon hochladen (PNG/SVG/JPG)
              </Label>
              <Input
                id="location-logo-upload"
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                onChange={onLogoFileChange}
              />
              <p className="text-xs text-muted-foreground">Optional, maximal 3 MB. Das Logo ersetzt den Standardpin und erhält weiterhin einen farbigen Statusrahmen.</p>
              {logoPreviewUrl ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border bg-white p-2.5">
                  <img src={logoPreviewUrl} alt="Vorschau des Standortlogos" className="size-12 rounded-full border-4 border-slate-400 object-cover shadow-sm" />
                  <div className="min-w-0 flex-1 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">Marker-Vorschau aktiv</p>
                    <p>Der Außenring passt sich auf der Karte dem Standortstatus an.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={removeLogoSelection}>
                    Logo entfernen
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="button" onClick={submit} disabled={create.isPending || update.isPending || uploadLogo.isPending || clearLogo.isPending}>{editingId ? "Speichern" : "Ort anlegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminPasswordDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Ort löschen"
        description={deleteTarget ? `„${deleteTarget.name}“ wird gelöscht. Zugeordnete Schichten, Vorbereitungen und Materialien behalten ihre Daten, aber ohne Ortsbezug.` : ""}
        confirmLabel="Ort löschen"
        destructive
        busy={remove.isPending}
        onConfirm={adminPassword => {
          if (deleteTarget) remove.mutate({ id: deleteTarget.id, adminPassword });
        }}
      />
      <AdminPasswordDialog
        open={!!trackDeleteTarget}
        onOpenChange={open => !open && setTrackDeleteTarget(null)}
        title="GPX-Strecke löschen"
        description={trackDeleteTarget ? `„${trackDeleteTarget.name}“ wird aus der Live-Standortkarte entfernt.` : ""}
        confirmLabel="Strecke löschen"
        destructive
        busy={removeTrack.isPending}
        onConfirm={adminPassword => {
          if (trackDeleteTarget) removeTrack.mutate({ id: trackDeleteTarget.id, adminPassword });
        }}
      />
    </div>
  );
}
