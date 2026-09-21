import { describe, expect, it } from "vitest";
import {
  myTasksDefaultStorageKey,
  readMyTasksDefaultPreference,
  writeMyTasksDefaultPreference,
} from "../client/src/hooks/useMyTasksDefault";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("persönliche Standardansicht für Meine Aufgaben", () => {
  it("bindet die Speicherung an normalisierten Sitzungsnamen und Rolle", () => {
    const first = myTasksDefaultStorageKey({
      name: "  Anne   Veling ",
      role: "user",
    });
    const equivalent = myTasksDefaultStorageKey({
      name: "anne veling",
      role: "USER",
    });
    const otherRole = myTasksDefaultStorageKey({
      name: "Anne Veling",
      role: "admin",
    });

    expect(first).toBe(equivalent);
    expect(otherRole).not.toBe(first);
    expect(myTasksDefaultStorageKey({ name: "", role: "user" })).toBeNull();
  });

  it("merkt und entfernt die Standardansicht getrennt für jede angemeldete Person", () => {
    const storage = memoryStorage();
    const anne = { name: "Anne Veling", role: "user" } as const;
    const christian = { name: "Christian Lambrich", role: "admin" } as const;

    expect(readMyTasksDefaultPreference(anne, storage)).toBe(false);
    expect(writeMyTasksDefaultPreference(anne, true, storage)).toBe(true);
    expect(readMyTasksDefaultPreference(anne, storage)).toBe(true);
    expect(readMyTasksDefaultPreference(christian, storage)).toBe(false);

    expect(writeMyTasksDefaultPreference(anne, false, storage)).toBe(true);
    expect(readMyTasksDefaultPreference(anne, storage)).toBe(false);
  });

  it("schreibt ohne gültige Sitzungsidentität keine globale Präferenz", () => {
    const writes: string[] = [];
    const storage = {
      getItem: () => null,
      setItem: (key: string) => writes.push(`set:${key}`),
      removeItem: (key: string) => writes.push(`remove:${key}`),
    };

    expect(writeMyTasksDefaultPreference(null, true, storage)).toBe(false);
    expect(readMyTasksDefaultPreference(null, storage)).toBe(false);
    expect(writes).toEqual([]);
  });
});
