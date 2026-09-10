import { describe, expect, it } from "vitest";
import { mapFinanceWrite } from "./db";

describe("mapFinanceWrite", () => {
  it("übersetzt API-Feldnamen in die Drizzle-Feldnamen", () => {
    expect(
      mapFinanceWrite({
        category: "Startgeld",
        incomeCents: 12550,
        expenseCents: 300,
        note: "Simulation",
      })
    ).toEqual({
      category: "Startgeld",
      income: 12550,
      expense: 300,
      note: "Simulation",
    });
  });

  it("überschreibt bei Teilupdates keine nicht gesendeten Beträge", () => {
    expect(mapFinanceWrite({ incomeCents: 990 })).toEqual({ income: 990 });
    expect(mapFinanceWrite({ expenseCents: 450 })).toEqual({ expense: 450 });
  });
});
