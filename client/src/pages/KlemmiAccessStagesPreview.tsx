import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EDITABLE_PLANNING_MODULES,
  PLANNING_MODULE_META,
  type EditablePlanningModule,
  type PlanningModuleAccess,
  type PlanningModuleAccessLevel,
} from "@shared/tenant-permissions";
import {
  PLANNING_ACCESS_STAGES,
  PLANNING_ACCESS_STAGE_META,
  planningAccessStageDefaults,
  planningAccessStageExceptionCount,
  type PlanningAccessStageId,
} from "@shared/planning-access-stages";
import { RotateCcw, ShieldCheck, UserCheck, Plus, Pencil, Trash2 } from "lucide-react";

export default function KlemmiAccessStagesPreview() {
  const [activeStage, setActiveStage] = useState<PlanningAccessStageId>("stage_1");
  const [moduleAccess, setModuleAccess] = useState<PlanningModuleAccess>(() =>
    planningAccessStageDefaults("stage_1")
  );
  const [label, setLabel] = useState("Petra Mustermann");
  const [email, setEmail] = useState("petra@sportverein.de");

  const meta = PLANNING_ACCESS_STAGE_META[activeStage];
  const exceptionCount = planningAccessStageExceptionCount(moduleAccess, activeStage);

  const applyStage = (stage: PlanningAccessStageId) => {
    setActiveStage(stage);
    setModuleAccess(planningAccessStageDefaults(stage));
  };

  const setLevel = (module: EditablePlanningModule, level: PlanningModuleAccessLevel) => {
    setModuleAccess(curr => ({ ...curr, [module]: level }));
  };

  return (
    <main className="min-h-dvh bg-slate-100 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-900">
                Schutz &amp; Protokoll · Administrator-Ansicht
              </span>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Planungsteam-Zugänge mit 4-Stufen-Modell
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Rechte schrittweise nach Aufgabenphase freigeben. Individuelle Ausnahmen jederzeit zuschaltbar.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Sicherheitsbereich · Vereinsadministration</span>
            </div>
          </div>
        </header>

        {/* Dialog / Bearbeitungsformular */}
        <Card className="border-orange-300 bg-white shadow-md">
          <CardHeader className="border-b bg-orange-50/50 pb-4">
            <CardTitle className="text-lg text-slate-900">
              Zugang bearbeiten – {label}
            </CardTitle>
            <p className="text-xs text-slate-600">
              Persönlicher Zugang für Ansprechpartner. Keine Master- oder Serverrechte.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Name / Bezeichnung
                </label>
                <Input
                  className="mt-1 bg-slate-50"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  E-Mail-Adresse für Einladung
                </label>
                <Input
                  className="mt-1 bg-slate-50"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* 4 Stufen-Auswahl */}
            <section className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Freigabestufe auswählen
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Wähle die passende Phase für diesen Ansprechpartner:
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-orange-300 bg-white text-orange-900 hover:bg-orange-100"
                  onClick={() => applyStage(activeStage)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Stufe wiederherstellen
                </Button>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {PLANNING_ACCESS_STAGES.map(stage => {
                  const sMeta = PLANNING_ACCESS_STAGE_META[stage];
                  const isCurrent = activeStage === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => applyStage(stage)}
                      className={
                        isCurrent
                          ? "rounded-lg border-2 border-orange-500 bg-white p-3 text-left shadow-sm"
                          : "rounded-lg border border-orange-200 bg-white/70 p-3 text-left transition-colors hover:border-orange-400 hover:bg-white"
                      }
                    >
                      <span className="block text-xs font-bold uppercase tracking-wide text-orange-700">
                        Stufe {sMeta.number}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-slate-900">
                        {sMeta.shortTitle}
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-slate-600">
                        {sMeta.focus}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-lg border border-orange-200 bg-white px-3.5 py-2.5 text-xs text-slate-700">
                <strong className="text-slate-900">{meta.title}:</strong> {meta.description}
                {exceptionCount > 0 ? (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                    {exceptionCount} individuelle {exceptionCount === 1 ? "Ausnahme" : "Ausnahmen"} aktiv
                  </span>
                ) : (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-900">
                    Exakt auf Stufen-Standard
                  </span>
                )}
              </div>
            </section>

            {/* Dreistufen-Matrix der Fachbereiche */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Fachbereichsrechte (mit individuellen Ausnahmen)
                </h3>
                <span className="text-xs text-slate-500">
                  Dreifachschalter: Aus · Lesen · Schreiben
                </span>
              </div>

              <div className="divide-y rounded-xl border bg-slate-50/60">
                {EDITABLE_PLANNING_MODULES.map(module => {
                  const mMeta = PLANNING_MODULE_META[module];
                  const level = moduleAccess[module] ?? "off";
                  const stageDefaultLevel = meta.defaults[module] ?? "off";
                  const isModified = level !== stageDefaultLevel;

                  return (
                    <div
                      key={module}
                      className={`flex flex-wrap items-center justify-between gap-3 p-3 transition-colors ${
                        isModified ? "bg-amber-50/60" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {mMeta.label}
                          </span>
                          {isModified && (
                            <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900 uppercase">
                              Ausnahme
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{mMeta.description}</p>
                      </div>

                      <div className="flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => setLevel(module, "off")}
                          className={`rounded px-2.5 py-1 text-xs font-semibold ${
                            level === "off"
                              ? "bg-slate-700 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Aus
                        </button>
                        <button
                          type="button"
                          onClick={() => setLevel(module, "read")}
                          className={`rounded px-2.5 py-1 text-xs font-semibold ${
                            level === "read"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Lesen
                        </button>
                        <button
                          type="button"
                          onClick={() => setLevel(module, "write")}
                          className={`rounded px-2.5 py-1 text-xs font-semibold ${
                            level === "write"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Schreiben
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Übersicht bestehender Zugänge */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b bg-slate-50/70 py-3">
            <CardTitle className="text-base text-slate-900">
              Vorhandene Planungsteam-Zugänge ({meta.shortTitle})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            <div className="flex items-center justify-between p-4">
              <div>
                <span className="font-semibold text-slate-900">Petra Mustermann</span>
                <span className="ml-2 rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-900">
                  {meta.shortTitle}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">petra@sportverein.de · Letzter Login: heute, 14:12 Uhr</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-8">Bearbeiten</Button>
                <Button size="sm" variant="ghost" className="h-8 text-destructive">Löschen</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
