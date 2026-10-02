import { createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  consumeMfaLoginChallenge,
  createMfaLoginChallenge,
  getDb,
  getMfaLoginChallenge,
} from "./db";
import { mfaLoginChallenges } from "../drizzle/schema";

const createdTokenHashes: string[] = [];

function tokenHash() {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  createdTokenHashes.push(hash);
  return hash;
}

afterEach(async () => {
  const database = await getDb();
  if (!database || createdTokenHashes.length === 0) return;
  try {
    for (const hash of createdTokenHashes.splice(0)) {
      await database.delete(mfaLoginChallenges).where(eq(mfaLoginChallenges.tokenHash, hash));
    }
  } catch {
    // Die Zufallstoken laufen ohnehin nach fünf Minuten ab; ein Test-Cleanup darf
    // eine bereits erfolgreiche Aussage nicht überdecken.
  }
});

describe("MFA-Login-Challenge", () => {
  it("akzeptiert eine gültige Challenge exakt einmal und erkennt den MySQL-ResultSetHeader", async () => {
    const hash = tokenHash();
    await createMfaLoginChallenge({ tokenHash: hash, subjectType: "master" });

    expect(await getMfaLoginChallenge(hash)).not.toBeNull();
    expect(await consumeMfaLoginChallenge(hash)).toBe(true);
    expect(await getMfaLoginChallenge(hash)).toBeNull();
    expect(await consumeMfaLoginChallenge(hash)).toBe(false);
  });
});
