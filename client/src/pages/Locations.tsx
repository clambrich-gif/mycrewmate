import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { KlemmiActionPanel } from "@/components/KlemmiActionPanel";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { KlemmiUpgradeDialog } from "@/components/KlemmiUpgradeDialog";
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
import { productAllowsCapability } from "@shared/product-packages";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import {
  locationLogoMimeType,
  MAX_LOCATION_LOGO_BYTES,
  optimizeLocationLogo,
  readFileAsBase64,
  readFileAsDataUrl,
} from "@/lib/location-logo";
import { FileImage, FileUp, LockKeyhole, MapPin, Pencil, Plus, Route, Sparkles, Trash2 } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

type LocationForm = { name: string; latitude: string; longitude: string };
const EMPTY_FORM: LocationForm = { name: "", latitude: "", longitude: "" };
const MAX_GPX_BYTES = 6_000_000;

function baseName(filename: string) {
  return filename.replace(/\.gpx$/i, "").trim() || "Strecke";
}

export default function Locations() {
  const { isTenantAdmin: canDelete, canWriteModule } = useTenantAdministration();
  const canManage = canWriteModule("locations");
  const utils = trpc.useUtils();
  const tenantProduct = trpc.tenantProduct.current.useQuery();
  const productPackageId = tenantProduct.data?.packageId ?? "pro";
  const canUseMapsGpx =
    tenantProduct.isSuccess && productAllowsCapability(productPackageId, "maps_gpx");
  const { data: locations = [], isLoading } = trpc.locations.list.useQuery();
  const { data: gpxTracks = [], isLoading: tracksLoading } = trpc.gpxTracks.list.useQuery(undefined, {
    enabled: canUseMapsGpx,
  });
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
  const [klemmiGuideOpen, setKlemmiGuideOpen] = useState(false);
  const [klemmiCreationSignal, setKlemmiCreationSignal] = useState<number | null>(null);
  const [klemmiGuideStartedEmpty, setKlemmiGuideStartedEmpty] = useState<boolean | null>(null);
  const [selectedTrackFile, setSelectedTrackFile] = useState<File | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editingTrackName, setEditingTrackName] = useState("");
  const [gpxUpgradeOpen, setGpxUpgradeOpen] = useState(false);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
  const renameTrack = trpc.gpxTracks.rename.useMutation({
    onSuccess: () => {
      invalidate();
      setEditingTrackId(null);
      setEditingTrackName("");
      toast.success("GPX-Strecke umbenannt");
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
      latitude:
        typeof location.latitude === "number" && Number.isFinite(location.latitude)
          ? String(location.latitude)
          : "",
      longitude:
        typeof location.longitude === "number" && Number.isFinite(location.longitude)
          ? String(location.longitude)
          : "",
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
    const name = form.name.trim();
    if (!name) {
      toast.error("Bitte einen Ortsnamen eingeben.");
      return;
    }
    const parsedLat = Number(form.latitude.replace(",", "."));
    const parsedLng = Number(form.longitude.replace(",", "."));
    const hasCoordinates =
      Boolean(form.latitude.trim() || form.longitude.trim()) &&
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng);
    if (canUseMapsGpx && (form.latitude.trim() || form.longitude.trim()) && !hasCoordinates) {
      toast.error("Bitte gültige Breiten- und Längengrade im Dezimalformat eingeben.");
      return;
    }
    const latitude = canUseMapsGpx && hasCoordinates ? parsedLat : null;
    const longitude = canUseMapsGpx && hasCoordinates ? parsedLng : null;
    try {
      const created = editingId
        ? null
        : await create.mutateAsync({ name, latitude, longitude });
      const locationId = editingId ?? created!.id;
      if (created) setEditingId(locationId);
      if (editingId)
        await update.mutateAsync({ id: editingId, name, latitude, longitude });
      if (canUseMapsGpx && selectedLogoFile) {
        const mimeType = locationLogoMimeType(selectedLogoFile);
        const base64 = await readFileAsBase64(selectedLogoFile);
        if (!mimeType) throw new Error("Die Bilddatei hat kein unterstütztes Format");
        await uploadLogo.mutateAsync({ id: locationId, base64, mimeType });
      } else if (canUseMapsGpx && removeExistingLogo && editingId) {
        await clearLogo.mutateAsync({ id: editingId });
      }
      invalidate();
      setOpen(false);
      if (created) setKlemmiCreationSignal(Date.now());
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
  const startTrackEdit = (track: (typeof gpxTracks)[number]) => {
    setEditingTrackId(track.id);
    setEditingTrackName(track.name);
  };
  const cancelTrackEdit = () => {
    setEditingTrackId(null);
    setEditingTrackName("");
  };
  const saveTrackName = (trackId: number) => {
    const name = editingTrackName.trim();
    if (!name) {
      toast.error("Bitte eine Bezeichnung für die Strecke eingeben.");
      return;
    }
    renameTrack.mutate({ id: trackId, name });
  };
  const klemmiGuideNeedsSample =
    klemmiGuideStartedEmpty ?? (!isLoading && locations.length === 0);
  const locationGuideSteps = [
    {
      key: "intro",
      selector: '[data-klemmi-target="locations-new"]',
      eyebrow: "Klemmi zeigt’s",
      title: "Orte und Standorte sauber anlegen",
      text: klemmiGuideNeedsSample
        ? "Hier ist noch kein Standort vorhanden. Wir legen gemeinsam einen echten Musterort an, den du danach behalten oder wieder löschen kannst."
        : "Ich zeige dir die vorhandenen Standorte und die echte Standortanlage. Dafür wird nichts neu gespeichert.",
      action: "Ort anlegen",
    },
    {
      key: "name",
      selector: '[data-klemmi-target="locations-name"]',
      eyebrow: "Schritt 1 von 4",
      title: "Ort eindeutig benennen",
      text: "Gib dem Standort einen Namen, den das Team auf Anhieb versteht – zum Beispiel „VP8 – Pumptrack“ oder „Kuchenstand“.",
      action: canUseMapsGpx ? "Koordinaten eintragen" : "Speichern zeigen",
    },
    {
      key: canUseMapsGpx ? "coordinates" : "light",
      selector: canUseMapsGpx
        ? '[data-klemmi-target="locations-coordinates"]'
        : '[data-klemmi-target="locations-package-note"]',
      eyebrow: "Schritt 2 von 4",
      title: canUseMapsGpx
        ? "Position auf der Karte festlegen"
        : "Orte ohne Karte nutzen",
      text: canUseMapsGpx
        ? "Breiten- und Längengrad positionieren den Standort auf der Live-Karte. Ein Marker-Logo darunter ist optional."
        : "Im Light-Paket verwaltest du reine Einsatzorte für Schichten, Vorbereitung und Material. Koordinaten und die Live-Karte sind Pro vorbehalten.",
      audioKey: canUseMapsGpx ? "coordinates" : "light",
      action: "Speichern zeigen",
    },
    {
      key: "save",
      selector: '[data-klemmi-target="locations-save"]',
      eyebrow: "Schritt 3 von 4",
      title: "Standort speichern",
      text: klemmiGuideNeedsSample
        ? "Klicke auf den markierten Button. Erst dein Klick legt den Musterort wirklich an."
        : "Der markierte Button legt einen neuen Standort an. Für diese Erklärung klickst du nicht darauf – gleich zeige ich dir die vorhandenen Orte.",
      action: klemmiGuideNeedsSample ? undefined : "Übersicht zeigen",
      waitsForSuccess: klemmiGuideNeedsSample,
      audioKey: klemmiGuideNeedsSample ? "save" : "overview-save",
    },
    {
      key: "overview",
      selector: '[data-klemmi-target="locations-overview"]',
      eyebrow: "Schritt 4 von 4",
      title: "Standortübersicht nutzen",
      text: klemmiGuideNeedsSample
        ? "Dein Musterort ist jetzt sichtbar. Passt er zur Planung, lässt du ihn stehen; sonst entfernst du ihn später über das rote Löschen-Symbol."
        : "Hier stehen alle bereits angelegten Orte. Der Stift passt Name oder Koordinaten an; der rote Papierkorb entfernt nur Standorte, die nicht mehr gebraucht werden.",
      audioKey: "complete",
      action: "Fertig",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTitle icon="locations">Orte & Standorte</PageTitle>
          <p className="text-muted-foreground">
            {canUseMapsGpx
              ? "Zentral gepflegte Orte stehen in Schichten, Vorbereitungen und Material zur Auswahl und erscheinen auf der Live-Standortkarte."
              : "Zentral gepflegte Orte stehen in Schichten, Vorbereitung und Material zur Auswahl."}
          </p>
        </div>
        {canManage && (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <KlemmiActionPanel
              className="w-full sm:w-auto"
              guide={
                <KlemmiSurfaceGuide
                  guideId="locations"
                  title="Orte und Standorte sauber anlegen"
                  introText={
                    canUseMapsGpx
                      ? "Ich zeige dir die echte Standortanlage: Namen vergeben, Koordinaten eintragen und den Ort anschließend in Schichten, Material und Vorbereitung verwenden."
                      : "Ich zeige dir, wie du zentrale Orte anlegst und in Schichten, Material und Vorbereitung verwendest."
                  }
                  successSignal={klemmiCreationSignal}
                  onOpenChange={isOpen => {
                    setKlemmiGuideOpen(isOpen);
                    if (isOpen) setKlemmiGuideStartedEmpty(!isLoading && locations.length === 0);
                    else {
                      setOpen(false);
                      setKlemmiGuideStartedEmpty(null);
                    }
                  }}
                  onStepAction={stepKey => {
                    if (stepKey === "intro") openCreate();
                    if (stepKey === "save" && !klemmiGuideNeedsSample) setOpen(false);
                  }}
                  completionTitle="Standort angelegt!"
                  completionText={
                    canUseMapsGpx
                      ? "Der Ort steht jetzt in Schichten, Vorbereitung und Material zur Auswahl und erscheint auf der Live-Standortkarte."
                      : "Der Ort steht jetzt in Schichten, Vorbereitung und Material zur Auswahl."
                  }
                  completionAudioKey={klemmiGuideNeedsSample ? "complete" : "overview"}
                  steps={locationGuideSteps}
                />
              }
              primaryAction={
                <Button
                  type="button"
                  variant="outline"
                  data-klemmi-target="locations-new"
                  className="h-10 min-w-[140px] border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-950 sm:px-5"
                  onClick={openCreate}
                >
                  <Plus className="mr-2 size-4 shrink-0" aria-hidden="true" /> Ort anlegen
                </Button>
              }
            />
          </div>
        )}
      </div>
      <div data-klemmi-target="locations-overview" className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {canUseMapsGpx ? (
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:grid">
            <span>Ort / Standort</span><span>Breitengrad</span><span>Längengrad</span><span className="text-right">Aktionen</span>
          </div>
        ) : (
          <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:grid">
            <span>Ort / Standort</span><span className="text-right">Aktionen</span>
          </div>
        )}
        {isLoading ? <p className="p-4 text-muted-foreground">Lade Orte …</p> : locations.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {canUseMapsGpx
              ? "Noch keine Orte angelegt. Erfasse zuerst einen Standort mit Koordinaten."
              : "Noch keine Orte angelegt. Lege hier deinen ersten Einsatzort an."}
          </p>
        ) : locations.map(location => (
          <div
            key={location.id}
            className={
              canUseMapsGpx
                ? "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-b px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto] sm:items-center sm:gap-3"
                : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b px-4 py-3 last:border-0"
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              {canUseMapsGpx && location.logoUrl && (
                <img
                  data-slot="location-logo-thumbnail"
                  src={location.logoUrl}
                  alt=""
                  title={`Logo für ${location.name}`}
                  className="size-7 shrink-0 rounded-full border-2 border-slate-300 bg-white object-cover shadow-sm"
                />
              )}
              <span className="min-w-0 break-words font-medium text-slate-900 sm:truncate" title={location.name}>{location.name}</span>
            </span>
            {canUseMapsGpx && (
              <>
                <span className="col-span-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-700 sm:hidden">
                  <span>
                    <span className="text-slate-500">Breitengrad: </span>
                    <span className="tabular-nums">
                      {typeof location.latitude === "number" && Number.isFinite(location.latitude)
                        ? location.latitude.toFixed(5)
                        : "–"}
                    </span>
                  </span>
                  <span>
                    <span className="text-slate-500">Längengrad: </span>
                    <span className="tabular-nums">
                      {typeof location.longitude === "number" && Number.isFinite(location.longitude)
                        ? location.longitude.toFixed(5)
                        : "–"}
                    </span>
                  </span>
                </span>
                <span className="hidden tabular-nums text-sm text-slate-700 sm:block">
                  {typeof location.latitude === "number" && Number.isFinite(location.latitude)
                    ? location.latitude.toFixed(5)
                    : "–"}
                </span>
                <span className="hidden tabular-nums text-sm text-slate-700 sm:block">
                  {typeof location.longitude === "number" && Number.isFinite(location.longitude)
                    ? location.longitude.toFixed(5)
                    : "–"}
                </span>
              </>
            )}
            <span className="col-start-2 row-start-1 flex shrink-0 justify-end gap-1 sm:col-auto sm:row-auto">
              {canManage && <Button variant="ghost" size="icon" aria-label={`${location.name} bearbeiten`} onClick={() => openEdit(location)}><Pencil className="size-4" /></Button>}
              {canDelete && <Button variant="ghost" size="icon" className="text-red-700 hover:text-red-800" aria-label={`${location.name} löschen`} onClick={() => setDeleteTarget(location)}><Trash2 className="size-4" /></Button>}
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
        {!canUseMapsGpx ? (
          <div data-slot="gpx-upgrade-notice" className="rounded-xl border border-orange-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-800"><LockKeyhole className="size-5" aria-hidden="true" /></span>
              <div>
                <p className="font-semibold text-slate-900">Live-Karte und GPX gehören zum Pro-Paket</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Deine Orte bleiben im Light-Paket für Schichten, Aufgaben und Material nutzbar. Für Routen, GPS-Punkte und die Live-Standortkarte ist Pro vorgesehen.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-4 border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100 sm:mt-0" onClick={() => setGpxUpgradeOpen(true)}>
              <Sparkles className="mr-2 size-4" aria-hidden="true" /> Klemmi erklärt Pro
            </Button>
          </div>
        ) : canManage && (
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
        {canUseMapsGpx && <div className="mt-4 divide-y rounded-lg border bg-white">
          {tracksLoading ? <p className="p-3 text-sm text-muted-foreground">Lade Strecken …</p> : gpxTracks.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Noch keine GPX-Strecke hinterlegt.</p>
          ) : gpxTracks.map(track => {
            const isEditing = editingTrackId === track.id;
            return (
              <div key={track.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium text-slate-900">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editingTrackName}
                      aria-label="Name der GPX-Strecke bearbeiten"
                      className="h-9 min-w-0"
                      onChange={event => setEditingTrackName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") saveTrackName(track.id);
                        if (event.key === "Escape") cancelTrackEdit();
                      }}
                    />
                  ) : (
                    <span className="min-w-0 truncate" title={track.name}>{track.name}</span>
                  )}
                </span>
                {canManage && (
                  <span className="flex shrink-0 items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button variant="outline" size="sm" className="min-h-9" disabled={renameTrack.isPending} onClick={() => saveTrackName(track.id)}>
                          {renameTrack.isPending ? "Speichert …" : "Speichern"}
                        </Button>
                        <Button variant="ghost" size="sm" className="min-h-9" disabled={renameTrack.isPending} onClick={cancelTrackEdit}>
                          Abbrechen
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon" aria-label={`${track.name} umbenennen`} onClick={() => startTrackEdit(track)}><Pencil className="size-4" /></Button>
                    )}
                    {canDelete && <Button variant="ghost" size="icon" className="text-red-700 hover:text-red-800" aria-label={`${track.name} löschen`} onClick={() => setTrackDeleteTarget(track)}><Trash2 className="size-4" /></Button>}
                  </span>
                )}
              </div>
            );
          })}
        </div>}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-x-hidden overflow-y-auto"
          onInteractOutside={event => {
            if (
              klemmiGuideOpen &&
              event.target instanceof HTMLElement &&
              event.target.closest("[data-klemmi-guide]")
            ) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingId ? "Ort bearbeiten" : "Neuen Ort anlegen"}</DialogTitle>
            <DialogDescription data-klemmi-target="locations-package-note">
              {canUseMapsGpx
                ? "Koordinaten im Dezimalformat eingeben, zum Beispiel 50.3569 und 6.9458."
                : "Vergib einen klaren Ortsnamen für Schichten, Material und Vorbereitungsaufgaben."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label data-klemmi-target="locations-name" className="grid gap-1.5 text-sm font-medium">Ortsname
              <Input autoFocus value={form.name} placeholder="z. B. VP8 – Pumptrack" onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            {canUseMapsGpx && (
              <>
                <div data-klemmi-target="locations-coordinates" className="grid gap-4 sm:grid-cols-2">
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
              </>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="button" data-klemmi-target="locations-save" onClick={submit} disabled={create.isPending || update.isPending || uploadLogo.isPending || clearLogo.isPending}>{editingId ? "Speichern" : "Ort anlegen"}</Button>
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
      <KlemmiUpgradeDialog
        open={gpxUpgradeOpen}
        onOpenChange={setGpxUpgradeOpen}
        currentPackageId={productPackageId}
        capability="maps_gpx"
      />
    </div>
  );
}
