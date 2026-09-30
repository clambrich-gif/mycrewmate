import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardDetailsLayout } from "@/hooks/useDashboardDetailsLayout";
import { createDashboardKlemmiSteps } from "@/lib/dashboard-klemmi-tour";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Datenfreie lokale Vorschau der Dashboard-Tour. Ausschließlich im DEV-Router
 * registriert und ohne Verbindung zu Konten oder echten Planungsdaten.
 */
export default function KlemmiDashboardPreview() {
  const [emptyState, setEmptyState] = useState(
    () => new URLSearchParams(window.location.search).get("leer") === "1"
  );
  const detailsLayout = useDashboardDetailsLayout();
  const steps = useMemo(
    () =>
      createDashboardKlemmiSteps({
        hasEventPeriod: !emptyState,
        hasPriorityActions: !emptyState,
        hasDeadlines: !emptyState,
        hasHelpers: !emptyState,
        hasAssignments: !emptyState,
        hasContacts: !emptyState,
        hasMappableLocations: !emptyState,
        canUseMapsGpx: true,
        canUseDonations: true,
        currentPackageId: "pro",
        detailsLayout,
      }),
    [detailsLayout, emptyState]
  );

  return (
    <main className="min-h-dvh bg-slate-50 p-4 text-slate-950 sm:p-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">Staging-Prototyp · keine Echtdaten</p>
            <h1 className="mt-0.5 text-xl font-bold">Klemmi erklärt das Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Die Tour reagiert in der echten Anwendung auf sichtbare Daten und Leerzustände.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={emptyState ? "outline" : "default"}
              className="min-h-11"
              onClick={() => setEmptyState(false)}
            >
              Gefülltes Dashboard
            </Button>
            <Button
              type="button"
              variant={emptyState ? "default" : "outline"}
              className="min-h-11"
              onClick={() => setEmptyState(true)}
            >
              Leerer Startzustand
            </Button>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-wide text-blue-700 uppercase">MyCrewMate</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Dashboard</h2>
              <p className="mt-1 text-sm text-slate-600">Die wichtigsten nächsten Schritte stehen zuerst.</p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <KlemmiSurfaceGuide
                guideId="dashboard"
                title="Dein Dashboard auf einen Blick"
                introText="Hier laufen die Informationen aus deiner Planung zusammen. Ich zeige dir jetzt nur die Bereiche, die auf diesem Dashboard wirklich sichtbar sind."
                steps={steps}
                successSignal={null}
                completionTitle="Alles im Blick!"
                completionText="Du weißt jetzt, wo das Dashboard den aktuellen Planungsstand zeigt – und welche Eingaben die einzelnen Übersichten füllen."
              />
              <section data-slot="event-countdown" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm sm:w-72">
                {emptyState ? "Zeitraum im Event einstellen" : "Noch 77 Tage bis zur Weihnachtsfeier"}
              </section>
            </div>
          </div>

          <section data-dashboard-section="Heute priorisieren" className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
            <h3 className="text-sm font-extrabold tracking-wide uppercase">Heute priorisieren</h3>
            {emptyState ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <CheckCircle2 className="size-5 shrink-0" /> Keine dringenden Punkte
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border-l-4 border-red-400 bg-red-50 p-4"><strong>4 offene Schichten</strong><p className="mt-1 text-sm">Helferbedarf noch nicht gedeckt</p></div>
                <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4"><strong>2 offene Vorbereitungen</strong><p className="mt-1 text-sm">Aufgaben und Verantwortlichkeiten prüfen</p></div>
              </div>
            )}
          </section>

          {!emptyState && (
            <section data-dashboard-level="Fristen">
              <Card data-dashboard-section="Nächste Fristen">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-5 text-blue-700" />Nächste Fristen</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>Freitag</strong><br />Beschilderung abstimmen</div><div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>Samstag</strong><br />Sanitätsdienst bestätigen</div></CardContent>
              </Card>
            </section>
          )}

          <section data-dashboard-section="Helfer-Kennzahlen" className="grid gap-3 md:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-base">Einsatzbereitschaft</CardTitle></CardHeader><CardContent className="text-sm">{emptyState ? "Schichten mit Bedarf anlegen" : "Samstag: 8 / 10 besetzt"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Helfer-Status</CardTitle></CardHeader><CardContent className="text-sm">{emptyState ? "Helfer anlegen, um Quoten zu sehen" : "16 / 18 Helfer erstkontaktiert"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Verpflegungsspenden</CardTitle></CardHeader><CardContent className="text-sm">{emptyState ? "Spenden erscheinen nach der Erfassung" : "Kuchen: 6 / 10 · Salate: 3 / 5"}</CardContent></Card>
          </section>

          <section data-dashboard-level="Tabellendetails" className="grid gap-3 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">Verantwortlichkeiten</CardTitle></CardHeader><CardContent className="text-sm">{emptyState ? "Noch keine Ansprechpartner angelegt." : "Anne Fehling · 4 Helfer · 2 Vorbereitungen"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="size-5 text-blue-700" />Helferauslastung</CardTitle></CardHeader><CardContent className="text-sm">{emptyState ? "Noch keine Helfer eingeteilt." : "Arno Weber · Samstag: 2 Schichten"}</CardContent></Card>
          </section>

          <section data-dashboard-level="Live-Standortkarte">
            <Card data-dashboard-section="Live-Standortkarte"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-5 text-blue-700" />Live-Standortkarte</CardTitle></CardHeader><CardContent><div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-600">{emptyState ? "Noch keine Orte hinterlegt. Orte & Standorte öffnen, um die Karte zu aktivieren." : "Karte mit den Standorten Pumptrack, Kuchenstand und VP 8"}</div></CardContent></Card>
          </section>
        </div>
      </section>
    </main>
  );
}
