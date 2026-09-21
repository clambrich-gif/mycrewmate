import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("UI- und Mobile-UX-Regeln", () => {
  it("zeigt PDF-Hinweise bearbeitbar per Desktop-Hover und Touch-Popover vollständig an", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("function HelperPdfNoteField");
    expect(helpers).toContain("event.pointerType");
    expect(helpers).toContain("window.setTimeout(() => setOpen(true), 900)");
    expect(helpers).toContain("Vollständigen PDF-Hinweis für");
    expect(helpers).toContain("Kein Hinweis hinterlegt.");
    expect(helpers).toContain("onBlur={event => {");
    expect(helpers.match(/<HelperPdfNoteField/g)).toHaveLength(2);
    expect(helpers).toContain("collisionPadding={12}");
    expect(helpers).toContain("z-50 w-[min(20rem,calc(100vw-1.5rem))]");
  });

  it("zentriert Desktop-Status- und Tagessteuerungen unter ihren Tabellenüberschriften", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");

    expect(helpers).toContain(
      'compactOnDesktop && "flex items-center justify-center"'
    );
    expect(helpers).toContain('"flex min-h-11 w-full items-center"');
    expect(helpers).toContain(
      'className="p-1 text-center align-middle text-[11px] leading-tight"'
    );
    expect(helpers).toContain(
      'className="flex min-h-8 items-center justify-center"'
    );
    expect(helpers).toContain('className="p-1 text-center align-middle"');
    expect(taskList).toContain('<th className="p-3 text-center">Status</th>');
    expect(taskList).toContain(
      '<div className="flex items-center justify-center">'
    );
    expect(taskGeneric).toContain(
      'isMaterialTable ? `${STICKY_TABLE_HEADER_CELL_CLASS} text-center` : "p-3 text-center"'
    );
  });

  it("zeigt beim verbindlichen Modulimport die konkrete Abbruchursache an", () => {
    const importer = source("client/src/components/ModuleExcelImportButton.tsx");

    expect(importer).toContain("Import wurde nicht übernommen");
    expect(importer).toContain("Unbekannte Importursache");
    expect(importer).toContain("duration: 10_000");
  });

  it("zeigt rollengetrennte Online-Sitzungen im Desktopkopf und Mobilmenü", () => {
    const layout = source("client/src/components/Layout.tsx");
    const presence = source("client/src/components/OnlinePresenceBadge.tsx");

    expect(layout).toContain("const onlinePresence = useOnlinePresence()");
    expect(layout.match(/<OnlinePresenceBadge/g)).toHaveLength(2);
    expect(presence).toContain("const PRESENCE_POLL_MS = 60_000");
    expect(presence).toContain("refetchInterval: PRESENCE_POLL_MS");
    expect(presence).toContain('document.addEventListener("pointerdown"');
    expect(presence).toContain('document.addEventListener("keydown"');
    expect(presence).toContain('document.addEventListener("scroll"');
    expect(presence).toContain("Online:");
    expect(presence).toContain("Planer");
    expect(presence).toContain("Admins");
    expect(presence).toContain("<Popover>");
    expect(presence).toContain("<PopoverTrigger asChild>");
    expect(presence).toContain("Wer wird als online gezählt?");
    expect(presence).toContain("innerhalb der letzten");
    expect(presence).toContain("10 Minuten");
    expect(presence).toContain("countsChanged");
    expect(presence).toContain("scale-[1.04]");
    expect(presence).toContain("motion-reduce:scale-100");
  });

  it("zeigt den zentralen Copyright-Vermerk in Anmeldung, Navigation und PDFs", () => {
    const branding = source("shared/branding.ts");
    const layout = source("client/src/components/Layout.tsx");
    const pdf = source("server/pdf.ts");
    const legal = source("client/src/components/ImpressumDialog.tsx");

    expect(branding).toContain(
      "© 2026 MyCrewMate.de · Inhaber: Christian Lambrich · Alle Rechte vorbehalten."
    );
    expect(layout).toContain('import { COPYRIGHT_NOTICE } from "@shared/branding"');
    expect(layout).toContain("absolute inset-x-4 bottom-3 text-center sm:bottom-4");
    expect(layout.match(/\{COPYRIGHT_NOTICE\}/g)).toHaveLength(1);
    expect(layout.match(/\{SIDEBAR_COPYRIGHT_NOTICE\}/g)).toHaveLength(2);
    expect(layout.match(/<LegalFooterLinks/g)).toHaveLength(3);
    expect(layout.match(/<ImpressumDialog/g)).toHaveLength(2);
    expect(pdf).toContain('import { COPYRIGHT_NOTICE } from "../shared/branding"');
    expect(pdf).toContain('info: { Creator: "MyCrewMate" }');
    expect(pdf).toContain("doc.text(COPYRIGHT_NOTICE, 0, doc.page.height - 36");
    expect(legal).toContain('export const PRIVACY_POLICY_URL = "https://mycrewmate.de/datenschutz"');
    expect(legal).toContain("Angaben gemäß § 5 DDG:");
    expect(legal).toContain("Eichenweg 4");
    expect(legal).toContain("56729 Nachtsheim");
    expect(legal).toContain("0174 5111984");
    expect(legal).toContain("clambrich@gmail.com");
    expect(legal).toContain("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen");
    expect(legal).toContain("https://ec.europa.eu/consumers/odr/");
    expect(legal).toContain("Verbraucherstreitbeilegung/Universalschlichtungsstelle:");
    expect(legal).toContain("Wir sind nicht bereit oder verpflichtet");
  });

  it("verhindert mobilen Formular-Auto-Zoom per 16px-Regel und lässt manuelles Zoomen zu", () => {
    const html = source("client/index.html");
    const css = source("client/src/index.css");
    const input = source("client/src/components/ui/input.tsx");
    const textarea = source("client/src/components/ui/textarea.tsx");
    const select = source("client/src/components/ui/select.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");
    const main = source("client/src/main.tsx");
    const viewportGuard = source("client/src/lib/mobileFocusViewport.ts");

    expect(html).toContain('content="width=device-width, initial-scale=1.0"');
    expect(html).not.toContain("maximum-scale");
    expect(html).not.toContain("user-scalable=no");
    expect(css).toContain("@media screen and (max-width: 1024px)");
    expect(css).toContain("bei mindestens 16px");
    expect(css).toContain('[contenteditable="true"]');
    expect(css).toContain('[data-slot="select-trigger"]');
    expect(css).toContain("font-size: 16px !important;");
    expect(css).toContain("-webkit-text-size-adjust: 100%;");
    expect(css).toContain("touch-action: manipulation;");
    expect(input).toContain("touch-manipulation");
    expect(input).toContain("text-base text-slate-950");
    expect(textarea).toContain("touch-manipulation");
    expect(textarea).toContain("text-base text-slate-950");
    expect(select).toContain("w-fit touch-manipulation items-center");
    expect(select).toContain("px-3 py-2 text-base");
    expect(helpers).toContain('"w-full pr-11 text-base xl:pr-9"');
    expect(helpers).not.toContain('"w-full pr-11 text-base xl:pr-9 xl:text-sm"');
    expect(main).toContain("installMobileFocusViewportGuard();");
    expect(viewportGuard).toContain("LOCKED_VIEWPORT_CONTENT");
    expect(viewportGuard).toContain("maximum-scale=1.0, user-scalable=no");
    expect(viewportGuard).toContain('document.addEventListener("focusin"');
    expect(viewportGuard).toContain('"pointerdown"');
    expect(viewportGuard).toContain('document.addEventListener("focusout"');
    expect(viewportGuard).toContain('"blur"');
    expect(viewportGuard).toContain("isMobileOrTouchViewport");
  });

  it("richtet die Helferplanung als installierbare PWA mit mobilem Installationshinweis ein", () => {
    const html = source("client/index.html");
    const main = source("client/src/main.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const app = source("client/src/App.tsx");
    const serviceWorker = source("client/public/service-worker.js");
    const manifest = JSON.parse(source("client/public/manifest.json"));

    expect(manifest.name).toBe("MyCrewMate · Helferplanung");
    expect(manifest.short_name).toBe("MyCrewMate");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#1e3a5f");
    expect(manifest.background_color).toBe("#f8fafc");
    expect(manifest.icons).toEqual([
      {
        src: "/manus-storage/mycrewmate-pwa-icon-192_9fe74598.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/manus-storage/mycrewmate-pwa-icon-512_b16ae84c.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ]);
    expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="MyCrewMate"');
    expect(html).toContain("<title>MyCrewMate · Helferplanung</title>");
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
    expect(html).toContain('sizes="180x180" href="/manus-storage/mycrewmate-apple-touch-icon-180_52e02d0f.png"');
    expect(readFileSync(new URL("../client/public/favicon.ico", import.meta.url)).subarray(0, 4).toString("hex")).toBe("00000100");
    expect(main).toContain('navigator.serviceWorker.register("/service-worker.js")');
    expect(serviceWorker).toContain('const STATIC_CACHE = "mycrewmate-pwa-v2"');
    expect(serviceWorker).toContain('/manus-storage/mycrewmate-pwa-icon-512_b16ae84c.png');
    expect(serviceWorker).toContain('/favicon.ico');
    expect(serviceWorker).not.toContain("/api/");
    expect(layout).toContain("beforeinstallprompt");
    expect(layout).toContain("appinstalled");
    expect(layout).toContain("📱 Als App auf Handy speichern");
    expect(layout).toContain('className="mr-2 h-10 w-10 rounded-xl shadow-md bg-white p-1.5 object-contain"');
    expect(layout).toContain("MyCrewMate als App speichern");
    expect(layout).toContain("iOS (iPhone/iPad)");
    expect(layout).toContain('<TabsTrigger value="android"');
    expect(layout).toContain("Tippen Sie unten in <strong>Safari</strong>");
    expect(layout).toContain("Tippen Sie oben rechts in <strong>Chrome</strong>");
    expect(layout).toContain("requestPwaInstallation");
    expect(layout).toContain('location.startsWith("/dashboard")');
    expect(layout).toContain('get("chat") === "open"');
    expect(app).toContain('<Route path="/dashboard" component={Dashboard} />');
    expect(manifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Einsatzplan",
          url: "/einsatzplan",
        }),
        expect.objectContaining({
          name: "Helferkartei",
          url: "/helfer",
        }),
        expect.objectContaining({
          name: "Orga-Chat",
          url: "/dashboard?chat=open",
        }),
      ])
    );
    expect(serviceWorker).toContain("shortcut-einsatzplan-192.png");
    expect(serviceWorker).toContain("shortcut-helferkartei-192.png");
    expect(serviceWorker).toContain("shortcut-orga-chat-192.png");
  });

  it("integriert das schwebende Live-Notizen & Chat-Widget plattformübergreifend", () => {
    const layout = source("client/src/components/Layout.tsx");
    const widget = source("client/src/components/LiveChatWidget.tsx");
    const presence = source("client/src/components/OnlinePresenceBadge.tsx");

    expect(layout).toContain("<LiveChatWidget");
    expect(layout).toContain("CHAT_SNAPSHOT_POLL_MS = 5_000");
    expect(layout).toContain("chatSnapshotPollInFlightRef");
    expect(layout).toContain("chatSnapshotPollQueuedRef");
    expect(layout).toContain("chatSnapshotEpochRef");
    expect(layout).toContain("const refreshChatSnapshot = useCallback");
    expect(layout).toContain("snapshot={chatSnapshot}");
    expect(layout).toContain("onRequestSnapshotRefresh={refreshChatSnapshot}");
    expect(layout).toContain("unreadNotesCount");
    expect(layout).toContain("hasImportantUnread={hasImportantUnread}");
    expect(layout).toContain("onOpenChat={openChatWidget}");
    expect(layout).toContain("window.setInterval(refreshChatSnapshot, CHAT_SNAPSHOT_POLL_MS)");
    expect(layout).toContain("utils.client.notes.list.query({ limit: 150 })");
    expect(layout).toContain("if (orderedNotes.length === 0)");
    expect(layout).toContain("setUnreadNotesCount(0)");
    expect(layout).toContain("setUnreadNotesCount(serverUnreadCount)");
    expect(layout).toContain("utils.client.notes.markRead.mutate()");
    expect(layout).toContain("setUnreadNotesCount(previous => previous + newNotes.length)");

    expect(presence).toContain("Live-Notizen & Chat öffnen");
    expect(presence).not.toContain("unreadCount");
    expect(presence).not.toContain("hasImportantUnread");

    expect(widget).toContain("env(safe-area-inset-bottom)+0.75rem");
    expect(widget).toContain("env(safe-area-inset-bottom)+0.5rem");
    expect(widget).toContain("Absender ist ausschließlich die vom Server bestätigte Sitzungsidentität");
    expect(widget).toContain("const confirmedName =");
    expect(widget).toContain("user?.name?.trim()");
    expect(widget).not.toContain("Wer schreibt hier?");
    expect(widget).not.toContain("Bestätigen & Beitreten");
    expect(widget).not.toContain("trpc.contacts.list.useQuery");
    expect(widget).not.toContain("+ Andere Person / Freie Eingabe");
    expect(widget).not.toContain("SHORT_POLL_INTERVAL_MS");
    expect(widget).not.toContain("utils.client.notes.list.query");
    expect(widget).toContain("snapshot: TeamNotesSnapshot");
    expect(widget).toContain("onRequestSnapshotRefresh: () => Promise<void>");
    expect(widget).toContain("void onRequestSnapshotRefresh()");
    expect(widget).toContain("unreadCount > 99 ? \"99+\" : unreadCount");
    expect(widget).toContain("hasImportantUnread ? \"bg-red-700 ring-yellow-200\" : \"bg-red-600\"");
    expect(widget).toContain("typingDebounceTimerRef.current = null");
    expect(widget).toContain("typingMutateRef.current");
    expect(widget).toContain("Beim Schließen/Minimieren und beim vollständigen Unmount");
    expect(widget).toContain("window.clearTimeout(typingDebounceTimerRef.current)");
    expect(widget).toContain("trpc.notes.send.useMutation");
    expect(widget).toContain("trpc.notes.clear.useMutation");
    expect(widget).toContain('title="Minimieren (⎯)"');
    expect(widget).toContain('title="Schließen (✕)"');
    expect(widget).toContain("inset-x-0 bottom-0 h-[85dvh]");
    expect(widget).toContain("sm:h-[540px] sm:w-[380px]");
    expect(widget).toContain("user?.role === \"admin\"");
    expect(widget).toContain("Verlauf für alle leeren");
    expect(widget).toContain("<AdminPasswordDialog");
    expect(widget).toContain("title=\"Team-Chatverlauf leeren?\"");
    expect(widget).toContain(
      'clearMutation.mutate({ adminPassword, scope: "current_event" });'
    );
    expect(widget).toContain("h-16 w-16 min-h-16 min-w-16");
    expect(widget).toContain("md:h-20 md:w-20 md:min-h-20 md:min-w-20");
    expect(widget).toContain("md:!h-10 md:!w-10");
    expect(widget).toContain("md:h-9 md:min-w-9");
    expect(widget).toContain("animate-pulse bg-red-600");
    expect(widget).toContain("text-base sm:text-xs leading-relaxed");
    expect(widget).toContain("tippt gerade …");
    expect(widget).toContain("[ ] Als Wichtig markieren");
    expect(widget).toContain("Wichtige Durchsage");
    expect(widget).toContain("SOUND_ENABLED_STORAGE_PREFIX");
    expect(widget).toContain("playImportantAlertTone");
    expect(widget).toContain("Warnton für wichtige Durchsagen stummschalten");
    expect(widget).toContain("Warnton für wichtige Durchsagen aktivieren");
    expect(widget).toContain("h-[85dvh] w-full max-h-[85vh]");
    expect(widget).toContain("max-w-full flex-col overflow-x-hidden");
    expect(widget).toContain("[overscroll-behavior:contain]");
    expect(widget).toContain("sticky bottom-0 z-10");
    expect(widget).toContain("pb-[max(1.5rem,env(safe-area-inset-bottom))]");
    expect(widget).toContain("w-full min-w-0 max-w-full flex-col overflow-x-hidden");
    expect(widget).toContain("h-7 min-w-7");
    expect(widget).toContain("Der zentrale Layout-Owner liefert genau einen serialisierten Snapshot");
    expect(widget).toContain("snapshot.notes.map(note =>");
    expect(widget).toContain("snapshot.typing.map(t => t.senderName)");
    expect(widget).toContain("text-base leading-normal [-webkit-text-size-adjust:100%]");
    expect(widget).toContain("xl:min-h-[40px]");
    expect(widget).not.toContain("xl:min-h-[40px] xl:text-xs");
    expect(widget).toContain("[-webkit-text-size-adjust:100%]");
  });

  it("sichert Dialoge und Recovery-Links für mobile Tastatur und Touchbedienung ab", () => {
    const dialog = source("client/src/components/ui/dialog.tsx");
    const alertDialog = source("client/src/components/ui/alert-dialog.tsx");
    const layout = source("client/src/components/Layout.tsx");

    expect(dialog).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog).toContain("overflow-y-auto overscroll-contain");
    expect(alertDialog).toContain("max-h-[calc(100dvh-2rem)]");
    expect(alertDialog).toContain("overflow-y-auto overscroll-contain");
    expect(layout).toContain("Passwort vergessen / Recovery");
    expect(layout).toContain("Zurück zur Anmeldung");
    expect(layout.match(/inline-flex min-h-11 items-center justify-center/g)).toHaveLength(2);
  });

  it("zeigt und entsperrt den globalen Planungsteam-Notfall-Stopp ausschließlich im Adminbereich", () => {
    const security = source("client/src/pages/Security.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const css = source("client/src/index.css");

    expect(security).toContain("Notfall-Sperrstatus Planungsteam (Global)");
    expect(security).toContain("Globaler Notfall-Stopp: Alle Planungsteam-Zugänge sperren");
    expect(security).toContain("Globalen Notfall-Stopp aufheben");
    expect(security).toContain("status?.planningTeamLocked");
    expect(security).toContain("trpc.auth.unlockPlanningTeamLock.useMutation");
    expect(security).toContain("trpc.auth.lockPlanningTeam.useMutation");
    expect(security).toContain("Sicherheitsprotokoll / Logbuch");
    expect(security).toContain("data-security-accordions");
    expect(security).toContain("if (!isAdmin)");
    expect(layout).toContain("passwordStatus.data?.planningTeamLocked");
    expect(layout).toContain("Nach 5 Fehlversuchen greift eine zeitbasierte Sperre (Cooldown).");
    expect(layout).toContain("Zugang für das Planungsteam gesperrt");
    expect(layout).toContain("Bitte kontaktieren Sie einen Administrator.");
    expect(layout).toContain("login-lock-alert");
    expect(layout).toContain('aria-live="assertive"');
    expect(layout).toContain("loginLockAlertRef.current?.focus");
    expect(layout).toContain('id="planning-team-lock-message"');
    expect(layout).toContain("tabIndex={-1}");
    expect(layout.match(/planning-team-lock-message/g)).toHaveLength(3);
    expect(css).toContain("@keyframes login-lock-shake");
    expect(css).toContain("animation: login-lock-shake 280ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".login-lock-alert { animation: none; }");
  });

  it("behandelt falsche Zugangsdaten als Formularmeldung statt als technischen API-Fehler", () => {
    const layout = source("client/src/components/Layout.tsx");
    const main = source("client/src/main.tsx");

    expect(layout).toContain('const [loginError, setLoginError]');
    expect(layout).toContain('mutationKey: ["auth", "passwordLogin"]');
    expect(layout).toContain('mutationKey: ["auth", "adminPasswordLogin"]');
    expect(layout).toContain('id="password-login-error"');
    expect(layout).toContain('role="alert"');
    expect(layout).toContain("loginErrorRef.current?.focus");
    expect(main).toContain("isHandledPasswordLogin");
    expect(main).toContain("mutationKey.flat(Infinity)");
    expect(main).toContain('keyPath === "auth.passwordLogin"');
    expect(main).toContain('keyPath === "auth.adminPasswordLogin"');
    expect(main).toContain("if (isHandledPasswordLogin) return;");
  });

  it("verdichtet nur die Desktop-Helfertabelle und kürzt Vielleicht geräteübergreifend auf ein Fragezeichen", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const mobileCards = helpers.slice(
      helpers.indexOf('<div className="space-y-3 md:hidden">'),
      helpers.indexOf('<Card className="hidden shadow-sm md:block">')
    );

    expect(helpers).toContain('availability === "vielleicht"');
    expect(helpers).toContain('? "?"');
    expect(helpers).toContain('? (Unklar)');
    expect(helpers).not.toContain('l: "Vielleicht"');
    expect(helpers).toContain('className="w-full table-fixed text-xs xl:text-sm"');
    expect(helpers).toContain('className="helpers-table-scroll p-0"');
    expect(helpers).toContain('<col className="w-[180px]" />');
    expect(helpers).toContain('<col className="w-[230px]" />');
    expect(helpers).toContain("1044 + activeDays.length * 56");
    expect(helpers).toContain('<col className="w-[176px]" />');
    expect(helpers).toContain("md:w-[52px] md:min-w-[52px]");
    expect(helpers).toContain("rounded-full border px-3");
    expect(helpers).toContain('availability === "ja" && timed');
    expect(helpers).toContain('? "🕒"');
    expect(helpers).toContain('className="size-3 shrink-0 opacity-40"');
    expect(helpers).toContain(
      "inline-flex h-11 min-h-11 w-[92px] items-center justify-center rounded-full"
    );
    expect(helpers).not.toContain("pointer-events-none absolute left-1.5");
    expect(helpers).toContain('className="whitespace-nowrap p-2">Telefon Helfer');
    expect(mobileCards).not.toContain("compactOnDesktop");
    expect(mobileCards).toContain('data-slot="mobile-helper-status-section"');
    expect(mobileCards).toContain("Allgemeiner Status");
    expect(mobileCards).toContain("<MobileStatusSwitch");
    expect(mobileCards).toContain('data-slot="mobile-helper-availability-section"');
    expect(mobileCards).toContain("Tages-Verfügbarkeiten");
    expect(mobileCards).toContain('className="grid grid-cols-3 gap-2"');
    expect(mobileCards).not.toContain("<YesNoToggle");
    expect(helpers).toContain("function MobileStatusSwitch");
    expect(helpers).toContain('data-slot="mobile-helper-status-switch"');
    expect(helpers).toContain("w-[72px] shrink-0 items-center rounded-full");
    expect(helpers).toContain('isYes ? "translate-x-7" : "translate-x-0"');
  });

  it("bietet globale Shortcuts für schließbare Dialoge und die Seitensuche", () => {
    const layout = source("client/src/components/Layout.tsx");
    const alertDialog = source("client/src/components/ui/alert-dialog.tsx");
    const sheet = source("client/src/components/ui/sheet.tsx");
    const forcePasswordModal = source(
      "client/src/components/ForcePasswordChangeModal.tsx"
    );

    expect(layout).toContain("function focusCurrentPageSearch()");
    expect(layout).toContain('input[data-global-search="true"]');
    expect(layout).toContain('input[placeholder*="Suchen"]');
    expect(layout).toContain("event.key === \"Escape\"");
    expect(layout).toContain("event.key.toLowerCase() === \"f\"");
    expect(layout).toContain('event.key === "/"');
    expect(layout).toContain('[data-slot="dialog-close"], [data-slot="alert-dialog-cancel"], [data-slot="sheet-close"]');
    expect(layout).toContain("if (forcePasswordChangeOpen) return;");
    expect(alertDialog).toContain('data-slot="alert-dialog-cancel"');
    expect(sheet).toContain('data-slot="sheet-close"');
    expect(forcePasswordModal).toContain("onEscapeKeyDown={event => event.preventDefault()}");
  });

  it("bietet kombinierbare Schnellfilter für eigene und offene Aufgaben", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const preparation = source("client/src/pages/Preparation.tsx");
    const postprocessing = source("client/src/pages/PostProcessing.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const genericTasks = source("client/src/pages/TaskGeneric.tsx");
    const defaultHook = source("client/src/hooks/useMyTasksDefault.ts");
    const defaultPin = source("client/src/components/MyTasksDefaultPin.tsx");

    expect(helpers).toContain("myHelperRecordOnly");
    expect(helpers).toContain("👤 Meine Helferakte");
    expect(helpers).toContain("useMyTasksDefault(user)");
    expect(helpers).toContain("<MyTasksDefaultPin");
    expect(preparation).toContain("myTasksOnly");
    expect(preparation).toContain("openOrUnassignedOnly");
    expect(preparation).toContain("👤 Meine Aufgaben");
    expect(preparation).toContain("⚠ Offen / unzugewiesen");
    expect(preparation).toContain("useMyTasksDefault(user)");
    expect(preparation).toContain("<MyTasksDefaultPin");
    expect(postprocessing).toContain('aria-label="Schnellfilter Nachbereitung"');
    expect(postprocessing).toContain("myTasksOnly");
    expect(postprocessing).toContain("openOrUnassignedOnly");
    expect(postprocessing).toContain("ownContactIds");
    expect(postprocessing).toContain("👤 Meine Aufgaben");
    expect(postprocessing).toContain("⚠ Offen / unzugewiesen");
    expect(postprocessing).toContain("useMyTasksDefault(user)");
    expect(postprocessing).toContain("<MyTasksDefaultPin");
    expect(plan).toContain("ownContactIds");
    expect(plan).toContain("ownHelperIds");
    expect(plan).toContain("deriveOwnAssignedHelperIds");
    expect(plan).toContain("matchesMyScheduleAssignment");
    expect(plan).not.toContain("ownContactIds.has(helper.contactId)");
    expect(plan).toContain("👤 Meine Aufgaben");
    expect(plan).toContain("⚠ Nur offene / unbesetzte Schichten");
    expect(plan).toContain("e.assigned.length < e.shift.needed");
    expect(plan).toContain("useMyTasksDefault(user)");
    expect(plan).toContain("<MyTasksDefaultPin");
    expect(genericTasks).toContain("openOrUnassignedOnly");
    expect(genericTasks).toContain("👤 Meine Aufgaben");
    expect(genericTasks).toContain("⚠ Offen / unzugewiesen");
    expect(genericTasks).toContain("useMyTasksDefault(user)");
    expect(genericTasks).toContain("<MyTasksDefaultPin");
    expect(defaultHook).toContain("MY_TASKS_DEFAULT_STORAGE_PREFIX");
    expect(defaultHook).toContain("myTasksDefaultStorageKey");
    expect(defaultHook).toContain("window.localStorage");
    expect(defaultPin).toContain('data-slot="my-tasks-default-pin"');
    expect(defaultPin).toContain("als Standard-Ansicht merken");
    expect(defaultPin).toContain("bg-blue-600 text-white");
  });

  it("grenzt eigene Einsatzplanaufgaben strikt von Helfer-Ansprechpartnerzusätzen ab", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const myTasksFilter = source("client/src/lib/plan-my-tasks.ts");

    expect(myTasksFilter).toContain("Ansprechpartner-Verknüpfung des");
    expect(myTasksFilter).toContain("zählt ausdrücklich nicht als eigene Helferzuweisung");
    expect(myTasksFilter).toContain("assigned.some");
    expect(myTasksFilter).toContain("areaContactMap.get(area)");
    expect(plan).toContain("matchesMyScheduleAssignment({");
  });

  it("hält mobile Formulare und Aktionen bei 44px und 16px und macht Helferchips per Tastatur erreichbar", () => {
    const input = source("client/src/components/ui/input.tsx");
    const button = source("client/src/components/ui/button.tsx");
    const select = source("client/src/components/ui/select.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");
    const finances = source("client/src/pages/Finances.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const widget = source("client/src/components/LiveChatWidget.tsx");
    const presence = source("client/src/components/OnlinePresenceBadge.tsx");
    const help = source("client/src/pages/Help.tsx");

    expect(input).toContain("h-11 w-full");
    expect(input).toContain("text-base text-slate-950");
    expect(button).toContain("min-h-11 min-w-11");
    expect(button).toContain("rounded-md text-base font-medium");
    expect(button).toContain("md:text-sm");
    expect(select).toContain("min-h-11 w-fit");
    expect(select).toContain("px-3 py-2 text-base");
    expect(select).toContain("md:text-sm");
    expect(helpers).toContain('"h-11 w-full text-base md:h-8 md:text-sm"');
    expect(finances).toContain('className="h-11 w-full text-base md:h-8 md:w-28 md:text-sm"');
    expect(plan).toContain("max-h-[calc(100dvh-2rem)]");
    expect(plan).toContain("max-w-[calc(100vw-2rem)]");
    expect(plan).toContain("pb-[max(1rem,env(safe-area-inset-bottom))]");
    expect(plan).toContain('type="button"');
    expect(plan).toContain("aria-label={`Details zu ${helper.name} anzeigen`}");
    expect(plan).toContain("<PopoverTrigger asChild>");
    expect(plan).toContain("min-h-11 min-w-0 flex-1 truncate text-left");
    expect(widget).toContain("min-h-12 min-w-0 flex-1 max-h-28 resize-none bg-white text-base");
    expect(widget).not.toContain("chat-contact-select");
    expect(widget).toContain("h-11 w-11 text-slate-600 hover:text-red-600");
    expect(presence).toContain("flex min-h-11 w-full items-center");
    expect(help).toContain("flex min-h-11 items-center rounded-md");
    expect(widget).toContain("h-11 w-11 text-slate-600 hover:text-slate-900 md:h-7 md:w-7");
    expect(widget).toContain("ungelesene Notizen");
  });

  it("zeigt Helfernamen nur in Mobilkarten als dominanten, flexibel umbrechenden Titel", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const mobileCards = helpers.slice(
      helpers.indexOf('<div className="space-y-3 md:hidden">'),
      helpers.indexOf('<Card className="hidden shadow-sm md:block">')
    );
    const desktopTable = helpers.slice(
      helpers.indexOf('<Card className="hidden shadow-sm md:block">')
    );

    expect(mobileCards).toContain(
      'className="flex items-start justify-between gap-2"'
    );
    expect(mobileCards).toContain('className="min-w-0 flex-1"');
    expect(mobileCards).toContain(
      'className="break-words text-[26px] leading-[1.05] font-black tracking-tight"'
    );
    expect(mobileCards.match(/size="icon"/g)).toHaveLength(3);
    expect(desktopTable).not.toContain("text-[26px]");
    expect(desktopTable).toContain('className="p-2 font-medium"');
  });

  it("fixiert den Helfertabellenkopf ausschließlich in der PC-Webansicht", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const css = source("client/src/index.css");
    const mobileCards = helpers.slice(
      helpers.indexOf('<div className="space-y-3 md:hidden">'),
      helpers.indexOf('<Card className="hidden shadow-sm md:block">')
    );

    expect(helpers).toContain(
      '<CardContent className="helpers-table-scroll p-0">'
    );
    expect(helpers).toContain(
      'className="helpers-desktop-sticky-head bg-muted/60"'
    );
    expect(mobileCards).not.toContain("sticky");
    expect(css).toContain(
      "@media (min-width: 1720px) and (hover: hover) and (pointer: fine)"
    );
    expect(css).toContain(".helpers-desktop-sticky-head {");
    expect(css).toContain(".helpers-table-scroll {");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("box-shadow: 0 2px 8px rgb(15 23 42 / 14%);");
    expect(css).toContain(".helpers-desktop-sticky-head th {");
  });

  it("erzwingt browserunabhängig ein kontrastfestes Light-Theme", () => {
    const html = source("client/index.html");
    const app = source("client/src/App.tsx");
    const css = source("client/src/index.css");
    const theme = source("client/src/contexts/ThemeContext.tsx");
    const toaster = source("client/src/components/ui/sonner.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const sheet = source("client/src/components/ui/sheet.tsx");
    const dialog = source("client/src/components/ui/dialog.tsx");
    const alertDialog = source("client/src/components/ui/alert-dialog.tsx");
    const select = source("client/src/components/ui/select.tsx");
    const dropdown = source("client/src/components/ui/dropdown-menu.tsx");
    const popover = source("client/src/components/ui/popover.tsx");
    const tabs = source("client/src/components/ui/tabs.tsx");
    const permissions = source("client/src/pages/Permissions.tsx");

    expect(html).toContain('<meta name="color-scheme" content="light" />');
    expect(html).toContain(
      '<meta name="supported-color-schemes" content="light" />'
    );
    expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *));");
    expect(css.match(/color-scheme:\s*light/g)).toHaveLength(2);
    expect(app).toContain('forcedTheme="light"');
    expect(theme).toContain('root.classList.toggle("dark", activeTheme === "dark")');
    expect(theme).toContain("root.style.colorScheme = activeTheme");
    expect(toaster).toContain('theme="light"');
    expect(toaster).not.toContain('from "next-themes"');
    expect(layout).toContain("bg-white px-3 text-slate-950 shadow-sm");
    expect(layout).toContain("bg-white p-0 text-slate-950");
    expect(sheet).not.toContain("dark:!bg-slate-950");
    expect(dialog).not.toContain("dark:!bg-slate-950");
    expect(alertDialog).not.toContain("dark:!bg-slate-950");
    expect(select).toContain('"bg-white text-slate-950 opacity-100');
    expect(dropdown).toContain('"bg-white text-slate-950 opacity-100');
    expect(popover).toContain('"bg-white text-slate-950 opacity-100');
    expect(tabs).not.toContain("dark:");
    expect(permissions).not.toContain("dark:");
  });

  it("hält die Löschprotokolltabelle innerhalb der Karte und bricht lange Details um", () => {
    const permissions = source("client/src/pages/Permissions.tsx");
    const chat = source("client/src/components/LiveChatWidget.tsx");

    expect(permissions).toContain("min-w-0 max-w-full overflow-hidden shadow-sm lg:mr-24");
    expect(permissions).toContain("w-full max-w-full table-fixed text-sm");
    expect(permissions).not.toContain('min-w-[900px]');
    expect(permissions).toContain("md:px-0 md:pt-0 md:pb-28");
    expect(permissions).toContain("w-[30%] break-words p-3 text-left");
    expect(permissions).toContain("w-[15%] break-words p-3 text-left");
    expect(permissions).toContain("w-full min-w-0 justify-center whitespace-nowrap px-2");
    expect(permissions).toContain("Vorgang &amp; ausgeführt von");
    expect(permissions).toContain("[overflow-wrap:anywhere]");
    expect(permissions).toContain("p-3 align-top leading-relaxed");
    expect(chat).toContain("md:bottom-8 md:right-8 md:h-20");
  });

  it("hält Dashboard-Statusfarben im erzwungenen Light-Theme gut lesbar", () => {
    const css = source("client/src/index.css");
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(css).toContain("--ok: #166534");
    expect(css).toContain("--warn: #92400e");
    expect(css).toContain("--err: #b91c1c");
    expect(css).toContain(".badge-ok { background:var(--ok-bg); border:1px solid #86efac; color:var(--ok); }");
    expect(css).toContain(".badge-warn { background:var(--warn-bg); border:1px solid #fcd34d; color:var(--warn); }");
    expect(css).toContain(".badge-err { background:var(--err-bg); border:1px solid #fca5a5; color:var(--err); }");
    expect(dashboard).not.toContain("dark:text-emerald-400");
    expect(dashboard).not.toContain("dark:text-red-400");
  });

  it("blendet Verwaltungsbereiche aus und hält die Planungsteam-Navigation flach", () => {
    const layout = source("client/src/components/Layout.tsx");
    const navigation = source("client/src/lib/nav.ts");
    const app = source("client/src/App.tsx");

    expect(layout).toContain("visibleNavigationSections(user?.role)");
    expect(layout.match(/visibleNavigationSections\(user\?\.role\)/g)).toHaveLength(2);
    expect(layout).toContain("navigationItemClasses(user?.role, href, active)");
    expect(layout.match(/navigationItemClasses\(user\?\.role, href, active\)/g)).toHaveLength(2);
    expect(layout).not.toContain("uppercase tracking-wider text-slate-400");
    expect(navigation).toContain("PLANNING_TEAM_HIDDEN_PATHS");
    expect(navigation).toContain("PLANNING_TEAM_EDITING_PATHS");
    expect(navigation).toContain("PLANNING_TEAM_OVERVIEW_PATHS");
    expect(navigation).not.toContain('label: "BEARBEITUNG"');
    expect(navigation).not.toContain('label: "ÜBERSICHT & INFO"');
    expect(navigation).toContain('"/ansprechpartner"');
    expect(navigation).toContain('"/finanzen"');
    expect(navigation).toContain('"/excel"');
    expect(navigation).toContain('"/orte"');
    expect(navigation).toContain('"/berechtigungen"');
    expect(navigation).toContain('label: "Protokoll"');
    expect(navigation).toContain("planningTeamHidden: true");
    expect(navigation).toContain("if (item.planningTeamHidden && role === \"user\") return false");
    expect(navigation).toContain("font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-900");
    expect(navigation).toContain("font-semibold text-slate-900 hover:bg-slate-100 hover:text-slate-900");
    expect(navigation).toContain("font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900");
    expect(layout.match(/rounded-lg px-3 py-2\.5 text-sm transition-all duration-150/g)).toHaveLength(1);
    expect(layout.match(/rounded-lg px-3 py-2 text-sm transition-all duration-150/g)).toHaveLength(1);
    expect(navigation).not.toContain("Nur Lesen");
    expect(app).toContain("function AdminOnlyPermissions");
    expect(app).toContain('if (user?.role !== "admin") return <Redirect to="/" />;');
    expect(app).toContain('<Route path="/berechtigungen" component={AdminOnlyPermissions} />');
  });

  it("kennzeichnet und steuert PDF-Bilder veranstaltungsspezifisch", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");

    expect(pdfExport).toContain("PDF-Bild für {currentEvent?.name");
    expect(pdfExport).toContain("aktuell ausgewählten Veranstaltung");
    expect(pdfExport).toContain("trpc.pdf.clearLogo.useMutation");
    expect(pdfExport).toContain("Verhalten ohne individuelles Bild");
    expect(pdfExport).toContain('<Select value="none" disabled>');
    expect(pdfExport).toContain('<SelectItem value="none">Kein Bild drucken</SelectItem>');
    expect(pdfExport).not.toContain("trpc.pdf.setLogoFallback.useMutation");
    expect(pdfExport).not.toContain("RSC-Vereinslogo verwenden");
    expect(pdfExport).not.toContain("Das Logo gilt für alle Veranstaltungen");
  });

  it("durchsucht den Einsatzplan auch nach eingeteilten Helfern", () => {
    const plan = source("client/src/pages/Plan.tsx");

    expect(plan).toContain("planEvaluationMatchesSearch");
    expect(plan).toContain("helperNameById");
    expect(plan).toContain("Suchen (Aufgabe/Bereich/Helfer) …");
    expect(plan).toContain(
      "Einsatzplan nach Aufgabe, Bereich oder Helfer durchsuchen"
    );
    expect(plan).toContain("<Search");
    expect(plan).toContain("h-12 w-full border-2 border-slate-400 bg-white");
    expect(plan).toContain("placeholder:text-slate-600");
    expect(plan).toContain('className="flex flex-col gap-2.5"');
    expect(plan).toContain("function HighlightedText");
    expect(plan).toContain('new RegExp(escapedQuery, "giu")');
    expect(plan).toContain("matchIndex + match[0].length");
    expect(plan).toContain("bg-amber-200 px-0.5 font-semibold");
    expect(plan).toContain("<HighlightedText text={shift.task} query={q} />");
    expect(plan).toContain("<HighlightedText text={s.area} query={q} />");
    expect(plan).toContain("searchQuery={q}");
    expect(plan).toContain('aria-label="Suche löschen"');
    expect(plan).toContain('setQ("")');
    expect(plan).toContain("searchInputRef.current?.focus()");
    expect(plan).toContain("h-11 w-11");
  });

  it("öffnet die Bereichsansprechpartner bedarfsgerecht und verdichtet sie auf bis zu fünf Spalten", () => {
    const plan = source("client/src/pages/Plan.tsx");

    expect(plan).toContain('<div className="space-y-3">');
    expect(plan).toContain('className="gap-0 border-slate-200 py-0 shadow-sm"');
    expect(plan).toContain('className="px-2 py-1 sm:px-2.5 sm:py-1"');
    expect(plan).toContain('className="flex h-9 w-full items-center justify-between');
    expect(plan).toContain('className="flex min-w-0 items-center gap-2"');
    expect(plan).toContain("mt-1.5 gap-1.5 sm:grid-cols-2 md:grid-cols-3");
    expect(plan).toContain("rounded-md border bg-slate-50/80 p-1.5");
    expect(plan).toMatch(/<SelectTrigger\s+size="sm"\s+className=/);
    expect(plan).toContain("w-full bg-white px-2 text-xs");
    expect(plan).toContain("areaContactsExpanded");
    expect(plan).toContain('aria-controls="area-contacts-grid"');
    expect(plan).toContain('aria-expanded={areaContactsExpanded}');
    expect(plan).toContain('areaContactsExpanded ? "grid" : "hidden"');
    expect(plan).toContain("xl:grid-cols-4 2xl:grid-cols-5");
  });

  it("warnt Admins vor dem Laden eines datierten Projektstands", () => {
    const storage = source(
      "client/src/components/ProjectStorageControls.tsx"
    );

    expect(storage).toContain("formatBackupTimestamp");
    expect(storage).toContain('day: "2-digit"');
    expect(storage).toContain('month: "2-digit"');
    expect(storage).toContain(
      "preview.data?.metadata.exportedAt"
    );
    expect(storage).toContain("Speicherstand vom ${formatBackupTimestamp");
    expect(storage).toContain(
      "alle Änderungen und Online-Eingaben überschrieben"
    );
    expect(storage).toContain('confirmLabel="Laden"');
    expect(storage).not.toContain(
      "Die Speicherdatei entspricht bereits dem aktuellen Stand"
    );
    expect(storage).toContain("setPreviewOpen(true)");
    expect(storage).toContain("Speicherdatei erfolgreich geprüft:");
    expect(storage).toContain(
      "Es sind keine Änderungen zu übernehmen."
    );
    expect(storage).toContain('{hasChanges ? "Abbrechen" : "Schließen"}');
    expect(storage).toContain("previewBinding: preview.data.previewBinding");
  });

  it("rendert Änderungseinträge auch bei alten doppelten Kennungen mit eindeutigen React-Schlüsseln", () => {
    const preview = source("client/src/components/ChangePreview.tsx");

    expect(preview).toContain("rows.map((change, index) =>");
    expect(preview).toContain("key={`${change.key}:${index}`}");
  });

  it("zeigt beim Ansprechpartnerimport die Prüfung aller Excel-Zeilen", () => {
    const moduleImport = source(
      "client/src/components/ModuleExcelImportButton.tsx"
    );

    expect(moduleImport).toContain("Vollständige Excel-Prüfung:");
    expect(moduleImport).toContain("preview.data?.rowsChecked");
    expect(moduleImport).toContain(
      "previewBinding: preview.data.previewBinding"
    );
  });

  it("zeigt keine überholten allgemeinen Kennzahlenkarten mehr im Dashboard", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).not.toContain("function MetricCardView");
    expect(dashboard).not.toContain("type MetricCard =");
    expect(dashboard).not.toContain("Helferbedarf & Belegung");
    expect(dashboard).not.toContain('title: "Aufgabenstatus"');
  });

  it("stellt akute Organisationsaufgaben priorisiert vor die neutralen Dashboardkennzahlen", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain('data-dashboard-section="Heute priorisieren"');
    expect(dashboard).toContain("Nur Punkte mit direktem Handlungsbedarf");
    expect(dashboard).toContain("const priorityActions: PriorityAction[]");
    expect(dashboard).toContain("].slice(0, 4)");
    expect(dashboard).toContain('id: "ausfaelle"');
    expect(dashboard).toContain('id: "vorbereitung-abgelehnt"');
    expect(dashboard).toContain('id: "doppelbelegungen"');
    expect(dashboard).toContain('id: "offene-schichten"');
    expect(dashboard).toContain('id: "knappe-schichten"');
    expect(dashboard).toContain('id: "offene-vorbereitung"');
    expect(dashboard).toContain('id: "offene-nachbereitung"');
    expect(dashboard).toContain('id: "einsatzplan-stabil"');
    expect(dashboard).toContain("PriorityActionCard");
    expect(dashboard).toContain("priorityActions.length === 1");
    expect(dashboard).toContain('"xl:grid-cols-2"');
    expect(dashboard).toContain('"xl:grid-cols-4"');
    expect(dashboard).toContain("Keine dringenden Punkte");
    expect(dashboard).not.toContain('title: "Einsatzplanung"');
    expect(dashboard).not.toContain("Helferbedarf & Belegung");
    expect(dashboard).not.toContain('title: "Aufgabenstatus"');
  });

  it("zeigt ausschließlich datierte nicht erledigte Vorbereitungsfristen chronologisch im Dashboard", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const router = source("server/routers.ts");

    expect(router).toContain("upcomingPreparationDeadlines(prep, contacts)");
    expect(router).toContain("naechsteVorbereitungsfristen");
    expect(dashboard).toContain("UpcomingDeadlinesCard");
    expect(dashboard).toContain('data-dashboard-section="Nächste Fristen"');
    expect(dashboard).toContain("Datierte Vorbereitungsaufgaben");
    expect(dashboard).toContain("deadlineTimingLabel");
    expect(dashboard).toContain("deadlineToneClass");
    expect(dashboard).toContain("upcomingDeadlines.length > 0");
    expect(dashboard).toContain('const target: DashboardTarget = { path: "/vorbereitung" }');
  });

  it("zeigt die Rückmeldequote eingeteilter Helfer und verlinkt offene Rückmeldungen direkt", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");
    const router = source("server/routers.ts");

    expect(router).toContain("helferEingeteilt");
    expect(router).toContain("helferEingeteiltBestaetigt");
    expect(router).toContain("helferEingeteiltUnbestaetigt");
    expect(router).toContain("rueckmeldequote");
    expect(dashboard).toContain("HelperStatusCommunicationCard");
    expect(dashboard).toContain('data-dashboard-section="Helfer-Status & Kommunikation"');
    expect(dashboard).toContain("Rückmeldequote");
    expect(dashboard).toContain("eingeteilte Helfer bestätigt");
    expect(dashboard).toContain('path: "/helfer"');
    expect(dashboard).toContain('confirmed: "nein"');
    expect(dashboard).toContain("assigned: true");
    expect(helpers).toContain("parseHelperConfirmationFilter");
    expect(helpers).toContain("parseHelperAssignmentFilter");
    expect(helpers).toContain("assignedHelperIds.has(helper.id)");
    expect(helpers).toContain("Dashboardfilter: Nur eingeteilte Helfer ohne Rückmeldung.");
    expect(helpers).toContain("Filter aufheben");
  });

  it("integriert das Helferpotenzial tagesgenau in die Einsatzbereitschaft", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const router = source("server/routers.ts");

    expect(router).toContain("isHelperWithoutFirstContact(helper, aktiveFestivaltage)");
    expect(router).toContain("helferOhneErstkontakt");
    expect(router).toContain("helferKontaktiert");
    expect(router).toContain("erstkontaktquote");
    expect(dashboard).toContain("HelperStatusCommunicationCard");
    expect(dashboard).toContain('data-dashboard-section="Helfer-Status & Kommunikation"');
    expect(dashboard).toContain("Erstkontakt-Quote");
    expect(dashboard).toContain("Helfer kontaktiert");
    expect(dashboard).toContain("Helfer noch ohne Erstkontakt");
    expect(dashboard).toContain("#2563eb");
    expect(dashboard).toContain('firstContact: "offen"');
    expect(helpers).toContain("parseHelperFirstContactFilter");
    expect(helpers).toContain("isHelperWithoutFirstContact(helper, activeDays)");
    expect(helpers).toContain("Dashboardfilter: Nur Helfer ohne Erstkontakt.");
    expect(router).toContain("gueltigeSchichtenJeHelfer");
    expect(router).toContain("gueltigeSchichtenJeHelferUndTag");
    expect(router).toContain("ungenutzteHelfer");
    expect(router).toContain("teilzeitReserve");
    expect(dashboard).not.toContain("HelperPotentialCard");
    expect(dashboard).not.toContain('data-dashboard-section="Helfer-Potenzial"');
    expect(dashboard).toContain("Komplett ungenutzt");
    expect(dashboard).toContain("Teilzeit-Reserve");
    expect(dashboard).toContain("ungenutzteHelferIds");
    expect(dashboard).toContain("teilzeitReserveIds");
    expect(dashboard).toContain("showPotentialInWorkload");
    expect(dashboard).toContain("workloadFilterLabel");
    expect(dashboard).toContain('id="helferauslastung"');
    expect(dashboard).toContain("Filter aufheben");
    expect(dashboard).toContain("const openHelperWorkload");
    expect(dashboard).toContain("helperId: helper.id");
    expect(dashboard).toContain('data-dashboard-workload-cell="helper"');
    expect(dashboard).toContain('data-dashboard-workload-cell={day}');
    expect(dashboard).toContain('data-dashboard-workload-cell="gesamt"');
    expect(dashboard).toContain("openHelperWorkload(a.name, day)");
    expect(dashboard).toContain("openHelperWorkload(a.name)");
    expect(dashboard).toContain("eingeteilte Schichten im Einsatzplan anzeigen");
    expect(plan).toContain("PLAN_HELPER_QUERY_KEY");
    expect(plan).toContain("PLAN_DAY_QUERY_KEY");
    expect(plan).toContain("parsePlanHelperFilter");
    expect(plan).toContain("parsePlanDayFilter");
    expect(plan).toContain("dashboardHelperId");
    expect(plan).toContain("assignment.helperId === dashboardHelperId");
    expect(plan).toContain("data-dashboard-helper-filter");
    expect(plan).toContain("Dashboardfilter:");
    expect(dashboard).toContain('data-dashboard-section="Helfer-Kennzahlen"');
    expect(dashboard).toContain(
      'className="grid gap-4 md:grid-cols-3"'
    );
    expect(dashboard).toContain("<LocationMapCard />");
    expect(dashboard).toContain('data-dashboard-level="Live-Standortkarte"');
    expect(source("client/src/components/LocationMapCard.tsx")).toContain(
      'data-dashboard-section="Live-Standortkarte"'
    );
  });

  it("visualisiert die tägliche Einsatzbereitschaft für die aktivierten Eventtage", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const router = source("server/routers.ts");

    expect(router).toContain("taeglicheEinsatzbereitschaft");
    expect(router).toContain("aktiveFestivaltage.map(day =>");
    expect(router).not.toContain('["Freitag", "Samstag", "Sonntag"] as const');
    expect(router).toContain("fehlend");
    expect(router).toContain("quote");
    expect(dashboard).toContain("DailyReadinessCard");
    expect(dashboard).toContain('data-dashboard-section="Einsatzbereitschaft je Festivaltag"');
    expect(dashboard).toContain("Einsatzbereitschaft je Festivaltag");
    expect(dashboard).toContain("Besetzt / Bedarf");
    expect(dashboard).toContain("readinessTone");
    expect(dashboard).toContain('role="progressbar"');
    expect(dashboard).toContain('path: "/einsatzplan"');
    expect(dashboard).toContain("Komplett ungenutzt");
    expect(dashboard).toContain("Teilzeit-Reserve");
    expect(dashboard).toContain("onPotentialFilter(day.day, \"ungenutzt\")");
    expect(dashboard).toContain("onPotentialFilter(day.day, \"teilzeit\")");
    expect(dashboard).toContain("function readinessGridClass(dayCount: number)");
    expect(dashboard).toContain("md:grid-cols-2 lg:grid-cols-3");
    expect(dashboard).toContain("md:grid-cols-2 lg:grid-cols-4");
    expect(dashboard).toContain("readinessGridClass(readiness.length)");
  });

  it("ordnet die nächsten vier Fristen als vollbreite Kartenmatrix unter den Prio-Aktionen an", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain('data-dashboard-level="Fristen"');
    expect(dashboard).toContain('className="w-full"');
    expect(dashboard).toContain('grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4');
    expect(dashboard).toContain('min-h-28 min-w-0 flex-col');
    expect(dashboard).toContain("deadlineTimingLabel(deadline.daysUntil)");
    expect(dashboard).toContain("Datierte Vorbereitungsaufgaben");
  });

  it("ordnet Kennzahlen, scrollbare Tabellen und Standortkarte in der Dashboard-Hierarchie", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const priorityIndex = dashboard.indexOf('data-dashboard-section="Heute priorisieren"');
    const deadlinesIndex = dashboard.indexOf('data-dashboard-level="Fristen"');
    const metricsIndex = dashboard.indexOf('data-dashboard-level="Helfer-Kennzahlen"');
    const tablesIndex = dashboard.indexOf('data-dashboard-level="Tabellendetails"');
    const mapIndex = dashboard.indexOf('data-dashboard-level="Live-Standortkarte"');

    expect(priorityIndex).toBeGreaterThanOrEqual(0);
    expect(priorityIndex).toBeLessThan(deadlinesIndex);
    expect(deadlinesIndex).toBeLessThan(metricsIndex);
    expect(metricsIndex).toBeLessThan(tablesIndex);
    expect(tablesIndex).toBeLessThan(mapIndex);
    expect(dashboard).toContain('flex h-[250px] flex-col overflow-hidden shadow-sm');
    expect(dashboard).toContain('min-h-0 flex-1 overflow-auto pt-0');
    expect(dashboard).toContain('min-h-0 flex-1 overflow-y-auto px-3 pt-0 sm:px-6');
    expect(
      (dashboard.match(/thead className="sticky top-0 z-10 bg-slate-50"/g) ?? []).length
    ).toBe(2);
    expect(dashboard).toContain('border-b border-slate-200 bg-slate-50');
    expect(dashboard).toContain('className="bg-slate-50 py-1 pr-3"');
    expect(dashboard).toContain('className="bg-slate-50 py-1 pr-1 sm:pr-2"');
  });

  it("zeigt das Live-Countdown-Widget im Dashboardkopf und den Kalender-Trigger im Layout", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const router = source("server/routers.ts");
    const eventDates = source("shared/event-dates.ts");
    const styles = source("client/src/index.css");

    expect(dashboard).toContain("EventCountdownWidget");
    expect(dashboard).toContain('data-slot="event-countdown"');
    expect(dashboard).toContain("eventCountdownState");
    expect(dashboard).toContain("Eventstart in");
    expect(dashboard).toContain("border-2 border-amber-400");
    expect(dashboard).toContain("text-4xl font-black");
    expect(dashboard).toContain("shrink-0 !min-w-[17.5rem]");
    expect(dashboard).toContain("const isUrgent = state.days < 14");
    expect(dashboard).toContain('data-countdown-urgent={isUrgent ? "true" : "false"}');
    expect(dashboard).toContain('" countdown-urgent"');
    expect(dashboard).not.toContain("formatEventDate");
    expect(dashboard).toContain("Event läuft!");
    expect(dashboard).toContain("Veranstaltung abgeschlossen");

    expect(layout).toContain('data-slot="event-dates-trigger"');
    expect(layout).toContain("openEventDateSettings");
    expect(layout).toContain("Startdatum");
    expect(layout).toContain("Enddatum");

    expect(router).toContain("startDate");
    expect(router).toContain("endDate");
    expect(eventDates).toContain("eventCountdownState");
    expect(styles).toContain(".countdown-urgent::after");
    expect(styles).toContain("@keyframes countdown-urgent-glow");
    expect(styles).toContain("prefers-reduced-motion: no-preference");
    expect(styles).toContain("will-change: opacity, transform");
  });

  it("zeigt im Einsatzplankopf keine Statusbadges mehr", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(dashboard).not.toContain('title: "Einsatzplanung"');
    expect(plan).not.toContain("function PlanStatusBar");
    expect(plan).not.toContain('data-plan-status-bar');
    expect(plan).not.toContain("PlanStatusCounts");
    expect(plan).not.toContain("planStatusCounts");
    expect(plan).toContain("utils.plan.evaluate.invalidate()");
    expect(plan).toContain("data-plan-action-header");
    expect(plan).toContain("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between");
    expect(plan).toContain("lg:min-w-[500px]");
  });

  it("bietet im Schichtdialog bestehende Bereiche zur Auswahl und erlaubt neue Freitexteingaben", () => {
    const plan = source("client/src/pages/Plan.tsx");

    expect(plan).toContain("const areaOptions = useMemo(");
    expect(plan).toContain('left.localeCompare(right, "de")');
    expect(plan).toContain('htmlFor="shift-area"');
    expect(plan).toContain('id="shift-area"');
    expect(plan).toContain('list="shift-area-options"');
    expect(plan).toContain('placeholder="Bestehenden Bereich wählen oder neu anlegen"');
    expect(plan).toContain('<datalist id="shift-area-options">');
    expect(plan).toContain("areaOptions.map(areaName => (");
    expect(plan).toContain('<option key={areaName} value={areaName} />');
    expect(plan).toContain('setForm({ ...form, area: e.target.value })');
  });

  it("verknüpft Dashboardwarnungen direkt mit gefilterten Einsatzplanschichten", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");

    expect(dashboard).toContain('status: "OFFEN"');
    expect(dashboard).toContain('status: "KNAPP"');
    expect(dashboard).toContain('warning: "konflikte"');
    expect(dashboard).toContain('warning: "ausfaelle"');
    expect(dashboard).toContain('path: "/nachbereitung", status: "offen"');
    expect(dashboard).toContain("navigate(dashboardTargetHref(target))");
    expect(dashboard).toContain("Zugehörige Einträge anzeigen");
    expect(dashboard).toContain('tone: "orange"');
    expect(dashboard).toContain('tone: "red"');
    expect(dashboard).toContain("PRIORITY_TONE_CLASSES");
    expect(dashboard).toContain("border-amber-300 bg-amber-50/90");
    expect(dashboard).toContain("border-red-300 bg-red-50/90");
    expect(plan).toContain('warningFilter !== "konflikte" || e.doppelCount > 0');
    expect(plan).toContain('warningFilter !== "ausfaelle" || e.ausfallCount > 0');
    expect(plan).toContain("parsePlanStatusFilter");
    expect(plan).toContain('aria-label="Warnungsfilter"');
    expect(plan).toContain("Nur Doppelbelegungen");
    expect(plan).toContain("Nur Ausfälle");
    expect(plan).not.toContain("PLAN_WARNING_FILTERS");
    expect(plan).not.toContain('warningFilter !== "alle" && (');
    expect(plan).toContain("Keine Schichten mit Doppelbelegungen gefunden.");
    expect(plan).toContain("Keine Schichten mit Ausfällen gefunden.");
    expect(taskList).toContain("parseTaskStatusFilter");
    expect(taskList).toContain('aria-label="Aufgabenstatus filtern"');
    expect(taskList).toContain("Nur offene Aufgaben");
    expect(dashboard).toContain("abgelehnteVorbereitung");
    expect(dashboard).toContain("offeneVorbereitung");
    expect(dashboard).toContain('target: { path: "/vorbereitung", status: "abgelehnt" }');
    expect(dashboard).toContain('target: { path: "/vorbereitung", status: "offen" }');
    expect(dashboard).not.toContain("PreparationMetricCardView");
  });

  it("ordnet Prio-Aktionen, Fristen, Helferkennzahlen und Tabellendetails logisch untereinander", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    const priorities = dashboard.indexOf('data-dashboard-section="Heute priorisieren"');
    const deadlines = dashboard.indexOf("<UpcomingDeadlinesCard");
    const helperKpis = dashboard.indexOf('data-dashboard-section="Helfer-Kennzahlen"');
    const detailCards = dashboard.indexOf('className="grid gap-6 lg:grid-cols-2"');
    expect(priorities).toBeGreaterThan(-1);
    expect(deadlines).toBeGreaterThan(-1);
    expect(helperKpis).toBeGreaterThan(deadlines);
    expect(detailCards).toBeGreaterThan(helperKpis);
    expect(deadlines).toBeGreaterThan(priorities);
    expect(dashboard).toContain('data-dashboard-level="Tabellendetails"');
    expect(dashboard).toContain("Verantwortlichkeiten pro Ansprechpartner");
    expect(dashboard).toContain("Helferauslastung (eingeteilte Schichten)");
    expect(dashboard).not.toContain("const sections: MetricSection[]");
  });

  it("führt Marketing und Genehmigungen in der sechsspaltigen Verantwortlichkeitstabelle als Vorbereitung", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const router = source("server/routers.ts");

    expect(dashboard).toContain('className="w-full min-w-[420px] table-fixed text-sm"');
    expect(dashboard).toContain('<col className="w-2/5" />');
    expect(dashboard).toContain('<th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Helfer</th>');
    expect(dashboard).toContain('<th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Vorb.</th>');
    expect(dashboard).toContain('<th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Nachb.</th>');
    expect(dashboard).toContain('<th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Mat.</th>');
    expect(dashboard).toContain('<th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Gesamt</th>');
    expect(dashboard).not.toContain(">Mark.<");
    expect(dashboard).not.toContain(">Genehm.<");
    expect(dashboard).not.toContain("v.marketing");
    expect(dashboard).not.toContain("v.genehmigungen");
    expect(dashboard).toContain("colSpan={6}");
    expect(router).toContain("const vorbereitung =");
    expect(router).toContain("marketing.filter(item => item.contactId === contact.id).length");
    expect(router).toContain("approvals.filter(item => item.contactId === contact.id).length");
    expect(router).toContain("gesamt: betreuteHelfer + vorbereitung + nachbereitung + material");
    expect(router).not.toContain("genehmigungen: approvals.filter");
  });

  it("vereinheitlicht Vorbereitung mit Dialog, Filtern und Aktionsicons des Einsatzplans", () => {
    const prep = source("client/src/pages/Preparation.tsx");
    expect(prep).toContain("Neue Vorbereitungsaufgabe");
    expect(prep).not.toContain("Optionale Felder:");
    expect(prep).toContain("Vorbereitungsaufgabe bearbeiten");
    expect(prep).toContain("ConfirmDeleteDialog");
    expect(prep).toContain("title=\"Vorbereitungsaufgabe löschen?\"");
    expect(prep).toContain("DialogContent");
    expect(prep).toContain("DialogFooter");
    expect(prep).toContain("openCreate");
    expect(prep).toContain("openEdit");
    expect(prep).toContain("Pencil");
    expect(prep).toContain("Trash2");
    expect(prep).toContain("max-h-[calc(100dvh-2rem)]");
    expect(prep).toContain("lg:hidden");
    expect(prep).toContain("trpc.pdf.prepTaskOverview.useMutation");
    expect(prep).toContain("downloadBase64File");
    expect(prep).toContain("Vorbereitungs-PDF wurde heruntergeladen");
    expect(prep).not.toContain('window.open("", "_blank", "popup=yes")');
    expect(prep).toContain("h-11 w-11");
    expect(prep).toContain("Bestehenden Bereich wählen oder neu anlegen");
    expect(prep).toContain("Verantwortlicher");
    expect(prep).toContain("Frist / Abgabedatum");
    expect(prep).toContain('type="date"');
    expect(prep).toContain("Datum über den Kalender wählen; gespeichert und angezeigt als TT.MM.JJJJ.");
    expect(prep).toContain("title=\"Frist chronologisch sortieren\"");
    expect(prep).toContain("dueSortDirection");
    expect(prep).toContain("parseDueDate");
    expect(prep).toContain("Logbuch-Eintrag / Aktueller Stand");
    expect(prep).toContain("Bisheriges Logbuch");
    expect(prep).toContain("prependPreparationLogbookEntry");
    expect(prep).toContain("useAuth");
    expect(prep).toContain("Datum, Uhrzeit und deinem Namen");
    expect(prep).toContain("Beantragt");
    expect(prep).toContain("Genehmigt");
    expect(prep).toContain("Abgelehnt");
    expect(prep).not.toContain('htmlFor="prep-status"');
    expect(prep).not.toContain("Beantragt und Genehmigt verwenden intern denselben Ablaufstatus");
    expect(prep).toContain('status: input.status ?? "offen"');
    expect(prep).toContain("Status für ${task.task} ändern");
    expect(prep).toContain("statusSelectValue(task.status, wording)");
    expect(prep).toContain("applyDialogStatus(value as DialogStatus)");
    expect(prep).toContain('left.category?.trim() || "\\uffff"');
    expect(prep).not.toContain("Sortierung:");
    expect(prep).toContain("Suchen (Aufgabe/Bereich/Verantwortlicher/Ort/Frist)");
    expect(prep).toContain("w-full max-w-2xl");
    expect(prep).toContain("grid grid-cols-1 gap-2 md:flex md:flex-wrap");
    expect(prep).toContain("border-sky-200 bg-white text-base md:h-10 md:w-[190px]");
    expect(prep).toContain("border-sky-200 bg-white text-base md:h-10 md:w-[220px]");
    expect(prep).toContain("border-sky-200 bg-white text-base md:h-10 md:w-[175px]");
    expect(prep).not.toContain("Aufgaben angezeigt");
    expect(prep).toContain("bg-sky-50/50");
    expect(prep).toContain("border-sky-100");
    expect(prep).toContain("bg-blue-600 text-base font-medium text-white");
    expect(prep).toContain('w-[15%] ${STICKY_TABLE_HEADER_CELL_CLASS}');
    expect(prep).toContain("border-sky-200 bg-sky-50 px-2 py-0.5");
    expect(prep).toContain("h-8 w-32 border text-xs font-medium");
    expect(prep).toContain("min-w-[260px] px-4 py-3 align-top text-slate-600");
    expect(prep).toContain("PopoverContent");
    expect(prep).toContain("Logbuch");
    expect(prep).toContain("Vollständiges Logbuch anzeigen");
    expect(prep).toContain("Logbuch zu ${task.task} anzeigen");
    expect(prep).toContain("latestPreparationLogbookEntry");
    expect(prep).toContain("preparationLogbookNeedsDetail");
    expect(prep).toContain("const logbookEntryCount = preparationLogbookEntryCount(task.note);");
    expect(prep).toContain("logbookEntryCount > 1");
    expect(prep).toContain("Logbucheinträge anzeigen");
    expect(prep).toContain("bg-slate-100 px-1 text-[10px] font-bold");
    expect(prep).toContain("MobilePreparationLogbookField");
    expect(prep).toContain("Logbuch zu ${task.task} ergänzen");
    expect(prep).toContain("Vollständiges Logbuch zu ${task.task} anzeigen");
    expect(prep).toContain("Logbuch – Verlauf");
    expect(prep).toContain("categoryFilter");
    expect(prep).toContain("contactFilter");
    expect(prep).toContain("statusFilter");
    expect(prep).toContain("Filter zurücksetzen");
    expect(prep).not.toContain("Filter aufheben");
    expect(prep).not.toContain("Nur offene Vorbereitungen");
    expect(prep).toContain("locationFilter");
    expect(prep).toContain("updateLocationFilter");
    expect(prep).toContain("Alle Standorte");
    expect(prep).toContain("locationMap.get(row.locationId)");
    expect(prep).toContain("PDF drucken");
    expect(prep).toContain("trpc.pdf.prepTaskOverview.useMutation");
    expect(prep).toContain("downloadBase64File");
    expect(prep).toContain("downloadTaskOverviewPdf");
    expect(prep).not.toContain('window.open("", "_blank", "popup=yes")');
    expect(prep).toContain("searchTerm");
  });

  it("verwendet die transparente MyCrewMate-Wortmarke und das App-Icon browserstabil", () => {
    const layout = source("client/src/components/Layout.tsx");
    const brandAssets = source("server/brand-assets.ts");

    expect(layout).toContain('const MYCREWMATE_WORDMARK = "/mycrewmate-logo.png"');
    expect(layout).toContain('const MYCREWMATE_ICON = "/manus-storage/mycrewmate-pwa-icon-512_b16ae84c.png"');
    expect(brandAssets).toContain("mycrewmate-transparent-wordmark-v2_1282b566.png");
    expect(brandAssets).not.toContain("RSC_BRAND_LOGO");
    expect(layout.match(/src=\{MYCREWMATE_WORDMARK\}/g)).toHaveLength(3);
    expect(layout.match(/src=\{MYCREWMATE_ICON\}/g)).toHaveLength(2);
    expect(layout.match(/alt="MyCrewMate"/g)).toHaveLength(3);
  });

  it("zeigt unter der Wortmarke einen zentrierten Planungstitel ohne Vereinslogo", () => {
    const layout = source("client/src/components/Layout.tsx");
    const legalFooter = source("client/src/components/ImpressumDialog.tsx");

    expect(layout).toContain("VEREINS- &amp; EVENTPLANUNG");
    expect(layout).toContain("text-center text-[11px] font-medium");
    expect(layout).toContain("bg-transparent object-contain");
    expect(layout).toContain("items-center border-b bg-white px-4 py-3");
    expect(layout).toContain("flex flex-col border-t border-slate-200/70 px-3 pt-0.5 pb-1 leading-none");
    expect(layout).toContain('className="h-6 w-6 shrink-0"');
    expect(layout).toContain('className="mt-0.5 block w-full whitespace-nowrap rounded px-0 text-center text-[9px] leading-none text-gray-400');
    expect(legalFooter).toContain(
      "© 2026 MyCrewMate.de · Alle Rechte vorbehalten."
    );
    expect(legalFooter).toContain("gap-0.5 whitespace-nowrap text-[9px] leading-none");
    expect(layout).toContain("SIDEBAR_COPYRIGHT_NOTICE");
    expect(layout).toContain("whitespace-nowrap");
    expect(layout).toContain('<OnlinePresenceBadge\n            counts={onlinePresence.counts}');
    expect(layout).not.toContain("ClubStatusLogoButton");
    expect(layout).not.toContain("ClubLogoModal");
    expect(layout).not.toContain("trpc.branding.current.useQuery");
    expect(layout).not.toContain("Vereinslogo ändern");
  });

  it("verdichtet den Projektstand ohne redundanten Hilfetext vor der Navigation", () => {
    const layout = source("client/src/components/Layout.tsx");
    const storageControls = source("client/src/components/ProjectStorageControls.tsx");

    expect(storageControls).not.toContain(
      "Kompakte Projektdatei der aktuell gewählten Veranstaltung."
    );
    expect(layout.match(/className="mt-2 border-t pt-2"/g)).toHaveLength(2);
    expect(layout.match(/className="mb-1 block text-xs text-muted-foreground"/g)).toHaveLength(2);
    expect(layout).toContain(
      'className="flex-1 overflow-y-auto px-2 pb-2 pt-1.5 space-y-0.5"'
    );
  });

  it("entfernt Schulungsvideos und Videoplatzhalter vollständig aus der Hilfe", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).not.toContain("helpVideo");
    expect(help).not.toContain("PlayCircle");
    expect(help).not.toContain("/api/videos/");
    expect(help).not.toContain("video-administratoren");
    expect(help).not.toContain("video-planungsteam");
    expect(help).not.toContain("<video");
    expect(help).not.toContain("<source");
    expect(help).toContain("PLANNING_TEAM_FLOW");
    expect(help).toContain("Dein Ablauf in 6 Schritten");
    expect(help).toContain("Persönlichen PDF-Link per WhatsApp weitergeben.");
  });

  it("bietet eine durchsuchbare, rollenmarkierte Hilfe für alle Handbuchbereiche", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).toContain("Schnellstart und Orientierung");
    expect(help).toContain("MyCrewMate als App auf dem Handy speichern");
    expect(help).toContain("Progressive Web App (PWA)");
    expect(help).toContain("Zum Home-Bildschirm");
    expect(help).toContain("App installieren");
    expect(help).toContain("Rollen- &amp; Berechtigungsübersicht");
    expect(help).toContain("Sektion A");
    expect(help).toContain("Sektion B");
    expect(help).toContain("Operativer Fokus");
    expect(help).toContain("Vollzugriff &amp; Systemsteuerung");
    expect(help).toContain("Zugangsschutz &amp; Notfall-Stopp");
    expect(help).toContain("System-Protokoll");
    expect(help.indexOf("Rollen- &amp; Berechtigungsübersicht")).toBeLessThan(
      help.indexOf('aria-label="Hilfekapitel nach Rolle filtern"')
    );
    expect(help).toContain("Helferkartei und Verfügbarkeiten");
    expect(help).toContain("Einsatzplan und intelligente Belegung");
    expect(help).toContain("Live-Chat und Notiz-Widget");
    expect(help).toContain("Fachbereiche und Aufgaben");
    expect(help).toContain("Import, Wiederherstellung und Datensicherheit");
    expect(help).toContain("PDF-Ausgabe und Versand");
    expect(help).toContain("PDF-Handbuch herunterladen");
    expect(help).toContain('placeholder="A–Z-Suche: z. B. Helfer, PDF, Bestätigung oder Excel"');
    expect(help).toContain('src: "/api/help/images/dashboard"');
    expect(help).toContain('src: "/api/help/images/helpers"');
    expect(help).toContain('src: "/api/help/images/plan"');
    expect(help).toContain('src: "/api/help/images/chat"');
    expect(help).toContain('src: "/api/help/images/pdf"');
    expect(help).toContain('src: "/api/help/images/app-speichern"');
    expect(help).not.toContain("dashboard-current_8a026d64.png");
  });

  it("filtert Hilfekapitel über zugängliche Schnellfilter nach Rolle", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).toContain('useState<keyof typeof ROLE_STYLE>("alle")');
    expect(help).toContain('aria-label="Hilfekapitel nach Rolle filtern"');
    expect(help).toContain("Alle Kapitel");
    expect(help).toContain("Nur Planungsteam");
    expect(help).toContain("Nur Administratoren");
    expect(help).toContain("aria-pressed={active}");
    expect(help).toContain("onClick={() => setRoleFilter(role)}");
    expect(help).toContain('section.role === "alle"');
    expect(help).toContain("section.role === roleFilter");
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
      "cursor-pointer bg-transparent text-gray-500 hover:bg-white/60 hover:text-gray-900"
    );
    expect(layout).toContain("bg-transparent text-gray-500");
    expect(layout).toContain("bg-white font-semibold text-blue-600 shadow-sm");
  });

  it("bietet auf der mobilen Anmeldung eine gut erreichbare Passwortanzeige", () => {
    const layout = source("client/src/components/Layout.tsx");

    expect(layout).toContain("const [passwordVisible, setPasswordVisible] = useState(false)");
    expect(layout).toContain("const [capsLockOn, setCapsLockOn] = useState(false)");
    expect(layout).toContain('type={passwordVisible ? "text" : "password"}');
    expect(layout).toContain('aria-label={passwordVisible ? "Passwort verbergen" : "Passwort anzeigen"}');
    expect(layout).toContain("onClick={() => setPasswordVisible(visible => !visible)}");
    expect(layout).toContain("<EyeOff className=\"h-5 w-5\"");
    expect(layout).toContain("<Eye className=\"h-5 w-5\"");
    expect(layout).toContain('className="h-12 pr-12 text-base"');
    expect(layout).toContain("rounded-lg bg-blue-600 py-2.5 text-base font-semibold text-white");
    expect(layout).toContain(': "Anmelden"');
    expect(layout).not.toContain("Als Hauptadministrator via Manus anmelden");
    expect(layout).not.toContain("Hauptadministrator</p>");
    expect(layout).toContain("VEREINS- &amp; EVENTPLANUNG");
    expect(layout).not.toContain("Geschützte Helfer-Planung für Organisatoren");
    expect(layout).toContain("Nach 5 Fehlversuchen greift eine zeitbasierte Sperre (Cooldown).");
    expect(layout).toContain("showCooldownHint && !planningTeamLocked");
    expect(layout).toContain("border-amber-200 bg-amber-50");
    expect(layout).toContain('event.getModifierState("CapsLock")');
    expect(layout).toContain('id="password-caps-lock-warning"');
    expect(layout).toContain("Feststelltaste ist aktiviert.");
    expect(layout).toContain('role="status"');
    expect(layout).toContain("min-h-12 min-w-12");
    expect(layout).toContain("min-h-[100dvh]");
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

  it("erlaubt auf mobilen Geräten manuelles Heranzoomen", () => {
    const html = source("client/index.html");

    expect(html).toContain("width=device-width, initial-scale=1.0");
    expect(html).not.toContain("maximum-scale");
    expect(html).not.toContain("user-scalable=no");
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
      'className="h-11 w-24 bg-white font-semibold text-slate-950"'
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

  it("hält die verbleibenden Dashboardkarten auf 320-Pixel-Ansichten lesbar", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("min-w-0 flex-1");
    expect(dashboard).toContain("line-clamp-2");
    expect(dashboard).toContain("flex-wrap");
  });

  it("bündelt die zwei Einsatzplan-Resetwege hinter einem passwortgeschützten Dialog", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const resetDialog = source(
      "client/src/components/PlanResetDialogButton.tsx"
    );
    const passwordDialog = source(
      "client/src/components/AdminPasswordDialog.tsx"
    );

    expect(plan.indexOf("<CopyPreviousPlanButton />")).toBeLessThan(
      plan.indexOf("<PlanResetDialogButton")
    );
    expect(plan).not.toContain("<ClearPlanAssignmentsButton");
    expect(plan).not.toContain("<ResetAreaButton");
    expect(resetDialog).toContain("trpc.plan.clearAssignments.useMutation");
    expect(resetDialog).toContain("trpc.moduleAssignments.clear.useMutation");
    expect(resetDialog).toContain("trpc.reset.area.useMutation");
    expect(resetDialog).toContain("Belegungen leeren");
    expect(resetDialog).toContain("Kompletten Plan löschen");
    expect(resetDialog).toContain("Alle eingeteilten Helfer werden aus den Schichten");
    expect(resetDialog).toContain("border-rose-200 bg-rose-50");
    expect(resetDialog).toContain("text-rose-700");
    expect(plan).toContain('name="plan-search-query"');
    expect(plan).toContain('autoComplete="off"');
    expect(plan).toContain('onCompleted={() => setQ("")}');
    expect(passwordDialog).toContain('name="admin-confirmation-password"');
    expect(passwordDialog).toContain('autoComplete="off"');
  });

  it("ordnet die drei Modulaktionen und den gemeinsamen Resetdialog für Vorbereitung, Nachbereitung und Material", () => {
    const prep = source("client/src/pages/Preparation.tsx");
    const post = source("client/src/pages/PostProcessing.tsx");
    const materials = source("client/src/pages/Materials.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    const resetDialog = source(
      "client/src/components/PlanResetDialogButton.tsx"
    );

    for (const module of [prep, post]) {
      expect(module).toContain("lg:min-w-[500px]");
      expect(module).toContain("grid grid-cols-2 gap-2 lg:grid-cols-3");
      expect(module).toContain('buttonLabel="Excel Import"');
      expect(module).toContain("<PlanResetDialogButton");
      expect(module.indexOf("PDF drucken")).toBeLessThan(
        module.indexOf("buttonLabel=\"Excel Import\"")
      );
      expect(module.indexOf("buttonLabel=\"Excel Import\"")).toBeLessThan(
        module.indexOf("<PlanResetDialogButton")
      );
      expect(module).not.toContain("<ClearModuleAssignmentsButton");
      expect(module).not.toContain("<ResetAreaButton");
    }

    expect(materials).toContain("stackedActionColumns={3}");
    expect(materials).toContain('excelImportButtonLabel="Excel Import"');
    expect(materials).toContain('clearAssignmentsArea="materials"');
    expect(taskGeneric).toContain("clearAssignmentsArea?: \"prep\" | \"post\" | \"materials\"");
    expect(taskGeneric).toContain("lg:grid-cols-3");
    expect(taskGeneric).toContain("<PlanResetDialogButton");
    expect(taskGeneric).not.toContain("<ClearModuleAssignmentsButton");
    expect(resetDialog).toContain("Alle Verantwortlichen und Fristen werden geleert");
    expect(resetDialog).toContain("Stand sämtlicher Materialartikel auf „Offen“ zurückgesetzt");
    expect(resetDialog).toContain("Alle Materialartikel der aktuell gewählten Veranstaltung werden dauerhaft gelöscht.");
  });

  it("setzt Helfer über den gemeinsamen Dialog ohne Stammdaten- oder Schichtlöschung zurück", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const resetDialog = source(
      "client/src/components/PlanResetDialogButton.tsx"
    );

    expect(helpers).toContain('<PlanResetDialogButton\n              area="helpers"');
    expect(helpers).not.toContain('<ResetAreaButton area="helpers"');
    expect(resetDialog).toContain('| "helpers"');
    expect(resetDialog).toContain('helpers: {');
    expect(resetDialog).toContain("Komplette Belegung leeren");
    expect(resetDialog).toContain("Ansprechpartner, Hinweise für PDF und zusätzliche Begleitungen werden entfernt");
    expect(resetDialog).toContain("Namen, Telefon, E-Mail und bestehende Einsatzplan-Schichten bleiben erhalten");
    expect(resetDialog).toContain("Alle Helfer der aktuell gewählten Veranstaltung werden dauerhaft gelöscht");
  });

  it("nutzt für die Einsatzplantabelle die volle Desktopbreite mit strukturiertem Helfergrid", () => {
    const layout = source("client/src/components/Layout.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(layout).toContain('location === "/helfer" || location === "/einsatzplan"');
    expect(layout).toContain('"w-full p-3 sm:p-4 xl:p-6"');
    expect(plan).toContain('<Card className="hidden w-full shadow-sm md:block">');
    expect(plan).toContain("STICKY_TABLE_CONTAINER_CLASS");
    expect(plan).toContain('data-sticky-table-header="plan"');
    expect(plan).toContain('data-slot="roster-table"');
    expect(plan).toContain(
      'className="w-full min-w-[1600px] table-auto text-sm"'
    );
    expect(plan).not.toContain('xl:overflow-x-hidden');
    expect(plan).not.toContain('<colgroup>');
    expect(plan).toContain('data-slot="roster-actions"');
    expect(plan).toContain('data-slot="roster-helper-grid"');
    expect(plan).toContain('data-slot="roster-delete-action"');
    expect(plan).toContain('canEditPlan ? "text-red-600" : "text-gray-400 opacity-50"');
    expect(plan).toContain('grid max-w-full grid-cols-2 items-start gap-1');
    expect(plan).toContain('w-full min-w-0 max-w-none min-h-11');
    expect(plan).toContain('Besetzt / Bedarf');
    expect(plan).toContain('{e.besetzt} / {s.needed}');
    expect(plan).toContain("STICKY_TABLE_HEADER_CELL_CLASS");
    expect(plan).toContain('min-w-[320px] whitespace-nowrap ${STICKY_TABLE_HEADER_CELL_CLASS}');
  });

  it("fixiert die Haupttabellen mit deckend weißen, kompakten Kopfzeilen im jeweiligen Scrollrahmen", () => {
    const sticky = source("client/src/lib/sticky-table.ts");
    const plan = source("client/src/pages/Plan.tsx");
    const preparation = source("client/src/pages/Preparation.tsx");
    const post = source("client/src/pages/PostProcessing.tsx");
    const materials = source("client/src/pages/Materials.tsx");
    const generic = source("client/src/pages/TaskGeneric.tsx");
    const donations = source("client/src/pages/Cakes.tsx");
    const finances = source("client/src/pages/Finances.tsx");

    expect(sticky).toContain("max-h-[calc(100dvh-18rem)] overflow-x-auto overflow-y-auto overscroll-contain");
    expect(sticky).toContain("sticky top-0 z-10 border-b border-gray-200 bg-white opacity-100");
    expect(sticky).toContain("font-semibold text-gray-700 shadow-sm");
    expect(sticky).toContain("[&>tr>th]:bg-white");
    expect(sticky).toContain('"px-3 py-2.5"');

    expect(plan).toContain('data-sticky-table-header="plan"');
    expect(preparation).toContain('data-sticky-table-header="preparation"');
    expect(post).toContain('data-sticky-table-header="postprocessing"');
    expect(donations).toContain('data-sticky-table-header="donations"');
    expect(finances).toContain('data-sticky-table-header="finances"');
    expect(materials).toContain('kind="materials"');
    expect(generic).toContain('const isMaterialTable = kind === "materials"');
    expect(generic).toContain('data-sticky-table-header={isMaterialTable ? "materials" : undefined}');

    for (const module of [plan, preparation, post, generic, donations, finances]) {
      expect(module).toContain("STICKY_TABLE_CONTAINER_CLASS");
      expect(module).toContain("STICKY_TABLE_HEADER_CLASS");
      expect(module).toContain("STICKY_TABLE_HEADER_CELL_CLASS");
    }
  });

  it("bietet Administratoren eine passwortgeschützte Bereinigung des Importprotokolls", () => {
    const excel = source("client/src/pages/Excel.tsx");

    expect(excel).toContain("Automatisch bereinigt: maximal 100 Einträge je Veranstaltung");
    expect(excel).toContain("Protokoll leeren");
    expect(excel).toContain("Lade- und Importprotokoll leeren?");
    expect(excel).toContain("clearLogs.mutate({ adminPassword })");
    expect(excel).toContain("utils.projectFile.restoreLogs.invalidate()");
  });

  it("bietet in der PDF-Ausgabe einen Ansprechpartnerfilter für Helferübersichten", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(pdfExport).toContain("Ansprechpartner filtern");
    expect(pdfExport).toContain("Alle Ansprechpartner (Gesamt-ZIP)");
    expect(pdfExport).toContain("helper-contact-filter");
    expect(pdfExport).toContain("PDFs für ${selectedHelperContact.name} herunterladen");
    expect(pdfExport).toContain("contactId: selectedHelperContactId");
    expect(pdfExport).toContain("whatsapp-message-template");
    expect(pdfExport).toContain("WhatsApp-Nachricht beim PDF-Teilen");
    expect(pdfExport).toContain("{PDF_LINK}");
    expect(helpers).not.toContain("bg-emerald-500 text-white hover:bg-emerald-600");
    expect(helpers).toContain("trpc.pdf.publicShare.useMutation");
    expect(helpers).toContain("Aufgabenplan per WhatsApp an Helfer senden");
    expect(helpers).toContain("result.url");
    expect(helpers).not.toContain("window.location.origin");
    expect(helpers).not.toContain("/api/public/pdf/");
    expect(helpers).toContain("buildWhatsAppShareUrl(message)");
    expect(helpers).toContain("window.location.assign(buildWhatsAppShareUrl(message))");
    expect(helpers).not.toContain("shareWindowRef");
    expect(helpers).not.toContain("copyWhatsAppMessage");
    expect(helpers).not.toContain("buildWhatsAppLaunchUrl");
    expect(helpers).not.toContain('window.open(whatsappUrl, "_blank", "noopener,noreferrer")');
    expect(helpers).not.toContain("navigator.share");
    expect(helpers).not.toContain("buildWhatsAppDeepLink(");
    expect(helpers.match(/shareHelperPdf/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("strukturiert die PDF-Ausgabe als geschlossene Accordions mit Ansprechpartner-Arbeitsmappen an zweiter Stelle", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");

    expect(pdfExport).toContain("CollapsibleTrigger");
    expect(pdfExport).toContain("const [open, setOpen] = useState(false)");
    expect(pdfExport).toContain('title="Alle Helferübersichten"');
    expect(pdfExport).toContain('title="Ansprechpartner-Übersichten"');
    expect(pdfExport).toContain('title="Einsatzplan als PDF"');
    expect(pdfExport).toContain('title="Vorlage frei konfigurieren"');
    expect(pdfExport.indexOf('title="Alle Helferübersichten"')).toBeLessThan(
      pdfExport.indexOf('title="Ansprechpartner-Übersichten"')
    );
    expect(pdfExport.indexOf('title="Ansprechpartner-Übersichten"')).toBeLessThan(
      pdfExport.indexOf('title="Einsatzplan als PDF"')
    );
    expect(pdfExport.indexOf('title="Einsatzplan als PDF"')).toBeLessThan(
      pdfExport.indexOf('title="Vorlage frei konfigurieren"')
    );
    expect(pdfExport).toContain("contactOverviewExportMode");
    expect(pdfExport).toContain("contactOverviewZip");
    expect(pdfExport).toContain("Gedruckte [ ]-Checkliste");
    expect(pdfExport).toContain("includePostProcessing");
    expect(pdfExport).toContain("includeMaterials");
  });

  it("blendet die PDF-Vorlagenkonfiguration für das Planungsteam vollständig aus", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");

    expect(pdfExport).toContain('const canManage = user?.role === "admin"');
    expect(pdfExport).toContain("{canManage && (");
    expect(pdfExport.indexOf("{canManage && (")).toBeLessThan(
      pdfExport.indexOf('title="Vorlage frei konfigurieren"')
    );
    expect(pdfExport).toContain("PDF-Grundeinstellungen können nur von Administratoren geändert werden.");
  });

  it("ordnet Einsatzplanaktionen mobil zweispaltig und ab Tablet einzeilig an", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const resetDialog = source(
      "client/src/components/PlanResetDialogButton.tsx"
    );
    const copyPlan = source("client/src/components/CopyPreviousPlanButton.tsx");
    const excelImport = source(
      "client/src/components/ModuleExcelImportButton.tsx"
    );

    expect(plan).toContain("data-plan-data-actions");
    expect(plan).toContain("grid grid-cols-2 gap-2 lg:grid-cols-3");
    expect(plan).toContain("[&>[data-slot=button]]:w-full");
    expect(plan).toContain('[&>[data-slot=button]]:whitespace-nowrap');
    expect(plan).not.toContain("min-[1280px]:w-[38rem]");
    expect(plan).toContain(
      'className="w-full border-blue-600 bg-blue-600 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500"'
    );
    expect(plan).toContain('buttonLabel="Excel Import"');
    expect(plan).toContain("<CopyPreviousPlanButton />");
    expect(plan).toContain("<PlanResetDialogButton");
    expect(plan).not.toContain("<ClearPlanAssignmentsButton");
    expect(resetDialog).toContain(
      "inline-flex items-center gap-2 whitespace-nowrap border-rose-200"
    );
    expect(resetDialog).toContain("px-3.5 py-1.5");
    expect(resetDialog).toContain("<RotateCcw");
    for (const actionButton of [copyPlan, excelImport]) {
      expect(actionButton).toContain("inline-flex items-center gap-2 whitespace-nowrap");
      expect(actionButton).toContain("px-3 py-1.5");
    }
    expect(excelImport).toContain('buttonLabel = "Excel importieren"');
    expect(excelImport).toContain("buttonLabel?: string");
    expect(excelImport).toContain("{buttonLabel}");
  });

  it("vereinheitlicht die mobilen Modulkopfbereiche bis 1024px mit Aktionsraster und Vollbreitenfeldern", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    const finances = source("client/src/pages/Finances.tsx");

    for (const module of [taskList, taskGeneric, finances]) {
      expect(module).toContain("grid w-full grid-cols-2 gap-2");
      expect(module).toContain("max-lg:[&>[data-slot=button]]:h-11");
      expect(module).toContain("max-lg:[&>[data-slot=button]]:text-base");
      expect(module).toContain("lg:[&>[data-slot=button]]:w-auto");
    }

    expect(helpers).toContain("w-full space-y-2 lg:ml-auto lg:w-[23rem]");
    expect(helpers).toContain("grid grid-cols-2 gap-2");
    expect(helpers).toContain("[&>[data-slot=button]]:h-10");
    expect(helpers).toContain("w-full bg-blue-600 px-4 text-base font-medium text-white");
    for (const module of [taskList, taskGeneric, finances]) {
      expect(module).toContain('className="col-span-2 shadow-xs lg:col-auto"');
    }

    expect(helpers).toContain("flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm");
    expect(helpers).toContain("Suchen (Name, Telefon, Hinweise) …");
    expect(taskList).toContain("flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center");
    expect(taskList).toContain('className="h-11 w-full text-base md:h-10 md:w-[220px] md:text-sm"');
    expect(taskList).toContain('className="h-11 w-full text-base md:h-10 md:w-[240px] md:text-sm"');
    expect(taskGeneric).toContain("flex w-full flex-col gap-2 lg:flex-row");
    expect(taskGeneric).toContain('className="w-full lg:w-[240px]"');
  });

  it("richtet Helfersuche, dynamischen Filterreset und Desktop-Aktionen kompakt aus", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const desktopTable = helpers.slice(
      helpers.indexOf('<Card className="hidden shadow-sm md:block">'),
      helpers.indexOf("<ConfirmDeleteDialog")
    );
    const desktopHeader = desktopTable.slice(
      desktopTable.indexOf("<thead"),
      desktopTable.indexOf("</thead>")
    );

    expect(helpers).toContain('md:max-w-[551px]');
    expect(helpers).toContain(
      "h-10 border-2 border-slate-300 bg-white pl-9 text-base shadow-sm focus:border-blue-500"
    );
    expect(helpers).toContain("const hasActiveHelperFilters =");
    expect(helpers).toContain("const resetHelperFilters = () => {");
    expect(helpers).toContain("data-helper-filter-reset");
    expect(helpers).toContain("Filter zurücksetzen");
    expect(helpers).toContain("<FilterX");
    expect(helpers).toContain('className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[190px] md:text-sm"');
    expect(helpers).toContain('className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[170px] md:text-sm"');
    expect(helpers).toContain('className="!h-10 w-full items-center border-slate-200 bg-white text-base md:w-[175px] md:text-sm"');

    expect(desktopHeader.indexOf("Name {sortAsc")).toBeLessThan(
      desktopHeader.indexOf("Aktionen")
    );
    expect(desktopHeader.indexOf("Aktionen")).toBeLessThan(
      desktopHeader.indexOf("Ansprechpartner")
    );
    expect(desktopHeader.indexOf("Ansprechpartner")).toBeLessThan(
      desktopHeader.indexOf("Telefon Helfer")
    );
    expect(desktopHeader.indexOf("Telefon Helfer")).toBeLessThan(
      desktopHeader.indexOf("Hinweis für PDF")
    );
    expect(desktopHeader.indexOf("Hinweis für PDF")).toBeLessThan(
      desktopHeader.indexOf("zusätzliche Begleitung")
    );
    expect(desktopHeader.indexOf("Bestätigt?")).toBeLessThan(
      desktopHeader.indexOf("Löschen")
    );
    expect(helpers).toContain("helperDeleteDisabled");
    expect(helpers).toContain('"text-gray-400 opacity-50"');
    expect(helpers).toContain('"text-red-600"');
    expect(helpers).toContain("colSpan={9 + activeDays.length}");
  });

  it("markiert historische Chatnachrichten als initial lautlos und erneuert fortlaufendes Typing gedrosselt", () => {
    const layout = source("client/src/components/Layout.tsx");
    const widget = source("client/src/components/LiveChatWidget.tsx");
    const logic = source("client/src/components/live-chat-logic.ts");

    expect(layout).toContain("const [chatSnapshotInitialized, setChatSnapshotInitialized] = useState(false)");
    expect(layout).toContain("setChatSnapshotInitialized(true)");
    expect(layout).toContain("snapshotInitialized={chatSnapshotInitialized}");
    expect(widget).toContain("if (!snapshotInitialized) return;");
    expect(widget).toContain("shouldRenewTypingStatus(typingLastRenewedAtRef.current, now)");
    expect(widget).toContain("Der Server bereinigt Typing nach 8 Sekunden");
    expect(logic).toContain("export const TYPING_RENEWAL_MS = 4_000");
    expect(logic).toContain("now - lastReportedAt >= TYPING_RENEWAL_MS");
  });

  it("hält eingebettete Karten hinter mobilem Menü und Chat, ohne den Vollbildmodus zu beeinträchtigen", () => {
    const layout = source("client/src/components/Layout.tsx");
    const widget = source("client/src/components/LiveChatWidget.tsx");
    const map = source("client/src/components/Map.tsx");
    const mapClient = source("client/src/components/LocationMapClient.tsx");
    const globalStyles = source("client/src/index.css");

    expect(layout).toContain('overlayClassName="z-50"');
    expect(layout).toContain('className="z-50 w-[88vw] max-w-xs');
    expect(widget).toContain("right-6 z-40 flex h-16");
    expect(widget).toContain("right-4 z-40 flex items-center");
    expect(widget).toContain('"fixed z-40 flex w-full');
    expect(map).toContain('"relative z-0 isolate h-[500px] w-full"');
    expect(mapClient).toContain(': "relative z-0 isolate"');
    expect(mapClient).toContain('overlayClassName="z-30 bg-slate-950/45"');
    expect(mapClient).toContain('className="z-[31] max-h-[70vh]');
    expect(mapClient).toContain("fixed inset-0 z-[2000]");
    expect(globalStyles).toContain(".mobile-fullscreen");
    expect(globalStyles).toContain("z-index: 999999 !important");
  });

  it("fordert vor Passwortänderungen die aktuelle Administratorbestätigung", () => {
    const security = source("client/src/pages/Security.tsx");
    const router = source("server/routers.ts");

    expect(security).toContain("Aktuelles Administratorpasswort");
    expect(security).toContain("aktuelle Eingabe ist als Sicherheitsbestätigung erforderlich");
    expect(security).toContain("disabled={!currentAdminPassword || saving}");
    expect(security).toContain("onSave({ password, currentAdminPassword })");
    expect(router).toContain("currentAdminPassword: z.string().min(1).max(200)");
    expect(router).toContain(
      "await requireAdminPassword(input.currentAdminPassword, ctx)"
    );
  });

  it("erfasst neue Helfer in einem schlanken Dialog mit Stammdaten und sicheren Standardwerten", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const contacts = source("client/src/pages/Contacts.tsx");
    const helperDialog = helpers.slice(
      helpers.indexOf("<Dialog\n        open={newHelperDialogOpen}"),
      helpers.indexOf("<ConfirmDeleteDialog")
    );

    expect(helpers).toContain("openNewHelperDialog");
    expect(helpers).toContain("newHelperDialogOpen");
    expect(helperDialog).toContain("Neuer Helfer anlegen");
    expect(helperDialog).toContain("Name des Helfers");
    expect(helperDialog).toContain("Ansprechpartner");
    expect(helperDialog).toContain("Telefon Helfer");
    expect(helperDialog).toContain("Hinweis für PDF");
    expect(helperDialog).toContain("Zusätzliche Begleitung (für Einsatzplan)");
    expect(helperDialog).toContain("Tagesverfügbarkeiten stehen zunächst");
    expect(helperDialog).not.toContain("activeDays.map");
    expect(helperDialog).not.toContain("YesNoToggle");
    expect(helpers).toContain("createNewHelper()");
    expect(helpers).toContain("Helfer anlegen");
    expect(helpers).toContain(
      "w-full bg-blue-600 px-4 text-base font-medium text-white"
    );

    expect(contacts).toContain("Neuanlage");
    expect(contacts).toContain('className="flex flex-col gap-3 sm:flex-row sm:items-end"');
    expect(contacts).toContain("Name des Ansprechpartners");
    expect(contacts).toContain("Rufnummer");
    expect(contacts).toContain("sm:min-w-[280px]");
    expect(contacts).toContain("Hinzufügen & Zugangsblatt drucken");
    expect(contacts).not.toContain("Passwort / Zugangscode (optional)");
  });

  it("bearbeitet Ansprechpartner in einem Modal statt innerhalb der Listenzeile", () => {
    const contacts = source("client/src/pages/Contacts.tsx");

    expect(contacts).toContain("const [editTarget, setEditTarget]");
    expect(contacts).toContain("open={Boolean(editTarget)}");
    expect(contacts).toContain("Ansprechpartner bearbeiten – {editTarget?.name}");
    expect(contacts).toContain('id="edit-contact-name"');
    expect(contacts).toContain('id="edit-contact-phone"');
    expect(contacts).toContain("Zugangsdaten / Einmalpasswort generieren & drucken");
    expect(contacts).toContain("setEditTarget({ id: contact.id, name: contact.name })");
    expect(contacts).not.toContain("editId === contact.id");
    expect(contacts).not.toContain("sm:grid-cols-[minmax(240px,1fr)_220px]");
  });

  it("verwendet Mint für Übernahmen und Rose für Resets", () => {
    const importButton = source("client/src/components/ModuleExcelImportButton.tsx");
    const copyButton = source("client/src/components/CopyPreviousPlanButton.tsx");
    const resetButton = source("client/src/components/ResetAreaButton.tsx");
    const clearButton = source("client/src/components/ClearPlanAssignmentsButton.tsx");

    expect(importButton).toContain("border-emerald-200 bg-emerald-50 text-emerald-700");
    expect(copyButton).toContain("border-emerald-200 bg-emerald-50 text-emerald-700");
    expect(resetButton).toContain("border-rose-200 bg-rose-50 text-rose-700");
    expect(clearButton).toContain("border-rose-200 bg-rose-50 text-rose-700");
  });

  it("schaltet Helfen und Bestätigt kompakt als klare Statuspillen", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("function YesNoToggle");
    expect(helpers).toContain('data-slot="helper-status-toggle"');
    expect(helpers).toContain('onClick={() => onChange(isYes ? "nein" : "ja")}');
    expect(helpers).toContain("h-11 min-h-11 w-[92px]");
    expect(helpers).toContain("items-center justify-center rounded-full");
    expect(helpers).not.toContain("translate-x-12 bg-emerald-500");
    expect(helpers).not.toContain("translate-x-0 bg-rose-400");
    expect(helpers).not.toContain("lg:translate-x-5");
    expect(helpers).toContain("border-emerald-200 bg-emerald-50 text-emerald-800");
    expect(helpers).toContain("border-rose-200 bg-rose-50 text-rose-800");
    expect(helpers).toContain('isYes ? "✓" : "✕"');
    expect(helpers).toContain('availability === "ja"\n                    ? "✓"\n                    : "✕"');
    expect(helpers).toContain("Helfen auf");
    expect(helpers).toContain("Bestätigung auf");
    expect(helpers.match(/<YesNoToggle/g)).toHaveLength(2);
    expect(helpers.match(/<MobileStatusSwitch/g)).toHaveLength(2);
  });

  it("erfasst Zeitfenster über ein schlankes Tages-Popover und filtert sie im Einsatzplan hart", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const statusBadge = source("client/src/components/StatusBadge.tsx");

    expect(helpers).toContain("function DayAvailabilityControl");
    expect(helpers).toContain('data-slot="day-availability-trigger"');
    expect(helpers).toContain("<PopoverTrigger asChild>");
    expect(helpers).toContain("availabilityPickerOpen");
    expect(helpers).toContain("Ja (Ganztägig)");
    expect(helpers).toContain("Ja (Zeit anpassen ...)");
    expect(helpers).toContain('? (Unklar)');
    expect(helpers).toContain('commitAvailability("nein")');
    expect(helpers).toContain("commitWindow(null, null)");
    expect(helpers).not.toContain("AVAILABILITY_PRESETS");
    expect(helpers).not.toContain("Ja (Vormittags)");
    expect(helpers).not.toContain("Ja (Nachmittags)");
    expect(helpers).not.toContain("Ja (Abends)");
    expect(helpers).not.toContain("Zeitfenster gelten nur für diesen Tag.");
    expect(helpers).not.toContain("Eigene Uhrzeit von – bis");
    expect(helpers).not.toContain('<Select value={availability}');
    expect(helpers).toContain("helperHasTimedAvailability");
    expect(helpers).toContain("<Clock3");
    expect(helpers).toContain("Zeitfenster speichern");
    expect(helpers).toContain("timedAvailabilityOnly");
    expect(helpers).toContain("Nur Helfer mit Zeitfenstern");
    expect(helpers).toContain("aria-pressed={timedAvailabilityOnly}");
    expect(helpers).toContain(
      "activeDays.some(day => helperHasTimedAvailability(helper, day))"
    );
    expect(plan).toContain("helperAvailableForShift");
    expect(plan).toContain("helperHasTimedAvailability");
    expect(plan).toContain("helperAvailabilityWindowLabel");
    expect(plan).toContain("timeRestricted");
    expect(plan).toContain("timeAvailabilityLabel");
    expect(plan).toContain("Zeitliche Verfügbarkeit:");
    expect(plan).toContain('shiftDay={shift.day}');
    expect(plan).toContain("helperHasTimedAvailability(\n                      helper,\n                      shift.day\n                    )");
    const assignedChip = plan.slice(
      plan.indexOf("function AssignedHelperChip"),
      plan.indexOf("export default function Plan")
    );
    expect(assignedChip.indexOf("👪")).toBeLessThan(
      assignedChip.indexOf("timeRestricted &&")
    );
    expect(plan).toContain("const AVAILABILITY_PILL_CLASS");
    expect(assignedChip).toContain(
      'data-slot="assigned-helper-availability-pills"'
    );
    expect(assignedChip).toContain(
      'data-slot="assigned-helper-availability-pill"'
    );
    expect(assignedChip).toContain("items-center gap-1.5");
    expect(assignedChip).toContain(
      "rounded-full border px-2 py-0.5 text-[11px] font-semibold"
    );
    expect(assignedChip).toContain("helperHasTimedAvailability(helper, day)");
    expect(assignedChip).toContain('<Clock3 className="size-3"');
    expect(assignedChip).not.toContain("{WEEKDAY_SHORT_LABELS[day]}: {availability}");
    expect(plan).toContain("const activeHelpers = (shift: DropdownShift)");
    expect(plan).toContain("const actives = activeHelpers(shift)");
    expect(plan).toContain("const timeWindowConflicts = useMemo");
    expect(plan).toContain('data-slot="shift-time-window-conflict"');
    expect(plan).toContain(
      "Die geänderte Schichtzeit passt nicht mehr zu folgenden"
    );
    expect(plan).toContain("Die Schichtzeit kann gespeichert werden.");
    expect(plan).toContain("const timeOverlapConflicts = useMemo");
    expect(plan).toContain('data-slot="shift-time-overlap-conflict"');
    expect(plan).toContain(
      "Diese Schichtzeit erzeugt folgende Doppelbelegung:"
    );
    expect(plan).toContain("Doppelbelegung aktualisiert:");
    expect(plan).toContain("timeUndercoverage={e.timeUndercoverage}");
    expect(plan).toContain("Flexible Belegung erlauben");
    expect(plan).toContain("allowFlexibleAssignment: false");
    expect(plan).toContain("const eligibleHelpersByShift = useMemo");
    expect(plan).toContain(
      "helperEligibleForShift(helper, evaluation.shift)"
    );
    expect(plan).toContain("const FlexibleTimeNote");
    expect(plan).toContain('data-slot="shift-flexible-time-note"');
    expect(plan).toContain("(flexibel)");
    expect(plan).toContain("flexibleAssignmentFilter");
    expect(plan).toContain('aria-label="Flexible Belegung filtern"');
    expect(plan).toContain("Nur flexible Belegung");
    expect(plan).toContain("e.shift.allowFlexibleAssignment");
    expect(statusBadge).toContain("timeUndercoverage = false");
    expect(statusBadge).toContain("manuallyConfirmed = false");
    expect(statusBadge).toContain(
      'timeUndercoverage && !manuallyConfirmed'
    );
    expect(statusBadge).toContain(
      "Zeitliche Unterdeckung: Mindestens ein Helfer deckt die Schichtzeit"
    );
    expect(statusBadge).toContain("OK ✓");
    expect(statusBadge).toContain("Manuell als vollständig geprüft freigegeben.");
    expect(plan).toContain('id="shift-manual-ok-confirmed"');
    expect(plan).toContain("✓ Manuell als OK bestätigen");
    expect(plan).toContain(
      "Ignoriert zeitliche Abweichungen & markiert die Schicht als vollständig geprüft."
    );
    expect(plan).toContain('id="shift-manual-double-conflict-accepted"');
    expect(plan).toContain("✓ Doppelbelegung akzeptieren");
    expect(plan).toContain(
      "Gilt nach Prüfung als genehmigt und entfernt die Warnung."
    );
    expect(statusBadge).toContain("doubleConflictAccepted = false");
    expect(statusBadge).toContain("Manuell bestätigt (Doppelbelegung akzeptiert)");
    expect(plan).toContain(
      "w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto"
    );
    expect(plan).toContain(
      "w-full min-w-0 flex-col gap-3 border-t pt-3 sm:flex-col sm:items-stretch"
    );
    expect(plan).toContain("flex w-full flex-wrap justify-end gap-2");
  });

  it("zeigt persönliche Zeitfenster in den Helfer-PDFs an", () => {
    const pdf = source("server/pdf.ts");

    expect(pdf).toContain("export function helperTimeBadgeLabel");
    expect(pdf).toContain("Zeitfenster: ${window.start}–${window.end} Uhr");
    expect(pdf).toContain("Vom Helfer mitgeteilter Verfügbarkeitszeitraum");
    expect(pdf).toContain("export function helperAvailabilityHeadingLabel");
    expect(pdf).toContain("drawCompactHelperDayHeading(doc, helper, day)");
    expect(pdf).toContain(
      "const availabilityHeading = helperAvailabilityHeadingLabel(helper, day)"
    );
    expect(pdf).not.toContain("drawHelperTimeBadge(doc, helper, day)");
  });

  it("strukturiert die Einsatzplantabelle mit fester Aktionsspalte, Zwei-Spalten-Helferraster und Filter-Reset", () => {
    const plan = source("client/src/pages/Plan.tsx");

    expect(plan).toContain('data-slot="roster-table"');
    expect(plan).toContain('data-slot="roster-actions"');
    expect(plan).toContain('data-slot="roster-helper-grid"');
    expect(plan).toContain("Besetzt / Bedarf");
    expect(plan).toContain("{e.besetzt} / {s.needed}");
    expect(plan).toContain("grid max-w-full grid-cols-2 items-start gap-1");
    expect(plan).toContain("w-full min-w-0 max-w-none min-h-11");
    expect(plan).toContain("const resetPlanFilters = () =>");
    expect(plan).toContain("setFlexibleAssignmentFilter(\"alle\")");
    expect(plan).toContain("next.delete(PLAN_WARNING_QUERY_KEY)");
    expect(plan).toContain("next.delete(PLAN_STATUS_QUERY_KEY)");
    expect(plan).toContain("next.delete(PLAN_HELPER_QUERY_KEY)");
    expect(plan).toContain("next.delete(PLAN_DAY_QUERY_KEY)");
    expect(plan).toContain("const hasActiveDropdownFilters =");
    expect(plan).toContain('day !== "alle"');
    expect(plan).toContain('warningFilter !== "alle"');
    expect(plan).toContain('flexibleAssignmentFilter !== "alle"');
    expect(plan).toContain("{hasActiveDropdownFilters && (");
    expect(plan).toContain("data-plan-filter-reset");
    expect(plan).toContain('variant="ghost"');
    expect(plan).toContain('size="sm"');
    expect(plan).toContain("<FilterX className=\"mr-1 size-3.5\" aria-hidden=\"true\" />");
    expect(plan).toContain(
      "h-11 w-full px-2 text-base text-sky-700 hover:bg-sky-100/60 hover:text-sky-900 lg:ml-1 lg:h-10 lg:w-auto lg:text-sm"
    );
    expect(plan).not.toContain("RotateCcw");
    expect(plan).toContain("Filter zurücksetzen");
    expect(plan).toContain("Alle Einsatzplanfilter zurücksetzen");
    expect(plan).toContain('value="OK_MANUELL">OK (Manuell)</SelectItem>');
    expect(plan).toContain("planStatusMatchesFilter(");
  });

  it("erfasst zusätzliche unbezahlte Begleitungen in den Helferstammdaten und kennzeichnet sie im Einsatzplan mit 👪", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(helpers).toContain("zusätzliche Begleitung (für Einsatzplan)");
    expect(helpers).toContain("zusätzliche Begleitung");
    expect(helpers).toContain("z. B. + Frau Muster, + Kind");
    expect(helpers).toContain("companion: value || null");

    expect(plan).toContain("companion?: string | null");
    expect(plan).toContain("👪");
    expect(plan).toContain("title={`zusätzliche Begleitung: ${companion}`}");
    expect(plan).toContain("zusätzliche Begleitung:");
    expect(plan.indexOf("👪")).toBeLessThan(
      plan.indexOf("<HighlightedText text={displayLabel}")
    );
    expect(plan).toContain("helper.companion?.trim() && (");
    expect(plan).toContain('<span className="truncate">{label(helper)}</span>');
  });

  it("bietet für jeden Helfer eine klickbare Spendenaktion mit dezentem Zähler", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("function CakeDonationAction");
    expect(helpers).toContain("trpc.cakes.list.useQuery()");
    expect(helpers).toContain("const cakeCountByDonor = useMemo");
    expect(helpers).toContain("personKey(cake.donor)");
    expect(helpers).toContain("Spende für diesen Helfer erfassen");
    expect(helpers).toContain("Bereits ${count} Spenden erfasst (Klick für weitere Spende)");
    expect(helpers).toContain("grayscale opacity-45");
    expect(helpers).toContain("🎁");
    expect(helpers).toContain("openCakeDonation(helper.name)");
    expect(helpers).toContain("cakeCountByDonor.get(personKey(helper.name)) ?? 0");
    expect(helpers).toContain('setLocation(`/spenden?donor=${encodeURIComponent(helperName)}`)');
  });

  it("kennzeichnet PDF, WhatsApp und Löschung in Helferaktionen eindeutig farbig", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("HELPER_ACTION_ICON_BUTTON_CLASS");
    expect(helpers).toContain("gap-3");
    expect(helpers).toContain("Persönliche Aufgaben-PDF herunterladen");
    expect(helpers).toContain('FileDown className="size-5 text-blue-600"');
    expect(helpers).toContain("Aufgabenplan per WhatsApp an Helfer senden");
    expect(helpers).toContain('MessageCircle className="size-5 text-[#25D366]"');
    expect(helpers).toContain("Helfer entfernen");
    expect(helpers).toContain('Trash2 className="size-5 text-red-600"');
  });

  it("vereinheitlicht Erstellungsaktionen und filtert Helfer nach zusätzlicher Begleitung", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const contacts = source("client/src/pages/Contacts.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const preparation = source("client/src/pages/Preparation.tsx");
    const creationAction = source("client/src/lib/creation-action.ts");
    const helperHeaderActions = helpers.slice(
      helpers.indexOf('<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">'),
      helpers.indexOf('<div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">')
    );

    expect(creationAction).toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(creationAction).toContain("border-slate-300 bg-white");
    expect(creationAction).toContain("text-base font-semibold");
    expect(contacts).toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(contacts).toContain('variant="outline"');
    expect(helpers).not.toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(plan).not.toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(plan).toContain("bg-blue-600 text-base font-medium text-white");
    expect(preparation).not.toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(preparation).toContain("bg-blue-600 text-base font-medium text-white");
    expect(helpers).toContain("grid grid-cols-2 gap-2");
    expect(helpers).toContain("w-full bg-blue-600 px-4 text-base font-medium text-white");
    expect(helperHeaderActions).not.toContain("bg-indigo-700");
    expect(contacts).not.toContain("bg-indigo-700");
    expect(helpers).toContain("companionFilter");
    expect(helpers).toContain('aria-label="Begleitung filtern"');
    expect(helpers).toContain("Alle Begleitungen");
    expect(helpers).toContain("Mit Begleitung");
    expect(helpers).toContain("Ohne Begleitung");
    expect(helpers).toContain("Boolean(helper.companion?.trim())");
    expect(helpers).toContain("!helper.companion?.trim()");
  });

  it("ordnet Helferfilter wie in der Vorbereitung in einer weißen Suchkarte an", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(helpers).toContain(
      'className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"'
    );
    expect(helpers).toContain('className="order-2 relative w-full md:order-1 md:max-w-[551px]"');
    expect(helpers).toContain('className="order-1 grid grid-cols-1 gap-2 md:order-2 md:flex md:flex-wrap"');
    expect(helpers).toContain("<Search");
    expect(helpers).toContain("Suchen (Name, Telefon, Hinweise) …");
    expect(helpers).toContain("Helfer nach Name, Telefon oder Hinweis durchsuchen");
    expect(helpers).toContain("helperScopeFilter");
    expect(helpers).toContain("willHelpFilter");
    const filterOrder = [
      "Alle Ansprechpartner",
      "Alle Begleitungen",
      "Alle Rückmeldungen",
      "Nur Helfer mit ...",
      "Helfen (Ja/Nein)",
      "Nur Helfer mit Zeitfenstern",
    ].map(label => helpers.indexOf(label));
    expect(filterOrder.every(index => index >= 0)).toBe(true);
    expect(filterOrder).toEqual([...filterOrder].sort((left, right) => left - right));
    expect(plan).toContain('className="order-2 relative w-full md:order-1 lg:max-w-xl"');
    expect(plan).toContain('className="order-1 grid gap-2 sm:grid-cols-2 md:order-2 lg:flex lg:flex-wrap"');
  });

  it("kennzeichnet Hauptseiten mit ruhigen einfarbigen Titelicons", () => {
    const pageTitle = source("client/src/components/PageTitle.tsx");
    const pages: Array<[string, string]> = [
      ["client/src/pages/Dashboard.tsx", "dashboard"],
      ["client/src/pages/Contacts.tsx", "contacts"],
      ["client/src/pages/Helpers.tsx", "helpers"],
      ["client/src/pages/Plan.tsx", "plan"],
      ["client/src/pages/Preparation.tsx", "preparation"],
      ["client/src/pages/PostProcessing.tsx", "postprocessing"],
      ["client/src/pages/Cakes.tsx", "donations"],
      ["client/src/pages/Finances.tsx", "finances"],
      ["client/src/pages/PdfExport.tsx", "pdf"],
      ["client/src/pages/Excel.tsx", "excel"],
      ["client/src/pages/Locations.tsx", "locations"],
      ["client/src/pages/Permissions.tsx", "permissions"],
      ["client/src/pages/Security.tsx", "security"],
      ["client/src/pages/Help.tsx", "help"],
    ];

    expect(pageTitle).toContain('"flex items-center gap-3 text-2xl font-bold"');
    expect(pageTitle).toContain("LayoutDashboard");
    expect(pageTitle).toContain("User,");
    expect(pageTitle).toContain("Users,");
    expect(pageTitle).toContain("text-blue-900");
    expect(pageTitle).toContain("const blueClassName");
    expect(pageTitle).not.toContain("text-orange");
    expect(pageTitle).not.toContain("UserCheck");
    expect(pageTitle).not.toContain("UserRound");
    expect(pageTitle).not.toContain("relative inline-flex");
    expect(pageTitle).toContain("FileDown");
    expect(pageTitle).toContain("text-red-600");
    expect(pageTitle).toContain("FileSpreadsheet");
    expect(pageTitle).toContain("text-emerald-600");

    for (const [path, icon] of pages) {
      const page = source(path);
      expect(page).toContain('import { PageTitle } from "@/components/PageTitle"');
      expect(page).toContain(`<PageTitle icon="${icon}"`);
    }

    const materials = source("client/src/pages/Materials.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    expect(materials).toContain('titleIcon="materials"');
    expect(taskGeneric).toContain("PageTitle, type PageTitleIconKind");
    expect(taskGeneric).toContain("<PageTitle icon={titleIcon}>{title}</PageTitle>");
  });

  it("bearbeitet Vorbereitungskarten mobil direkt und zeigt das Logbuch kompakt mit Verlauf an", () => {
    const prep = source("client/src/pages/Preparation.tsx");
    const logbook = source("shared/preparation-logbook.ts");
    const css = source("client/src/index.css");

    expect(prep).toContain("function MobilePreparationLogbookField");
    expect(prep).toContain("formatPreparationLogbookForMobileDisplay");
    expect(prep).toContain("mobile-prep-contact-${task.id}");
    expect(prep).toContain("mobile-prep-due-${task.id}");
    expect(prep).toContain('type="date"');
    expect(prep).toContain("data-mobile-prep-due");
    expect(prep).toContain("relative w-full max-w-full min-w-0 box-border");
    expect(prep).toContain("w-full max-w-full min-w-0 box-border appearance-none pr-11 [-webkit-appearance:none]");
    expect(prep).toContain("WebkitAppearance: \"none\"");
    expect(prep).toContain('<Calendar\n                            aria-hidden="true"');
    expect(css).toContain("input[data-mobile-prep-due]");
    expect(css).toContain("-webkit-appearance: none;");
    expect(css).toContain("input[data-mobile-prep-due]::-webkit-calendar-picker-indicator");
    expect(css).toContain("opacity: 0;");
    expect(prep).toContain('aria-label={`Status für ${task.task} ändern`}');
    expect(prep).toContain('aria-label={`Logbuch zu ${task.task} ergänzen`}');
    expect(prep).toContain('aria-label={`Vollständiges Logbuch zu ${task.task} anzeigen${entryCount ? ` (${entryCount} Einträge)` : ""}`}');
    expect(prep).toContain("preparationLogbookEntryCount(task.note)");
    expect(prep).toContain("Neuen Logbuch-Eintrag verfassen...");
    expect(prep).toContain("setEntry(\"\")");
    expect(prep).toContain("onCommit={logEntry => update.mutate({ id: task.id, logEntry })}");
    expect(prep).toContain("Neue Einträge werden oben im Verlauf ergänzt.");
    expect(logbook).toContain("formatPreparationLogbookForMobileDisplay");
    expect(logbook).toContain('"$1:"');
  });

  it("öffnet lange mobile Hinweise und Bemerkungen in komfortablen Mehrzeileneditoren", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(helpers).toContain("Hinweis für PDF bearbeiten");
    expect(helpers).toContain("Hinweis für ${helperName}");
    expect(helpers).toContain("mobile-helper-note-${helperId}");
    expect(helpers).toContain("Verfügbarkeit, Besonderheiten oder Bemerkungen");
    expect(helpers).toContain("rows={7}");
    expect(helpers).toContain("min-h-40 resize-y text-base");
    expect(helpers).toContain('aria-label={`Hinweis für PDF von ${helperName} mehrzeilig bearbeiten`}');

    expect(plan).toContain("function MobileShiftNote");
    expect(plan).toContain("Bemerkung bearbeiten");
    expect(plan).toContain('id="mobile-shift-note"');
    expect(plan).toContain("Treffpunkt, Material, Besonderheiten oder Hinweise");
    expect(plan).toContain("const needsDetail = normalizedNote.length > 110");
    expect(plan).toContain('aria-label={`Vollständige Bemerkung zu ${shiftLabel} anzeigen`}');
    expect(plan).toContain("openMobileNoteEditor(shift)");
    expect(plan).toContain("updateShift.mutate({\n      id: mobileNoteShift.id,\n      note: mobileNoteValue.trim() || null,");
  });

  it("erfasst Nachbereitung, Material und Kuchen über fokussierte Dialoge statt über Inline-Felder", () => {
    const taskList = source("client/src/pages/TaskList.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    const materials = source("client/src/pages/Materials.tsx");
    const cakes = source("client/src/pages/Cakes.tsx");
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(taskList).toContain("postCreateDialogOpen");
    expect(taskList).toContain("Neue Nachbereitungsaufgabe");
    expect(taskList).toContain('id="post-create-task"');
    expect(taskList).toContain("openPostCreateDialog");
    expect(taskList).toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(taskList).toContain(
      "w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto"
    );

    expect(taskGeneric).toContain("createInDialog?: boolean");
    expect(taskGeneric).toContain("createDialogOpen");
    expect(taskGeneric).toContain("createDialogTitle");
    expect(taskGeneric).toContain("createTriggerLabel");
    expect(taskGeneric).toContain("openCreateDialog");
    expect(taskGeneric).toContain("resetCreateForm");
    expect(taskGeneric).toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(taskGeneric).toContain("DialogContent");
    expect(taskGeneric).toContain("DialogFooter");
    expect(taskGeneric).toContain("<Label htmlFor={`${kind}-create-name`}>");
    expect(taskGeneric).toContain("sm:grid-cols-2");

    expect(materials).toContain("createInDialog");
    expect(materials).toContain('createDialogTitle="Neuen Artikel anlegen"');
    expect(materials).toContain('createTriggerLabel="Neuer Artikel"');
    expect(materials).toContain('label: "Stand"');
    expect(materials).toContain('{ v: "offen", l: "🔴 Offen" }');
    expect(materials).toContain('{ v: "bestellt", l: "🟡 Bestellt" }');
    expect(materials).toContain('{ v: "geliefert", l: "🟢 Geliefert" }');
    expect(materials).toContain('headerLayout="stacked"');
    expect(materials).toContain("stackedActionColumns={3}");
    expect(materials).toContain("createButtonClassName=\"border-rose-700 bg-rose-600");
    expect(materials).toContain("filterConfig={{");
    expect(materials).toContain('searchPlaceholder: "Suchen (Artikel/Kategorie/Verantwortlicher/Ort) …"');
    expect(materials).toContain('"PDF drucken"');
    expect(materials).toContain("headerActions={({ visibleRows }) =>");
    expect(materials).toContain("materialIds: visibleRows");
    expect(materials).not.toContain("Standort für Material-Packliste auswählen");
    expect(materials).not.toContain("Packliste PDF");
    expect(materials).not.toContain("sortableAndFilterable");
    expect(taskGeneric).toContain('headerLayout?: "default" | "stacked"');
    expect(taskGeneric).toContain("createButtonClassName?: string");
    expect(taskGeneric).toContain("filterConfig?: {");
    expect(taskGeneric).toContain("Alle {filterConfig.categoryLabel}");
    expect(taskGeneric).toContain("Alle Standorte");
    expect(taskGeneric).toContain("Alle Verantwortlichen");
    expect(taskGeneric).toContain("Alle {filterConfig.statusLabel ?? \"Stände\"}");
    expect(taskGeneric).toContain("Filter zurücksetzen");
    expect(taskGeneric).toContain("const resetAllFilters");
    expect(cakes).toContain("Spende erfassen");
    expect(cakes).toContain("Spende bearbeiten");
    expect(cakes).toContain("Kategorie");
    expect(cakes).toContain("🌱 Vegan");
    expect(cakes).toContain("🌾 Glutenfrei");
    expect(cakes).toContain("🥛 Laktosefrei");
    expect(cakes).toContain("🌰 Enthält Nüsse");
    expect(cakes).toContain("🥩 Fleischhaltig");
    expect(cakes).toContain("Hinweise zur Spende (optional)");
    expect(cakes).toContain("trpc.helpers.list.useQuery()");
    expect(cakes).toContain('list="donation-donor-options"');
    expect(cakes).toContain('<datalist id="donation-donor-options">');
    expect(cakes).toContain("Helfer auswählen oder einen neuen Namen frei eingeben.");
    expect(cakes).toContain("Abgabeort / Standort");
    expect(cakes).toContain("Abgabetag / Datum");
    expect(cakes).toContain("Abgabe-Uhrzeit");
    expect(cakes).toContain('type="date"');
    expect(cakes).toContain('type="time"');
    expect(cakes).toContain("trpc.pdf.donationOverview.useMutation");
    expect(cakes).toContain("Spenden-PDF wurde heruntergeladen");
    expect(cakes).toContain("downloadDonationOverviewPdf");
    expect(cakes).toContain('ModuleExcelImportButton area="KUCHEN" label="Spenden"');
    expect(cakes).toContain('<ResetAreaButton\n              area="cakes"');
    expect(cakes).toContain("alle erfassten Spenden und alle eingetragenen Sollwerte");
    expect(cakes).toContain('confirmLabel="Spenden & Sollwerte löschen"');
    expect(cakes).toContain('successMessage="Alle Spenden und Sollwerte wurden gelöscht"');
    expect(cakes).not.toContain("disabled={!hasActiveFilters}");
    expect(cakes).toContain("Suchen (Spender/Spende/Hinweise/Ort) …");
    expect(cakes).toContain("Alle Kategorien");
    expect(cakes).toContain('label: "Sonstiges"');
    expect(cakes).not.toContain('label: "Deftiges"');
    expect(cakes).toContain("Alle Eigenschaften");
    expect(cakes).toContain("Alle Abgabetage");
    expect(cakes).toContain("Alle Standorte");
    expect(cakes).toContain("von {donations.length} Spenden sichtbar");
    expect(cakes).toContain('aria-live="polite"');
    expect(cakes).toContain("resetFilters");
    expect(cakes).toContain("{hasActiveFilters && (");
    expect(cakes).toContain("data-donation-filter-reset");
    expect(cakes).toContain('aria-label="Alle Spendenfilter zurücksetzen"');
    expect(cakes).toContain('<FilterX className="mr-1 size-3.5" aria-hidden="true" />');
    expect(cakes).toContain(
      'lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]'
    );
    expect(cakes).toContain('className="h-11 w-full bg-white text-base lg:h-9 lg:text-sm"');
    expect(cakes).toContain('className="inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-full');
    expect(cakes).toContain("filteredDonations");
    expect(cakes).toContain('<th className={STICKY_TABLE_HEADER_CELL_CLASS}>Ort</th>');
    expect(cakes).not.toContain("LocationMapLink");
    expect(helpers).toContain("newHelperBringsCake");
    expect(helpers).toContain("cakeWorkflowDonorRef");
    expect(helpers).toContain('Ich unterstütze mit einer Spende');
    expect(helpers).toContain('setLocation(`/spenden?donor=${encodeURIComponent(cakeWorkflowDonor)}`)');
    expect(cakes).toContain('searchParams.get("donor")?.trim() ?? ""');
    expect(cakes).toContain('setForm({ ...EMPTY_DONATION_FORM, donor: requestedDonor })');
    expect(cakes).toContain('next.delete("donor")');
    expect(cakes).toContain("Spenden-Sollwerte");
    expect(cakes).toContain("Zielmengen für den Soll/Ist-Vergleich im Dashboard festlegen.");
    expect(cakes).toContain("updateDonationTargets.mutate");
    expect(cakes).toContain("donationTargetKuchen");
    expect(cakes).toContain("donationTargetSalat");
    expect(cakes).toContain("donationTargetSnack");
    expect(cakes).not.toContain("donationTargetSonstiges");
    expect(cakes).toContain("donationTargetCategories");
    expect(cakes).toContain('grid grid-cols-1 gap-3 sm:grid-cols-3');
    expect(cakes).toContain("donationTargetsOpen");
    expect(cakes).toContain("setDonationTargetsOpen(false)");
    expect(cakes).toContain("data-donation-targets-collapsible");
    expect(cakes).toContain("Spenden-Sollwerte festlegen");
    expect(cakes).toContain('aria-controls="donation-targets-content"');
    expect(cakes).toContain("data-[state=open]:animate-accordion-down");

    const resetButton = source("client/src/components/ResetAreaButton.tsx");
    expect(resetButton).toContain("description?: string");
    expect(resetButton).toContain("confirmLabel?: string");
    expect(resetButton).toContain("successMessage?: string");
    expect(resetButton).toContain("successMessage ??");

    const dashboard = source("client/src/pages/Dashboard.tsx");
    expect(dashboard).toContain("DonationSummaryCard");
    expect(dashboard).toContain('data-dashboard-section="Verpflegungsspenden"');
    expect(dashboard).toContain("Verpflegungsspenden");
    expect(dashboard).toContain("Spenden erfasst");
    expect(dashboard).toContain("🌱 Vegan");
    expect(dashboard).toContain("🌾 Glutenfrei");
    expect(dashboard).toContain("🥛 Laktosefrei");
    expect(dashboard).toContain("🌰 Nüsse");
    expect(dashboard).toContain("🥩 Fleischhaltig");
    expect(dashboard).toContain('category.id !== "sonstiges"');
    expect(dashboard).toContain("📦 Sonstiges:");
    expect(dashboard).toContain('className="flex min-h-20 items-center gap-2');
    expect(dashboard).toContain('space-y-1.5 px-3 pb-3 pt-0');
    expect(dashboard).toContain('className="h-full gap-2 border-blue-300');
    expect(dashboard).toContain('className="h-full gap-2 border-rose-200');
    expect(dashboard).toContain('className="h-full gap-2 border-emerald-300');
    expect(dashboard).toContain('completion >= 100');
    expect(dashboard).toContain('completion >= 80');
    expect(dashboard).toContain('bg-emerald-500');
    expect(dashboard).toContain('bg-amber-400');
    expect(dashboard).toContain('data-progress-tone={progressTone.name}');
  });

  it("bietet zentrale Orte, Ortsauswahl und Kartenlinks in Schichten und Vorbereitungen", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const prep = source("client/src/pages/Preparation.tsx");
    const locations = source("client/src/pages/Locations.tsx");
    const nav = source("client/src/lib/nav.ts");
    const mapCard = source("client/src/components/LocationMapCard.tsx");
    const mapClient = source("client/src/components/LocationMapClient.tsx");

    expect(nav).toContain('href: "/orte"');
    expect(nav).toContain('label: "Orte & Standorte"');
    expect(locations).toContain("Orte & Standorte");
    expect(locations).toContain("Breitengrad (Latitude)");
    expect(locations).toContain("Längengrad (Longitude)");

    const materials = source("client/src/pages/Materials.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    const locationMapLink = source("client/src/components/LocationMapLink.tsx");
    expect(materials).toContain("locationField");
    expect(taskGeneric).toContain("Ort / Zielstandort (optional)");
    expect(taskGeneric).toContain("<LocationMapLink");

    expect(plan).toContain("Ort / Standort");
    expect(plan).toContain("<LocationMapLink");

    expect(prep).toContain("Ort / Standort");
    expect(prep).toContain("<LocationMapLink");

    expect(locationMapLink).toContain('href={`/?location=${location.id}&scroll=map`}');
    expect(locationMapLink).toContain("<MapPin");
    expect(locationMapLink).toContain("{location.name}");
    expect(locationMapLink).toContain("Live-Standortkarte anzeigen");

    expect(mapCard).toContain("Live-Standortkarte");
    expect(mapCard).toContain('lazy(() => import("./LocationMapClient"))');
    expect(mapCard).toContain('data-map-scroll-target="true"');
    expect(mapCard).toContain('id="live-standortkarte"');
    expect(mapCard).toContain('scrollIntoView({');
    expect(mapCard).toContain('behavior: "smooth"');
    expect(mapCard).toContain("onFocusedLocationReady={scrollFocusedLocationIntoView}");
    expect(mapCard).toContain('status === "offen"');
    expect(mapCard).toContain('status === "bestellt"');
    expect(mapCard).toContain('status === "geliefert"');
    expect(mapCard).toContain('severity:');
    expect(mapCard).toContain('"GELIEFERT"');
    expect(mapCard).toContain('section: "preparation"');
    expect(mapCard).toContain('section: "shifts"');
    expect(mapCard).toContain('section: "materials"');
    expect(mapCard).not.toContain("@/components/Map");
    expect(mapClient).toContain("MapContainer");
    expect(mapClient).toContain("TileLayer");
    expect(mapClient).toContain("const LocationMarker = memo");
    expect(mapCard).toContain("const markTileLoadFailed = useCallback");
    expect(mapClient).toContain("openstreetmap.org");
    expect(mapClient).toContain("fitBounds");
    expect(mapClient).toContain("onFocusedLocationReady");
    expect(mapClient).toContain('map.once("moveend", reportFocusedLocationReady)');
    expect(mapClient).toContain("window.setTimeout(reportFocusedLocationReady, 360)");
    expect(mapClient).toContain('data-map-layer-switcher="top-right"');
    expect(mapClient).toContain("right-3 top-3");

    expect(materials).toContain("trpc.pdf.materialPacklist.useMutation");
    expect(materials).toContain('"PDF drucken"');
    expect(source("server/pdf.ts")).toContain("MATERIAL_PACKLIST_PORTRAIT_WIDTH");
    expect(source("server/pdf.ts")).toContain("width: 138");
    expect(locations).toContain("GPX-Streckenoverlays");
    expect(locations).toContain("GPX hochladen");
    expect(mapCard).toContain("trpc.gpxTracks.mapData.useQuery()");
    expect(mapClient).toContain("Polyline");
    expect(mapClient).toContain("data-gpx-layer-control=\"bottom-left\"");
    expect(mapClient).toContain("Strecken einblenden");
    expect(mapClient).toContain("Strecken werden bewusst nicht automatisch eingeblendet");
    expect(mapClient).toContain("() => new Set()");
    expect(mapClient).not.toContain("gpxTracks.map(track => track.id)");
    expect(mapClient).toContain("requestFullscreen");
    expect(mapClient).toContain("document.fullscreenEnabled");
    expect(mapClient).toContain("cssFullscreen");
    expect(mapClient).toContain("setCssFullscreen(true)");
    expect(mapClient).toContain('data-map-fullscreen-mode');
    expect(mapClient).toContain("mobile-fullscreen");
    expect(mapClient).toContain("Kartenansicht zurücksetzen");
    expect(mapClient).toContain('data-map-shell={fullscreen ? "fullscreen" : "embedded"}');
    expect(mapClient).toContain('data-map-container={fullscreen ? "fullscreen" : "embedded"}');
    expect(mapClient).toContain("h-[100vh]");
    expect(mapClient).toContain("w-[100vw]");
    expect(mapClient).toContain("useLayoutEffect");
    expect(mapClient).toContain("map.invalidateSize({ pan: false");
    expect(mapClient).toContain("desktopLocationDetails");
    expect(mapClient).toContain('data-location-desktop-panel="true"');
    expect(mapClient).toContain("max-h-[80vh]");
    expect(mapClient).toContain("overflow-y-auto overscroll-contain");
    expect(mapClient).toContain("onLocationDetailsOpen");

    const locationDetails = source("client/src/components/LocationDetailContent.tsx");
    const sheet = source("client/src/components/ui/sheet.tsx");
    expect(mapClient).toContain("useIsMobile");
    expect(mapClient).toContain("data-location-mobile-sheet=\"true\"");
    expect(mapClient).toContain("max-h-[70vh]");
    expect(mapClient).toContain("overflow-y-auto overscroll-contain");
    expect(mapClient).toContain("openLocationDetails");
    expect(mapClient).toContain("openMobileDetails");
    expect(mapClient).toContain('className: "location-map-marker"');
    expect(mapClient).toContain('data-location-mobile-sheet-close="true"');
    expect(mapClient).toContain("dismissedMobileFocusRef");
    expect(mapClient).toContain("closeMobileDetails");
    expect(mapClient).toContain("navigateMobileLocation");
    expect(mapClient).toContain('data-location-mobile-navigation="true"');
    expect(mapClient).toContain('data-location-mobile-previous="true"');
    expect(mapClient).toContain('data-location-mobile-next="true"');
    expect(mapClient).toContain("Standort {mobileLocationIndex + 1} von {mobileNavigationLocations.length}");
    expect(mapClient).toContain("const activeLocationId =");
    expect(mapClient).toContain("mobileLocationDetails?.location.id");
    expect(mapClient).toContain("desktopLocationDetails?.location.id");
    expect(mapClient).toContain("focusLocationId={activeLocationId}");
    expect(locationDetails).toContain('data-location-detail-content={mobile ? "mobile-sheet" : "desktop-panel"}');
    expect(locationDetails).toContain('data-location-detail-tabs="true"');
    expect(locationDetails).toContain('label: "Vorbereitung"');
    expect(locationDetails).toContain('label: "Schichten"');
    expect(locationDetails).toContain('label: "Material"');
    expect(locationDetails).toContain('data-location-detail-panel-close="true"');
    expect(locationDetails).toContain("Karte weiter nutzen");
    expect(sheet).toContain("overlayClassName");
    expect(sheet).toContain("showClose = true");

    const globalStyles = source("client/src/index.css");
    expect(globalStyles).toContain('[data-map-shell="fullscreen"]');
    expect(globalStyles).toContain("width: 100vw !important");
    expect(globalStyles).toContain("height: 100vh !important");
    expect(globalStyles).toContain(".mobile-fullscreen");
    expect(globalStyles).toContain("z-index: 999999 !important");
    expect(globalStyles).toContain("height: 100dvh !important");
    expect(globalStyles).toContain("border-radius: 0 !important");
    expect(globalStyles).toContain(".leaflet-popup-pane,");
    expect(globalStyles).toContain("z-index: 10000 !important");
    expect(globalStyles).toContain(".leaflet-control,");

    expect(locations).toContain("Standort-Logo / Marker-Icon hochladen (PNG/SVG/JPG)");
    expect(locations).toContain("optimizeLocationLogo(file, mimeType)");
    expect(source("client/src/lib/location-logo.ts")).toContain(
      "MAX_LOCATION_LOGO_DIMENSION = 800"
    );
    expect(locations).toContain("Marker-Vorschau aktiv");
    expect(locations).toContain("Logo entfernen");
    expect(locations).toContain('data-slot="location-logo-thumbnail"');
    expect(locations).toContain("Logo für ${location.name}");

    expect(mapCard).toContain("logoUrl");
    expect(mapClient).toContain("divIcon");
    expect(mapClient).toContain("location-logo-marker");
    expect(mapClient).toContain("--location-marker-color");
    expect(mapClient).toContain('data-location-marker-logo="true"');
    expect(mapClient).toContain("escapeHtmlAttribute");
    expect(mapClient).toContain("CircleMarker");
    expect(mapClient).toContain("markerSizeForZoom");
    const routers = source("server/routers.ts");
    const locationLogoRoute = source("server/location-logo-routes.ts");
    expect(routers).toContain("locationLogoUrl(location)");
    expect(locationLogoRoute).toContain('"/api/location-logo/:year/:eventId/:locationId"');
    expect(locationLogoRoute).toContain("Cross-Origin-Resource-Policy");
    expect(locationLogoRoute).toContain('"Cache-Control": "private, no-store"');
    expect(globalStyles).toContain(".location-logo-marker__frame");
    expect(globalStyles).toContain("border: 4px solid var(--location-marker-color, #64748b);");
  });

  it("gibt in der Helferauswahl Neu-, Tages- und Konfliktstatus klar wieder", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const feedback = source("client/src/lib/helper-assignment-feedback.ts");

    expect(plan).toContain("function HelperDropdownFeedbackBadge");
    expect(plan).toContain('data-slot="helper-dropdown-feedback"');
    expect(plan).toContain('data-feedback-kind="new"');
    expect(plan).toContain('data-feedback-kind="day-segments"');
    expect(plan).toContain('data-feedback-kind="already-assigned"');
    expect(plan).toContain('data-current-day={segment.isCurrentDay ? "true" : "false"}');
    expect(plan).toContain("bg-emerald-100");
    expect(plan).toContain("bereits belegt");
    expect(plan).toContain("font-extrabold");
    expect(plan).toContain("opacity-80");
    expect(plan).toContain('segment.isCurrentDay\n          ? segment.state === "current"');
    expect(plan).toContain('"bg-amber-100 text-amber-800"');
    expect(plan).toContain('"bg-red-100 text-red-700 line-through"');
    expect(plan).toContain('"bg-emerald-100 text-emerald-800"');
    expect(plan).toContain("Rot: nicht verfügbar");
    expect(plan).toContain("helperDropdownAssignmentFeedback({");
    expect(plan).toContain("const sortedActives = actives");
    expect(plan).toContain("helperDropdownPriority(left.assignmentFeedback)");
    expect(plan).toContain("const assignedDaysByHelper = useMemo");
    expect(plan).toContain("assignments: assignedDaysByHelper.get(helper.id) ?? []");
    expect(plan).toContain("availabilityByDay: activeDays.map(day => ({");
    expect(plan).toContain("available: helperDayAvailability(helper, day).available");
    expect(plan).toContain('segment.state === "unavailable"');
    expect(plan).toContain("line-through");
    expect(plan).toContain("bg-sky-100 text-sky-800");
    expect(plan).toContain("currentDay: shift.day");
    expect(plan).toContain("normalizeWeekday(evaluation.shift.day)");
    expect(plan).toContain("Bereits eingeteilt");
    expect(plan).toContain("assignedShift.area}: ${assignedShift.task}");
    expect(plan).toContain("time: formatTimeLabel(assignedShift)");
    expect(plan).toContain("verfügbar, noch nicht eingeteilt");
    expect(plan).toContain("für diese Schicht verfügbar");
    expect(plan).toContain("title={assignedTooltip}");
    expect(plan).toContain("cursor-help");

    expect(feedback).toContain('kind: "new"');
    expect(feedback).toContain('kind: "already-assigned"');
    expect(feedback).toContain('kind: "day-segments"');
    expect(feedback).toContain("helperDropdownPriority");
    expect(feedback).toContain("isCurrentDay: day === selectedDay");
    expect(feedback).toContain("hasTimeConflict");
    expect(feedback).toContain("WEEKDAY_SHORT_LABELS");
    expect(feedback).toContain("orderedWeekdays(activeDays)");
    expect(feedback).toContain("normalizeEventWeekday");
    expect(feedback).toContain("availabilityByDay");
    expect(feedback).toContain('? "unavailable"');
    expect(feedback).toContain("assignedDays.has(day)");
    expect(feedback).toContain("day === selectedDay");

    const storageProxy = source("server/_core/storageProxy.ts");
    expect(storageProxy).toContain('const INLINE_LOCATION_LOGO_PREFIX = "location-logos/"');
    expect(storageProxy).toContain("Standortlogos müssen in Dialogvorschau und Leaflet-divIcon");
    expect(storageProxy).toContain('"Content-Disposition": "inline"');
    expect(storageProxy).toContain("locationLogoContentType(key)");
  });
  it("erweitert das Löschprotokoll um Vor- und Nachbereitungen und deren Wiederherstellung", () => {
    const permissions = source("client/src/pages/Permissions.tsx");
    const router = source("server/routers.ts");
    expect(permissions).toContain("Nur Vorbereitungen");
    expect(permissions).toContain("Nur Nachbereitungen");
    expect(permissions).toContain("Nur Material");
    expect(permissions).toContain("prep: \"Vorbereitung\"");
    expect(permissions).toContain("post: \"Nachbereitung\"");
    expect(permissions).toContain("material: \"Material\"");
    expect(permissions).toContain("utils.prep.list.invalidate()");
    expect(permissions).toContain("utils.post.list.invalidate()");
    expect(permissions).toContain("utils.materials.list.invalidate()");
    expect(permissions).toContain("Gelöscht von:");
    expect(permissions).toContain("entry.actorName");
    expect(permissions).toContain("Historische Zusatzangabe:");
    expect(permissions).toContain("Wiederherstellen");
    expect(router).toContain("entityType: z.enum([\"helper\", \"cake\", \"prep\", \"post\", \"material\"])");

    const post = source("client/src/pages/PostProcessing.tsx");
    expect(post).toContain("ConfirmDeleteDialog");
    expect(post).toContain("title=\"Nachbereitungsaufgabe löschen?\"");

    const materials = source("client/src/pages/Materials.tsx");
    expect(materials).toContain("deletionRequiresContact");

    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    expect(taskGeneric).toContain("deletionRequiresContact = false");
  });

  it("stellt Nachbereitung spiegelgleich zur Vorbereitung mit Pastell-Rosa-Design und 3 Status bereit", () => {
    const post = source("client/src/pages/PostProcessing.tsx");
    const app = source("client/src/App.tsx");
    expect(app).toContain('path="/nachbereitung" component={PostProcessing}');
    expect(post).toContain("bg-rose-50/50");
    expect(post).toContain("border-rose-100");
    expect(post).not.toContain("Modul Nachbereitung · Pastell-Design");
    expect(post).toContain("Nachbereitungsaufgabe");
    expect(post).toContain("LocationMapLink");
    expect(post).toContain("Standort");
    expect(post).toContain("Alle Bereiche");
    expect(post).toContain("Alle Verantwortlichen");
    expect(post).toContain("Alle Status");
    expect(post).toContain("PDF drucken");
    expect(post).toContain("Filter zurücksetzen");
    expect(post).not.toContain("Filter aufheben");
    expect(post).not.toContain("Nur offene Nachbereitungen");
    expect(post).toContain("lg:min-w-[500px]");
    expect(post).toContain("lg:grid-cols-3");
    expect(post).toContain("className={`w-full ${CREATION_ACTION_BUTTON_CLASS}`}");
    expect(post).toContain("trpc.pdf.postTaskOverview.useMutation");
    expect(post).toContain("downloadBase64File");
    expect(post).toContain("Nachbereitungs-PDF wurde heruntergeladen");
    expect(post).not.toContain('window.open("", "_blank", "popup=yes")');
    expect(post).toContain("filteredRows.map(task");
    expect(post).toContain("ConfirmDeleteDialog");
    expect(post).toContain("title=\"Nachbereitungsaufgabe löschen?\"");
    expect(post).toContain('type PostStatus = "offen" | "inArbeit" | "erledigt"');
    expect(post).not.toContain('"abgelehnt"');
    expect(post).not.toContain('"beantragt"');
    expect(post).not.toContain('"genehmigt"');
  });

  it("bindet im Zugangsschutz das Verwaltungsmodul für Planungsteam-Zugänge ein", () => {
    const security = source("client/src/pages/Security.tsx");
    const manager = source("client/src/components/PlanningTeamAccessManager.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const contacts = source("client/src/pages/Contacts.tsx");
    const permissions = source("client/src/pages/Permissions.tsx");

    expect(security).toContain("<PlanningTeamAccessManager />");
    expect(security).toContain("Planungsteam-Zugänge verwalten");
    expect(security).toContain("Administratorpasswort neu vergeben");
    expect(security).toContain("Notfall-Sperrstatus Planungsteam (Global)");
    expect(security).toContain("Sicherheitsprotokoll / Logbuch");
    expect(manager).toContain("Vorhandene Zugänge &amp; Filter");
    expect(manager).toContain("Neuen Zugang anlegen");
    expect(manager).toContain('value="existing-accesses"');
    expect(manager).toContain('value="create-access"');
    expect(manager).toContain("Freigegebene Veranstaltungen");
    expect(manager).toContain("Administratorpasswort");
    expect(manager).toContain("Ansprechpartner");
    expect(manager).toContain("availableContacts");
    expect(manager).toContain("Ansprechpartner-Zugang");
    expect(manager).toContain("mustChangePassword: boolean");
    expect(manager).toContain("⏳ Initialcode offen");
    expect(manager).toContain("✓ Passwort eingerichtet");
    expect(manager).toContain("bg-amber-100 text-amber-900");
    expect(manager).toContain("bg-emerald-100 text-emerald-800");
    expect(manager).toContain("function uniqueContactChoices");
    expect(manager).toContain("normalizedContactName");
    expect(manager).toContain("contactChoices.map(contact");
    expect(manager).toContain("{contact.name}");
    expect(manager).not.toContain("{contact.name} · {contact.year} · {contact.eventName}");
    expect(manager).toContain("Freigegebene Veranstaltungen");
    expect(manager).toContain("const submitDelete");
    expect(manager).toContain("<form className=\"space-y-4\" onSubmit={submitDelete}>");
    expect(manager).toContain("!flex !flex-row !flex-nowrap !items-center !justify-end !gap-3");
    expect(manager).toContain('type="submit"');
    expect(manager).toContain("shrink-0 whitespace-nowrap");
    expect(manager).toContain("bg-red-600");
    expect(manager).toContain("hover:bg-red-700");
    expect(manager).toContain("text-white");
    expect(manager).toContain("opacity-100 visible");
    expect(manager).toContain("Zugangsdaten dauerhaft löschen");
    expect(manager).toContain("!overflow-visible");
    expect(manager).toContain("Zugangsblätter drucken (PDF)");
    expect(manager).toContain("createWithAccessSheet");
    expect(manager).toContain("resetAndPrint");
    expect(manager).toContain("Sortieren &amp; Filtern");
    expect(manager).toContain("planning-access-filter-year");
    expect(manager).toContain("planning-access-filter-event");
    expect(manager).toContain("filteredAccesses");
    expect(manager).toContain("Zugangsblätter drucken – Personenauswahl");
    expect(manager).toContain("Alle auswählen");
    expect(manager).toContain("selectedPrintAccessIds");
    expect(manager).toContain("accessSheets.mutate({ accessIds: selectedPrintAccessIds })");
    expect(manager).toContain("Passwort zurücksetzen &amp; Zugangsblatt drucken");
    expect(manager).toContain("Der reguläre Nachdruck enthält aus Sicherheitsgründen keine Zugangscodes");
    expect(manager).toContain("Der Klartextcode erscheint nur im direkt heruntergeladenen PDF");
    expect(manager).toContain("downloadBase64File(result.base64, result.mimeType, result.filename)");
    expect(manager).not.toContain("planning-access-password-confirmation");

    expect(contacts).toContain("Neuanlage");
    expect(contacts).toContain("Name des Ansprechpartners");
    expect(contacts).toContain("Hinzufügen & Zugangsblatt drucken");
    expect(contacts).toContain("createWithAccessSheet");
    expect(contacts).toContain("generateAccessSheet");
    expect(contacts).toContain("Zugangsdaten / Einmalpasswort generieren & drucken");
    expect(contacts).not.toContain("Passwort / Zugangscode (optional)");
    expect(contacts).not.toContain("Neues Passwort (optional)");

    expect(layout).toContain("Wer meldet sich als Administrator an?");
    expect(layout).toContain("Schnellauswahl Ansprechpartner");
    expect(layout).toContain("Name (alternativ)");
    expect(layout).toContain("adminIdentityDialogOpen");
    expect(layout).toContain("function AdminIdentityDialog");
    expect(layout).toContain("function uniqueAdminLoginContacts");
    expect(layout).toContain("LAST_ADMINISTRATOR_NAME_STORAGE_KEY");
    expect(layout).toContain("getLastAdministratorName()");
    expect(layout).toContain("rememberAdministratorName(selectedAdministratorName)");
    expect(layout).toContain("{contact.name}");
    expect(layout).not.toContain("{contact.name} · {contact.year} · {contact.eventName}");
    const unauthenticatedLayout = layout.slice(
      layout.indexOf("if (!isAuthenticated)"),
      layout.indexOf("if (\n    events.isLoading")
    );
    expect(unauthenticatedLayout).toContain("{adminIdentityDialog}");
    expect(layout).toContain("Angemeldet:");
    expect(manager).toContain("⏳ Initialcode offen");
    expect(manager).toContain("✓ Passwort eingerichtet");
    expect(permissions).toContain("Aktivitätsprotokoll");
  });

  it("erzwingt bei Anmeldung mit Initialpasswort ein nicht schließbares Modal zur Passwort-Neuvergabe", () => {
    const layout = source("client/src/components/Layout.tsx");
    const modal = source("client/src/components/ForcePasswordChangeModal.tsx");

    expect(layout).toContain("ForcePasswordChangeModal");
    expect(layout).toContain("initialPasswordChangeStatus");
    expect(layout).toContain("completeInitialPasswordChange");
    expect(layout).toContain("forcePasswordChangeModal");

    expect(modal).toContain("Willkommen bei MyCrewMate – Passwort ändern");
    expect(modal).toContain(
      "Du hast dich mit einem temporären Zugangs-Code angemeldet. Bitte"
    );
    expect(modal).toContain(
      "vergib jetzt dein persönliches, dauerhaftes Passwort."
    );
    expect(modal).toContain("Neues Passwort");
    expect(modal).toContain("Neues Passwort bestätigen");
    expect(modal).toContain("Neues Passwort speichern & Fortfahren");
    expect(modal).toContain("showCloseButton={false}");
    expect(modal).toContain("onEscapeKeyDown={event => event.preventDefault()}");
    expect(modal).toContain("onPointerDownOutside={event => event.preventDefault()}");
  });

  it("hält die Loginansicht je Rolle minimal und zeigt den Cooldown erst nach wiederholten Fehlern", () => {
    const layout = source("client/src/components/Layout.tsx");
    const unauthenticatedLayout = layout.slice(
      layout.indexOf("if (!isAuthenticated)"),
      layout.indexOf("if (\n    events.isLoading")
    );

    expect(unauthenticatedLayout).toContain("transition-all duration-200 ease-in-out");
    expect(unauthenticatedLayout).toContain('loginMode === "admin"');
    expect(unauthenticatedLayout).toContain("Administratorpasswort");
    expect(unauthenticatedLayout).toContain("Zugangspasswort");
    expect(unauthenticatedLayout).toContain("Als Administrator anmelden");
    expect(unauthenticatedLayout).toContain("Passwort vergessen / Recovery");
    expect(layout).toContain("loginFailureCounts");
    expect(layout).toContain("currentLoginFailureCount >= 2");
    expect(unauthenticatedLayout).toContain("showCooldownHint && !planningTeamLocked");
    expect(unauthenticatedLayout).toContain("border-amber-200 bg-amber-50");
    expect(unauthenticatedLayout).not.toContain("Hauptadministrator");
    expect(unauthenticatedLayout).not.toContain("via Manus");
  });
});
