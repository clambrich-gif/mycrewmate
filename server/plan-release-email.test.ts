import { describe, expect, it } from "vitest";
import { renderPlanReleaseContactEmail } from "./mail-service";

describe("Einsatzplanfreigabe-E-Mail", () => {
  it("benennt die Veranstaltung grammatikalisch korrekt und verlinkt direkt zur passenden Helferübersicht", () => {
    const email = renderPlanReleaseContactEmail({
      recipientName: "Alex Beispiel",
      eventName: "MyEifelRide",
      helperOverviewUrl:
        "https://app.mycrewmate.de/helfer?meine=1&eingeteilt=1&event=44&jahr=2027",
      kind: "released",
    });

    expect(email.subject).toContain(
      "Einsatzplan für die Veranstaltung MyEifelRide steht"
    );
    expect(email.text).toContain(
      "Der Einsatzplan für die Veranstaltung MyEifelRide steht."
    );
    expect(email.text).toContain("Für mindestens einen deiner zugeordneten Helfer");
    expect(email.html).toContain("Meine Helferübersicht öffnen");
    expect(email.html).toContain("event=44&amp;jahr=2027");
  });

  it("kennzeichnet eine Änderung für dieselbe konkrete Veranstaltung", () => {
    const email = renderPlanReleaseContactEmail({
      recipientName: "Alex Beispiel",
      eventName: "Weihnachtsfeier",
      helperOverviewUrl:
        "https://app.mycrewmate.de/helfer?meine=1&eingeteilt=1&event=77&jahr=2027",
      kind: "changed",
    });

    expect(email.subject).toContain(
      "Einsatzplan für die Veranstaltung Weihnachtsfeier geändert"
    );
    expect(email.text).toContain(
      "Der Einsatzplan für die Veranstaltung Weihnachtsfeier wurde geändert."
    );
  });
});
