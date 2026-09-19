import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Gift,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "wouter";

type DonationCategory = "kuchen" | "salat" | "snack" | "sonstiges";

type DonationRow = {
  id: number;
  donor: string;
  /** Die historische Datenbanksäule enthält jetzt die neutrale Spendenbezeichnung. */
  cake: string;
  donationCategory: DonationCategory;
  locationId: number | null;
  dropoffDate: string;
  dropoffTime: string;
  legacyDropoffText: string;
  vegan: boolean;
  glutenFree: boolean;
  lactoseFree: boolean;
  containsNuts: boolean;
  meat: boolean;
  note: string | null;
};

type DonationForm = Omit<
  DonationRow,
  "id" | "note" | "legacyDropoffText"
> & {
  note: string;
};

const EMPTY_DONATION_FORM: DonationForm = {
  donor: "",
  cake: "",
  donationCategory: "kuchen",
  locationId: null,
  dropoffDate: "",
  dropoffTime: "",
  vegan: false,
  glutenFree: false,
  lactoseFree: false,
  containsNuts: false,
  meat: false,
  note: "",
};

const donationCategories: Array<{
  value: DonationCategory;
  label: string;
  badgeClass: string;
}> = [
  {
    value: "kuchen",
    label: "Kuchen / Gebäck",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    value: "salat",
    label: "Salat",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "snack",
    label: "Dessert",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    value: "sonstiges",
    label: "Sonstiges",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
  },
];

const traits = [
  {
    key: "vegan",
    label: "🌱 Vegan",
    tagClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    activeClass: "border-emerald-400 bg-emerald-100 text-emerald-900",
  },
  {
    key: "glutenFree",
    label: "🌾 Glutenfrei",
    tagClass: "border-amber-200 bg-amber-50 text-amber-900",
    activeClass: "border-amber-400 bg-amber-100 text-amber-950",
  },
  {
    key: "lactoseFree",
    label: "🥛 Laktosefrei",
    tagClass: "border-sky-200 bg-sky-50 text-sky-800",
    activeClass: "border-sky-400 bg-sky-100 text-sky-950",
  },
  {
    key: "containsNuts",
    label: "🌰 Enthält Nüsse",
    tagClass: "border-orange-200 bg-orange-50 text-orange-900",
    activeClass: "border-orange-400 bg-orange-100 text-orange-950",
  },
  {
    key: "meat",
    label: "🥩 Fleischhaltig",
    tagClass: "border-rose-200 bg-rose-50 text-rose-800",
    activeClass: "border-rose-400 bg-rose-100 text-rose-950",
  },
] as const;

type TraitKey = (typeof traits)[number]["key"];

function formatDropoffTime(row: DonationRow) {
  if (row.dropoffDate) {
    const weekday = new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
    }).format(new Date(`${row.dropoffDate}T12:00:00`));
    return row.dropoffTime
      ? `${weekday}, ${row.dropoffTime} Uhr`
      : weekday;
  }
  if (row.dropoffTime) return `${row.dropoffTime} Uhr`;
  return row.legacyDropoffText || "–";
}

function weekdayForDropoffDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
    new Date(`${value}T12:00:00`)
  );
}

function categoryMeta(category: DonationCategory | null | undefined) {
  return (
    donationCategories.find(item => item.value === category) ??
    donationCategories[0]
  );
}

function CategoryBadge({ category }: { category: DonationCategory }) {
  const item = categoryMeta(category);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${item.badgeClass}`}
    >
      {item.label}
    </span>
  );
}

function TraitTags({ row }: { row: DonationRow }) {
  const selectedTraits = traits.filter(trait => row[trait.key]);
  const note = row.note?.trim();

  if (!selectedTraits.length && !note)
    return <span className="text-sm text-slate-400">–</span>;

  return (
    <div className="space-y-1.5">
      {selectedTraits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTraits.map(trait => (
            <span
              key={trait.key}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${trait.tagClass}`}
            >
              {trait.label}
            </span>
          ))}
        </div>
      )}
      {note && <p className="text-xs leading-5 text-slate-600">{note}</p>}
    </div>
  );
}

