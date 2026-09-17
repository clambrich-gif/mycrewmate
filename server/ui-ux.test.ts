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

    expect(helpers).toContain('availability === "vielleicht" ? "?"');
    expect(helpers).toContain('? (Unklar)');
    expect(helpers).not.toContain('l: "Vielleicht"');
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
    expect(dashboard).toContain("FeedbackRateCard");
    expect(dashboard).toContain('data-dashboard-section="Rückmeldequote"');
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
    const router = source("server/routers.ts");

    expect(router).toContain("isHelperWithoutFirstContact(helper, aktiveFestivaltage)");
    expect(router).toContain("helferOhneErstkontakt");
    expect(router).toContain("helferKontaktiert");
    expect(router).toContain("erstkontaktquote");
    expect(dashboard).toContain("FirstContactRateCard");
    expect(dashboard).toContain('data-dashboard-section="Erstkontakt-Quote"');
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
    expect(dashboard).toContain('data-dashboard-section="Helfer-Kennzahlen"');
    expect(dashboard).toContain('className="grid gap-4 md:grid-cols-3"');
  });

  it("visualisiert die tägliche Einsatzbereitschaft für das dreitägige Festival", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const router = source("server/routers.ts");

    expect(router).toContain("taeglicheEinsatzbereitschaft");
    expect(router).toContain('["Freitag", "Samstag", "Sonntag"] as const');
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

  it("verschiebt die Einsatzplan-Kennzahlen als kompakte Live-Statusleiste in den Einsatzplan", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const plan = source("client/src/pages/Plan.tsx");

    expect(dashboard).not.toContain('title: "Einsatzplanung"');
    expect(plan).toContain("function PlanStatusBar");
    expect(plan).toContain('data-plan-status-bar');
    expect(plan).toContain('aria-label="Status des Einsatzplans"');
    expect(plan).toContain('label: "Schichten"');
    expect(plan).toContain('label: "Offen"');
    expect(plan).toContain('label: "Knapp besetzt"');
    expect(plan).toContain('label: "Voll besetzt"');
    expect(plan).toContain('badge: "KNAPP"');
    expect(plan).toContain('badge: "OK"');
    expect(plan).toContain("const planStatusCounts = useMemo<PlanStatusCounts>");
    expect(plan).toContain('entry.status === "OFFEN"');
    expect(plan).toContain('entry.status === "KNAPP"');
    expect(plan).toContain('entry.status === "OK"');
    expect(plan).toContain("utils.plan.evaluate.invalidate()");
    expect(plan).toContain("<PlanStatusBar counts={planStatusCounts} isLoading={isLoading} />");
    expect(plan).toContain("xl:flex-row xl:flex-wrap xl:items-center xl:justify-between");
    expect(plan).toContain("xl:flex-none");
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
    expect(plan).toContain("Filter aufheben");
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
    expect(dashboard).toContain('<th className="px-1 py-2 text-center whitespace-nowrap">Helfer</th>');
    expect(dashboard).toContain('<th className="px-1 py-2 text-center whitespace-nowrap">Vorb.</th>');
    expect(dashboard).toContain('<th className="px-1 py-2 text-center whitespace-nowrap">Nachb.</th>');
    expect(dashboard).toContain('<th className="px-1 py-2 text-center whitespace-nowrap">Mat.</th>');
    expect(dashboard).toContain('<th className="px-1 py-2 text-center whitespace-nowrap">Gesamt</th>');
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
    expect(prep).toContain("Suchen (Aufgabe/Bereich/Verantwortlicher/Frist)");
    expect(prep).toContain("w-full max-w-2xl");
    expect(prep).toContain("grid grid-cols-1 gap-2 md:flex md:flex-wrap");
    expect(prep).toContain("h-11 w-full bg-white text-base md:h-10 md:w-[190px]");
    expect(prep).toContain("h-11 w-full bg-white text-base md:h-10 md:w-[220px]");
    expect(prep).toContain("h-11 w-full bg-white text-base md:h-10 md:w-[175px]");
    expect(prep).not.toContain("Aufgaben angezeigt");
    expect(prep).toContain("min-w-[230px] whitespace-nowrap");
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

  it("hält die verbleibenden Dashboardkarten auf 320-Pixel-Ansichten lesbar", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("min-w-0 flex-1");
    expect(dashboard).toContain("line-clamp-2");
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
      'grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end'
    );
    expect(plan).toContain('[&>[data-slot=button]]:w-full');
    expect(plan).toContain('sm:[&>[data-slot=button]]:w-auto');
    expect(plan).toContain(
      'className={`col-span-2 !w-full !px-4 sm:col-auto sm:!w-auto sm:!text-sm ${CREATION_ACTION_BUTTON_CLASS}`}'
    );
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

    expect(helpers).toContain("CREATION_ACTION_BUTTON_CLASS");
    for (const module of [taskList, taskGeneric, finances]) {
      expect(module).toContain('className="col-span-2 shadow-xs lg:col-auto"');
    }

    expect(helpers).toContain("flex w-full flex-col gap-2 lg:flex-row");
    expect(helpers).toContain('className="w-full lg:w-56"');
    expect(taskList).toContain("flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center");
    expect(taskList).toContain('className="h-11 w-full text-base md:h-10 md:w-[220px] md:text-sm"');
    expect(taskList).toContain('className="h-11 w-full text-base md:h-10 md:w-[240px] md:text-sm"');
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
    expect(helpers).toContain("CREATION_ACTION_BUTTON_CLASS");

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
    expect(plan).toContain("helperEligibleForShift(helper, shift)");
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
    expect(pdf).toContain("drawHelperTimeBadge(doc, helper, day)");
    expect(pdf).toContain("helperTimeBadgeLabel(helper, day) ? 99 : 72");
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

  it("vereinheitlicht Erstellungsaktionen und filtert Helfer nach zusätzlicher Begleitung", () => {
    const helpers = source("client/src/pages/Helpers.tsx");
    const contacts = source("client/src/pages/Contacts.tsx");
    const plan = source("client/src/pages/Plan.tsx");
    const preparation = source("client/src/pages/Preparation.tsx");
    const creationAction = source("client/src/lib/creation-action.ts");
    const helperHeaderActions = helpers.slice(
      helpers.indexOf('<div className="flex flex-wrap items-end justify-between gap-3">'),
      helpers.indexOf('<div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">')
    );

    expect(creationAction).toContain("CREATION_ACTION_BUTTON_CLASS");
    expect(creationAction).toContain("border-slate-300 bg-white");
    expect(creationAction).toContain("text-base font-semibold");
    for (const module of [helpers, contacts, plan, preparation]) {
      expect(module).toContain("CREATION_ACTION_BUTTON_CLASS");
      expect(module).toContain('variant="outline"');
    }
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
});
