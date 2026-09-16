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
      '{!noStatus && <th className="p-3 text-center">Status</th>}'
    );
    expect(taskGeneric).toContain(
      '<th className="p-3 text-center">{extraField.label}</th>'
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

    expect(manifest.name).toBe("RSC Helferplanung");
    expect(manifest.short_name).toBe("Helferplanung");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#1e3a5f");
    expect(manifest.background_color).toBe("#f8fafc");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/rsc-helferplanung-192.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/rsc-helferplanung-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ])
    );
    expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('/icons/rsc-helferplanung-192.png');
    expect(main).toContain('navigator.serviceWorker.register("/service-worker.js")');
    expect(serviceWorker).toContain('const STATIC_CACHE = "rsc-helferplanung-pwa-v2"');
    expect(serviceWorker).not.toContain("/api/");
    expect(layout).toContain("beforeinstallprompt");
    expect(layout).toContain("appinstalled");
    expect(layout).toContain("📱 Als App auf Handy speichern");
    expect(layout).toContain("RSC Helferplanung als App speichern");
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
    expect(layout).toContain("setUnreadNotesCount(previous => previous + newNotes.length)");

    expect(presence).toContain("Live-Notizen & Chat öffnen");
    expect(presence).not.toContain("unreadCount");
    expect(presence).not.toContain("hasImportantUnread");

    expect(widget).toContain("env(safe-area-inset-bottom)+0.75rem");
    expect(widget).toContain("env(safe-area-inset-bottom)+0.5rem");
    expect(widget).toContain("sessionStorage.getItem(storageKey)");
    expect(widget).toContain("sessionStorage.setItem(storageKey, finalName)");
    expect(widget).toContain("trpc.contacts.list.useQuery");
    expect(widget).toContain("+ Andere Person / Freie Eingabe");
    expect(widget).not.toContain("SHORT_POLL_INTERVAL_MS");
    expect(widget).not.toContain("utils.client.notes.list.query");
    expect(widget).toContain("snapshot: TeamNotesSnapshot");
    expect(widget).toContain("onRequestSnapshotRefresh: () => Promise<void>");
    expect(widget).toContain("void onRequestSnapshotRefresh()");
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

  it("zeigt und entsperrt den dauerhaften Planungsteam-Login ausschließlich im Adminbereich", () => {
    const security = source("client/src/pages/Security.tsx");
    const layout = source("client/src/components/Layout.tsx");
    const css = source("client/src/index.css");

    expect(security).toContain("Sperrstatus Planungsteam");
    expect(security).toContain("status?.planningTeamLocked");
    expect(security).toContain("trpc.auth.unlockPlanningTeamLock.useMutation");
    expect(security).toContain("Sperre für Planungsteam aufheben");
    expect(security).toContain('user?.role !== "admin"');
    expect(layout).toContain("passwordStatus.data?.planningTeamLocked");
    expect(layout).toContain("Administratoren");
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

    expect(helpers).toContain('{ v: "vielleicht", l: "?" }');
    expect(helpers).not.toContain('{ v: "vielleicht", l: "Vielleicht" }');
    expect(helpers).toContain('className="w-full table-fixed text-xs xl:text-sm"');
    expect(helpers).toContain('<col className="w-[180px]" />');
    expect(helpers).toContain('<col className="w-[230px]" />');
    expect(helpers).toContain("932 + activeDays.length * 56");
    expect(helpers).toContain("md:w-[52px] md:min-w-[52px]");
    expect(helpers).toContain('className="whitespace-nowrap p-2">Telefon Helfer');
    expect(mobileCards).not.toContain("compactOnDesktop");
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
    expect(widget).toContain("h-11 w-full bg-white text-base md:h-10 md:text-xs");
    expect(widget).toContain("h-11 bg-white text-base md:h-9 md:text-xs");
    expect(widget).toContain("inline-flex min-h-11 min-w-11 items-center");
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
      "@media (min-width: 1280px) and (hover: hover) and (pointer: fine)"
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

  it("grenzt die vier Planungsteam-Fokusbereiche in Desktop- und Mobilnavigation ab", () => {
    const layout = source("client/src/components/Layout.tsx");
    const navigation = source("client/src/lib/nav.ts");

    expect(layout).toContain("navigationItemClasses(user?.role, href, active)");
    expect(layout.match(/navigationItemClasses\(user\?\.role, href, active\)/g)).toHaveLength(2);
    expect(navigation).toContain('role !== "user"');
    expect(navigation).toContain('"/helfer"');
    expect(navigation).toContain('"/kuchen"');
    expect(navigation).toContain('"/pdf-export"');
    expect(navigation).toContain('"/hilfe"');
    expect(navigation).toContain("font-bold text-black opacity-100");
    expect(navigation).toContain("font-normal text-gray-500");
  });

  it("kennzeichnet und steuert PDF-Bilder veranstaltungsspezifisch", () => {
    const pdfExport = source("client/src/pages/PdfExport.tsx");

    expect(pdfExport).toContain("PDF-Bild für {currentEvent?.name");
    expect(pdfExport).toContain("aktuell ausgewählten Veranstaltung");
    expect(pdfExport).toContain("trpc.pdf.clearLogo.useMutation");
    expect(pdfExport).toContain("trpc.pdf.setLogoFallback.useMutation");
    expect(pdfExport).toContain("Kein Bild drucken");
    expect(pdfExport).toContain("RSC-Vereinslogo verwenden");
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
    expect(plan).toContain('className="space-y-2.5"');
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

  it("verdichtet die Bereichsansprechpartner auf bis zu fünf Desktopspalten", () => {
    const plan = source("client/src/pages/Plan.tsx");

    expect(plan).toContain('className="p-2 sm:p-2.5"');
    expect(plan).toContain("mt-1.5 gap-1.5 sm:grid-cols-2 md:grid-cols-3");
    expect(plan).toContain("rounded-md border bg-slate-50/80 p-1.5");
    expect(plan).toMatch(/<SelectTrigger\s+size="sm"\s+className=/);
    expect(plan).toContain("w-full bg-white px-2 text-xs");
    expect(plan).toContain("areaContactsExpanded");
    expect(plan).toContain('aria-controls="area-contacts-grid"');
    expect(plan).toContain('aria-expanded={areaContactsExpanded}');
    expect(plan).toContain("xl:hidden");
    expect(plan).toContain("xl:grid xl:grid-cols-4 2xl:grid-cols-5");
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

  it("deaktiviert Dashboardkarten ohne Treffer visuell und funktional", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("const isEmpty = metric.value === 0");
    expect(dashboard).toContain(
      "border-slate-200 bg-slate-100 text-slate-600"
    );
    expect(dashboard).toContain("if (!target || isEmpty) return card");
    expect(dashboard).toContain("!isEmpty && metric.target");
  });

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
    expect(dashboard).toContain("abgelehnteVorbereitung");
    expect(dashboard).toContain("Vorbereitung abgelehnt");
    expect(dashboard).toContain('status: "abgelehnt"');
  });

  it("vereinheitlicht Vorbereitung mit Dialog, Filtern und Aktionsicons des Einsatzplans", () => {
    const prep = source("client/src/pages/Preparation.tsx");
    expect(prep).toContain("Neue Vorbereitungsaufgabe");
    expect(prep).not.toContain("Optionale Felder:");
    expect(prep).toContain("Vorbereitungsaufgabe bearbeiten");
    expect(prep).toContain("Vorbereitungsaufgabe löschen");
    expect(prep).toContain("DialogContent");
    expect(prep).toContain("DialogFooter");
    expect(prep).toContain("openCreate");
    expect(prep).toContain("openEdit");
    expect(prep).toContain("Pencil");
    expect(prep).toContain("Trash2");
    expect(prep).toContain("max-h-[calc(100dvh-2rem)]");
    expect(prep).toContain("lg:hidden");
    expect(prep).toContain("h-11 w-11");
    expect(prep).toContain("Bestehenden Bereich wählen oder neu anlegen");
    expect(prep).toContain("Verantwortlicher");
    expect(prep).toContain("Frist / Abgabedatum (Freitext)");
    expect(prep).toContain("Bemerkungen / Informationen");
    expect(prep).toContain("Beantragt");
    expect(prep).toContain("Genehmigt");
    expect(prep).toContain("Abgelehnt");
    expect(prep).toContain("Suchen (Aufgabe/Bereich/Verantwortlicher/Frist)");
    expect(prep).toContain("categoryFilter");
    expect(prep).toContain("contactFilter");
    expect(prep).toContain("statusFilter");
    expect(prep).toContain("searchTerm");
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
    expect(help).toContain("Erweiterte Schulung für Administratoren");
    expect(help).toContain("Schulung für das Planungsteam: Von A bis Z");
    expect(help).toContain('src: "/api/videos/admin"');
    expect(help).toContain('src: "/api/videos/planungsteam"');
    expect(help).not.toContain(
      "manus-storage/RSC-Helferplanung-Erklaervideo"
    );
    expect(help).toContain('poster: "/api/help/images/video-administratoren"');
    expect(help).toContain('poster: "/api/help/images/video-planungsteam"');
    expect(help.match(/<video/g)).toHaveLength(1);
    expect(help).toContain("controls");
    expect(help).toContain("playsInline");
    expect(help).toContain("aspect-video w-full max-w-full");
    expect(help).toContain("PLANNING_TEAM_FLOW");
    expect(help).toContain("Dein Ablauf in 6 Schritten");
    expect(help).toContain("Persönlichen PDF-Link per WhatsApp weitergeben.");
  });

  it("bietet eine durchsuchbare, rollenmarkierte Hilfe für alle Handbuchbereiche", () => {
    const help = source("client/src/pages/Help.tsx");

    expect(help).toContain("Schnellstart und Orientierung");
    expect(help).toContain("RSC Helferplanung als App auf dem Handy speichern");
    expect(help).toContain("Progressive Web App (PWA)");
    expect(help).toContain("Zum Home-Bildschirm");
    expect(help).toContain("App installieren");
    expect(help).toContain("Rollen und Passwortschutz");
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

  it("hält lange Dashboard-Kartentitel auf 320-Pixel-Ansichten umbrechbar", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("min-w-0 break-words");
    expect(dashboard).toContain("whitespace-normal");
    expect(dashboard).toContain("flex-wrap");
  });

  it("leert im Einsatzplan ausschließlich Helferzuweisungen mit semantischem Rose-Styling", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const clearButton = source(
      "client/src/components/ClearPlanAssignmentsButton.tsx"
    );
    const resetButton = source("client/src/components/ResetAreaButton.tsx");
    const passwordDialog = source(
      "client/src/components/AdminPasswordDialog.tsx"
    );

    expect(plan.indexOf("<CopyPreviousPlanButton />")).toBeLessThan(
      plan.indexOf("<ClearPlanAssignmentsButton")
    );
    expect(plan.indexOf("<ClearPlanAssignmentsButton")).toBeLessThan(
      plan.indexOf("<ResetAreaButton")
    );
    expect(clearButton).toContain("trpc.plan.clearAssignments.useMutation");
    expect(clearButton).toContain("Die Schichten, Bereiche, Aufgaben");
    expect(clearButton).toContain("Bereichsansprechpartner bleiben vollständig erhalten");
    expect(clearButton).toContain("border-rose-200 bg-rose-50 text-rose-700");
    expect(resetButton).toContain("border-rose-200 bg-rose-50 text-rose-700");
    expect(resetButton).not.toContain('"assignments"');
    expect(plan).toContain('name="plan-search-query"');
    expect(plan).toContain('autoComplete="off"');
    expect(plan).toContain('onCleared={() => setQ("")}');
    expect(passwordDialog).toContain('name="admin-confirmation-password"');
    expect(passwordDialog).toContain('autoComplete="off"');
  });

  it("nutzt für die Einsatzplantabelle die volle Desktopbreite mit flexibler Helferchipspalte", () => {
    const layout = source("client/src/components/Layout.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(layout).toContain('location === "/helfer" || location === "/einsatzplan"');
    expect(layout).toContain('"w-full p-3 sm:p-4 xl:p-6"');
    expect(plan).toContain('<Card className="hidden w-full shadow-sm md:block">');
    expect(plan).toContain('<CardContent className="w-full overflow-x-auto p-0 xl:overflow-x-hidden">');
    expect(plan).toContain(
      '<table className="w-full table-auto text-sm md:min-w-[1080px] xl:min-w-0 xl:table-fixed xl:text-xs">'
    );
    expect(plan).not.toContain('min-w-[1500px]');
    expect(plan).not.toContain('min-w-[400px]');
    expect(plan).toContain('<col className="w-[29%]" />');
    expect(plan).toContain('<col className="w-[6%]" />');
    expect(plan).toContain('max-w-[10rem] whitespace-pre-wrap break-words');
    expect(plan).toContain('className="flex max-w-full flex-wrap gap-1 xl:gap-1"');
    expect(plan).toContain('xl:!min-w-[132px] xl:!max-w-[216px] xl:!px-2 xl:!py-0.5 xl:!text-xs');
    expect(plan).toContain('<th className="break-words p-2 leading-tight xl:p-1.5">Kontakt</th>');
    expect(plan).toContain('<th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Bedarf</th>');
    expect(plan).toContain('<th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Doppelt</th>');
    expect(plan).toContain('<th className="p-2 text-center leading-tight xl:px-0.5 xl:py-1.5 xl:whitespace-nowrap">Ausfälle</th>');
    expect(plan).toContain('<th className="break-words p-2 leading-tight xl:p-1.5">Eingeteilte Helfer</th>');
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
    expect(helpers).toContain("Persönlichen PDF-Link per WhatsApp teilen");
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

  it("ordnet Einsatzplanaktionen ausschließlich mobil als gleich breites Raster an", () => {
    const plan = source("client/src/pages/Plan.tsx");
    const resetButton = source("client/src/components/ResetAreaButton.tsx");

    expect(plan).toContain(
      'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end'
    );
    expect(plan).toContain('[&>[data-slot=button]]:w-full');
    expect(plan).toContain('sm:[&>[data-slot=button]]:w-auto');
    expect(plan).toContain('className="col-span-2 !w-full !px-4 !text-base sm:col-auto sm:!w-auto sm:!text-sm"');
    expect(plan).toContain('mobileButtonLabel="Plan zurücksetzen"');
    expect(resetButton).toContain('<span className="sm:hidden">{mobileButtonLabel}</span>');
    expect(resetButton).toContain('<span className="hidden sm:inline">');
  });

  it("vereinheitlicht die mobilen Modulkopfbereiche bis 1024px mit Aktionsraster und Vollbreitenfeldern", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const taskList = source("client/src/pages/TaskList.tsx");
    const taskGeneric = source("client/src/pages/TaskGeneric.tsx");
    const finances = source("client/src/pages/Finances.tsx");

    for (const module of [helpers, taskList, taskGeneric, finances]) {
      expect(module).toContain("grid w-full grid-cols-2 gap-2");
      expect(module).toContain("max-lg:[&>[data-slot=button]]:h-11");
      expect(module).toContain("max-lg:[&>[data-slot=button]]:text-base");
      expect(module).toContain("lg:[&>[data-slot=button]]:w-auto");
    }

    expect(helpers).toContain('className="col-span-2 shadow-xs lg:hidden"');
    for (const module of [taskList, taskGeneric, finances]) {
      expect(module).toContain('className="col-span-2 shadow-xs lg:col-auto"');
    }

    expect(helpers).toContain("flex w-full flex-col gap-2 lg:flex-row");
    expect(helpers).toContain('className="w-full lg:w-56"');
    expect(taskList).toContain("flex w-full flex-col gap-2 lg:flex-row");
    expect(taskList).toContain('className="w-full lg:w-[220px]"');
    expect(taskGeneric).toContain("flex w-full flex-col gap-2 lg:flex-row");
    expect(taskGeneric).toContain('className="w-full lg:w-[240px]"');
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

  it("fordert vor Passwortänderungen die aktuelle Administratorbestätigung", () => {
    const security = source("client/src/pages/Security.tsx");
    const router = source("server/routers.ts");

    expect(security).toContain("Aktuelles Administratorpasswort");
    expect(security).toContain("Die Eingabe ist vor jeder Passwortänderung zwingend erforderlich.");
    expect(security).toContain("disabled={!currentAdminPassword || saving}");
    expect(security).toContain("onSave({ password, currentAdminPassword })");
    expect(router).toContain("currentAdminPassword: z.string().min(1).max(200)");
    expect(router).toContain(
      "await requireAdminPassword(input.currentAdminPassword, ctx)"
    );
  });

  it("hebt Stammdateneingaben ausschließlich ab dem Desktop-Breakpoint hervor", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const contacts = source("client/src/pages/Contacts.tsx");

    expect(helpers).toContain('className="hidden border-blue-200 bg-slate-50/80 shadow-sm lg:block"');
    expect(helpers).toContain("Neuanlage – Name des Helfers");
    expect(helpers).toContain("Name des neuen Helfers eingeben");
    expect(helpers).toContain("Helfer hinzufügen");
    expect(helpers).toContain("bg-indigo-700");
    expect(helpers).toContain('className="col-span-2 w-full lg:hidden"');

    expect(contacts).toContain('className="hidden border-blue-200 bg-slate-50/80 shadow-sm lg:block"');
    expect(contacts).toContain("Neuanlage – Name des Ansprechpartners");
    expect(contacts).toContain("Neuanlage – Rufnummer");
    expect(contacts).toContain('className="grid gap-2 sm:grid-cols-[1fr_220px_auto] lg:hidden"');
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

  it("schaltet Helfen und Bestätigt kompakt mit festen Ja-Nein-Endanschlägen", () => {
    const helpers = source("client/src/pages/Helpers.tsx");

    expect(helpers).toContain("function YesNoToggle");
    expect(helpers).toContain('data-slot="helper-status-toggle"');
    expect(helpers).toContain('onClick={() => onChange(isYes ? "nein" : "ja")}');
    expect(helpers).toContain("h-11 min-h-11 w-[92px]");
    expect(helpers).toContain("translate-x-12 bg-emerald-500");
    expect(helpers).toContain("translate-x-0 bg-rose-400");
    expect(helpers).toContain("lg:translate-x-5");
    expect(helpers).toContain("border-emerald-200 bg-emerald-50 text-emerald-800");
    expect(helpers).toContain("border-rose-200 bg-rose-50 text-rose-800");
    expect(helpers).toContain("Helfen auf");
    expect(helpers).toContain("Bestätigung auf");
    expect(helpers.match(/<YesNoToggle/g)).toHaveLength(4);
  });
});
