import * as React from "react";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import { Button } from "@/components/ui/button";
import { useKlemmiVoice } from "@/hooks/useKlemmiVoice";
import { KLEMMI_AUDIO_SCRIPTS, type KlemmiAudioId } from "@/lib/klemmiAudio";
import { cn } from "@/lib/utils";
import type { ProductPackageId } from "@shared/product-packages";
import {
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Gem,
  Mail,
  Minus,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";

type ComparisonState = "included" | "limited" | "notIncluded" | "custom";
type ComparisonPackageId = "event_pass" | "light" | "pro" | "enterprise";

type ComparisonCell = {
  state: ComparisonState;
  label?: string;
};

type ComparisonRow = {
  group: string;
  capability: string;
  event_pass: ComparisonCell;
  light: ComparisonCell;
  pro: ComparisonCell;
  enterprise: ComparisonCell;
};

const PACKAGES: Array<{
  id: ComparisonPackageId;
  name: string;
  price: string;
}> = [
  { id: "event_pass", name: "Event Pass", price: "69 €" },
  { id: "light", name: "Light", price: "149 €" },
  { id: "pro", name: "Pro", price: "299 €" },
  { id: "enterprise", name: "Enterprise", price: "ab 449 €" },
];

const MYCREWMATE_UPGRADE_EMAIL = "info@mycrewmate.de";

const NEXT_PACKAGE_ID: Partial<Record<ProductPackageId, ComparisonPackageId>> =
  {
    event_pass: "light",
    light: "pro",
    pro: "enterprise",
  };

const KLEMMI_PACKAGE_TIP: Partial<Record<ProductPackageId, string>> = {
  event_pass: KLEMMI_AUDIO_SCRIPTS["package-tip-event-pass"],
  light: KLEMMI_AUDIO_SCRIPTS["package-tip-light"],
  pro: KLEMMI_AUDIO_SCRIPTS["package-tip-pro"],
};

const PACKAGE_TIP_AUDIO_ID: Partial<Record<ProductPackageId, KlemmiAudioId>> = {
  event_pass: "package-tip-event-pass",
  light: "package-tip-light",
  pro: "package-tip-pro",
};

function packageById(packageId: ComparisonPackageId) {
  return PACKAGES.find(packageItem => packageItem.id === packageId);
}

function buildUpgradeRequestHref(
  currentPackageId: ProductPackageId,
  targetPackageId: ComparisonPackageId
) {
  const currentPackage = packageById(currentPackageId);
  const targetPackage = packageById(targetPackageId);
  const subject = `Unverbindliche Upgrade-Anfrage: ${currentPackage?.name ?? "MyCrewMate-Paket"} zu ${targetPackage?.name ?? "höherem Paket"}`;
  const body = [
    "Hallo MyCrewMate-Team,",
    "",
    `wir möchten uns unverbindlich über ein Upgrade von ${currentPackage?.name ?? "unserem aktuellen Paket"} auf ${targetPackage?.name ?? "ein höheres Paket"} informieren.`,
    "Bitte meldet euch bei uns mit den nächsten Schritten.",
    "",
    "Viele Grüße",
  ].join("\n");

  return `mailto:${MYCREWMATE_UPGRADE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Einzige redaktionelle Quelle für den öffentlichen und den angemeldeten
 * Paketvergleich. So bleiben Preis-, Funktions- und Upgradeaussagen identisch.
 */
export const PACKAGE_COMPARISON_ROWS: ComparisonRow[] = [
  {
    group: "Grundlage",
    capability: "Veranstaltungsumfang",
    event_pass: { state: "limited", label: "1 Event" },
    light: { state: "limited", label: "1 Haupt-Event" },
    pro: { state: "limited", label: "bis 5 Events" },
    enterprise: { state: "custom", label: "nach Vereinbarung" },
  },
  {
    group: "Grundlage",
    capability: "Helfer & Schichten",
    event_pass: { state: "limited", label: "bis 50 Helfer" },
    light: { state: "limited", label: "bis 150 Helfer" },
    pro: { state: "included", label: "bis 350 / Event" },
    enterprise: { state: "custom", label: "nach Bedarf" },
  },
  {
    group: "Team",
    capability: "Persönliche Teamzugänge",
    event_pass: { state: "notIncluded" },
    light: { state: "limited", label: "bis 5 Zugänge" },
    pro: { state: "included", label: "Rollen & Co-Admins" },
    enterprise: { state: "custom", label: "nach Größe" },
  },
  {
    group: "Planung",
    capability: "Vorbereitung & Nachbereitung",
    event_pass: { state: "limited", label: "Vorbereitung" },
    light: { state: "included" },
    pro: { state: "included" },
    enterprise: { state: "custom", label: "eigene Abläufe" },
  },
  {
    group: "Planung",
    capability: "Ansprechpartner & Orte",
    event_pass: { state: "notIncluded" },
    light: { state: "limited", label: "50 Ansprechpartner · 25 Orte" },
    pro: { state: "included", label: "unbegrenzt" },
    enterprise: { state: "custom", label: "erweiterbar" },
  },
  {
    group: "Planung",
    capability: "Materialplanung",
    event_pass: { state: "notIncluded" },
    light: { state: "included" },
    pro: { state: "included" },
    enterprise: { state: "custom", label: "erweiterbar" },
  },
  {
    group: "Planung",
    capability: "Spenden & Finanzen",
    event_pass: { state: "notIncluded" },
    light: { state: "notIncluded" },
    pro: { state: "included" },
    enterprise: { state: "custom", label: "individuell" },
  },
  {
    group: "Vor Ort",
    capability: "Karte, GPS & GPX-Strecken",
    event_pass: { state: "notIncluded" },
    light: { state: "notIncluded" },
    pro: { state: "included" },
    enterprise: { state: "custom", label: "Sonderansichten" },
  },
  {
    group: "Kommunikation",
    capability: "Chat, WhatsApp-Vorlagen & PDF",
    event_pass: { state: "limited", label: "Standard-PDF" },
    light: { state: "limited", label: "PDF & WhatsApp-Direktlink" },
    pro: {
      state: "included",
      label: "Chat, individuelle WhatsApp-Vorlagen & PDF",
    },
    enterprise: { state: "custom", label: "eigene Vorlagen & Prozesse" },
  },
  {
    group: "Sicherheit",
    capability: "Schutz, Protokolle & Rechte",
    event_pass: { state: "limited", label: "Grundschutz" },
    light: { state: "included", label: "Rollen & Protokolle" },
    pro: { state: "included", label: "vollständig" },
    enterprise: { state: "custom", label: "Sonderprozesse" },
  },
];

function ComparisonCell({ cell }: { cell: ComparisonCell }) {
  if (cell.state === "notIncluded") {
    return (
      <span className="inline-flex items-center justify-center text-slate-300">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">Nicht enthalten</span>
      </span>
    );
  }

  const config =
    cell.state === "custom"
      ? {
          icon: Gem,
          className: "bg-orange-50 text-orange-800 ring-orange-100",
          fallback: "Individuell",
        }
      : cell.state === "limited"
        ? {
            icon: Check,
            className: "bg-blue-50 text-blue-800 ring-blue-100",
            fallback: "Enthalten",
          }
        : {
            icon: CheckCircle2,
            className: "bg-emerald-50 text-emerald-800 ring-emerald-100",
            fallback: "Enthalten",
          };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-[12.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-sm font-bold leading-5 ring-1",
        config.className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{cell.label ?? config.fallback}</span>
    </span>
  );
}

function packageHeaderClass(
  packageId: ComparisonPackageId,
  currentPackageId?: ProductPackageId
) {
  if (currentPackageId === packageId) {
    return "bg-orange-50/90 ring-2 ring-inset ring-orange-500";
  }
  if (packageId === "pro") return "bg-blue-50/70";
  if (packageId === "event_pass") return "bg-orange-50/70";
  return "";
}

function packageCellClass(
  packageId: ComparisonPackageId,
  currentPackageId?: ProductPackageId
) {
  if (currentPackageId === packageId) {
    return "bg-orange-50/80 ring-2 ring-inset ring-orange-500";
  }
  return packageId === "pro" ? "bg-blue-50/35" : "";
}

function KlemmiPackageTip({
  currentPackageId,
}: {
  currentPackageId: ProductPackageId;
}) {
  const { cancel, isSpeaking, muted, speak } = useKlemmiVoice();
  const targetPackageId = NEXT_PACKAGE_ID[currentPackageId];
  const targetPackage = targetPackageId ? packageById(targetPackageId) : null;
  const tip = KLEMMI_PACKAGE_TIP[currentPackageId];
  const audioClipId = PACKAGE_TIP_AUDIO_ID[currentPackageId];

  if (!targetPackageId || !targetPackage || !tip) {
    return null;
  }

  const handleAudioClick = () => {
    if (!audioClipId || muted) return;
    if (isSpeaking) {
      cancel();
      return;
    }
    void speak(KLEMMI_AUDIO_SCRIPTS[audioClipId], audioClipId);
  };

  const audioLabel = isSpeaking
    ? "Vorlesen stoppen"
    : muted
      ? "Klemmi ist stumm"
      : "Klemmi vorlesen";

  return (
    <aside
      className="group relative mt-8 overflow-hidden rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,#fff7ed,white_55%,#eff6ff)] p-4 pr-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-orange-300 motion-safe:hover:shadow-md motion-safe:focus-within:-translate-y-0.5 motion-safe:focus-within:border-orange-300 motion-safe:focus-within:shadow-md sm:p-5"
      data-klemmi-package-tip
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-orange-300/20 blur-2xl opacity-0 transition-opacity duration-200 motion-reduce:transition-none motion-safe:group-hover:opacity-100 motion-safe:group-focus-within:opacity-100"
        aria-hidden="true"
      />
      <div className="flex items-start gap-3 sm:gap-4">
        <KlemmiMascot
          decorative
          className="mt-0.5 size-12 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-1 motion-safe:group-focus-within:-translate-y-1 motion-safe:group-focus-within:rotate-1 sm:size-14"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">
            Klemmi sagt
          </p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            Der nächste sinnvolle Schritt: {targetPackage.name}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">{tip}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="sm"
              className="bg-orange-700 font-bold text-white hover:bg-orange-800"
            >
              <a
                href={buildUpgradeRequestHref(
                  currentPackageId,
                  targetPackageId
                )}
                data-upgrade-request={targetPackageId}
              >
                Upgrade zu {targetPackage.name} anfragen
                <Mail className="ml-1.5 size-4" aria-hidden="true" />
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-orange-200 bg-white/85 font-bold text-orange-800 shadow-sm transition-[background-color,border-color,color,transform] duration-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900 motion-reduce:transition-none motion-safe:hover:-translate-y-0.5"
              disabled={muted}
              aria-pressed={isSpeaking}
              title={
                muted
                  ? "Klemmi-Stimme im Menü wieder einschalten"
                  : isSpeaking
                    ? "Vorlesen stoppen"
                    : "Klemmi liest den Paketvorteil vor"
              }
              onClick={handleAudioClick}
              data-klemmi-package-tip-audio={currentPackageId}
            >
              {isSpeaking ? (
                <Square
                  className="mr-1.5 size-3.5 fill-current"
                  aria-hidden="true"
                />
              ) : muted ? (
                <VolumeX className="mr-1.5 size-4" aria-hidden="true" />
              ) : (
                <Volume2 className="mr-1.5 size-4" aria-hidden="true" />
              )}
              {audioLabel}
            </Button>
            <span className="inline-flex items-center gap-1 text-xs leading-5 text-slate-500">
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              Öffnet nur eine E-Mail – keine automatische Buchung.
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

type PackageComparisonSectionProps = {
  /** Markiert das gebuchte Paket innerhalb der Anwendung in MyCrewMate-Orange. */
  currentPackageId?: ProductPackageId;
  /** Ermöglicht der öffentlichen Angebotsseite den Navigationsanker „Vergleichen“. */
  sectionId?: string;
  /** Ordnet die Preisübersicht auf der öffentlichen Angebotsseite zeitlich ein. */
  priceNote?: string;
  /** Entfernt die Seitenaußenabstände für die Verwendung in einem Dialog. */
  embedded?: boolean;
  className?: string;
};

export function PackageComparisonSection({
  currentPackageId,
  sectionId,
  priceNote,
  embedded = false,
  className,
}: PackageComparisonSectionProps) {
  const comparisonScrollRef = React.useRef<HTMLDivElement>(null);

  function handleComparisonKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const container = comparisonScrollRef.current;
    if (!container) return;
    event.preventDefault();
    const amount = Math.max(240, Math.round(container.clientWidth * 0.75));
    container.scrollBy({
      left: event.key === "ArrowRight" ? amount : -amount,
      behavior: "smooth",
    });
  }

  return (
    <section
      id={sectionId}
      className={cn(
        "bg-white py-16 sm:py-20",
        embedded && "py-8 sm:py-10",
        className
      )}
      data-package-comparison
    >
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          embedded && "px-4 sm:px-6"
        )}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(22rem,1fr)] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-700">
              Auf einen Blick vergleichen
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              So wächst MyCrewMate mit eurem Verein.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Die Übersicht zeigt nicht nur Funktionen. Sie zeigt, wie aus einem
              einzelnen Plan ein gemeinsamer, professioneller Ablauf wird.
            </p>
            {priceNote && (
              <p className="mt-4 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold leading-6 text-amber-900 ring-1 ring-amber-200">
                {priceNote}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-orange-50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
              Eure Entwicklung
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] font-black sm:text-xs">
              <span className="rounded-lg bg-orange-100 px-2 py-2 text-orange-800">
                Starten
              </span>
              <span className="rounded-lg bg-slate-100 px-2 py-2 text-slate-700">
                Organisieren
              </span>
              <span className="rounded-lg bg-blue-100 px-2 py-2 text-blue-800">
                Steuern
              </span>
              <span className="rounded-lg bg-amber-100 px-2 py-2 text-amber-800">
                Gestalten
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Event Pass → Light → Pro → Enterprise
            </p>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)]">
          <div className="relative">
            <div
              ref={comparisonScrollRef}
              className="overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              data-offer-comparison
              role="region"
              tabIndex={0}
              aria-label="Tarifvergleich: mit den Pfeiltasten horizontal durch die Pakete navigieren"
              aria-describedby="comparison-swipe-hint"
              onKeyDown={handleComparisonKeyDown}
            >
            <table className="min-w-[940px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-[25%] px-5 py-5 text-sm font-black text-slate-700">
                    Was euer Team braucht
                  </th>
                  {PACKAGES.map(packageItem => (
                    <th
                      key={packageItem.id}
                      className={cn(
                        "min-w-[160px] px-3 py-5 text-center",
                        packageHeaderClass(packageItem.id, currentPackageId)
                      )}
                      data-package-comparison-header={packageItem.id}
                    >
                      <span className="block text-base font-black text-slate-950">
                        {packageItem.name}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-slate-600">
                        {packageItem.price}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PACKAGE_COMPARISON_ROWS.map((row, rowIndex) => (
                  <tr
                    key={row.capability}
                    className={cn(
                      "border-b border-slate-100",
                      rowIndex % 2 === 1 && "bg-slate-50/40"
                    )}
                  >
                    <th className="px-5 py-4 align-middle">
                      <span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                        {row.group}
                      </span>
                      <span className="mt-1 block text-sm font-bold text-slate-700">
                        {row.capability}
                      </span>
                    </th>
                    {PACKAGES.map(packageItem => (
                      <td
                        key={packageItem.id}
                        className={cn(
                          "px-3 py-4 text-center align-middle",
                          packageCellClass(packageItem.id, currentPackageId)
                        )}
                        data-package-comparison-cell={packageItem.id}
                      >
                        <ComparisonCell cell={row[packageItem.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent pr-2 text-blue-700 sm:hidden"
              aria-hidden="true"
            >
              <span className="grid size-8 place-items-center rounded-full border border-blue-100 bg-white/95 shadow-sm">
                <ArrowLeftRight className="size-4" />
              </span>
            </div>
          </div>
          <p
            id="comparison-swipe-hint"
            className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-sm leading-5 text-slate-600"
          >
            <ArrowLeftRight className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              Auf dem Smartphone nach links und rechts wischen, um alle Pakete
              zu vergleichen. Mit der Tastatur zuerst in die Tabelle springen
              und dann die Pfeiltasten verwenden. Enterprise-Erweiterungen
              werden individuell und transparent abgestimmt.
            </span>
          </p>
        </div>
        {currentPackageId && (
          <KlemmiPackageTip currentPackageId={currentPackageId} />
        )}
      </div>
    </section>
  );
}
