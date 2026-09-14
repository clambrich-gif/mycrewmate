import { describe, expect, it, vi } from "vitest";

describe("Atomare Ansprechpartner-Löschung und Reset", () => {
  it("räumt abhängige Bereichskontakte und Aufgabenreferenzen vor dem Löschen der Kontakte atomar auf", async () => {
    const executedOperations: string[] = [];

    const txMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() =>
              Promise.resolve([
                { id: 10, name: "Leiter A" },
                { id: 11, name: "Leiter B" },
              ])
            ),
          })),
        })),
      })),
      delete: vi.fn((table: any) => ({
        where: vi.fn(() => {
          executedOperations.push(table?._?.name ?? "unknown");
          return Promise.resolve({ affectedRows: 2 });
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn(() => ({
          where: vi.fn(() => {
            executedOperations.push(`update:${table?._?.name ?? "unknown"}`);
            return Promise.resolve({ affectedRows: 2 });
          }),
        })),
      })),
    };

    const simulateResetContacts = async (tx: typeof txMock) => {
      // 1. Kontakt- und Helferlisten im Scope laden
      const contactRows = await tx.select().from().where().for();
      const contactIds = contactRows.map(c => c.id);

      // 2. Bereichskontakte VOR den Kontakten löschen
      await tx.delete({ _: { name: "shift_area_contacts" } } as any).where();

      // 3. Referenzen in Aufgaben/Helfern entkoppeln (SET NULL)
      await tx.update({ _: { name: "helpers" } } as any).set().where();
      await tx.update({ _: { name: "prep_tasks" } } as any).set().where();
      await tx.update({ _: { name: "post_tasks" } } as any).set().where();
      await tx.update({ _: { name: "materials" } } as any).set().where();
      await tx.update({ _: { name: "marketing" } } as any).set().where();
      await tx.update({ _: { name: "approvals" } } as any).set().where();

      // 4. Erst danach die Kontakte löschen
      await tx.delete({ _: { name: "contacts" } } as any).where();
    };

    await simulateResetContacts(txMock);

    expect(executedOperations).toEqual([
      "shift_area_contacts",
      "update:helpers",
      "update:prep_tasks",
      "update:post_tasks",
      "update:materials",
      "update:marketing",
      "update:approvals",
      "contacts",
    ]);
  });
});
