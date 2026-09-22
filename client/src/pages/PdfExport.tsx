import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/PageTitle";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  resolveWhatsAppMessageTemplate,
} from "@/lib/whatsappShare";
import { eventWeekdays, type Weekday } from "@shared/weekdays";
import {
  ChevronDown,
  ClipboardCheck,
  Download,
  FileArchive,
  ImageUp,
  ListFilter,
  Plus,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { toast } from "sonner";

type SettingsForm = {
  eventName: string;
  eventYear: string;
  helperPdfTitle: string;
  blankPlanTitle: string;
  contactLabel: string;
  footerText: string;
  whatsAppMessageTemplate: string;
  extraColumns: string[];
  blankRowsPerShift: number;
};

const EMPTY_FORM: SettingsForm = {
  eventName: "MyEifelRide",
  eventYear: "2026",
  helperPdfTitle: "Aufgabenübersicht",
  blankPlanTitle: "Einsatzplan – Blanko",
  contactLabel: "Ansprechpartner",
  footerText: "",
  whatsAppMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  extraColumns: [],
  blankRowsPerShift: 0,
};

type PdfSectionProps = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
};

/** Ein ruhiges Accordion hält die PDF-Ausgabe bei vielen Exportoptionen übersichtlich. */
function PdfSection({
  title,
  description,
  icon: Icon,
  children,
}: PdfSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label={`${title} ${open ? "einklappen" : "aufklappen"}`}
          >
            <span className="block min-w-0 flex-1 px-6 py-4">
              <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Icon className="h-5 w-5 text-slate-700" />
                {title}
              </span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronDown
              className={`mr-5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 data-[state=closed]:animate-none">
          <CardContent className="space-y-5 pt-5">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function PdfExport() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.pdf.settings.useQuery();
  const { data: plan = [] } = trpc.plan.evaluate.useQuery();
  const { data: currentEvent } = trpc.events.current.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: areaContacts = [] } = trpc.plan.areaContacts.useQuery();
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [planMode, setPlanMode] = useState<"blank" | "filled">("blank");
  const activeDays = useMemo(
    () => (currentEvent ? eventWeekdays(currentEvent.activeDays) : []),
    [currentEvent?.activeDays]
  );
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState([
    "OFFEN",
    "KNAPP",
    "OK",
  ]);
  const [selectedAreas, setSelectedAreas] = useState<string[] | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<number[] | null>(
    null
  );
  const [includeUnassignedContact, setIncludeUnassignedContact] =
    useState(true);
  const [helperContactFilter, setHelperContactFilter] = useState("all");
  const [selectedContactOverviewIds, setSelectedContactOverviewIds] =
    useState<number[]>([]);
  const [contactOverviewExportMode, setContactOverviewExportMode] =
    useState<"single" | "zip">("zip");
  const [contactOverviewContent, setContactOverviewContent] = useState({
    includeShifts: true,
    includePreparation: true,
    includePostProcessing: true,
    includeMaterials: true,
  });
  const selectedHelperContactId =
    helperContactFilter === "all" ? undefined : Number(helperContactFilter);
  const helperZipInput = useMemo(
    () => ({ contactId: selectedHelperContactId }),
    [selectedHelperContactId]
  );
  const allHelpers = trpc.pdf.allHelpers.useQuery(helperZipInput, {
    enabled: false,
  });
  const selectedHelperContact = contacts.find(
    contact => contact.id === selectedHelperContactId
  );

  useEffect(() => {
    if (!settings) return;
    setForm({
      eventName: settings.eventName,
      eventYear: settings.eventYear,
      helperPdfTitle: settings.helperPdfTitle,
      blankPlanTitle: settings.blankPlanTitle,
      contactLabel: settings.contactLabel,
      footerText: settings.footerText,
      whatsAppMessageTemplate: resolveWhatsAppMessageTemplate(
        settings.whatsAppMessageTemplate
      ),
      extraColumns: settings.extraColumns,
      blankRowsPerShift: settings.blankRowsPerShift,
    });
  }, [settings]);

  useEffect(() => {
    setSelectedDays(activeDays);
  }, [activeDays]);

  useEffect(() => {
    setSelectedContactOverviewIds(current => {
      const validCurrent = current.filter(id =>
        contacts.some(contact => contact.id === id)
      );
      return validCurrent.length > 0
        ? validCurrent
        : contacts.map(contact => contact.id);
    });
  }, [contacts]);

  const save = trpc.pdf.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.pdf.settings.invalidate();
      toast.success("PDF-Konfiguration gespeichert");
    },
    onError: error => toast.error(error.message),
  });
  const planPdf = trpc.pdf.plan.useMutation({
    onSuccess: result =>
      downloadBase64File(result.base64, result.mimeType, result.filename),
    onError: error => toast.error(error.message),
  });
  const contactOverviewPdf = trpc.pdf.contactOverview.useMutation({
    onSuccess: result =>
      downloadBase64File(result.base64, result.mimeType, result.filename),
    onError: error => toast.error(error.message),
  });
  const contactOverviewZip = trpc.pdf.contactOverviewZip.useMutation({
    onSuccess: result =>
      downloadBase64File(result.base64, result.mimeType, result.filename),
    onError: error => toast.error(error.message),
  });
  const uploadLogo = trpc.pdf.uploadLogo.useMutation({
    onSuccess: async () => {
      await utils.pdf.settings.invalidate();
      toast.success(
        `Eventlogo für ${currentEvent?.name ?? "die Veranstaltung"} gespeichert`
      );
    },
    onError: error => toast.error(error.message),
  });
  const clearLogo = trpc.pdf.clearLogo.useMutation({
    onSuccess: async () => {
      await utils.pdf.settings.invalidate();
      toast.success(
        `Eventlogo für ${currentEvent?.name ?? "die Veranstaltung"} entfernt`
      );
    },
    onError: error => toast.error(error.message),
  });

  const onLogoSelected = (file?: File) => {
    if (!file) return;
    if (!(["image/png", "image/jpeg"] as string[]).includes(file.type)) {
      toast.error("Bitte ein PNG- oder JPEG-Logo auswählen");
      return;
    }
    if (file.size > 3_000_000) {
      toast.error("Das Logo darf höchstens 3 MB groß sein");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",")[1];
      if (!base64) return toast.error("Logo konnte nicht gelesen werden");
      uploadLogo.mutate({
        base64,
        mimeType: file.type as "image/png" | "image/jpeg",
      });
    };
    reader.onerror = () => toast.error("Logo konnte nicht gelesen werden");
    reader.readAsDataURL(file);
  };

  const areas = Array.from(new Set(plan.map(item => item.shift.area))).sort();
  const effectiveLogoUrl = settings?.logoUrl ?? null;
  const mappedContactIds = Array.from(
    new Set(
      areaContacts
        .map(item => item.contactId)
        .filter((id): id is number => id !== null)
    )
  );
  const activeAreas = selectedAreas ?? areas;
  const activeContacts = selectedContacts ?? mappedContactIds;
  const mappedAreas = new Set(
    areaContacts.filter(item => item.contactId !== null).map(item => item.area)
  );
  const hasUnassignedAreas = areas.some(area => !mappedAreas.has(area));
  const allContactOptionsSelected =
    activeContacts.length === mappedContactIds.length &&
    mappedContactIds.every(id => activeContacts.includes(id)) &&
    (!hasUnassignedAreas || includeUnassignedContact);
  const allContactOverviewSelected =
    contacts.length > 0 &&
    selectedContactOverviewIds.length === contacts.length &&
    contacts.every(contact => selectedContactOverviewIds.includes(contact.id));

  const downloadAll = async () => {
    const result = await allHelpers.refetch();
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    if (result.data) {
      downloadBase64File(
        result.data.base64,
        result.data.mimeType,
        result.data.filename
      );
    }
  };

  const downloadContactOverviews = () => {
    if (!selectedContactOverviewIds.length) {
      toast.error("Bitte mindestens einen Ansprechpartner auswählen");
      return;
    }
    if (
      !contactOverviewContent.includeShifts &&
      !contactOverviewContent.includePreparation &&
      !contactOverviewContent.includePostProcessing &&
      !contactOverviewContent.includeMaterials
    ) {
      toast.error("Bitte mindestens einen Inhaltsbereich auswählen");
      return;
    }
    const input = {
      contactIds: selectedContactOverviewIds,
      ...contactOverviewContent,
    };
    if (contactOverviewExportMode === "single") {
      if (selectedContactOverviewIds.length !== 1) {
        toast.error(
          "Für ein Einzel-PDF bitte genau einen Ansprechpartner auswählen"
        );
        return;
      }
      contactOverviewPdf.mutate(input);
      return;
    }
    contactOverviewZip.mutate(input);
  };

  const downloadPlan = () => {
    if (
      !selectedDays.length ||
      !selectedStatuses.length ||
      !activeAreas.length ||
      (!activeContacts.length && !includeUnassignedContact)
    ) {
      toast.error(
        "Bitte mindestens einen Tag, Status, Bereich und Ansprechpartner-Filter auswählen"
      );
      return;
    }
    planPdf.mutate({
      mode: planMode,
      days: selectedDays,
      statuses: selectedStatuses as Array<"OFFEN" | "KNAPP" | "OK">,
      areas: activeAreas,
      contactIds: activeContacts,
      includeUnassignedContact,
    });
  };

  const toggle = <T,>(values: T[], value: T, checked: boolean) =>
    checked
      ? Array.from(new Set([...values, value]))
      : values.filter(v => v !== value);

  const updateField = <K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K]
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <PageTitle icon="pdf">PDF-Ausgabe</PageTitle>
        <p className="text-muted-foreground">
          Persönliche Aufgabenübersichten sowie frei filterbare Blanko- und
          ausgefüllte Einsatzpläne erzeugen.
        </p>
      </div>

      <div className="space-y-4">
        <PdfSection
          title="Alle Helferübersichten"
          description="Persönliche Aufgaben-PDFs nach Ansprechpartnern herunterladen."
          icon={FileArchive}
        >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="helper-contact-filter">
                  Ansprechpartner filtern
                </Label>
                <Select
                  value={helperContactFilter}
                  onValueChange={setHelperContactFilter}
                >
                  <SelectTrigger
                    id="helper-contact-filter"
                    className="min-h-11 w-full bg-white dark:bg-slate-950"
                  >
                    <SelectValue placeholder="Ansprechpartner auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Alle Ansprechpartner (Gesamt-ZIP)
                    </SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={String(contact.id)}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedHelperContact
                    ? `Erstellt ein ZIP-Archiv nur mit Helfer-PDFs für ${selectedHelperContact.name}.`
                    : "Erstellt ein Gesamt-ZIP mit allen Helfer-PDFs, sortiert nach Ansprechpartnern."}
                </p>
              </div>
              <Button
                className="min-h-11 w-full md:w-auto"
                onClick={downloadAll}
                disabled={allHelpers.isFetching}
              >
                <Download className="mr-2 h-4 w-4" />
                {allHelpers.isFetching
                  ? "PDFs werden erstellt …"
                  : selectedHelperContact
                    ? `PDFs für ${selectedHelperContact.name} herunterladen`
                    : "Alle PDFs als ZIP"}
              </Button>
            </div>
        </PdfSection>

        <PdfSection
          title="Ansprechpartner-Übersichten"
          description="Arbeitsmappen mit Bereichsverantwortung, Schichten und druckbaren Checklisten erstellen."
          icon={UsersRound}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Ansprechpartner</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedContactOverviewIds(
                      allContactOverviewSelected
                        ? []
                        : contacts.map(contact => contact.id)
                    )
                  }
                >
                  {allContactOverviewSelected
                    ? "Alle abwählen"
                    : "Alle auswählen"}
                </Button>
              </div>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
                {contacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedContactOverviewIds.includes(contact.id)}
                      onCheckedChange={checked =>
                        setSelectedContactOverviewIds(current =>
                          toggle(current, contact.id, checked === true)
                        )
                      }
                    />
                    {contact.name}
                  </label>
                ))}
                {!contacts.length && (
                  <p className="p-2 text-sm text-muted-foreground">
                    Noch keine Ansprechpartner angelegt.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedContactOverviewIds.length === contacts.length
                  ? "Alle Ansprechpartner sind ausgewählt."
                  : `${selectedContactOverviewIds.length} Ansprechpartner ausgewählt.`}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-overview-export-mode">Ausgabe</Label>
                <Select
                  value={contactOverviewExportMode}
                  onValueChange={value =>
                    setContactOverviewExportMode(value as "single" | "zip")
                  }
                >
                  <SelectTrigger
                    id="contact-overview-export-mode"
                    className="w-full bg-white dark:bg-slate-950"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">
                      Einzelnes Ansprechpartner-PDF
                    </SelectItem>
                    <SelectItem value="zip">
                      Gesamt-ZIP für die Auswahl
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {contactOverviewExportMode === "single"
                    ? "Für ein Einzel-PDF bitte genau einen Ansprechpartner auswählen."
                    : "Erstellt für jeden ausgewählten Ansprechpartner eine eigene PDF-Datei im ZIP-Archiv."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Inhalte</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    [
                      "includeShifts",
                      "Einsatzplan & Schichten",
                      "Bereichsverantwortung und eigene Schichten",
                    ],
                    [
                      "includePreparation",
                      "Vorbereitung",
                      "Gedruckte [ ]-Checkliste",
                    ],
                    [
                      "includePostProcessing",
                      "Nachbereitung",
                      "Gedruckte [ ]-Checkliste",
                    ],
                    [
                      "includeMaterials",
                      "Material",
                      "Gedruckte [ ]-Checkliste",
                    ],
                  ].map(([key, label, hint]) => {
                    const contentKey = key as keyof typeof contactOverviewContent;
                    return (
                      <label
                        key={contentKey}
                        className="flex items-start gap-2 rounded-md border bg-background p-2 text-sm"
                      >
                        <Checkbox
                          checked={contactOverviewContent[contentKey]}
                          onCheckedChange={checked =>
                            setContactOverviewContent(current => ({
                              ...current,
                              [contentKey]: checked === true,
                            }))
                          }
                        />
                        <span>
                          <span className="block font-medium">{label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button
                className="min-h-11 w-full sm:w-auto"
                onClick={downloadContactOverviews}
                disabled={
                  contactOverviewPdf.isPending || contactOverviewZip.isPending
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {contactOverviewPdf.isPending || contactOverviewZip.isPending
                  ? "PDFs werden erstellt …"
                  : contactOverviewExportMode === "single"
                    ? "Ansprechpartner-PDF herunterladen"
                    : "Ansprechpartner-PDFs als ZIP"}
              </Button>
            </div>
          </div>
        </PdfSection>

        <PdfSection
          title="Einsatzplan als PDF"
          description="Blanko- oder ausgefüllten Einsatzplan nach Tagen, Bereichen und Status filtern."
          icon={ListFilter}
        >

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Ausgabeart</Label>
                <Select
                  value={planMode}
                  onValueChange={value =>
                    setPlanMode(value as "blank" | "filled")
                  }
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">
                      Blanko-Einsatzplan zum Ausfüllen
                    </SelectItem>
                    <SelectItem value="filled">
                      Gefüllter Einsatzplan mit Helfern
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tage</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {activeDays.map(value => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedDays.includes(value)}
                        onCheckedChange={checked =>
                          setSelectedDays(current =>
                            toggle(current, value, checked === true)
                          )
                        }
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Bereiche</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedAreas(
                        activeAreas.length === areas.length ? [] : areas
                      )
                    }
                  >
                    {activeAreas.length === areas.length
                      ? "Alle abwählen"
                      : "Alle auswählen"}
                  </Button>
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
                  {areas.map(value => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={activeAreas.includes(value)}
                        onCheckedChange={checked =>
                          setSelectedAreas(
                            toggle(activeAreas, value, checked === true)
                          )
                        }
                      />
                      {value}
                    </label>
                  ))}
                  {!areas.length && (
                    <p className="p-2 text-sm text-muted-foreground">
                      Noch keine Schichten angelegt.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["OFFEN", "KNAPP", "OK"].map(value => (
                      <label
                        key={value}
                        className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedStatuses.includes(value)}
                          onCheckedChange={checked =>
                            setSelectedStatuses(current =>
                              toggle(current, value, checked === true)
                            )
                          }
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Bereichsansprechpartner</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedContacts(
                          allContactOptionsSelected ? [] : mappedContactIds
                        );
                        setIncludeUnassignedContact(
                          allContactOptionsSelected ? false : hasUnassignedAreas
                        );
                      }}
                    >
                      {allContactOptionsSelected
                        ? "Alle abwählen"
                        : "Alle auswählen"}
                    </Button>
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
                    {contacts
                      .filter(contact => mappedContactIds.includes(contact.id))
                      .map(contact => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={activeContacts.includes(contact.id)}
                            onCheckedChange={checked =>
                              setSelectedContacts(
                                toggle(
                                  activeContacts,
                                  contact.id,
                                  checked === true
                                )
                              )
                            }
                          />
                          {contact.name}
                        </label>
                      ))}
                    {hasUnassignedAreas && (
                      <label className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted">
                        <Checkbox
                          checked={includeUnassignedContact}
                          onCheckedChange={checked =>
                            setIncludeUnassignedContact(checked === true)
                          }
                        />
                        Ohne zugeordneten Ansprechpartner
                      </label>
                    )}
                    {!mappedContactIds.length && !hasUnassignedAreas && (
                      <p className="p-2 text-sm text-muted-foreground">
                        Noch keine Einsatzplanbereiche vorhanden.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={downloadPlan} disabled={planPdf.isPending}>
              <Download className="mr-2 h-4 w-4" />
              {planPdf.isPending
                ? "PDF wird erstellt …"
                : planMode === "blank"
                  ? "Gefilterten Blanko-Plan erzeugen"
                  : "Gefüllten Einsatzplan erzeugen"}
            </Button>
        </PdfSection>
      </div>

      {canManage && (
      <PdfSection
        title="Vorlage frei konfigurieren"
        description="PDF-Titel, Eventlogo, Zusatzspalten und Hinweise für die aktuelle Veranstaltung verwalten."
        icon={ClipboardCheck}
      >
          {isLoading ? (
            <p className="text-muted-foreground">
              Konfiguration wird geladen …
            </p>
          ) : (
            <>
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white">
                    {effectiveLogoUrl ? (
                      <img
                        src={effectiveLogoUrl}
                        alt="Aktuelles Eventlogo dieser Veranstaltung"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <ImageUp className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <Label htmlFor="pdf-logo">
                        Eventlogo für {currentEvent?.name ?? "diese Veranstaltung"}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        PNG oder JPEG bis 3 MB. Das Bild erscheint im Dashboard-Zähler
                        und in den PDF-Ausgaben der aktuell ausgewählten Veranstaltung.
                        Ohne eigenes Bild wird im Dashboard das Standardlogo verwendet.
                      </p>
                    </div>
                    {canManage && (
                      <Input
                      id="pdf-logo"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={
                        uploadLogo.isPending ||
                        clearLogo.isPending
                      }
                      onChange={event => {
                        onLogoSelected(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                    )}
                    {(uploadLogo.isPending || clearLogo.isPending) && (
                      <p className="text-xs font-medium text-primary">
                        {uploadLogo.isPending
                          ? "Bild wird hochgeladen …"
                          : "Bild wird entfernt …"}
                      </p>
                    )}
                    {canManage && settings?.logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={
                          uploadLogo.isPending ||
                          clearLogo.isPending
                        }
                        onClick={() => clearLogo.mutate()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Bild dieser Veranstaltung entfernen
                      </Button>
                    )}
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="pdf-logo-fallback">
                        Verhalten ohne individuelles Bild
                      </Label>
                      <Select value="none" disabled>
                        <SelectTrigger
                          id="pdf-logo-fallback"
                          className="w-full bg-white dark:bg-slate-950 sm:max-w-sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kein Bild drucken</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-name">Veranstaltungsname</Label>
                  <Input id="event-name" value={form.eventName} disabled />
                  <p className="text-xs text-muted-foreground">
                    Wird aus der oben gewählten Veranstaltung übernommen.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-year">Jahr / Zusatz</Label>
                  <Input id="event-year" value={form.eventYear} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="helper-title">Titel der Helfer-PDFs</Label>
                  <Input
                    id="helper-title"
                    value={form.helperPdfTitle}
                    onChange={event =>
                      updateField("helperPdfTitle", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="blank-title">Titel des Blanko-Plans</Label>
                  <Input
                    id="blank-title"
                    value={form.blankPlanTitle}
                    onChange={event =>
                      updateField("blankPlanTitle", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-label">
                    Bezeichnung Ansprechpartner
                  </Label>
                  <Input
                    id="contact-label"
                    value={form.contactLabel}
                    onChange={event =>
                      updateField("contactLabel", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="blank-rows">Mindestzeilen je Schicht</Label>
                  <Input
                    id="blank-rows"
                    type="number"
                    min={0}
                    max={20}
                    value={form.blankRowsPerShift}
                    onChange={event =>
                      updateField(
                        "blankRowsPerShift",
                        Math.max(
                          0,
                          Math.min(20, Number(event.target.value) || 0)
                        )
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0 verwendet automatisch den hinterlegten Helferbedarf.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Zusätzliche Blanko-Spalten</Label>
                    <p className="text-xs text-muted-foreground">
                      Bis zu fünf frei benennbare Spalten, z. B. Mobilnummer,
                      Bestätigung oder Notiz.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={form.extraColumns.length >= 5}
                    onClick={() =>
                      updateField("extraColumns", [
                        ...form.extraColumns,
                        "Neue Spalte",
                      ])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Spalte
                  </Button>
                </div>
                {form.extraColumns.map((column, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      aria-label={`Zusatzspalte ${index + 1}`}
                      value={column}
                      onChange={event => {
                        const next = [...form.extraColumns];
                        next[index] = event.target.value;
                        updateField("extraColumns", next);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Spalte entfernen"
                      onClick={() =>
                        updateField(
                          "extraColumns",
                          form.extraColumns.filter(
                            (_, current) => current !== index
                          )
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="footer">Fußzeile / Hinweis</Label>
                <Input
                  id="footer"
                  value={form.footerText}
                  onChange={event =>
                    updateField("footerText", event.target.value)
                  }
                  placeholder="Optionaler Hinweis auf allen PDFs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp-message-template">
                  WhatsApp-Nachricht beim PDF-Teilen
                </Label>
                <textarea
                  id="whatsapp-message-template"
                  value={form.whatsAppMessageTemplate}
                  onChange={event =>
                    updateField("whatsAppMessageTemplate", event.target.value)
                  }
                  className="min-h-52 w-full rounded-md border border-input bg-white px-3 py-2 text-base text-slate-950 shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder={DEFAULT_WHATSAPP_MESSAGE_TEMPLATE}
                />
                <p className="text-xs text-muted-foreground">
                  Der Platzhalter <code>{"{EVENT_NAME}"}</code> wird beim Teilen
                  automatisch durch die aktuell ausgewählte Veranstaltung ersetzt.
                  Der Platzhalter <code>{"{PDF_LINK}"}</code> wird durch den
                  persönlichen, 90 Tage gültigen PDF-Link ersetzt.
                </p>
              </div>

              {canManage ? (
                <Button
                onClick={() => save.mutate(form)}
                disabled={
                  save.isPending ||
                  !form.eventName.trim() ||
                  !form.blankPlanTitle.trim() ||
                  !form.whatsAppMessageTemplate.trim()
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {save.isPending ? "Speichert …" : "Konfiguration speichern"}
              </Button>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Hinweis: Die PDF-Grundeinstellungen können nur von Administratoren geändert werden.
                </p>
              )}
            </>
          )}
      </PdfSection>
      )}
    </div>
  );
}
