import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import {
  Download,
  FileArchive,
  FileText,
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
  const blankPlan = trpc.pdf.blankPlan.useQuery(undefined, { enabled: false });
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);

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

  const downloadBlank = async () => {
    const result = await blankPlan.refetch();
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
          Persönliche Aufgabenübersichten nach dem Muster der Anlage und einen
          frei konfigurierbaren Blanko-Einsatzplan erzeugen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
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

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" /> Blanko-Einsatzplan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Erstellt einen ausfüllbaren Querformat-Plan aus allen angelegten
              Schichten. Zeilenanzahl und zusätzliche Spalten werden über die
              Konfiguration bestimmt.
            </p>
            <Button
              variant="outline"
              onClick={downloadBlank}
              disabled={blankPlan.isFetching}
            >
              <Download className="mr-2 h-4 w-4" />
              {blankPlan.isFetching
                ? "PDF wird erstellt …"
                : "Blanko-Plan als PDF"}
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
