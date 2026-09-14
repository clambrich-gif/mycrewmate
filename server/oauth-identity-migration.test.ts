import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue({
      select: dbMocks.select,
      update: dbMocks.update,
      insert: dbMocks.insert,
      transaction: dbMocks.transaction,
    }),
  };
});

import { refreshConfiguredOAuthOwner } from "./db";

describe("OAuth-Hauptadministrator-Identitätsmigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aktualisiert die Eigentümer-ID nur bei bestehendem Administratorkonto und identischer E-Mail", async () => {
    let settingsOpenId = "initial-owner-id";
    let adminRecord = {
      id: 1,
      openId: "initial-owner-id",
      email: "clambrich@gmail.com",
      role: "admin",
      loginMethod: "google",
      name: "Christian Lambrich",
    };

    dbMocks.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: (n: number) => {
            if (n === 1) return Promise.resolve([{ oauthOwnerOpenId: settingsOpenId }]);
            return Promise.resolve([adminRecord]);
          },
        }),
      }),
    }));

    dbMocks.transaction.mockImplementation(async (callback: any) => {
      return callback({
        update: () => ({
          set: (patch: any) => ({
            where: () => {
              adminRecord = { ...adminRecord, ...patch };
              return Promise.resolve();
            },
          }),
        }),
        insert: () => ({
          values: (v: any) => ({
            onDuplicateKeyUpdate: ({ set }: any) => {
              settingsOpenId = set.oauthOwnerOpenId;
              return Promise.resolve();
            },
          }),
        }),
      });
    });

    const refreshed = await refreshConfiguredOAuthOwner({
      openId: "new-manus-provider-id",
      email: "clambrich@gmail.com",
      name: "Christian Lambrich",
      loginMethod: "google",
    });

    expect(refreshed?.openId).toBe("new-manus-provider-id");
    expect(refreshed?.role).toBe("admin");
  });

  it("weist fremde E-Mails oder unbekannte Konten ohne Migration ab", async () => {
    dbMocks.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    const result = await refreshConfiguredOAuthOwner({
      openId: "stranger-id",
      email: "stranger@example.com",
      name: "Fremder",
      loginMethod: "google",
    });

    expect(result).toBeUndefined();
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});
