import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TaskGeneric from "./TaskGeneric";

export default function Materials() {
  const [packlistDialogOpen, setPacklistDialogOpen] = useState(false);
  const [packlistMaterialIds, setPacklistMaterialIds] = useState<number[]>([]);
  const [packlistIncludesNotes, setPacklistIncludesNotes] = useState(true);
  const packlist = trpc.pdf.materialPacklist.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Material-Packliste wurde als PDF erstellt");
    },
    onError: error => toast.error(error.message),
  });

  const openPacklistDialog = (visibleRows: Array<Record<string, unknown>>) => {
    const materialIds = visibleRows
      .map(row => Number(row.id))
      .filter(id => Number.isSafeInteger(id) && id > 0);
    if (materialIds.length === 0) {
      toast.message("Für die aktuelle Auswahl sind keine Materialartikel sichtbar.");
      return;
    }
    setPacklistMaterialIds(materialIds);
    // Der bisherige Ausdruck enthielt Notizen bereits automatisch.
    setPacklistIncludesNotes(true);
    setPacklistDialogOpen(true);
  };

  const createPacklist = () => {
    if (packlistMaterialIds.length === 0 || packlist.isPending) return;
    setPacklistDialogOpen(false);
    packlist.mutate({
      materialIds: packlistMaterialIds,
      includeNotes: packlistIncludesNotes,
    });
  };

  return (
    <>
      <TaskGeneric
        kind="materials"
        title="Material"
        titleIcon="materials"
        addLabel="Artikel"
        nameKey="article"
        klemmiGuide={{
          guideId: "materials",
          title: "Material schnell und sauber erfassen",
          introText:
            "Ich zeige dir die echte Materialanlage: Artikel benennen, Menge eintragen, direkt eine zuständige Person auswählen und den Einsatzort eindeutig festhalten.",
          completionTitle: "Materialposition angelegt!",
          completionText:
            "Der Artikel ist jetzt im Materialplan. Zuständigkeit, Status und Ort können später jederzeit angepasst werden.",
          steps: [
            {
              key: "intro",
              selector: '[data-klemmi-target="materials-new"]',
              eyebrow: "Klemmi zeigt’s",
              title: "Material schnell und sauber erfassen",
              text: "Ich führe dich direkt durch die echte Anlage.",
              action: "Artikel anlegen",
            },
            {
              key: "name",
              selector: '[data-klemmi-target="materials-name"]',
              eyebrow: "Schritt 1 von 5",
              title: "Artikel klar benennen",
              text: "Trage zuerst ein, was benötigt wird – zum Beispiel Bierzeltgarnitur, Kabeltrommel oder Kaffeebecher.",
              action: "Menge ergänzen",
            },
            {
              key: "details",
              selector: '[data-klemmi-target="materials-details"]',
              eyebrow: "Schritt 2 von 5",
              title: "Menge und Einordnung festhalten",
              text: "Menge, Einheit und Kategorie machen den Bedarf nachvollziehbar. Den Beschaffungsstand und Einsatzort ergänzst du direkt bei der Anlage.",
              action: "Zuständigkeit zeigen",
            },
            {
              key: "responsible",
              selector: '[data-klemmi-target="materials-responsible"]',
              eyebrow: "Schritt 3 von 5",
              title: "Zuständigkeit direkt zuordnen",
              text: "Wähle bei der Anlage schon die Person, die für Beschaffung, Bereitstellung oder Rückgabe zuständig ist. So erscheint der Artikel sofort in der richtigen persönlichen Ansicht und nichts bleibt ohne Ansprechpartner.",
              action: "Speichern zeigen",
            },
            {
              key: "save",
              selector: '[data-klemmi-target="materials-save"]',
              eyebrow: "Schritt 4 von 5",
              title: "Materialposition speichern",
              text: "Klicke auf den markierten Speichern-Button. Erst dein Klick legt den Artikel tatsächlich im Materialplan an.",
              waitsForSuccess: true,
              completeOnSuccess: false,
            },
            {
              key: "notebook",
              selector: '[data-klemmi-target="materials-notebook"]',
              eyebrow: "Schritt 5 von 5",
              title: "Wichtige Materialhinweise festhalten",
              text: "Im Notizbuch sammelst du Hinweise direkt am Artikel – zum Beispiel Lagerort, Übergabe oder Rückgabe. Jeder Eintrag bleibt mit Zeitpunkt und Name nachvollziehbar.",
              action: "Übersicht zeigen",
            },
          ],
        }}
        columns={[
          { key: "category", label: "Kategorie" },
          { key: "quantity", label: "Menge" },
          { key: "unit", label: "Einheit" },
        ]}
        extraField={{
          key: "status",
          label: "Stand",
          options: [
            { v: "offen", l: "🔴 Offen" },
            { v: "bestellt", l: "🟡 Bestellt" },
            { v: "geliefert", l: "🟢 Geliefert" },
          ],
        }}
        noStatus
        locationField
        createResponsibleField
        deletionRequiresContact
        createInDialog
        createDialogTitle="Neuen Artikel anlegen"
        createTriggerLabel="Neuer Artikel"
        createButtonClassName="border-rose-700 bg-rose-600 text-base font-semibold text-white shadow-xs hover:bg-rose-700 hover:text-white focus-visible:ring-rose-500"
        headerLayout="stacked"
        clearAssignmentsArea="materials"
        viewModeStorageKey="materials"
        filterConfig={{
          categoryKey: "category",
          categoryLabel: "Kategorien",
          statusKey: "status",
          statusLabel: "Stände",
          searchPlaceholder: "Suchen (Artikel/Kategorie/Verantwortlicher/Ort) …",
        }}
        headerActions={({ visibleRows }) => (
          <Button
            type="button"
            variant="outline"
            className="h-11 border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
            disabled={packlist.isPending}
            onClick={() => openPacklistDialog(visibleRows)}
          >
            <Printer className="mr-2 size-4" aria-hidden="true" />
            {packlist.isPending ? "PDF wird erstellt …" : "PDF drucken"}
          </Button>
        )}
      />

      <Dialog open={packlistDialogOpen} onOpenChange={setPacklistDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Material-Packliste erstellen</DialogTitle>
            <DialogDescription>
              Wähle, ob die Notizbucheinträge der aktuell angezeigten Artikel im PDF erscheinen sollen.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={packlistIncludesNotes ? "with-notes" : "without-notes"}
            onValueChange={value => setPacklistIncludesNotes(value === "with-notes")}
            className="grid gap-3"
          >
            <Label
              htmlFor="material-packlist-with-notes"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-slate-900"
            >
              <RadioGroupItem
                id="material-packlist-with-notes"
                value="with-notes"
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span className="font-semibold">Mit Notizen</span>
                <span className="text-sm font-normal text-slate-600">
                  Lagerorte, Übergaben und weitere Materialhinweise mit ausdrucken.
                </span>
              </span>
            </Label>
            <Label
              htmlFor="material-packlist-without-notes"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
            >
              <RadioGroupItem
                id="material-packlist-without-notes"
                value="without-notes"
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span className="font-semibold">Ohne Notizen</span>
                <span className="text-sm font-normal text-slate-600">
                  Eine kompakte Packliste nur mit Artikel, Menge, Ort, Stand und Zuständigkeit erstellen.
                </span>
              </span>
            </Label>
          </RadioGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPacklistDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={packlistMaterialIds.length === 0 || packlist.isPending}
              onClick={createPacklist}
            >
              {packlist.isPending ? "PDF wird erstellt …" : "PDF erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
