import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Vorbereitung & Nachbereitung Verantwortlichen- und Helferzuordnung", () => {
  it("bietet in Preparation.tsx zwei getrennte Auswahlfelder und zeigt den Helfer in der Kachel an", () => {
    const prepCode = readFileSync(
      path.resolve(__dirname, "../client/src/pages/Preparation.tsx"),
      "utf8"
    );

    // Dialog enthält Verantwortlicher und optionalen Helfer
    expect(prepCode).toContain("<Label>Verantwortlicher</Label>");
    expect(prepCode).toContain("Bitte Verantwortlichen wählen");
    // Dialog enthält optionalen Helfer
    expect(prepCode).toContain("Unterstützender Helfer");
    expect(prepCode).toContain("Kein zusätzlicher Helfer");
    // Kachelansicht zeigt optionalen Helfer
    expect(prepCode).toContain("Helfer: {helperMap.get(task.helperId) ?? \"—\"}");
  });

  it("bietet in PostProcessing.tsx zwei getrennte Auswahlfelder und zeigt den Helfer in der Kachel an", () => {
    const postCode = readFileSync(
      path.resolve(__dirname, "../client/src/pages/PostProcessing.tsx"),
      "utf8"
    );

    // Dialog enthält Verantwortlicher und optionalen Helfer
    expect(postCode).toContain("<Label>Verantwortlicher</Label>");
    expect(postCode).toContain("Bitte Verantwortlichen wählen");
    // Dialog enthält optionalen Helfer
    expect(postCode).toContain("Unterstützender Helfer");
    expect(postCode).toContain("Kein zusätzlicher Helfer");
    // Kachelansicht zeigt optionalen Helfer
    expect(postCode).toContain("Helfer: {helperMap.get(task.helperId) ?? \"—\"}");
  });

  it("akzeptiert im Router helperId getrennt von contactId", () => {
    const routerCode = readFileSync(
      path.resolve(__dirname, "../server/routers.ts"),
      "utf8"
    );

    expect(routerCode).toContain("contactId: z.number().int().positive()");
    expect(routerCode).toContain("helperId: z.number().int().positive().nullable().optional()");
  });

  it("speichert helperId in prepTasks und postTasks in schema.ts", () => {
    const schemaCode = readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );

    expect(schemaCode).toContain('helperId: int("helperId").references(() => helpers.id');
  });
});
