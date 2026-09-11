import { createContext, useContext, useMemo, useState } from "react";

const YEAR_STORAGE_KEY = "rsc-helper-event-year";
const LEGACY_YEAR_STORAGE_KEY = "myeifelride-event-year";
const EVENT_STORAGE_PREFIX = "rsc-helper-event-id-";
const DEFAULT_YEAR = 2026;
const DEFAULT_EVENT_ID = 1;

type PlanningScopeContextValue = {
  year: number;
  eventId: number;
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

export function storedEventId(selectedYear = storedEventYear()) {
  if (typeof window === "undefined") return DEFAULT_EVENT_ID;
  const value = Number(
    window.localStorage.getItem(`${EVENT_STORAGE_PREFIX}${selectedYear}`)
  );
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_EVENT_ID;
}

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [year] = useState(storedEventYear);
  const [eventId] = useState(() => storedEventId(year));
  const value = useMemo<PlanningScopeContextValue>(
    () => ({
      year,
      eventId,
      selectYear(nextYear) {
        window.localStorage.setItem(YEAR_STORAGE_KEY, String(nextYear));
        window.location.reload();
      },
      selectEvent(nextEventId) {
        window.localStorage.setItem(
          `${EVENT_STORAGE_PREFIX}${year}`,
          String(nextEventId)
        );
        window.location.reload();
      },
    }),
    [eventId, year]
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
