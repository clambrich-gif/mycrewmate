import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProductPackageId } from "@shared/product-packages";
import { Check, CheckCircle2, Gem, Minus } from "lucide-react";

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
    capability: "Ansprechpartner, Orte & Material",
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
      <span
        className="inline-flex items-center justify-center text-slate-300"
        aria-label="Nicht enthalten"
      >
        <Minus className="size-4" aria-hidden="true" />
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
        "inline-flex max-w-[12.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-[11px] font-bold leading-4 ring-1",
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

type PackageComparisonSectionProps = {
  /** Markiert das gebuchte Paket innerhalb der Anwendung in MyCrewMate-Orange. */
  currentPackageId?: ProductPackageId;
  /** Ermöglicht der öffentlichen Angebotsseite den Navigationsanker „Vergleichen“. */
  sectionId?: string;
  /** Entfernt die Seitenaußenabstände für die Verwendung in einem Dialog. */
  embedded?: boolean;
  className?: string;
};

export function PackageComparisonSection({
  currentPackageId,
  sectionId,
  embedded = false,
  className,
}: PackageComparisonSectionProps) {
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
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
              Auf einen Blick vergleichen
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              So wächst MyCrewMate mit eurem Verein.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Die Übersicht zeigt nicht nur Funktionen. Sie zeigt, wie aus einem
              einzelnen Plan ein gemeinsamer, professioneller Ablauf wird.
            </p>
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
          <div className="overflow-x-auto" data-offer-comparison>
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
                      <span className="mt-1 block text-[11px] font-bold text-slate-500">
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
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
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
          <p className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500">
            Hinweis: Auf dem Smartphone kann die Vergleichsübersicht horizontal
            gewischt werden. Enterprise-Erweiterungen werden individuell und
            transparent abgestimmt.
          </p>
        </div>
      </div>
    </section>
  );
}
