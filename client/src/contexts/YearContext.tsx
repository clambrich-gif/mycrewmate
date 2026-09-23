import { createContext, useContext, useMemo, useState } from "react";

const YEAR_STORAGE_KEY = "rsc-helper-event-year";
const LEGACY_YEAR_STORAGE_KEY = "myeifelride-event-year";
const EVENT_STORAGE_PREFIX = "rsc-helper-event-id-";
const TENANT_STORAGE_KEY = "mycrewmate:tenant-id";
const DEFAULT_YEAR = 2026;
const DEFAULT_EVENT_ID = 1;
const DEFAULT_TENANT_ID = "rsc-eifelland-mayen";

type PlanningScopeContextValue = {
  tenantId: string;
  year: number;
  eventId: number;
  selectTenant: (tenantId: string) => void;
  selectYear: (year: number) => void;
  selectEvent: (eventId: number) => void;
};

const YearContext = createContext<PlanningScopeContextValue | null>(null);

export function storedEventYear() {
  if (typeof window === "undefined") return DEFAULT_YEAR;
  const stored =
    window.localStorage.getItem(YEAR_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_YEAR_STORAGE_KEY);
  const value = Number(stored);
  return Number.isInteger(value) && value >= 2020 && value <= 2100
    ? value
    : DEFAULT_YEAR;
}

export function storedTenantId() {
  if (typeof window === "undefined") return DEFAULT_TENANT_ID;
  const value = window.localStorage.getItem(TENANT_STORAGE_KEY)?.trim();
  return value && /^[a-z0-9-]{3,96}$/.test(value)
    ? value
    : DEFAULT_TENANT_ID;
}

export function storedEventId(
  selectedYear = storedEventYear(),
  selectedTenant = storedTenantId()
) {
  if (typeof window === "undefined") return DEFAULT_EVENT_ID;
  const value = Number(
    window.localStorage.getItem(
      `${EVENT_STORAGE_PREFIX}${selectedTenant}-${selectedYear}`
    ) ?? window.localStorage.getItem(`${EVENT_STORAGE_PREFIX}${selectedYear}`)
  );
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_EVENT_ID;
}

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [tenantId] = useState(storedTenantId);
  const [year] = useState(storedEventYear);
  const [eventId] = useState(() => storedEventId(year, tenantId));
  const value = useMemo<PlanningScopeContextValue>(
    () => ({
      tenantId,
      year,
      eventId,
      selectTenant(nextTenantId) {
        window.localStorage.setItem(TENANT_STORAGE_KEY, nextTenantId);
        // Alle drei internen Testmandanten besitzen eine getrennte Musterveranstaltung
        // im gemeinsamen Testjahr. Dadurch wird nach dem Wechsel sofort eine gültige
        // Veranstaltung ausgewählt und kein alter Event-Schlüssel weiterverwendet.
        window.localStorage.setItem(YEAR_STORAGE_KEY, "2027");
        window.localStorage.removeItem(
          `${EVENT_STORAGE_PREFIX}${nextTenantId}-2027`
        );
        window.location.reload();
      },
      selectYear(nextYear) {
        window.localStorage.setItem(YEAR_STORAGE_KEY, String(nextYear));
        window.location.reload();
      },
      selectEvent(nextEventId) {
        window.localStorage.setItem(
          `${EVENT_STORAGE_PREFIX}${tenantId}-${year}`,
          String(nextEventId)
        );
        window.location.reload();
      },
    }),
    [eventId, tenantId, year]
  );
  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
}

export function useEventYear() {
  const context = useContext(YearContext);
  if (!context)
    throw new Error(
      "useEventYear muss innerhalb des YearProvider verwendet werden"
    );
  return context;
}
