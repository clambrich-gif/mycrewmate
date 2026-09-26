import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ClipboardList, Package, UsersRound, X, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import type { MapEntry, MapLocation } from "./LocationMapCard";

type LocationDetailContentProps = {
  location: MapLocation;
  entries: MapEntry[];
  statusText: string;
  activeTab: LocationDetailTab;
  onActiveTabChange: (tab: LocationDetailTab) => void;
  mobile?: boolean;
  showHeading?: boolean;
  onClose?: () => void;
};

export type LocationDetailTab = "preparation" | "shifts" | "materials";

type DetailTabDefinition = {
  value: LocationDetailTab;
  label: string;
  icon: LucideIcon;
  emptyText: string;
};

const DETAIL_TABS: DetailTabDefinition[] = [
  {
    value: "preparation",
    label: "Vorbereitung",
    icon: ClipboardList,
    emptyText: "Keine Vorbereitungsaufgaben an diesem Standort.",
  },
  {
    value: "shifts",
    label: "Schichten",
    icon: UsersRound,
    emptyText: "Keine Schichten an diesem Standort.",
  },
  {
    value: "materials",
    label: "Material",
    icon: Package,
    emptyText: "Keine Materialartikel an diesem Standort.",
  },
];

const ENTRY_TONE: Record<
  MapEntry["severity"],
  { card: string; badge: string }
> = {
  critical: {
    card: "border-red-200 bg-red-50/70",
    badge: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/70",
    badge: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
  },
  complete: {
    card: "border-emerald-200 bg-emerald-50/70",
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  },
  neutral: {
    card: "border-slate-200 bg-slate-50",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  },
};

export function firstAvailableLocationDetailTab(entries: MapEntry[]): LocationDetailTab {
  return (
    DETAIL_TABS.find(tab =>
      entries.some(entry => entry.section === tab.value)
    )?.value ?? "preparation"
  );
}

/** Strukturierte Standortdetails für Desktop-Seitenpanel und mobiles Bottom-Sheet. */
export function LocationDetailContent({
  location,
  entries,
  statusText,
  activeTab,
  onActiveTabChange,
  mobile = false,
  showHeading = true,
  onClose,
}: LocationDetailContentProps) {
  const entriesByTab = useMemo(
    () =>
      new Map<LocationDetailTab, MapEntry[]>(
        DETAIL_TABS.map(tab => [
          tab.value,
          entries.filter(entry => entry.section === tab.value),
        ])
      ),
    [entries]
  );

  return (
    <div
      data-location-detail-content={mobile ? "mobile-sheet" : "desktop-panel"}
      data-location-detail-tabs="true"
      className="min-w-0 text-slate-900"
    >
      {showHeading ? (
        <div className="relative border-b border-slate-100 pb-3 pr-12">
          <h2 className="text-lg font-bold leading-6 text-slate-950">{location.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{statusText}</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              data-location-detail-panel-close="true"
              className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-label="Standortdetails schließen"
              title="Standortdetails schließen"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">{statusText}</p>
      )}

      <Tabs
        value={activeTab}
        onValueChange={value => onActiveTabChange(value as LocationDetailTab)}
        className="mt-3 gap-0"
      >
        <TabsList
          aria-label="Einträge des Standorts"
          className="grid h-auto w-full grid-cols-3 rounded-xl bg-slate-100 p-1"
        >
          {DETAIL_TABS.map(tab => {
            const Icon = tab.icon;
            const count = entriesByTab.get(tab.value)?.length ?? 0;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-location-detail-tab={tab.value}
                className="min-h-10 min-w-0 px-1 text-xs sm:px-2"
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="hidden min-[420px]:inline">{tab.label}</span>
                <span className="sr-only max-[419px]:not-sr-only">
                  {tab.label}
                </span>
                <span
                  className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-700"
                  aria-label={`${count} ${tab.label}`}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DETAIL_TABS.map(tab => {
          const tabEntries = entriesByTab.get(tab.value) ?? [];
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-3">
              {tabEntries.length ? (
                <ul className="space-y-2" aria-label={`${tab.label} an ${location.name}`}>
                  {tabEntries.map((entry, index) => {
                    const tone = ENTRY_TONE[entry.severity];
                    return (
                      <li
                        key={`${entry.label}-${index}`}
                        className={`rounded-lg border p-2.5 ${tone.card}`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}
                          >
                            {entry.status}
                          </span>
                          <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-slate-900">
                            {entry.label}
                          </p>
                        </div>
                        {entry.href && entry.actionLabel ? (
                          <a
                            href={entry.href}
                            onClick={onClose}
                            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          >
                            {entry.actionLabel}
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-600">
                  {tab.emptyText}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {mobile && (
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="mt-4 min-h-11 w-full"
        >
          Karte weiter nutzen
        </Button>
      )}
    </div>
  );
}
