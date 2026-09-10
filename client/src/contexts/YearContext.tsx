import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "myeifelride-event-year";
const DEFAULT_YEAR = 2026;

type YearContextValue = {
  year: number;
  selectYear: (year: number) => void;
};

const YearContext = createContext<YearContextValue | null>(null);

export function storedEventYear() {
  if (typeof window === "undefined") return DEFAULT_YEAR;
  const value = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(value) && value >= 2020 && value <= 2100
    ? value
    : DEFAULT_YEAR;
}

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [year] = useState(storedEventYear);
  const value = useMemo<YearContextValue>(
    () => ({
      year,
      selectYear(nextYear) {
        window.localStorage.setItem(STORAGE_KEY, String(nextYear));
        window.location.reload();
      },
    }),
    [year]
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
