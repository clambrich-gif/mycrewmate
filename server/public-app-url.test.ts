import { describe, expect, it } from "vitest";
import { PUBLIC_APP_ORIGIN, publicAppUrl } from "./public-app-url";

describe("öffentliche Anwendungsadresse", () => {
  it("erzeugt ausschließlich absolute HTTPS-Freigabelinks auf der veröffentlichten Domain", () => {
    const url = publicAppUrl("/api/public/pdf/signierter-token");

    expect(PUBLIC_APP_ORIGIN).toBe("https://app.mycrewmate.de");
    expect(url).toBe(
      "https://app.mycrewmate.de/api/public/pdf/signierter-token"
    );
    expect(new URL(url).protocol).toBe("https:");
  });
});
