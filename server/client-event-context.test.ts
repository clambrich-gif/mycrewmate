import { afterEach, describe, expect, it, vi } from "vitest";
import { storedEventId, storedTenantId } from "../client/src/contexts/YearContext";

function browserStorage(entries: Record<string, string>) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Browserauswahl der Veranstaltung", () => {
  it("behält einen gültigen aktuellen Vereinswert und verwirft ihn nicht als Altverein", () => {
    const localStorage = browserStorage({
      "mycrewmate:tenant-id": "rsc-eifelland-mayen",
    });
    vi.stubGlobal("window", { localStorage, location: { search: "" } });

    expect(storedTenantId()).toBe("rsc-eifelland-mayen");
    expect(localStorage.getItem("mycrewmate:tenant-id")).toBe("rsc-eifelland-mayen");
  });

  it("liest eine Veranstaltung nur aus dem eindeutig zugeordneten Vereinswert", () => {
    const localStorage = browserStorage({
      "rsc-helper-event-id-2027": "1020002",
      "rsc-helper-event-id-rsc-eifelland-mayen-2027": "1020001",
    });
    vi.stubGlobal("window", { localStorage, location: { search: "" } });

    expect(storedEventId(2027, "rsc-eifelland-mayen")).toBe(1020001);
    expect(storedEventId(2027, "anderer-verein")).toBe(1);
  });
});
