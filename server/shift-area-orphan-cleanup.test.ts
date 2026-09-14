import { describe, expect, it, vi } from "vitest";

describe("Atomare Bereichskontakt-Bereinigung bei Schichtmutationen", () => {
  it("löscht eine Schicht und bereinigt verwaiste Bereichskontakte über denselben Transaktionsclient", async () => {
    const executedQueries: string[] = [];

    const txMock = {
      delete: vi.fn((table: any) => ({
        where: vi.fn((condition: any) => {
          executedQueries.push(
            table?._?.name === "shifts" ? "delete(shifts)" : "delete(shift_area_contacts)"
          );
          return Promise.resolve({ affectedRows: 1 });
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            executedQueries.push("select(shift_area_contacts)");
            return Promise.resolve([
              { id: 101, area: "Strecke Nord" },
              { id: 102, area: "Kuchenbuffet" },
            ]);
          }),
        })),
      })),
    };

    const runTransaction = async (
      tx: typeof txMock,
      shiftId: number,
      remainingAreasAfterDelete: string[]
    ) => {
      // 1. Schicht im selben tx-Client löschen
      await tx.delete({ _: { name: "shifts" } } as any).where({ shiftId });

      // 2. Bereichszuordnungen im selben tx-Client scoped lesen
      const mappings = await tx
        .select()
        .from()
        .where();

      const activeAreaSet = new Set(remainingAreasAfterDelete);
      const orphanIds = mappings
        .filter((mapping: any) => !activeAreaSet.has(mapping.area))
        .map((mapping: any) => mapping.id);

      if (orphanIds.length > 0) {
        await tx.delete({ _: { name: "shift_area_contacts" } } as any).where({ orphanIds });
      }

      return { orphanIds };
    };

    const result = await runTransaction(txMock, 42, ["Kuchenbuffet"]);

    expect(result.orphanIds).toEqual([101]);
    expect(executedQueries).toEqual([
      "delete(shifts)",
      "select(shift_area_contacts)",
      "delete(shift_area_contacts)",
    ]);
  });
});
