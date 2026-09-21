import {
  getHelpAudienceForRole,
  HELP_AUDIENCE_FILTERS,
  HELP_CHAPTER_COUNT,
  HelpGuide,
  type HelpAudience,
} from "@/components/HelpGuide";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Help() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<HelpAudience>("all");
  const [hasManualAudienceSelection, setHasManualAudienceSelection] =
    useState(false);
  const guidePdf = trpc.help.guidePdf.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("PDF-Handbuch wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });

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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={guidePdf.isPending}
          onClick={() => guidePdf.mutate()}
        >
          <Download className="h-4 w-4" />
          {guidePdf.isPending
            ? "PDF wird vorbereitet …"
            : "PDF-Handbuch herunterladen"}
        </Button>
      </header>

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
          <div className="relative">
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

      <div id="help-results" className="scroll-mt-6">
        <HelpGuide
          audience={audience}
          query={query}
          isAdmin={user?.role === "admin"}
          onQuickSearch={handleQuickSearch}
        />
      </div>
    </div>
  );
}
