import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("UI- und Mobile-UX-Regeln", () => {
  it("verknüpft Dashboardwarnungen direkt mit gefilterten Einsatzplanschichten", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");

    expect(dashboard).toContain('status: "OFFEN"');
    expect(dashboard).toContain('status: "KNAPP"');
    expect(dashboard).toContain('warning: "konflikte"');
    expect(dashboard).toContain('warning: "ausfaelle"');
    expect(dashboard).toContain('path: "/vorbereitung", status: "offen"');
    expect(dashboard).toContain('path: "/nachbereitung", status: "offen"');
    expect(dashboard).toContain("navigate(dashboardTargetHref(target))");
    expect(dashboard).toContain("Gefilterte Einträge anzeigen");
    expect(dashboard).toContain('urgency: "orange"');
    expect(dashboard).toContain('urgency: "red"');
    expect(dashboard).toContain("border-orange-300 bg-orange-50/90");
    expect(dashboard).toContain("border-red-300 bg-red-50/90");
    expect(plan).toContain('warningFilter !== "konflikte" || e.doppelCount > 0');
    expect(plan).toContain('warningFilter !== "ausfaelle" || e.ausfallCount > 0');
    expect(plan).toContain("parsePlanStatusFilter");
    expect(plan).toContain('aria-label="Warnungsfilter"');
    expect(plan).toContain("Nur Doppelbelegungen");
    expect(plan).toContain("Nur Ausfälle");
    expect(plan).toContain("Filter aufheben");
    expect(plan).toContain("Keine Schichten mit Doppelbelegungen gefunden.");
    expect(plan).toContain("Keine Schichten mit Ausfällen gefunden.");
    expect(taskList).toContain("parseTaskStatusFilter");
    expect(taskList).toContain('aria-label="Aufgabenstatus filtern"');
    expect(taskList).toContain("Nur offene Aufgaben");
  });

  it("lädt das RSC-Logo browserstabil über eine öffentliche Same-Origin-Route", () => {
    const layout = source("client/src/components/Layout.tsx");

    expect(layout).toContain('const RSC_LOGO = "/api/brand/rsc-logo"');
    expect(layout).not.toContain(
      "/manus-storage/rsc-eifelland-logo-chrome"
    );
    expect(layout.match(/src=\{RSC_LOGO\}/g)).toHaveLength(4);
    expect(layout.match(/alt="RSC Eifelland(?: e\. V\.)?"/g)).toHaveLength(4);
  });

  it("zeigt in der Hilfe ausschließlich das Video der aktiven Rolle", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).toContain('user?.role === "admin"');
    expect(help).toContain('user?.role === "user"');
    expect(help).toContain("Video-Anleitung für Administratoren");
    expect(help).toContain("Video-Anleitung für das Planungsteam");
    expect(help).toContain('src: "/api/videos/admin"');
    expect(help).toContain('src: "/api/videos/planungsteam"');
    expect(help).not.toContain(
      "manus-storage/RSC-Helferplanung-Erklaervideo"
    );
    expect(help).toContain("RSC-Helferplanung-Poster-Administratoren");
    expect(help).toContain("RSC-Helferplanung-Poster-Planungsteam");
    expect(help.match(/<video/g)).toHaveLength(1);
    expect(help).toContain("controls");
    expect(help).toContain("playsInline");
    expect(help).toContain("aspect-video w-full max-w-full");
  });

  it("stellt die Login-Rollen als zugänglichen Segmented-Control dar", () => {
    const layout = source("client/src/components/Layout.tsx");

    expect(layout).toContain('role="group"');
    expect(layout).toContain("aria-pressed={loginMode === \"user\"}");
    expect(layout).toContain("aria-pressed={loginMode === \"admin\"}");
    expect(layout).toContain(
      "bg-white font-semibold text-blue-600 shadow-sm"
    );
    expect(layout).toContain(
      "cursor-pointer text-gray-500 hover:text-gray-900"
    );
  });

  it("verwendet für Schichtlöschungen ein internes dynamisches Modal", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const alertDialog = source("client/src/components/ui/alert-dialog.tsx");

    expect(plan).not.toMatch(/\bconfirm\s*\(/);
    expect(plan).toContain("<AlertDialogTitle>Schicht löschen</AlertDialogTitle>");
    expect(plan).toContain("{deleteCandidate?.area}");
    expect(plan).toContain("{deleteCandidate?.task}");
    expect(plan).toContain("zugeordneten Helferplätze");
    expect(plan).toContain("Abbrechen");
    expect(plan).toContain('!bg-red-600 !text-white');
    expect(plan).toContain("dark:!bg-white dark:!text-slate-950");
    expect(alertDialog).toContain("bg-black/40 backdrop-blur-sm");
  });

  it("hält die Desktop-Navigation viewportfest und den Inhalt separat scrollbar", () => {
    const layout = source("client/src/components/Layout.tsx");

    expect(layout).toContain("lg:h-screen lg:flex-row lg:overflow-hidden");
    expect(layout).toContain("lg:sticky lg:top-0 lg:flex lg:h-screen");
    expect(layout).toContain("lg:h-screen lg:overflow-y-auto");
  });

  it("lässt auf mobilen Geräten Pinch-to-Zoom zu", () => {
    const html = source("client/index.html");

    expect(html).toContain("width=device-width, initial-scale=1.0");
    expect(html).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
  });

  it("sperrt den Admin-Passwortdialog während laufender Aktionen", () => {
    const dialog = source("client/src/components/AdminPasswordDialog.tsx");

    expect(dialog).toContain("!busy &&");
    expect(dialog).toContain("disabled={busy}");
    expect(dialog).toContain("showCloseButton={!busy}");
    expect(dialog).toContain("if (busy) event.preventDefault()");
    expect(dialog).toContain("if (!canConfirm || submitLocked.current) return");
    expect(dialog).toContain("submitLocked.current = true");
  });

  it("erzwingt für mobile Bedienelemente mindestens 44 Pixel Touchfläche", () => {
    const button = source("client/src/components/ui/button.tsx");
    const input = source("client/src/components/ui/input.tsx");
    const select = source("client/src/components/ui/select.tsx");
    const checkbox = source("client/src/components/ui/checkbox.tsx");
    const sheet = source("client/src/components/ui/sheet.tsx");
    const dialog = source("client/src/components/ui/dialog.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");

    expect(button).toContain("min-h-11 min-w-11");
    expect(input).toContain("h-11");
    expect(select).toContain("min-h-11");
    expect(checkbox).toContain("size-11");
    expect(sheet).toContain("size-11");
    expect(dialog).toContain("size-11");
    expect(dialog).toContain("pr-12 text-center sm:pr-0");
    expect(plan).toContain("min-h-11 min-w-11");
    expect(layout).toContain(
      'className="h-11 w-24 bg-white font-semibold dark:bg-slate-900"'
    );
    expect(plan).toContain("slot slot-offen h-11");
    expect(taskList).not.toMatch(/<Input[\s\S]{0,120}className="h-10/);
    expect(taskGeneric).not.toMatch(/<Input[\s\S]{0,120}className="h-10/);
    expect(taskList).not.toMatch(
      /<SelectTrigger[\s\S]{0,120}className="h-10/
    );
    expect(taskGeneric).not.toMatch(
      /<SelectTrigger[\s\S]{0,120}className="h-10/
    );
    expect(taskList).toContain('className="h-11 w-full font-medium md:h-10"');
    expect(taskGeneric).toContain(
      'className="h-11 w-full font-medium md:h-10"'
    );
  });

  it("hält lange Dashboard-Kartentitel auf 320-Pixel-Ansichten umbrechbar", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("min-w-0 break-words");
    expect(dashboard).toContain("whitespace-normal");
    expect(dashboard).toContain("flex-wrap");
  });
});
