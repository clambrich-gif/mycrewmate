import {
  getHelpAudienceForRole,
  HELP_AUDIENCE_FILTERS,
  HELP_CHAPTER_COUNT,
  HelpGuide,
  type HelpAudience,
} from "@/components/HelpGuide";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HELP_KLEMMI_STEPS } from "@/lib/klemmi-area-tours";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { ArrowRight, BookOpen, GraduationCap, Play, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function Help() {
  const { user } = useAuth();
  const { isTenantAdmin } = useTenantAdministration();
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<HelpAudience>("all");
  const [hasManualAudienceSelection, setHasManualAudienceSelection] =
    useState(false);

  useEffect(() => {
    if (!hasManualAudienceSelection) {
      setAudience(getHelpAudienceForRole(user?.role));
    }
  }, [hasManualAudienceSelection, user?.role]);

  const handleQuickSearch = (
    label: string,
    targetAudience?: Exclude<HelpAudience, "all">
  ) => {
    if (targetAudience === "admin") {
      setHasManualAudienceSelection(true);
      setAudience("admin");
    } else if (targetAudience === "planning" && audience !== "admin") {
      setHasManualAudienceSelection(true);
      setAudience("planning");
    }
    setQuery(label);
    window.requestAnimationFrame(() => {
      document.getElementById("help-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-blue-700">
            <BookOpen className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              MyCrewMate Hilfe-Center
            </span>
          </div>
          <PageTitle icon="help">Anleitung, Wissen &amp; Zusammenarbeit</PageTitle>
          <p className="mt-2 leading-6 text-slate-600">
            Durchsuchen Sie die wichtigsten Abläufe von der ersten Orientierung bis zu Schutz, Import und Abschluss. Die Rollenfilter zeigen die passenden Arbeitsschritte für Planungsteam und Administration.
          </p>
          <div className="mt-3">
            <KlemmiSurfaceGuide
              guideId="help"
              title="Hilfe-Center verstehen"
              introText="Ich zeige dir, wie du die passende Anleitung findest, nach deiner Rolle filterst und direkt in den jeweiligen Bereich weitergehst."
              steps={HELP_KLEMMI_STEPS}
              successSignal={null}
            />
          </div>
        </div>
      </header>

      {/* WBT-Lernwerkstatt Schnellzugriff */}
      <Card className="overflow-hidden border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-sm shadow-cyan-200">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">Interaktive Lernwerkstatt</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">100% datenfrei</span>
              </div>
              <h3 className="text-base font-bold text-slate-950 sm:text-lg">
                Web-Based-Training (WBT): Helfer &amp; Planung interaktiv lernen
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                Zwei spezialisierte Kurse mit zweistimmiger Vertonung (Lernsprecher + Klemmi) und offizieller Teilnahmebestätigung.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => window.open("/wbt", "_blank")}
              className="bg-cyan-700 text-white hover:bg-cyan-800 shadow-sm"
            >
              <Play className="mr-1.5 size-4" />
              WBT jetzt öffnen
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Das passende Wissen direkt finden
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {HELP_CHAPTER_COUNT} Kapitel, klare Rollenhinweise und eine Live-Suche für den aktiven Planungsalltag.
              </p>
            </div>
            <div
              data-klemmi-target="help-filters"
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Hilfe-Center nach Zielgruppe filtern"
            >
              {HELP_AUDIENCE_FILTERS.map(filter => {
                const Icon = filter.icon;
                const active = audience === filter.id;
                return (
                  <Button
                    key={filter.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={active}
                    onClick={() => {
                      setHasManualAudienceSelection(true);
                      setAudience(filter.id);
                    }}
                    className={cn(
                      "min-h-11 gap-1.5 border bg-white px-3 text-sm font-semibold text-slate-700 transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.97]",
                      active && `${filter.activeClassName} ring-2 ring-offset-1 shadow-sm`
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div data-klemmi-target="help-search" className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="help-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-11 border-slate-300 bg-white pl-9 text-base shadow-sm focus-visible:border-blue-500"
              placeholder="Live-Suche: z. B. Helfer, Einsatzplan, Material, PDF, Excel oder Passwort"
              aria-label="Hilfe durchsuchen"
            />
          </div>
        </CardContent>
      </Card>

      <div id="help-results" data-klemmi-target="help-chapters" className="scroll-mt-6">
        <HelpGuide
          audience={audience}
          query={query}
          isAdmin={isTenantAdmin}
          onQuickSearch={handleQuickSearch}
        />
      </div>
    </div>
  );
}
