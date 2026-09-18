import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import {
  OnlinePresenceBadge,
  useOnlinePresence,
} from "@/components/OnlinePresenceBadge";
import {
  LiveChatWidget,
  type ActiveTyperItem,
  type TeamNoteItem,
  type LiveChatWidgetState,
} from "@/components/LiveChatWidget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { startLogin } from "@/const";
import { useEventYear } from "@/contexts/YearContext";
import { NAV, navigationItemClasses } from "@/lib/nav";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type Weekday } from "@shared/weekdays";
import {
  Bike,
  Calendar,
  CalendarRange,
  Download,
  KeyRound,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings2,
  Share,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const RSC_LOGO = "/api/brand/rsc-logo";
const CHAT_SNAPSHOT_POLL_MS = 5_000;

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

type TeamNotesSnapshot = {
  notes: TeamNoteItem[];
  typing: ActiveTyperItem[];
};

const ProjectStorageControls = lazy(() =>
  import("@/components/ProjectStorageControls").then(module => ({
    default: module.ProjectStorageControls,
  }))
);

const logoLoading = {
  loading: "eager" as const,
  decoding: "sync" as const,
  fetchPriority: "high" as const,
  draggable: false,
};

function ProjectStorageFallback() {
  return (
    <div role="status" aria-label="Projektfunktionen werden geladen">
      <div className="grid grid-cols-2 gap-2" aria-hidden="true">
        <div className="h-9 animate-pulse rounded-md border bg-muted" />
        <div className="h-9 animate-pulse rounded-md border bg-muted" />
      </div>
      <div
        className="mt-1.5 h-4 w-full animate-pulse rounded bg-muted"
        aria-hidden="true"
      />
      <span className="sr-only">Projektfunktionen werden geladen …</span>
    </div>
  );
}

function LazyProjectStorageControls() {
  return (
    <Suspense fallback={<ProjectStorageFallback />}>
      <ProjectStorageControls />
    </Suspense>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const onlinePresence = useOnlinePresence();
  const { year, eventId, selectYear, selectEvent } = useEventYear();
  const [location] = useLocation();
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newYear, setNewYear] = useState(year + 1);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDays, setNewEventDays] = useState<Weekday[]>([
    "Freitag",
    "Samstag",
    "Sonntag",
  ]);
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventStartDate, setEditEventStartDate] = useState("");
  const [editEventEndDate, setEditEventEndDate] = useState("");
  const [deleteEventTarget, setDeleteEventTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<DeferredInstallPrompt | null>(null);
  const [pwaInstallDialogOpen, setPwaInstallDialogOpen] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [chatState, setChatState] = useState<LiveChatWidgetState>("closed");
  const [chatSnapshot, setChatSnapshot] = useState<TeamNotesSnapshot>({
    notes: [],
    typing: [],
  });
  const [chatSnapshotInitialized, setChatSnapshotInitialized] = useState(false);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [hasImportantUnread, setHasImportantUnread] = useState(false);
  const lastSeenChatNoteIdRef = useRef<number>(0);
  const hasLoadedChatSnapshotRef = useRef(false);
  const chatStateRef = useRef<LiveChatWidgetState>("closed");
  const chatSnapshotEpochRef = useRef(0);
  const chatSnapshotPollInFlightRef = useRef<Promise<void> | null>(null);
  const chatSnapshotPollQueuedRef = useRef(false);
  const loginLockAlertRef = useRef<HTMLDivElement>(null);
  const loginErrorRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const refreshInstallationState = () => {
      const installed = isStandalonePwa();
      setPwaInstalled(installed);
      if (installed) {
        setPwaInstallDialogOpen(false);
      }
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as DeferredInstallPrompt);
    };
    const handleInstalled = () => {
      setPwaInstalled(true);
      setDeferredInstallPrompt(null);
      setPwaInstallDialogOpen(false);
    };

    refreshInstallationState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener("change", refreshInstallationState);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener("change", refreshInstallationState);
    };
  }, []);

  const installPwa = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
    if (choice.outcome === "accepted") {
      setPwaInstalled(true);
      setPwaInstallDialogOpen(false);
    }
  }, [deferredInstallPrompt]);

  const requestPwaInstallation = useCallback(() => {
    if (deferredInstallPrompt) {
      void installPwa();
      return;
    }
    setMobileMenuOpen(false);
    window.setTimeout(() => setPwaInstallDialogOpen(true), 150);
  }, [deferredInstallPrompt, installPwa]);

  const passwordStatus = trpc.auth.passwordStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const years = trpc.years.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const events = trpc.events.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const selectedEvent = events.data?.find(item => item.id === eventId);

  useEffect(() => {
    chatSnapshotEpochRef.current += 1;
    chatSnapshotPollQueuedRef.current = true;
    setChatSnapshot({ notes: [], typing: [] });
    setChatSnapshotInitialized(false);
    lastSeenChatNoteIdRef.current = 0;
    hasLoadedChatSnapshotRef.current = false;
    setUnreadNotesCount(0);
    setHasImportantUnread(false);
  }, [year, eventId]);

  useEffect(() => {
    chatStateRef.current = chatState;
  }, [chatState]);

  // Ein einziger Layout-Owner lädt vollständige 24h-Chat-Snapshots. Parallele
  // Timer oder manuelle Refreshes werden als ein nachgelagerter Abruf gebündelt,
  // damit eine langsame Antwort keinen neueren Chatstand überschreiben kann.
  const refreshChatSnapshot = useCallback(() => {
    if (chatSnapshotPollInFlightRef.current) {
      chatSnapshotPollQueuedRef.current = true;
      return chatSnapshotPollInFlightRef.current;
    }

    const poll = async () => {
      do {
        chatSnapshotPollQueuedRef.current = false;
        const requestEpoch = chatSnapshotEpochRef.current;
        try {
          const snapshot = await utils.client.notes.list.query({ limit: 150 });
          if (requestEpoch !== chatSnapshotEpochRef.current || !snapshot) {
            // Der Scope wechselte während des Abrufs: danach exakt einmal den
            // aktuellen Scope laden, statt eine verspätete Antwort zu verwenden.
            chatSnapshotPollQueuedRef.current = true;
            continue;
          }

          const notesList = (snapshot.notes ?? []) as TeamNoteItem[];
          const typing = (snapshot.typing ?? []) as ActiveTyperItem[];
          const orderedNotes = [...notesList].sort((a, b) => a.id - b.id);
          setChatSnapshot({ notes: orderedNotes, typing });
          // Erst ein bestätigter Server-Snapshot darf als Initialhistorie gelten.
          // Die anfängliche leere React-Ansicht löst daher nie einen Warnton aus.
          setChatSnapshotInitialized(true);

          if (orderedNotes.length === 0) {
            lastSeenChatNoteIdRef.current = 0;
            hasLoadedChatSnapshotRef.current = true;
            setUnreadNotesCount(0);
            setHasImportantUnread(false);
            continue;
          }

          const newestNoteId = orderedNotes[orderedNotes.length - 1].id;
          if (!hasLoadedChatSnapshotRef.current) {
            // Beim Eintritt ist die 24h-Historie sichtbar, aber keine neue
            // Benachrichtigung. Erst spätere Server-Snapshots zählen als ungelesen.
            hasLoadedChatSnapshotRef.current = true;
            lastSeenChatNoteIdRef.current = newestNoteId;
            setUnreadNotesCount(0);
            setHasImportantUnread(false);
            continue;
          }
          if (chatStateRef.current === "open") {
            lastSeenChatNoteIdRef.current = newestNoteId;
            setUnreadNotesCount(0);
            setHasImportantUnread(false);
            continue;
          }

          const newNotes = orderedNotes.filter(
            note => note.id > lastSeenChatNoteIdRef.current
          );
          if (newNotes.length > 0) {
            lastSeenChatNoteIdRef.current = newestNoteId;
            setUnreadNotesCount(previous => previous + newNotes.length);
            setHasImportantUnread(previous =>
              previous || newNotes.some(note => Boolean(note.important))
            );
          }
        } catch {
          // Ein einzelner Pollingfehler bleibt leise und der nächste Tick lädt erneut.
        }
      } while (chatSnapshotPollQueuedRef.current);
    };

    const activePoll = poll().finally(() => {
      chatSnapshotPollInFlightRef.current = null;
    });
    chatSnapshotPollInFlightRef.current = activePoll;
    return activePoll;
  }, [utils.client.notes.list]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshChatSnapshot();
    const timer = window.setInterval(refreshChatSnapshot, CHAT_SNAPSHOT_POLL_MS);
    return () => {
      // Laufende Antworten aus der abgemeldeten bzw. alten Sitzung dürfen den
      // aktuellen State nicht mehr überschreiben.
      chatSnapshotEpochRef.current += 1;
      chatSnapshotPollQueuedRef.current = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, refreshChatSnapshot, year, eventId]);

  const openChatWidget = () => {
    chatStateRef.current = "open";
    setChatState("open");
    setUnreadNotesCount(0);
    setHasImportantUnread(false);
    void refreshChatSnapshot();
  };

  const minimizeChatWidget = () => {
    chatStateRef.current = "minimized";
    setChatState("minimized");
  };

  const closeChatWidget = () => {
    chatStateRef.current = "closed";
    setChatState("closed");
  };

  useEffect(() => {
    if (!isAuthenticated || !location.startsWith("/dashboard")) return;
    if (new URLSearchParams(window.location.search).get("chat") === "open") {
      openChatWidget();
    }
  }, [isAuthenticated, location]);

  useEffect(() => {
    if (!events.data?.length || selectedEvent) return;
    selectEvent(events.data[0].id);
  }, [events.data, selectEvent, selectedEvent]);
  const finishLogin = async () => {
    setPassword("");
    setLoginError(null);
    setRecoveryOpen(false);
    setRecoveryKey("");
    setNewAdminPassword("");
    setRecoveryError(null);
    await utils.auth.me.invalidate();
    toast.success("Anmeldung erfolgreich");
  };
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    mutationKey: ["auth", "passwordLogin"],
    onSuccess: finishLogin,
    onError: async error => {
      setLoginError(error.message);
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        await utils.auth.passwordStatus.invalidate();
      }
    },
  });
  const adminPasswordLogin = trpc.auth.adminPasswordLogin.useMutation({
    mutationKey: ["auth", "adminPasswordLogin"],
    onSuccess: finishLogin,
    onError: error => setLoginError(error.message),
  });
  const resetAdminWithKey = trpc.auth.resetAdminWithKey.useMutation({
    mutationKey: ["auth", "resetAdminWithKey"],
    onSuccess: finishLogin,
    onError: error => setRecoveryError(error.message),
  });
  const createYear = trpc.years.create.useMutation({
    onSuccess: async () => {
      await utils.years.list.invalidate();
      setYearDialogOpen(false);
      selectYear(newYear);
    },
    onError: error => toast.error(error.message),
  });
  const createEvent = trpc.events.create.useMutation({
    onSuccess: async result => {
      await utils.events.list.invalidate();
      setEventDialogOpen(false);
      setNewEventName("");
      setNewEventDays(["Freitag", "Samstag", "Sonntag"]);
      selectEvent(result.id);
    },
    onError: error => toast.error(error.message),
  });
  const updateEvent = trpc.events.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.events.list.invalidate(),
        utils.events.current.invalidate(),
        utils.events.all.invalidate(),
      ]);
      setEditEventId(null);
      setEditEventName("");
      setEditEventStartDate("");
      setEditEventEndDate("");
      toast.success("Veranstaltung gespeichert");
    },
    onError: error => toast.error(error.message),
  });
  const removeEvent = trpc.events.remove.useMutation({
    onSuccess: async result => {
      setDeleteEventTarget(null);
      toast.success(`„${result.deletedName}“ wurde gelöscht`);
      if (result.deletedId === eventId) {
        selectEvent(result.nextEventId);
        return;
      }
      await Promise.all([
        utils.events.list.invalidate(),
        utils.events.all.invalidate(),
      ]);
      setEventManagerOpen(true);
    },
    onError: error => toast.error(error.message),
  });

  const openEventManager = () => {
    setMobileMenuOpen(false);
    setEditEventId(null);
    setEditEventName("");
    setEditEventStartDate("");
    setEditEventEndDate("");
    setEventManagerOpen(true);
  };

  const openEventDateSettings = (targetEventId?: number) => {
    const target =
      (targetEventId
        ? events.data?.find(item => item.id === targetEventId)
        : selectedEvent) ?? events.data?.[0];
    if (!target) return;
    setMobileMenuOpen(false);
    setEditEventId(target.id);
    setEditEventName(target.name);
    setEditEventStartDate(target.startDate ?? "");
    setEditEventEndDate(target.endDate ?? "");
    setEventManagerOpen(true);
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    if (loginMode === "admin") adminPasswordLogin.mutate({ password });
    else passwordLogin.mutate({ password });
  };
  const loginEnabled =
    loginMode === "admin"
      ? passwordStatus.data?.adminEnabled
      : passwordStatus.data?.enabled;
  const planningTeamLocked = Boolean(
    loginMode === "user" && passwordStatus.data?.planningTeamLocked
  );
  const loginAvailable = Boolean(loginEnabled && !planningTeamLocked);
  const loginPending =
    passwordLogin.isPending ||
    adminPasswordLogin.isPending ||
    resetAdminWithKey.isPending;

  useEffect(() => {
    if (!planningTeamLocked) return;
    loginLockAlertRef.current?.focus({ preventScroll: true });
  }, [planningTeamLocked]);

  useEffect(() => {
    if (!loginError) return;
    loginErrorRef.current?.focus({ preventScroll: true });
  }, [loginError]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Lade …
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.97_0.02_250)] to-[oklch(0.92_0.04_240)] p-4">
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl p-8 w-full max-w-md">
          <img
            {...logoLoading}
            src={RSC_LOGO}
            alt="RSC Eifelland e. V."
            className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white object-contain shadow-sm"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">RSC Helferplanung</h1>
            <p className="text-muted-foreground mb-6">
              Geschützte Helfer-Planung für Organisatoren
            </p>
          </div>

          <div
            className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-gray-300 bg-gray-100 p-1"
            role="group"
            aria-label="Anmelderolle auswählen"
          >
            <button
              type="button"
              aria-pressed={loginMode === "user"}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-sm transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                loginMode === "user"
                  ? "bg-white font-semibold text-blue-600 shadow-sm"
                  : "cursor-pointer text-gray-500 hover:text-gray-900"
              )}
              onClick={() => {
                setLoginMode("user");
                setPassword("");
                setLoginError(null);
                setRecoveryOpen(false);
              }}
            >
              Planungsteam
            </button>
            <button
              type="button"
              aria-pressed={loginMode === "admin"}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-sm transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                loginMode === "admin"
                  ? "bg-white font-semibold text-blue-600 shadow-sm"
                  : "cursor-pointer text-gray-500 hover:text-gray-900"
              )}
              onClick={() => {
                setLoginMode("admin");
                setPassword("");
                setLoginError(null);
              }}
            >
              Administrator
            </button>
          </div>

          {loginMode === "admin" && recoveryOpen ? (
            <form
              className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4"
              onSubmit={event => {
                event.preventDefault();
                setRecoveryError(null);
                if (!recoveryKey.trim() || !newAdminPassword) return;
                resetAdminWithKey.mutate({
                  recoveryKey: recoveryKey.trim(),
                  newPassword: newAdminPassword,
                });
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Notfall-Wiederherstellung
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded px-2 text-xs text-muted-foreground underline hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => {
                    setRecoveryOpen(false);
                    setRecoveryError(null);
                  }}
                >
                  Zurück zur Anmeldung
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Geben Sie den Master Recovery Key aus der Server-Konfiguration
                ein, um ein neues Administratorpasswort zu vergeben.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="master-recovery-key" className="text-xs font-medium">
                  Master Recovery Key
                </Label>
                <Input
                  id="master-recovery-key"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="z. B. 16-stelliger Schlüssel"
                  value={recoveryKey}
                  onChange={e => {
                    setRecoveryKey(e.target.value);
                    if (recoveryError) setRecoveryError(null);
                  }}
                  disabled={resetAdminWithKey.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-admin-password" className="text-xs font-medium">
                  Neues Administratorpasswort
                </Label>
                <Input
                  id="new-admin-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mindestens 10 Zeichen"
                  value={newAdminPassword}
                  onChange={e => {
                    setNewAdminPassword(e.target.value);
                    if (recoveryError) setRecoveryError(null);
                  }}
                  disabled={resetAdminWithKey.isPending}
                />
              </div>
              {recoveryError && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 shadow-sm"
                  role="alert"
                >
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" />
                  <span>{recoveryError}</span>
                </div>
              )}
              <Button
                className="w-full mt-2"
                size="default"
                type="submit"
                disabled={
                  !recoveryKey.trim() ||
                  newAdminPassword.length < 10 ||
                  resetAdminWithKey.isPending
                }
              >
                {resetAdminWithKey.isPending
                  ? "Wiederherstellung läuft …"
                  : "Passwort neu setzen & anmelden"}
              </Button>
            </form>
          ) : (
          <form className="space-y-3" onSubmit={submitPassword}>
            <Label htmlFor="planning-password">
              {loginMode === "admin"
                ? "Administratorpasswort"
                : "Zugangspasswort"}
            </Label>
            <Input
              id="planning-password"
              type="password"
              autoComplete="current-password"
              placeholder="Passwort eingeben"
              value={password}
              onChange={event => {
                setPassword(event.target.value);
                if (loginError) setLoginError(null);
              }}
              disabled={!loginAvailable || loginPending}
              aria-describedby={
                [
                  planningTeamLocked ? "planning-team-lock-message" : "",
                  loginError ? "password-login-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={!password || !loginAvailable || loginPending}
              aria-describedby={
                [
                  planningTeamLocked ? "planning-team-lock-message" : "",
                  loginError ? "password-login-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            >
              {loginMode === "admin" ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {loginPending
                ? "Wird geprüft …"
                : loginMode === "admin"
                  ? "Als Administrator anmelden"
                  : "Mit Passwort anmelden"}
            </Button>
            {loginMode === "admin" && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded px-2 text-xs text-muted-foreground underline hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => {
                    setRecoveryOpen(true);
                    setLoginError(null);
                    setRecoveryError(null);
                  }}
                >
                  Passwort vergessen / Recovery
                </button>
              </div>
            )}
            {passwordStatus.data && !loginEnabled && (
              <p className="text-xs text-destructive">
                Dieser Passwortzugang ist noch nicht eingerichtet.
              </p>
            )}
            {loginError && (
              <div
                ref={loginErrorRef}
                id="password-login-error"
                className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 shadow-sm"
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
              >
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                  aria-hidden="true"
                />
                <span>{loginError}</span>
              </div>
            )}
            {planningTeamLocked && (
              <div
                ref={loginLockAlertRef}
                id="planning-team-lock-message"
                className="login-lock-alert flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900 shadow-sm"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                tabIndex={-1}
              >
                <TriangleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-bold">
                    Zugang für das Planungsteam gesperrt
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-red-800">
                    Bitte kontaktieren Sie einen Administrator. Nur ein
                    Administrator kann die Sperre im Bereich „Zugangsschutz“
                    wieder aufheben.
                  </p>
                </div>
              </div>
            )}
          </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            Hauptadministrator
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => startLogin()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Mit Manus anmelden
          </Button>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Nach fünf Fehlversuchen greift für den jeweiligen Anschluss eine
                zeitbasierte Abklingzeit (Cooldown). Eine dauerhafte Sperre kann
                nur gezielt durch Administratoren verhängt werden.
              </p>
            </div>
          </div>
    );
  }
  if (
    events.isLoading ||
    (events.data !== undefined && events.data.length > 0 && !selectedEvent)
  ) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Veranstaltung wird geladen …
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-white px-3 text-slate-950 shadow-sm lg:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label="Navigation öffnen"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">RSC Helferplanung</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {selectedEvent?.name ?? `Veranstaltung ${year}`}
            </div>
          </div>
          <img
            {...logoLoading}
            src={RSC_LOGO}
            alt="RSC Eifelland"
            className="h-11 w-11 shrink-0 rounded-full border-2 border-white bg-white object-contain shadow-md ring-1 ring-slate-300"
          />
        </div>
        <Select
          value={String(year)}
          onValueChange={value => selectYear(Number(value))}
        >
          <SelectTrigger className="h-11 w-24 bg-white font-semibold text-slate-950">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(years.data?.length
              ? years.data
              : [{ year, label: `MyEifelRide ${year}` }]
            ).map(item => (
              <SelectItem key={item.year} value={String(item.year)}>
                {item.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[88vw] max-w-xs gap-0 bg-white p-0 text-slate-950"
        >
          <SheetHeader className="border-b text-left">
            <SheetTitle className="flex items-center gap-2">
              <span>RSC Helferplanung</span>
              <img
                {...logoLoading}
                src={RSC_LOGO}
                alt="RSC Eifelland"
                className="h-12 w-12 rounded-full border-2 border-white bg-white object-contain shadow-md ring-1 ring-slate-300"
              />
            </SheetTitle>
            <SheetDescription>
              Planung {year} ·{" "}
              {user?.role === "admin" ? "Administrator" : "Planungsteam"}
            </SheetDescription>
            <OnlinePresenceBadge
              counts={onlinePresence.counts}
              onOpenChat={openChatWidget}
              className="mt-1 w-fit"
            />
          </SheetHeader>
          <div className="border-b p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
              </Label>
              {user?.role === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Weiteres Jahr anlegen"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setYearDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={String(year)}
              onValueChange={value => {
                selectYear(Number(value));
                setMobileMenuOpen(false);
              }}
            >
              <SelectTrigger className="w-full bg-white font-semibold text-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(years.data?.length
                  ? years.data
                  : [{ year, label: `MyEifelRide ${year}` }]
                ).map(item => (
                  <SelectItem key={item.year} value={String(item.year)}>
                    {item.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mb-1.5 mt-3 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Veranstaltung
              </Label>
              {user?.role === "admin" && (
                <span className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Veranstaltungen verwalten"
                    aria-label="Veranstaltungen verwalten"
                    onClick={openEventManager}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Veranstaltung anlegen"
                    aria-label="Veranstaltung anlegen"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setEventDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </div>
            <Select
              value={
                events.data?.some(item => item.id === eventId)
                  ? String(eventId)
                  : undefined
              }
              onValueChange={value => {
                selectEvent(Number(value));
                setMobileMenuOpen(false);
              }}
            >
              <SelectTrigger className="w-full bg-white font-semibold text-slate-950">
                <SelectValue placeholder="Veranstaltung wählen" />
              </SelectTrigger>
              <SelectContent>
                {events.data?.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3 border-t pt-3">
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Projektstand
              </Label>
              <LazyProjectStorageControls />
            </div>
            {!pwaInstalled && (
              deferredInstallPrompt ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 min-h-11 w-full justify-start border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                  onClick={() => void installPwa()}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>📱 Als App auf Handy speichern</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 min-h-11 w-full justify-start border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPwaInstallDialogOpen(true);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>📱 Als App auf Handy speichern</span>
                </Button>
              )
            )}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {NAV.filter(item => !item.adminOnly || user?.role === "admin").map(
              ({ href, label, icon: Icon }) => {
                const active = location === href;
                return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  onFocus={() => preloadRoute(href)}
                  onMouseEnter={() => preloadRoute(href)}
                  onTouchStart={() => preloadRoute(href)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    navigationItemClasses(user?.role, href, active)
                  )}
                >
                  <Icon className="h-5 w-5" /> {label}
                </Link>
                );
              }
            )}
          </nav>
          <div className="border-t p-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Abmelden
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start">
        <div className="flex min-h-24 items-center gap-3 border-b bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-slate-950">
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-tight">RSC Helferplanung</div>
            <div className="truncate text-xs text-muted-foreground">
              Vereinsorganisation
            </div>
            <OnlinePresenceBadge
              counts={onlinePresence.counts}
              onOpenChat={openChatWidget}
              className="mt-1.5 max-w-full"
            />
          </div>
          <img
            {...logoLoading}
            src={RSC_LOGO}
            alt="RSC Eifelland e. V."
            className="h-14 w-14 shrink-0 rounded-full border-2 border-white bg-white object-contain shadow-md ring-1 ring-slate-300"
          />
        </div>

        <div className="border-b p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
            </Label>
            {user?.role === "admin" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Weiteres Jahr anlegen"
                onClick={() => setYearDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={String(year)}
            onValueChange={value => selectYear(Number(value))}
          >
            <SelectTrigger className="w-full bg-background font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(years.data?.length
                ? years.data
                : [{ year, label: `MyEifelRide ${year}` }]
              ).map(item => (
                <SelectItem key={item.year} value={String(item.year)}>
                  {item.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mb-1.5 mt-3 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Veranstaltung
            </Label>
            {user?.role === "admin" && (
              <span className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Veranstaltungsdaten & Zeitraum bearbeiten"
                  aria-label="Veranstaltungsdaten & Zeitraum bearbeiten"
                  data-slot="event-dates-trigger"
                  onClick={() => openEventDateSettings(eventId)}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Veranstaltungen verwalten"
                  aria-label="Veranstaltungen verwalten"
                  onClick={openEventManager}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Veranstaltung anlegen"
                  aria-label="Veranstaltung anlegen"
                  onClick={() => setEventDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </span>
            )}
          </div>
          <Select
            value={
              events.data?.some(item => item.id === eventId)
                ? String(eventId)
                : undefined
            }
            onValueChange={value => selectEvent(Number(value))}
          >
            <SelectTrigger className="w-full bg-background font-semibold">
              <SelectValue placeholder="Veranstaltung wählen" />
            </SelectTrigger>
            <SelectContent>
              {events.data?.map(item => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 border-t pt-3">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Projektstand
            </Label>
            <LazyProjectStorageControls />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.filter(item => !item.adminOnly || user?.role === "admin").map(
            ({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onFocus={() => preloadRoute(href)}
                  onMouseEnter={() => preloadRoute(href)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    navigationItemClasses(user?.role, href, active)
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            }
          )}
        </nav>
        <div className="border-t p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground">
              {user?.role === "admin" ? "Administrator" : "Planungsteam"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Abmelden"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div
          className={
            location === "/helfer" || location === "/einsatzplan"
              ? "w-full p-3 sm:p-4 xl:p-6"
              : "w-full max-w-[1400px] p-3 sm:p-4 lg:p-6"
          }
        >
          <div className="mb-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {selectedEvent?.name ?? "Veranstaltung"} · Planung {year}
          </div>
          {children}
        </div>
      </main>

      <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weiteres Veranstaltungsjahr anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-event-year">Jahr</Label>
            <Input
              id="new-event-year"
              type="number"
              min={2020}
              max={2100}
              value={newYear}
              onChange={event => setNewYear(Number(event.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Das neue Jahr startet leer. Den Einsatzplan können Sie
              anschließend aus einem Vorjahr übernehmen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                !Number.isInteger(newYear) || newYear < 2020 || newYear > 2100
              }
              onClick={() => createYear.mutate({ year: newYear })}
            >
              Jahr anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventDialogOpen}
        onOpenChange={open => {
          setEventDialogOpen(open);
          if (!open) {
            setNewEventName("");
            setNewEventDays(["Freitag", "Samstag", "Sonntag"]);
          }
        }}
      >
        <DialogContent className="bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Veranstaltung für {year} anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-event-name">Name der Veranstaltung</Label>
              <Input
                id="new-event-name"
                value={newEventName}
                placeholder="z. B. Cross-Veranstaltung"
                onChange={event => setNewEventName(event.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Aktive Veranstaltungstage
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WEEKDAYS.map(day => {
                  const checked = newEventDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-950"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={value =>
                          setNewEventDays(current =>
                            value
                              ? WEEKDAYS.filter(item =>
                                  new Set([...current, day]).has(item)
                                )
                              : current.filter(item => item !== day)
                          )
                        }
                      />
                      {day}
                    </label>
                  );
                })}
              </div>
              {newEventDays.length === 0 && (
                <p className="text-sm font-medium text-red-700">
                  Bitte mindestens einen Veranstaltungstag auswählen.
                </p>
              )}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Die neue Veranstaltung erhält im Jahr {year} einen vollständig
              eigenen Datenbestand. Helferverfügbarkeiten und Einsatzplan
              verwenden nur die ausgewählten Tage.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                newEventName.trim().length < 2 ||
                newEventDays.length === 0 ||
                createEvent.isPending
              }
              onClick={() =>
                createEvent.mutate({
                  name: newEventName,
                  activeDays: newEventDays,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Veranstaltung anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventManagerOpen} onOpenChange={setEventManagerOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Veranstaltungen {year} verwalten</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Namen können jederzeit geändert werden. Beim Löschen werden alle
            Planungsdaten dieser Veranstaltung dauerhaft entfernt.
          </p>
          <div className="divide-y rounded-lg border">
            {events.data?.map(item => (
              <div
                key={item.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
              >
                {editEventId === item.id ? (
                  <div className="w-full space-y-3 sm:max-w-md">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name der Veranstaltung</Label>
                      <Input
                        autoFocus
                        value={editEventName}
                        onChange={event => setEditEventName(event.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`edit-start-date-${item.id}`} className="text-xs text-muted-foreground">
                          Startdatum
                        </Label>
                        <Input
                          id={`edit-start-date-${item.id}`}
                          type="date"
                          value={editEventStartDate}
                          onChange={event => setEditEventStartDate(event.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-end-date-${item.id}`} className="text-xs text-muted-foreground">
                          Enddatum
                        </Label>
                        <Input
                          id={`edit-end-date-${item.id}`}
                          type="date"
                          value={editEventEndDate}
                          onChange={event => setEditEventEndDate(event.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    {editEventStartDate && editEventEndDate && editEventStartDate > editEventEndDate && (
                      <p className="text-xs text-destructive">
                        Das Enddatum darf nicht vor dem Startdatum liegen.
                      </p>
                    )}
                    {Boolean(editEventStartDate) !== Boolean(editEventEndDate) && (
                      <p className="text-xs text-muted-foreground">
                        Bitte Start- und Enddatum gemeinsam eintragen oder beide leeren.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.startDate && item.endDate
                        ? `Zeitraum: ${item.startDate} bis ${item.endDate}`
                        : "Kein Datum hinterlegt"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.activeDays.join(", ")}
                    </div>
                    {item.id === eventId && (
                      <div className="text-xs text-primary">
                        Aktuell ausgewählt
                      </div>
                    )}
                  </div>
                )}
                <div className="flex w-full shrink-0 flex-col justify-end gap-2 sm:w-auto sm:flex-row">
                  {editEventId === item.id ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={updateEvent.isPending}
                        onClick={() => setEditEventId(null)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={
                          editEventName.trim().length < 2 ||
                          Boolean(editEventStartDate) !== Boolean(editEventEndDate) ||
                          (Boolean(editEventStartDate) &&
                            Boolean(editEventEndDate) &&
                            editEventStartDate > editEventEndDate) ||
                          updateEvent.isPending
                        }
                        onClick={() =>
                          updateEvent.mutate({
                            id: item.id,
                            name: editEventName,
                            startDate: editEventStartDate || null,
                            endDate: editEventEndDate || null,
                          })
                        }
                      >
                        Speichern
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditEventId(item.id);
                          setEditEventName(item.name);
                          setEditEventStartDate(item.startDate ?? "");
                          setEditEventEndDate(item.endDate ?? "");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full border border-red-700 !bg-red-600 !text-white shadow-sm hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-100 disabled:!text-red-800 disabled:opacity-100 sm:w-auto"
                        disabled={(events.data?.length ?? 0) <= 1}
                        title={
                          (events.data?.length ?? 0) <= 1
                            ? "Die letzte Veranstaltung des Jahres kann nicht gelöscht werden"
                            : "Veranstaltung löschen"
                        }
                        onClick={() => {
                          setEventManagerOpen(false);
                          setDeleteEventTarget({
                            id: item.id,
                            name: item.name,
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Löschen
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(events.data?.length ?? 0) <= 1 && (
            <p className="text-xs text-muted-foreground">
              Für jedes Veranstaltungsjahr muss mindestens eine Veranstaltung
              erhalten bleiben.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEventManagerOpen(false)}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={Boolean(deleteEventTarget)}
        onOpenChange={open => {
          if (!open) {
            setDeleteEventTarget(null);
            setEventManagerOpen(true);
          }
        }}
        title="Veranstaltung endgültig löschen?"
        description={`„${deleteEventTarget?.name ?? ""}“, sämtliche zugehörigen Planungsdaten und Löschprotokolle werden dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`}
        confirmLabel="Veranstaltung endgültig löschen"
        busy={removeEvent.isPending}
        onConfirm={adminPassword =>
          deleteEventTarget &&
          removeEvent.mutate({
            id: deleteEventTarget.id,
            adminPassword,
          })
        }
      />

      <Dialog open={pwaInstallDialogOpen} onOpenChange={setPwaInstallDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-700" aria-hidden="true" />
              RSC Helferplanung als App speichern
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-slate-600">
            Speichern Sie die Helferplanung auf dem Startbildschirm. Danach öffnet
            sie sich wie eine eigene App ohne Browserleiste.
          </p>
          <Tabs defaultValue={deferredInstallPrompt ? "android" : "ios"}>
            <TabsList className="grid h-11 w-full grid-cols-2 bg-slate-100">
              <TabsTrigger value="ios" className="min-h-10">
                iOS (iPhone/iPad)
              </TabsTrigger>
              <TabsTrigger value="android" className="min-h-10">
                Android
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ios" className="pt-4">
              <ol className="space-y-3 text-sm leading-relaxed text-slate-800">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    1
                  </span>
                  <span>
                    Tippen Sie unten in <strong>Safari</strong> auf das
                    <strong> Teilen-Symbol</strong> (Quadrat mit Pfeil nach oben).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    2
                  </span>
                  <span>
                    Scrollen Sie nach unten und wählen Sie
                    <strong> „Zum Home-Bildschirm“</strong>.
                  </span>
                </li>
              </ol>
            </TabsContent>
            <TabsContent value="android" className="pt-4">
              <ol className="space-y-3 text-sm leading-relaxed text-slate-800">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    1
                  </span>
                  <span>
                    Tippen Sie oben rechts in <strong>Chrome</strong> auf die
                    <strong> drei Punkte</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    2
                  </span>
                  <span>
                    Wählen Sie <strong>„App installieren“</strong> oder
                    <strong> „Zum Startbildschirm hinzufügen“</strong>.
                  </span>
                </li>
              </ol>
              {deferredInstallPrompt && (
                <Button
                  type="button"
                  className="mt-4 min-h-11 w-full"
                  onClick={() => void installPwa()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  App jetzt installieren
                </Button>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPwaInstallDialogOpen(false)}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAuthenticated && (
        <LiveChatWidget
          state={chatState}
          snapshot={chatSnapshot}
          snapshotInitialized={chatSnapshotInitialized}
          unreadCount={unreadNotesCount}
          hasImportantUnread={hasImportantUnread}
          onOpen={openChatWidget}
          onMinimize={minimizeChatWidget}
          onClose={closeChatWidget}
          onRequestSnapshotRefresh={refreshChatSnapshot}
        />
      )}
    </div>
  );
}
