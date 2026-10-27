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
    expect(prepCode).toContain("Hauptadministrator wird automatisch übernommen");
    expect(prepCode).toContain('<SelectItem value="unassigned">-</SelectItem>');
    // Dialog enthält bis zu fünf optionale Helfer
    expect(prepCode).toContain("Unterstützende Helfer");
    expect(prepCode).toContain("Helfer hinzufügen");
    expect(prepCode).toContain("Maximal fünf Helfer gewählt");
    // Kachelansicht zeigt alle zugeordneten Helfer
    expect(prepCode).toContain("Helfer: {(task.helperIds ?? (task.helperId ? [task.helperId] : [])).map");
  });

  it("bietet in PostProcessing.tsx zwei getrennte Auswahlfelder und zeigt den Helfer in der Kachel an", () => {
    const postCode = readFileSync(
      path.resolve(__dirname, "../client/src/pages/PostProcessing.tsx"),
      "utf8"
    );

    // Dialog enthält Verantwortlicher und optionalen Helfer
    expect(postCode).toContain("<Label>Verantwortlicher</Label>");
    expect(postCode).toContain("Bitte Verantwortlichen wählen");
    // Dialog enthält bis zu fünf optionale Helfer
    expect(postCode).toContain("Unterstützende Helfer");
    expect(postCode).toContain("Helfer hinzufügen");
    expect(postCode).toContain("Maximal fünf Helfer gewählt");
    // Kachelansicht zeigt alle zugeordneten Helfer
    expect(postCode).toContain("Helfer: {(task.helperIds ?? (task.helperId ? [task.helperId] : [])).map");
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