export default function Cakes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const requestedDonor = searchParams.get("donor")?.trim() ?? "";
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.cakes.list.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const { data: selectedEvent } = trpc.events.current.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationRow | null>(null);
  const [form, setForm] = useState<DonationForm>(EMPTY_DONATION_FORM);
  const [deleteTarget, setDeleteTarget] = useState<DonationRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"alle" | DonationCategory>(
    "alle"
  );
  const [traitFilter, setTraitFilter] = useState<"alle" | TraitKey>("alle");
  const [weekdayFilter, setWeekdayFilter] = useState("alle");
  const [locationFilter, setLocationFilter] = useState("alle");
  const [donationTargets, setDonationTargets] = useState({
    kuchen: "0",
    salat: "0",
    snack: "0",
    sonstiges: "0",
  });
  const donorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          helpers
            .map(helper => helper.name.trim())
            .filter((name): name is string => Boolean(name))
        )
      ).sort((left, right) => left.localeCompare(right, "de-DE")),
    [helpers]
  );
  const locationOptions = useMemo(
    () =>
      [...locations].sort((left, right) =>
        left.name.localeCompare(right.name, "de-DE")
      ),
    [locations]
  );
  const locationNames = useMemo(
    () => new Map(locations.map(location => [location.id, location.name])),
    [locations]
  );
  const donationWeekdays = useMemo(() => {
    const activeDays = selectedEvent?.activeDays ?? [];
    if (activeDays.length) return activeDays;
    return Array.from(
      new Set(
        (rows as DonationRow[])
          .map(row => weekdayForDropoffDate(row.dropoffDate))
          .filter(Boolean)
      )
    );
  }, [rows, selectedEvent?.activeDays]);

  useEffect(() => {
    if (!requestedDonor) return;
    setEditingDonation(null);
    setForm({ ...EMPTY_DONATION_FORM, donor: requestedDonor });
    setDialogOpen(true);
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete("donor");
        return next;
      },
      { replace: true }
    );
  }, [requestedDonor, setSearchParams]);

  useEffect(() => {
    if (!selectedEvent) return;
    setDonationTargets({
      kuchen: String(selectedEvent.donationTargetKuchen ?? 0),
      salat: String(selectedEvent.donationTargetSalat ?? 0),
      snack: String(selectedEvent.donationTargetSnack ?? 0),
      sonstiges: String(selectedEvent.donationTargetSonstiges ?? 0),
    });
  }, [
    selectedEvent?.id,
    selectedEvent?.donationTargetKuchen,
    selectedEvent?.donationTargetSalat,
    selectedEvent?.donationTargetSnack,
    selectedEvent?.donationTargetSonstiges,
  ]);

  const refresh = () => {
    void utils.cakes.list.invalidate();
    void utils.dashboard.stats.invalidate();
  };

  const createDonation = trpc.cakes.create.useMutation({
    onSuccess: () => {
      toast.success("Spende erfasst");
      setDialogOpen(false);
      setForm(EMPTY_DONATION_FORM);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const updateDonation = trpc.cakes.update.useMutation({
    onSuccess: () => {
      toast.success("Spende gespeichert");
      setEditingDonation(null);
      setDialogOpen(false);
      setForm(EMPTY_DONATION_FORM);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const deleteDonation = trpc.cakes.remove.useMutation({
    onSuccess: () => {
      toast.success("Spende entfernt");
      setDeleteTarget(null);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const updateDonationTargets = trpc.events.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.events.current.invalidate(),
        utils.events.list.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);
      toast.success("Spenden-Sollwerte gespeichert");
    },
    onError: error => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingDonation(null);
    setForm(EMPTY_DONATION_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: DonationRow) => {
    setEditingDonation(row);
    setForm({
      donor: row.donor,
      cake: row.cake,
      donationCategory: row.donationCategory ?? "kuchen",
      locationId: row.locationId,
      dropoffDate: row.dropoffDate,
      dropoffTime: row.dropoffTime,
      vegan: row.vegan,
      glutenFree: row.glutenFree,
      lactoseFree: row.lactoseFree,
      containsNuts: row.containsNuts,
      meat: row.meat ?? false,
      note: row.note ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (createDonation.isPending || updateDonation.isPending) return;
    setDialogOpen(false);
    setEditingDonation(null);
    setForm(EMPTY_DONATION_FORM);
  };

  const submit = () => {
    if (!form.donor.trim()) return;
    const values = {
      donor: form.donor.trim(),
      cake: form.cake.trim(),
      donationCategory: form.donationCategory,
      locationId: form.locationId,
      dropoffDate: form.dropoffDate,
      dropoffTime: form.dropoffTime.trim(),
      vegan: form.vegan,
      glutenFree: form.glutenFree,
      lactoseFree: form.lactoseFree,
      containsNuts: form.containsNuts,
      meat: form.meat,
      note: form.note.trim() || null,
    };
    if (editingDonation)
      updateDonation.mutate({ id: editingDonation.id, ...values });
    else createDonation.mutate({ ...values, note: values.note ?? undefined });
  };

  const toggleTrait = (key: TraitKey) =>
    setForm(current => ({ ...current, [key]: !current[key] }));

  const busy = createDonation.isPending || updateDonation.isPending;
  const donations = rows as DonationRow[];
  const filteredDonations = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("de-DE");
    return donations.filter(row => {
      if (categoryFilter !== "alle" && row.donationCategory !== categoryFilter)
        return false;
      if (traitFilter !== "alle" && !row[traitFilter]) return false;
      if (
        weekdayFilter !== "alle" &&
        weekdayForDropoffDate(row.dropoffDate) !== weekdayFilter
      )
        return false;
      if (
        locationFilter !== "alle" &&
        String(row.locationId ?? "none") !== locationFilter
      )
        return false;
      if (!query) return true;
      return [
        row.donor,
        row.cake,
        row.note ?? "",
        row.locationId ? locationNames.get(row.locationId) ?? "" : "",
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(query);
    });
  }, [
    donations,
    searchTerm,
    categoryFilter,
    traitFilter,
    weekdayFilter,
    locationFilter,
    locationNames,
  ]);
  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    categoryFilter !== "alle" ||
    traitFilter !== "alle" ||
    weekdayFilter !== "alle" ||
    locationFilter !== "alle";
  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("alle");
    setTraitFilter("alle");
    setWeekdayFilter("alle");
    setLocationFilter("alle");
  };
  const saveDonationTargets = () => {
    if (!selectedEvent) return;
    const values = Object.fromEntries(
      Object.entries(donationTargets).map(([key, value]) => [
        key,
        Math.max(0, Math.min(10_000, Number.parseInt(value || "0", 10) || 0)),
      ])
    ) as Record<keyof typeof donationTargets, number>;
    updateDonationTargets.mutate({
      id: selectedEvent.id,
      donationTargetKuchen: values.kuchen,
      donationTargetSalat: values.salat,
      donationTargetSnack: values.snack,
      donationTargetSonstiges: values.sonstiges,
    });
  };
  const donationOverviewPdf = trpc.pdf.donationOverview.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Spenden-PDF wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const downloadDonationOverviewPdf = () => {
    donationOverviewPdf.mutate({
      donationIds: filteredDonations
        .map(row => row.id)
        .filter(id => Number.isSafeInteger(id) && id > 0),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6 text-rose-600" aria-hidden="true" />
            Spenden
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verpflegungsspenden schnell erfassen und wichtige Hinweise sichtbar
            kennzeichnen.
          </p>
        </div>
        <div className="w-full space-y-2 lg:w-auto lg:min-w-[500px]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 sm:[&>[data-slot=button]]:h-10">
            <Button
              type="button"
              variant="outline"
              className="border-blue-200 bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-900"
              disabled={donationOverviewPdf.isPending}
              onClick={downloadDonationOverviewPdf}
            >
              <Printer className="mr-2 h-4 w-4 text-blue-700" />
              {donationOverviewPdf.isPending ? "PDF wird erstellt …" : "PDF drucken"}
            </Button>
            <ModuleExcelImportButton area="KUCHEN" label="Spenden" />
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-900"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Zurücksetzen
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className={`w-full ${CREATION_ACTION_BUTTON_CLASS}`}
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Spende erfassen
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-slate-50/70 p-3 sm:p-4">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Suchen (Spender/Spende/Hinweise/Ort) …"
            className="h-11 bg-white pl-9 pr-8 text-base sm:h-10 sm:text-sm"
            aria-label="Spenden durchsuchen"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700 sm:min-h-0 sm:min-w-0"
              aria-label="Suche leeren"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            value={categoryFilter}
            onValueChange={value =>
              setCategoryFilter(value as "alle" | DonationCategory)
            }
          >
            <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Kategorien</SelectItem>
              {donationCategories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={traitFilter}
            onValueChange={value => setTraitFilter(value as "alle" | TraitKey)}
          >
            <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
              <SelectValue placeholder="Eigenschaft" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Eigenschaften</SelectItem>
              {traits.map(trait => (
                <SelectItem key={trait.key} value={trait.key}>
                  {trait.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={weekdayFilter} onValueChange={setWeekdayFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
              <SelectValue placeholder="Abgabetag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Abgabetage</SelectItem>
              {donationWeekdays.map(day => (
                <SelectItem key={day} value={day}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
              <SelectValue placeholder="Standort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Standorte</SelectItem>
              <SelectItem value="none">Ohne Standort</SelectItem>
              {locationOptions.map(location => (
                <SelectItem key={location.id} value={String(location.id)}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end" aria-live="polite" aria-atomic="true">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            {filteredDonations.length} von {donations.length} Spenden sichtbar
          </span>
        </div>
      </div>

      {user?.role === "admin" && selectedEvent && (
        <Card className="border-rose-200 bg-rose-50/45 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Spenden-Sollwerte</h2>
                <p className="text-sm text-slate-600">
                  Zielmengen für den Soll/Ist-Vergleich im Dashboard festlegen.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Nur für Administratoren sichtbar
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {donationCategories.map(category => (
                <div key={category.value} className="space-y-1.5">
                  <Label
                    htmlFor={`donation-target-${category.value}`}
                    className="text-xs font-medium text-slate-700"
                  >
                    {category.label}
                  </Label>
                  <Input
                    id={`donation-target-${category.value}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10000}
                    value={donationTargets[category.value]}
                    onChange={event =>
                      setDonationTargets(current => ({
                        ...current,
                        [category.value]: event.target.value,
                      }))
                    }
                    className="h-11 bg-white text-base sm:h-10 sm:text-sm"
                    aria-label={`${category.label}: Sollmenge`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                className="bg-rose-700 text-white hover:bg-rose-800"
                disabled={updateDonationTargets.isPending}
                onClick={saveDonationTargets}
              >
                {updateDonationTargets.isPending
                  ? "Speichert …"
                  : "Sollwerte speichern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 md:hidden">
        {isLoading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Lade …
            </CardContent>
          </Card>
        )}
        {filteredDonations.map(row => (
          <Card key={row.id} className="shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Spender
                  </p>
                  <p className="font-semibold text-slate-950">{row.donor}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.donor} bearbeiten`}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.donor} löschen`}
                    disabled={deleteDonation.isPending}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Spende
                  </p>
                  <p className="text-sm text-slate-800">{row.cake || "–"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Kategorie
                  </p>
                  <div className="mt-1">
                    <CategoryBadge category={row.donationCategory ?? "kuchen"} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Eigenschaften & Hinweise
                </p>
                <div className="mt-1">
                  <TraitTags row={row} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ort</p>
                <p className="text-sm text-slate-800">
                  {row.locationId ? locationNames.get(row.locationId) ?? "–" : "–"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Abgabezeit
                </p>
                <p className="text-sm text-slate-800">{formatDropoffTime(row)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filteredDonations.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Keine Spenden entsprechen den aktuellen Filterkriterien."
                : "Noch keine Spenden erfasst."}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="hidden shadow-sm md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">Spender</th>
                <th className="p-3">Spende</th>
                <th className="p-3">Kategorie</th>
                <th className="min-w-[240px] p-3">Eigenschaften & Hinweise</th>
                <th className="p-3">Ort</th>
                <th className="p-3">Abgabezeit</th>
                <th className="w-20 p-3">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-4 text-muted-foreground">
                    Lade …
                  </td>
                </tr>
              )}
              {filteredDonations.map(row => (
                <tr key={row.id} className="border-t align-top hover:bg-muted/30">
                  <td className="p-3 font-medium text-slate-950">{row.donor}</td>
                  <td className="p-3 text-slate-800">{row.cake || "–"}</td>
                  <td className="p-3">
                    <CategoryBadge category={row.donationCategory ?? "kuchen"} />
                  </td>
                  <td className="p-3">
                    <TraitTags row={row} />
                  </td>
                  <td className="whitespace-nowrap p-3 text-slate-800">
                    {row.locationId ? locationNames.get(row.locationId) ?? "–" : "–"}
                  </td>
                  <td className="whitespace-nowrap p-3 text-slate-800">
                    {formatDropoffTime(row)}
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${row.donor} bearbeiten`}
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${row.donor} löschen`}
                        disabled={deleteDonation.isPending}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredDonations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-muted-foreground">
                    {hasActiveFilters
                      ? "Keine Spenden entsprechen den aktuellen Filterkriterien."
                      : "Noch keine Spenden erfasst."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={open => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 shadow-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDonation ? "Spende bearbeiten" : "Spende erfassen"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid min-w-0 gap-4 py-2"
            onSubmit={event => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="donation-donor">
                Spender <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="donation-donor"
                list="donation-donor-options"
                autoFocus
                required
                value={form.donor}
                placeholder="Helfer auswählen oder Namen eingeben"
                aria-describedby="donation-donor-hint"
                onChange={event =>
                  setForm(current => ({ ...current, donor: event.target.value }))
                }
              />
              <datalist id="donation-donor-options">
                {donorOptions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p id="donation-donor-hint" className="text-xs text-muted-foreground">
                Helfer auswählen oder einen neuen Namen frei eingeben.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="donation-name">Spende</Label>
                <Input
                  id="donation-name"
                  value={form.cake}
                  placeholder="z. B. Kuchen, Salat, Snack"
                  onChange={event =>
                    setForm(current => ({ ...current, cake: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donation-category">Kategorie</Label>
                <Select
                  value={form.donationCategory}
                  onValueChange={value =>
                    setForm(current => ({
                      ...current,
                      donationCategory: value as DonationCategory,
                    }))
                  }
                >
                  <SelectTrigger id="donation-category" className="h-11 text-base sm:h-10 sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {donationCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donation-location">Abgabeort / Standort</Label>
                <Select
                  value={form.locationId === null ? "none" : String(form.locationId)}
                  onValueChange={value =>
                    setForm(current => ({
                      ...current,
                      locationId: value === "none" ? null : Number(value),
                    }))
                  }
                >
                  <SelectTrigger id="donation-location" className="h-11 text-base sm:h-10 sm:text-sm">
                    <SelectValue placeholder="Kein Ort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Ort</SelectItem>
                    {locationOptions.map(location => (
                      <SelectItem key={location.id} value={String(location.id)}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donation-dropoff-date">Abgabetag / Datum</Label>
                <Input
                  id="donation-dropoff-date"
                  type="date"
                  value={form.dropoffDate}
                  min={selectedEvent?.startDate ?? undefined}
                  max={selectedEvent?.endDate ?? undefined}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                  onChange={event =>
                    setForm(current => ({ ...current, dropoffDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donation-dropoff-time">Abgabe-Uhrzeit</Label>
                <Input
                  id="donation-dropoff-time"
                  type="time"
                  step="60"
                  value={form.dropoffTime}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                  onChange={event =>
                    setForm(current => ({ ...current, dropoffTime: event.target.value }))
                  }
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">
                Eigenschaften (optional)
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {traits.map(trait => {
                  const active = form[trait.key];
                  return (
                    <Button
                      key={trait.key}
                      type="button"
                      variant="outline"
                      aria-pressed={active}
                      onClick={() => toggleTrait(trait.key)}
                      className={`h-11 justify-start border text-sm shadow-none transition-colors ${active ? trait.activeClass : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <span
                        className="mr-2 inline-flex size-4 items-center justify-center rounded border border-current text-[10px]"
                        aria-hidden="true"
                      >
                        {active ? "✓" : ""}
                      </span>
                      {trait.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="donation-note">Hinweise zur Spende (optional)</Label>
              <Textarea
                id="donation-note"
                rows={3}
                value={form.note}
                placeholder="z. B. Enthält Alkohol/Rum, Walnüsse oder Zutatenhinweise"
                onChange={event =>
                  setForm(current => ({ ...current, note: event.target.value }))
                }
              />
            </div>

            <DialogFooter className="mt-1 gap-2 border-t pt-3 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={busy}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={!form.donor.trim() || busy}>
                {busy ? "Speichert …" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Spende löschen?"
        description={`„${deleteTarget?.cake || "Diese Spende"}“ von ${deleteTarget?.donor ?? ""} wird endgültig gelöscht.`}
        busy={deleteDonation.isPending}
        onConfirm={() => deleteTarget && deleteDonation.mutate({ id: deleteTarget.id })}
      />
    </div>
  );
}
