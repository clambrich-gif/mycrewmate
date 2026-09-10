import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Download,
  FileArchive,
  ListFilter,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SettingsForm = {
  eventName: string;
  eventYear: string;
  helperPdfTitle: string;
  blankPlanTitle: string;
  contactLabel: string;
  footerText: string;
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
  extraColumns: [],
  blankRowsPerShift: 0,
};

export default function PdfExport() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.pdf.settings.useQuery();
  const allHelpers = trpc.pdf.allHelpers.useQuery(undefined, {
    enabled: false,
  });
  const { data: plan = [] } = trpc.plan.evaluate.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: areaContacts = [] } = trpc.plan.areaContacts.useQuery();
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [planMode, setPlanMode] = useState<"blank" | "filled">("blank");
  const [selectedDays, setSelectedDays] = useState([
    "Freitag",
    "Samstag",
    "Sonntag",
  ]);
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

  useEffect(() => {
    if (!settings) return;
    setForm({
      eventName: settings.eventName,
      eventYear: settings.eventYear,
      helperPdfTitle: settings.helperPdfTitle,
      blankPlanTitle: settings.blankPlanTitle,
      contactLabel: settings.contactLabel,
      footerText: settings.footerText,
      extraColumns: settings.extraColumns,
      blankRowsPerShift: settings.blankRowsPerShift,
    });
  }, [settings]);

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

  const areas = Array.from(new Set(plan.map(item => item.shift.area))).sort();
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
      days: selectedDays as Array<"Freitag" | "Samstag" | "Sonntag">,
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
        <h1 className="text-2xl font-bold">PDF-Ausgabe</h1>
        <p className="text-muted-foreground">
          Persönliche Aufgabenübersichten sowie frei filterbare Blanko- und
          ausgefüllte Einsatzpläne erzeugen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileArchive className="h-5 w-5" /> Alle Helferübersichten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Erstellt pro Helfer ein separates PDF und bündelt alle Dateien
              nach Ansprechpartnern in einer ZIP-Datei. Jede Übersicht enthält
              Aufgaben, Zeiten, Mithelfer sowie Name und Rufnummer des
              Ansprechpartners.
            </p>
            <Button onClick={downloadAll} disabled={allHelpers.isFetching}>
              <Download className="mr-2 h-4 w-4" />
              {allHelpers.isFetching
                ? "PDFs werden erstellt …"
                : "Alle PDFs als ZIP"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListFilter className="h-5 w-5" /> Einsatzplan als PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Erzeugt wahlweise einen Blanko-Plan oder den aktuell ausgefüllten
              Einsatzplan. Nur die angehakten Tage, Bereiche, Statuswerte und
              Bereichsansprechpartner werden aufgenommen.
            </p>

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
                <div className="grid grid-cols-3 gap-2">
                  {["Freitag", "Samstag", "Sonntag"].map(value => (
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
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Vorlage frei konfigurieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="text-muted-foreground">
              Konfiguration wird geladen …
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-name">Veranstaltungsname</Label>
                  <Input
                    id="event-name"
                    value={form.eventName}
                    onChange={event =>
                      updateField("eventName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-year">Jahr / Zusatz</Label>
                  <Input
                    id="event-year"
                    value={form.eventYear}
                    onChange={event =>
                      updateField("eventYear", event.target.value)
                    }
                  />
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

              <Button
                onClick={() => save.mutate(form)}
                disabled={
                  save.isPending ||
                  !form.eventName.trim() ||
                  !form.blankPlanTitle.trim()
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {save.isPending ? "Speichert …" : "Konfiguration speichern"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
