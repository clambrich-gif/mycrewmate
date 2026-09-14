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

  it("unterbindet mobilen Formular-Auto-Zoom global und im HTML-Viewport", () => {
    const html = source("client/index.html");
    const css = source("client/src/index.css");
    const input = source("client/src/components/ui/input.tsx");
    const textarea = source("client/src/components/ui/textarea.tsx");
    const select = source("client/src/components/ui/select.tsx");

    expect(html).toContain(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"'
    );
    expect(css).toContain("@media (max-width: 1023px)");
    expect(css).toContain('[data-slot="select-trigger"]');
    expect(css).toContain("font-size: 16px !important;");
    expect(css).toContain("touch-action: manipulation;");
    expect(input).toContain("touch-manipulation");
    expect(input).toContain("text-base text-slate-950");
    expect(textarea).toContain("touch-manipulation");
    expect(textarea).toContain("text-base text-slate-950");
    expect(select).toContain("w-fit touch-manipulation items-center");
    expect(select).toContain("px-3 py-2 text-base");
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

    expect(widget).toContain("fixed bottom-4 right-4 z-50");
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
    expect(layout).toContain("Admin-Freigabe");
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
    expect(helpers).toContain("892 + activeDays.length * 56");
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
    expect(mobileCards.match(/size="icon"/g)).toHaveLength(2);
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

  it("unterbindet auf mobilen Geräten die automatische und manuelle Zoomgeste", () => {
    const html = source("client/index.html");

    expect(html).toContain(
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    );
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

  it("leert im Einsatzplan ausschließlich Helferzuweisungen und lässt Aktionsfarben unverändert", () => {
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
      plan.indexOf('<ResetAreaButton area="shifts"')
    );
    expect(clearButton).toContain("trpc.plan.clearAssignments.useMutation");
    expect(clearButton).toContain("Die Schichten, Bereiche, Aufgaben");
    expect(clearButton).toContain("Bereichsansprechpartner bleiben vollständig erhalten");
    expect(clearButton).toContain("border-destructive/40 text-destructive");
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
    expect(plan).toContain('<CardContent className="w-full overflow-x-auto p-0">');
    expect(plan).toContain(
      '<table className="w-full table-auto text-sm md:min-w-[1080px] xl:min-w-0">'
    );
    expect(plan).not.toContain('min-w-[1500px]');
    expect(plan).toContain('className="min-w-[400px] p-3"');
    expect(plan).toContain('className="min-w-[400px] p-3 align-top"');
    expect(plan).toContain('className="flex flex-wrap gap-1.5"');
  });
});
