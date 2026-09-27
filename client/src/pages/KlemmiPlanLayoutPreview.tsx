import { KlemmiActionPanel } from "@/components/KlemmiActionPanel";
import { KlemmiSurfaceGuide, type KlemmiSurfaceStep } from "@/components/KlemmiSurfaceGuide";
import { ViewModeToggle, type ViewMode } from "@/components/ViewModeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

const PREVIEW_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="plan-new"]',
    eyebrow: "Klemmi zeigt’s",
    title: "Schichten Schritt für Schritt anlegen",
    text: "In dieser Vorschau kannst du die Box am Griff verschieben. So bleiben die gerade markierten Felder frei sichtbar.",
    action: "Neue Schicht hervorheben",
  },
  {
    key: "basics",
    selector: '[data-klemmi-target="plan-basics"]',
    eyebrow: "Schritt 1 von 1",
    title: "Bereich und Zeitfenster im Blick",
    text: "Der orange Rahmen zeigt den echten Zielbereich. Ziehe die Klemmi-Box bei Bedarf an den Greifpunkt, um die Details dahinter anzusehen.",
    action: "Fertig",
  },
];

/** Datenfreie lokale Vorschau für die kompakte Einsatzplan-Leiste und die verschiebbare Klemmi-Box. */
export default function KlemmiPlanLayoutPreview() {
  const [viewMode, setViewMode] = useState<ViewMode>("kacheln");

  return (
    <main className="min-h-dvh bg-slate-50 p-4 text-slate-950 sm:p-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
            Staging-Prototyp · keine Echtdaten
          </p>
          <h1 className="mt-0.5 text-xl font-bold">Einsatzplan: kompaktes Aktionsraster</h1>
          <p className="mt-1 text-sm text-slate-600">
            Die Klemmi-Box lässt sich über den kleinen Griff am oberen Rand mit Maus oder Finger verschieben.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
            <div className="min-w-0 max-w-4xl lg:pt-1">
              <p className="text-xs font-bold tracking-wide text-blue-700 uppercase">MyCrewMate</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Einsatzplan</h2>
              <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
                Nur verfügbare, aktive Helfer sind auswählbar. Neue Schichten werden zuerst mit Bereich, Aufgabe, Zeitfenster und benötigter Helferzahl angelegt.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:shrink-0">
              <KlemmiActionPanel
                className="lg:ml-0"
                viewControl={<ViewModeToggle mode={viewMode} onChange={setViewMode} />}
                guide={
                  <KlemmiSurfaceGuide
                    guideId="plan"
                    title="Schichten Schritt für Schritt anlegen"
                    introText="Ich zeige dir die kompakte Leiste und wie du meine Erklärbox bei Bedarf frei verschiebst."
                    steps={PREVIEW_STEPS}
                    successSignal={null}
                    completionTitle="Alles sichtbar!"
                    completionText="Du kannst Klemmi jederzeit am Griff verschieben und die echten Felder dahinter frei ansehen."
                  />
                }
                secondaryActions={
                  <>
                    <Button type="button" variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                      <Copy className="mr-1.5 size-4" /> Plan übernehmen
                    </Button>
                    <Button type="button" variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                      <RotateCcw className="mr-1.5 size-4" /> Zurücksetzen
                    </Button>
                  </>
                }
                primaryAction={
                  <Button
                    type="button"
                    data-klemmi-target="plan-new"
                    className="h-10 bg-blue-600 px-4 text-base font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="mr-2 size-4" /> Neue Schicht
                  </Button>
                }
              />
            </div>
          </div>

          <Card data-klemmi-target="plan-basics" className="border-orange-200 bg-orange-50/40 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-bold">Neue Schicht: Bereich und Zeitfenster</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-3 text-sm"><strong>Bereich</strong><br />Catering</div>
                <div className="rounded-xl border bg-white p-3 text-sm"><strong>Aufgabe</strong><br />Kuchenstand betreuen</div>
                <div className="rounded-xl border bg-white p-3 text-sm"><strong>Zeit</strong><br />Samstag · 12:00–15:00</div>
              </div>
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
