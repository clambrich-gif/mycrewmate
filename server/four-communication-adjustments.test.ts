import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

describe("Kommunikationsanpassungen für Ansprechpartner, Helfer und Dashboard", () => {
  it("zeigt die freiwillige Rufnummernfreigabe kompakt und erklärt sie mit Klemmi", async () => {
    const [contacts, tours, audio] = await Promise.all([
      source("client/src/pages/Contacts.tsx"),
      source("client/src/lib/klemmi-area-tours.ts"),
      source("client/src/lib/klemmiAudio.ts"),
    ]);

    expect(contacts).toContain('data-klemmi-target="contacts-phone-share"');
    expect(contacts).toContain("Erklärung zur Rufnummernfreigabe anzeigen");
    expect(contacts).toContain("Ohne Häkchen bleibt sie intern.");
    expect(tours).toContain('key: "phone-share"');
    expect(tours).toContain("Rufnummer bewusst für Helferpläne freigeben");
    expect(audio).toContain('"contacts-phone-share"');
  });

  it("erklärt Absagen nach dem Löschhinweis mit dem roten Nein-Status", async () => {
    const [guide, audio] = await Promise.all([
      source("client/src/components/KlemmiHelperGuide.tsx"),
      source("client/src/lib/klemmiAudio.ts"),
    ]);

    expect(guide).toContain('key: "action-cancellation"');
    expect(guide).toContain("Bei Absage auf Nein stellen – nicht löschen");
    expect(guide).toContain("Status auf Nein");
    expect(audio).toContain('"helpers-action-cancellation"');
  });

  it("beschreibt die erweiterte Basisansicht und hält Teamdaten weiterhin getrennt", async () => {
    const [helpers, pdf, privacy] = await Promise.all([
      source("client/src/pages/Helpers.tsx"),
      source("server/pdf.ts"),
      source("client/src/pages/AppPrivacy.tsx"),
    ]);

    expect(helpers).toContain("Eigene Zeiten, Aufgaben, Ort, Hinweise und Spenden");
    expect(pdf).toContain("selectPublicHelperOwnDetails");
    expect(pdf).toContain("keine Mithelfenden, Hinweise oder Spenden anderer Personen");
    expect(privacy).toContain("eigene Hinweise und eigene");
    expect(privacy).toContain("Verpflegungsspenden");
  });

  it("erklärt den Live-Chat mit Wirkung wichtiger Nachrichten nur im Pro-Kontext", async () => {
    const [tour, dashboard, widget, audio] = await Promise.all([
      source("client/src/lib/dashboard-klemmi-tour.ts"),
      source("client/src/pages/Dashboard.tsx"),
      source("client/src/components/LiveChatWidget.tsx"),
      source("client/src/lib/klemmiAudio.ts"),
    ]);

    expect(tour).toContain("canUseChat");
    expect(tour).toContain('key: "chat"');
    expect(tour).toContain("keine automatische E-Mail oder WhatsApp-Nachricht");
    expect(dashboard).toContain("canUseChat,");
    expect(widget).toContain('data-klemmi-target="dashboard-live-chat"');
    expect(audio).toContain('"dashboard-chat"');
    expect(
      await source("client/src/components/KlemmiSurfaceGuide.tsx")
    ).toContain('step.selector === \'[data-klemmi-target="dashboard-live-chat"]\'');
  });
});
