import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { ForcePasswordChangeModal } from "@/components/ForcePasswordChangeModal";
import {
  ImpressumDialog,
  LegalFooterLinks,
  SIDEBAR_COPYRIGHT_NOTICE,
} from "@/components/ImpressumDialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEventYear } from "@/contexts/YearContext";
import {
  navigationItemClasses,
  visibleNavigationSections,
} from "@/lib/nav";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { storePreviewSessionToken } from "@/lib/preview-session";
import { WEEKDAYS, type Weekday } from "@shared/weekdays";
import { COPYRIGHT_NOTICE } from "@shared/branding";
import {
  Bike,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileImage,
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
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const MYCREWMATE_WORDMARK = "/brand/mycrewmate-wordmark.png";
const MYCREWMATE_ICON = "/icons/mycrewmate-pwa-512.png";
const CHAT_SNAPSHOT_POLL_MS = 5_000;
const LAST_ADMINISTRATOR_NAME_STORAGE_KEY = "mycrewmate:last-administrator-name";
const DESKTOP_SIDEBAR_OPEN_STORAGE_KEY = "mycrewmate:desktop-sidebar-open";

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

const SaveLoadControls = lazy(() =>
  import("@/components/SaveLoadModal").then(module => ({
    default: module.SaveLoadControls,
  }))
);

const logoLoading = {
  loading: "eager" as const,
  decoding: "sync" as const,
  fetchPriority: "high" as const,
  draggable: false,
};

function SaveLoadControlsFallback() {
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

function LazySaveLoadControls({ onAction }: { onAction?: () => void }) {
  return (
    <Suspense fallback={<SaveLoadControlsFallback />}>
      <SaveLoadControls onAction={onAction} />
    </Suspense>
  );
}

type AdminLoginContact = {
  id: number;
  name: string;
  year: number;
  eventName: string;
};

function normalizeAdministratorName(name: string) {
  return name.trim().toLocaleLowerCase("de-DE");
}

function uniqueAdminLoginContacts(contacts: AdminLoginContact[]) {
  const seenNames = new Set<string>();
  return contacts.filter(contact => {
    const normalizedName = normalizeAdministratorName(contact.name);
    if (!normalizedName || seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  });
}

function getLastAdministratorName() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_ADMINISTRATOR_NAME_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function rememberAdministratorName(name: string) {
  if (typeof window === "undefined" || !name.trim()) return;
  try {
    window.localStorage.setItem(LAST_ADMINISTRATOR_NAME_STORAGE_KEY, name.trim());
  } catch {
    // Die Anmeldung bleibt auch bei deaktiviertem LocalStorage vollständig nutzbar.
  }
}

function getDesktopSidebarOpenPreference() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DESKTOP_SIDEBAR_OPEN_STORAGE_KEY) !== "false";
  } catch {
    // Ohne lokalen Speicher bleibt die offene Sidebar die sichere Standardansicht.
    return true;
  }
}

function rememberDesktopSidebarOpenPreference(isOpen: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESKTOP_SIDEBAR_OPEN_STORAGE_KEY, String(isOpen));
  } catch {
    // Der Fokusmodus bleibt auch bei deaktiviertem LocalStorage in der Sitzung nutzbar.
  }
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function focusCurrentPageSearch() {
  const searchTarget = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[data-global-search="true"], input[type="search"], input[placeholder*="Suchen"], input[aria-label*="durchsuchen"]'
    )
  ).find(input => !input.disabled && input.offsetParent !== null);
  if (!searchTarget) return false;
  searchTarget.focus();
  searchTarget.select();
  return true;
}

function AdminIdentityDialog({
  open,
  contacts,
  selectedContactId,
  manualName,
  selectedName,
  busy,
  onOpenChange,
  onContactChange,
  onManualNameChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  contacts: AdminLoginContact[];
  selectedContactId: string;
  manualName: string;
  selectedName: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onContactChange: (value: string) => void;
  onManualNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-slate-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wer meldet sich als Administrator an?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Wählen Sie einen hinterlegten Ansprechpartner aus oder tragen Sie
          einen Namen ein. Diese Auswahl kennzeichnet die aktuelle Sitzung.
        </p>
        <div className="space-y-2">
          <Label htmlFor="administrator-contact-select">
            Schnellauswahl Ansprechpartner
          </Label>
          <Select
            value={selectedContactId || "manual"}
            onValueChange={onContactChange}
            disabled={busy}
          >
            <SelectTrigger id="administrator-contact-select">
              <SelectValue placeholder="Ansprechpartner auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">
                {manualName
                  ? `Freitext verwenden: ${manualName}`
                  : "Freitext verwenden"}
              </SelectItem>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={String(contact.id)}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="administrator-manual-name">Name (alternativ)</Label>
          <Input
            id="administrator-manual-name"
            value={manualName}
            onChange={event => onManualNameChange(event.target.value)}
            placeholder="Name eingeben, falls die Person neu ist"
            disabled={Boolean(selectedContactId) || busy}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={selectedName.trim().length < 2 || busy}
            onClick={onConfirm}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const onlinePresence = useOnlinePresence();
  const { year, eventId, selectYear, selectEvent } = useEventYear();
  const [location] = useLocation();
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [loginFailureCounts, setLoginFailureCounts] = useState({ user: 0, admin: 0 });
  const [forcePasswordChangeOpen, setForcePasswordChangeOpen] = useState(false);
  const [initialPassword, setInitialPassword] = useState("");
  const [initialPasswordConfirmation, setInitialPasswordConfirmation] = useState("");
  const [initialPasswordError, setInitialPasswordError] = useState<string | null>(null);
  const [adminIdentityDialogOpen, setAdminIdentityDialogOpen] = useState(false);
  const [adminLoginContacts, setAdminLoginContacts] = useState<
    AdminLoginContact[]
  >([]);
  const [selectedAdminContactId, setSelectedAdminContactId] = useState<string>("");
  const [manualAdministratorName, setManualAdministratorName] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [impressumOpen, setImpressumOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getDesktopSidebarOpenPreference);
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
  const uniqueAdminContacts = useMemo(
    () => uniqueAdminLoginContacts(adminLoginContacts),
    [adminLoginContacts]
  );
  const currentLoginFailureCount = loginFailureCounts[loginMode];
  const showCooldownHint = currentLoginFailureCount >= 2;
  const toggleDesktopSidebar = useCallback(() => {
    setIsSidebarOpen(isOpen => {
      const nextIsOpen = !isOpen;
      rememberDesktopSidebarOpenPreference(nextIsOpen);
      return nextIsOpen;
    });
  }, []);

  useEffect(() => {
    const handleGlobalKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;

      if (event.key === "Escape") {
        // Der verpflichtende Initialpasswortwechsel bleibt aus Sicherheitsgründen
        // die einzige Ausnahme: Der Einmalcode darf keine normale Sitzung öffnen.
        if (forcePasswordChangeOpen) return;
        const closers = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-slot="dialog-close"], [data-slot="alert-dialog-cancel"], [data-slot="sheet-close"]'
          )
        ).filter(button => button.offsetParent !== null && !button.hasAttribute("disabled"));
        const closeTopmost = closers.at(-1);
        if (closeTopmost) {
          event.preventDefault();
          closeTopmost.click();
          return;
        }
        if (mobileMenuOpen) {
          event.preventDefault();
          setMobileMenuOpen(false);
          return;
        }
        if (chatState !== "closed") {
          event.preventDefault();
          setChatState("closed");
        }
        return;
      }

      const isFindShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
      const isSlashShortcut =
        event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!isFindShortcut && !isSlashShortcut) return;
      if (isSlashShortcut && isEditableShortcutTarget(event.target)) return;
      if (document.querySelector('[data-slot="dialog-content"][data-state="open"]')) {
        return;
      }
      if (focusCurrentPageSearch()) event.preventDefault();
    };

    window.addEventListener("keydown", handleGlobalKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleGlobalKeyboardShortcut);
  }, [chatState, forcePasswordChangeOpen, mobileMenuOpen]);

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

  useEffect(() => {
    // Leaflet und vergleichbare flächenabhängige Komponenten reagieren auf ein
    // Resize-Ereignis. Nach Abschluss der Grid-Animation erhalten sie damit
    // zuverlässig die neue echte Arbeitsbreite des Fokusmodus.
    const refreshWorkspaceSize = () => window.dispatchEvent(new Event("resize"));
    refreshWorkspaceSize();
    const animationEnd = window.setTimeout(refreshWorkspaceSize, 320);
    return () => window.clearTimeout(animationEnd);
  }, [isSidebarOpen]);

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
  const initialPasswordStatus = trpc.auth.initialPasswordChangeStatus.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
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
          const serverUnreadCount = Number(snapshot.unreadCount ?? 0);
          const serverHasImportantUnread = Boolean(snapshot.hasImportantUnread);
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
          if (chatStateRef.current === "open") {
            lastSeenChatNoteIdRef.current = newestNoteId;
            setUnreadNotesCount(0);
            setHasImportantUnread(false);
            continue;
          }

          if (!hasLoadedChatSnapshotRef.current) {
            // Beim Neu-Login bzw. Erstladen bestimmt der serverseitig persistierte
            // Abwesenheits-Lesestatus den roten Nachrichtenzähler.
            hasLoadedChatSnapshotRef.current = true;
            lastSeenChatNoteIdRef.current = newestNoteId;
            setUnreadNotesCount(serverUnreadCount);
            setHasImportantUnread(serverHasImportantUnread);
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
          } else if (serverUnreadCount === 0 && !serverHasImportantUnread) {
            // Falls ein paralleler Tab oder Aufruf bereits als gelesen markiert hat.
            setUnreadNotesCount(0);
            setHasImportantUnread(false);
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
    void utils.client.notes.markRead.mutate().catch(() => {});
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
    if (!isAuthenticated || !years.data?.length) return;
    if (years.data.some(item => item.year === year)) return;
    // Ein Zugang kann nachträglich auf andere Events beschränkt werden. Ein
    // veralteter LocalStorage-Wert darf dann nicht zu einer leeren Ansicht führen.
    selectYear(years.data[0].year);
  }, [isAuthenticated, selectYear, year, years.data]);

  useEffect(() => {
    if (!initialPasswordStatus.data?.mustChangePassword) return;
    setInitialPassword("");
    setInitialPasswordConfirmation("");
    setInitialPasswordError(null);
    setForcePasswordChangeOpen(true);
  }, [initialPasswordStatus.data?.mustChangePassword]);

  useEffect(() => {
    if (!events.data?.length || selectedEvent) return;
    selectEvent(events.data[0].id);
  }, [events.data, selectEvent, selectedEvent]);
  const finishLogin = async (previewSessionToken?: string) => {
    storePreviewSessionToken(previewSessionToken);
    setPassword("");
    setLoginError(null);
    setLoginFailureCounts({ user: 0, admin: 0 });
    setRecoveryOpen(false);
    setRecoveryKey("");
    setNewAdminPassword("");
    setRecoveryError(null);
    await utils.auth.me.invalidate();
    toast.success("Anmeldung erfolgreich");
  };
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    mutationKey: ["auth", "passwordLogin"],
    onSuccess: async result => {
      setLoginFailureCounts(current => ({ ...current, user: 0 }));
      storePreviewSessionToken(result.previewSessionToken);
      if (result.mustChangePassword) {
        setPassword("");
        setLoginError(null);
        setInitialPassword("");
        setInitialPasswordConfirmation("");
        setInitialPasswordError(null);
        setForcePasswordChangeOpen(true);
        await utils.auth.me.invalidate();
        return;
      }
      await finishLogin(result.previewSessionToken);
    },
    onError: async error => {
      setLoginError(error.message);
      if (error.data?.code === "BAD_REQUEST") {
        setLoginFailureCounts(current => ({
          ...current,
          user: current.user + 1,
        }));
      }
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        await utils.auth.passwordStatus.invalidate();
      }
    },
  });
  const completeInitialPasswordChange =
    trpc.auth.completeInitialPasswordChange.useMutation({
      mutationKey: ["auth", "completeInitialPasswordChange"],
      onSuccess: async result => {
        storePreviewSessionToken(result.previewSessionToken);
        setInitialPassword("");
        setInitialPasswordConfirmation("");
        setInitialPasswordError(null);
        setForcePasswordChangeOpen(false);
        await Promise.all([
          utils.auth.me.invalidate(),
          utils.auth.initialPasswordChangeStatus.invalidate(),
        ]);
        toast.success("Dein persönliches Passwort wurde gespeichert");
      },
      onError: error => setInitialPasswordError(error.message),
    });
  const adminPasswordLogin = trpc.auth.adminPasswordLogin.useMutation({
    mutationKey: ["auth", "adminPasswordLogin"],
    onSuccess: async result => {
      setLoginFailureCounts(current => ({ ...current, admin: 0 }));
      if (result.requiresIdentity) {
        const contacts = uniqueAdminLoginContacts(result.contacts ?? []);
        const lastAdministratorName = getLastAdministratorName();
        const previouslySelectedContact = contacts.find(
          contact =>
            normalizeAdministratorName(contact.name) ===
            normalizeAdministratorName(lastAdministratorName)
        );
        setAdminLoginContacts(contacts);
        setSelectedAdminContactId(
          previouslySelectedContact ? String(previouslySelectedContact.id) : ""
        );
        setManualAdministratorName(
          previouslySelectedContact ? "" : lastAdministratorName
        );
        setAdminIdentityDialogOpen(true);
        return;
      }
      rememberAdministratorName(selectedAdministratorName);
      await finishLogin(result.previewSessionToken);
    },
    onError: error => {
      setLoginError(error.message);
      if (error.data?.code === "BAD_REQUEST") {
        setLoginFailureCounts(current => ({
          ...current,
          admin: current.admin + 1,
        }));
      }
    },
  });
  const resetAdminWithKey = trpc.auth.resetAdminWithKey.useMutation({
    mutationKey: ["auth", "resetAdminWithKey"],
    onSuccess: async result => finishLogin(result.previewSessionToken),
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
  const selectedAdministratorName =
    uniqueAdminContacts.find(contact => String(contact.id) === selectedAdminContactId)
      ?.name ?? manualAdministratorName.trim();
  const closeAdminIdentityDialog = () => {
    setAdminIdentityDialogOpen(false);
    setAdminLoginContacts([]);
    setSelectedAdminContactId("");
    setManualAdministratorName("");
    setPassword("");
  };
  const adminIdentityDialog = (
    <AdminIdentityDialog
      open={adminIdentityDialogOpen}
      contacts={uniqueAdminContacts}
      selectedContactId={selectedAdminContactId}
      manualName={manualAdministratorName}
      selectedName={selectedAdministratorName}
      busy={adminPasswordLogin.isPending}
      onOpenChange={open => {
        if (!open && !adminPasswordLogin.isPending) closeAdminIdentityDialog();
      }}
      onContactChange={value => {
        setSelectedAdminContactId(value === "manual" ? "" : value);
        if (value !== "manual") setManualAdministratorName("");
      }}
      onManualNameChange={value => {
        setManualAdministratorName(value);
        if (value) setSelectedAdminContactId("");
      }}
      onCancel={closeAdminIdentityDialog}
      onConfirm={() =>
        adminPasswordLogin.mutate({
          password,
          administratorName: selectedAdministratorName.trim(),
        })
      }
    />
  );
  const submitInitialPasswordChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInitialPasswordError(null);
    if (initialPassword !== initialPasswordConfirmation) {
      setInitialPasswordError("Die Passwörter stimmen nicht überein.");
      return;
    }
    completeInitialPasswordChange.mutate({
      password: initialPassword,
      passwordConfirmation: initialPasswordConfirmation,
    });
  };
  const forcePasswordChangeModal = (
    <ForcePasswordChangeModal
      open={forcePasswordChangeOpen}
      password={initialPassword}
      passwordConfirmation={initialPasswordConfirmation}
      busy={completeInitialPasswordChange.isPending}
      error={initialPasswordError}
      onPasswordChange={value => {
        setInitialPassword(value);
        if (initialPasswordError) setInitialPasswordError(null);
      }}
      onPasswordConfirmationChange={value => {
        setInitialPasswordConfirmation(value);
        if (initialPasswordError) setInitialPasswordError(null);
      }}
      onSubmit={submitInitialPasswordChange}
    />
  );

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
      <div className="relative grid min-h-[100dvh] place-items-center bg-gradient-to-br from-[oklch(0.97_0.02_250)] to-[oklch(0.92_0.04_240)] px-4 py-5 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-5 text-card-foreground shadow-xl backdrop-blur-sm transition-all duration-200 ease-in-out sm:p-6">
          <div className="mb-4 text-center">
            <h1 className="sr-only">MyCrewMate</h1>
            <img
              {...logoLoading}
              src={MYCREWMATE_WORDMARK}
              alt="MyCrewMate"
              className="mx-auto h-10 w-auto max-w-full bg-transparent object-contain sm:h-12"
            />
            <p className="mt-1 text-[11px] font-medium tracking-[0.08em] text-slate-600">
              VEREINS- &amp; EVENTPLANUNG
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
                  : "cursor-pointer bg-transparent text-gray-500 hover:bg-white/60 hover:text-gray-900"
              )}
              onClick={() => {
                setLoginMode("user");
                setPassword("");
                setPasswordVisible(false);
                setCapsLockOn(false);
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
                  : "cursor-pointer bg-transparent text-gray-500 hover:bg-white/60 hover:text-gray-900"
              )}
              onClick={() => {
                setLoginMode("admin");
                setPassword("");
                setPasswordVisible(false);
                setCapsLockOn(false);
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
          <form className="space-y-4" onSubmit={submitPassword}>
            <Label htmlFor="planning-password" className="text-sm font-semibold">
              {loginMode === "admin"
                ? "Administratorpasswort"
                : "Zugangspasswort"}
            </Label>
            <div className="relative">
              <Input
                id="planning-password"
                className="h-12 pr-12 text-base"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Passwort eingeben"
                value={password}
                onChange={event => {
                  setPassword(event.target.value);
                  if (loginError) setLoginError(null);
                }}
                onKeyDown={event => setCapsLockOn(event.getModifierState("CapsLock"))}
                onKeyUp={event => setCapsLockOn(event.getModifierState("CapsLock"))}
                onBlur={() => setCapsLockOn(false)}
                disabled={!loginAvailable || loginPending}
                aria-describedby={
                  [
                    planningTeamLocked ? "planning-team-lock-message" : "",
                    loginError ? "password-login-error" : "",
                    capsLockOn ? "password-caps-lock-warning" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex min-h-12 min-w-12 items-center justify-center rounded-r-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
                aria-label={passwordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
                aria-pressed={passwordVisible}
                title={passwordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
                disabled={!loginAvailable || loginPending}
                onClick={() => setPasswordVisible(visible => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {capsLockOn && (
              <p
                id="password-caps-lock-warning"
                className="-mt-2 flex items-center gap-1.5 text-xs text-amber-700"
                role="status"
                aria-live="polite"
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Feststelltaste ist aktiviert.
              </p>
            )}
            <Button
              className="h-12 w-full rounded-lg bg-blue-600 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 hover:text-white focus-visible:ring-blue-500"
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
                  : "Anmelden"}
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
            {showCooldownHint && !planningTeamLocked && (
              <p
                className="flex items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-center text-xs text-amber-900"
                role="status"
                aria-live="polite"
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Nach 5 Fehlversuchen greift eine zeitbasierte Sperre (Cooldown).
              </p>
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
                    Administrator kann die Sperre im Bereich „Schutz &amp; Protokoll“
                    wieder aufheben.
                  </p>
                </div>
              </div>
            )}
          </form>
          )}
        </div>
          <div className="absolute inset-x-4 bottom-3 text-center sm:bottom-4">
            <LegalFooterLinks onOpenImpressum={() => setImpressumOpen(true)} />
            <button
              type="button"
              className="mt-1 rounded px-1 text-xs text-gray-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => setImpressumOpen(true)}
            >
              {COPYRIGHT_NOTICE}
            </button>
          </div>
          {adminIdentityDialog}
          <ImpressumDialog open={impressumOpen} onOpenChange={setImpressumOpen} />
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
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-100/80 flex flex-col lg:h-screen lg:overflow-hidden lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out lg:grid",
        isSidebarOpen
          ? "lg:grid-cols-[16rem_minmax(0,1fr)]"
          : "lg:grid-cols-[0px_minmax(0,1fr)]"
      )}
      data-sidebar-open={isSidebarOpen ? "true" : "false"}
      data-workspace-mode={isSidebarOpen ? "standard" : "focus"}
    >
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
            <div className="truncate text-sm font-bold">MyCrewMate</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {selectedEvent?.name ?? `Veranstaltung ${year}`}
            </div>
          </div>
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
          overlayClassName="z-50"
          className="z-50 w-[88vw] max-w-xs gap-0 bg-white p-0 text-slate-950"
        >
          <SheetHeader className="items-center bg-white px-4 py-3 text-center">
            <SheetTitle className="flex justify-center">
              <img
                {...logoLoading}
                src={MYCREWMATE_WORDMARK}
                alt="MyCrewMate"
                className="h-10 w-auto max-w-[190px] bg-transparent object-contain"
              />
            </SheetTitle>
            <SheetDescription className="mt-1 text-center text-[11px] font-medium tracking-[0.08em] text-slate-600">
              VEREINS- &amp; EVENTPLANUNG
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-10 items-center justify-center border-y border-slate-200 bg-slate-50 px-3 py-1.5">
            <OnlinePresenceBadge
              counts={onlinePresence.counts}
              onOpenChat={openChatWidget}
              className="min-h-7 max-w-full"
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
            <div className="mt-2 border-t pt-2">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Projektstand
              </Label>
              <LazySaveLoadControls onAction={() => setMobileMenuOpen(false)} />
            </div>
            {!pwaInstalled && (
              deferredInstallPrompt ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 min-h-11 w-full justify-start border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                  onClick={() => void installPwa()}
                >
                  <img
                    {...logoLoading}
                    src={MYCREWMATE_ICON}
                    alt=""
                    aria-hidden="true"
                    className="mr-2 h-10 w-10 rounded-xl shadow-md bg-white p-1.5 object-contain"
                  />
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
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
                  <img
                    {...logoLoading}
                    src={MYCREWMATE_ICON}
                    alt=""
                    aria-hidden="true"
                    className="mr-2 h-10 w-10 rounded-xl shadow-md bg-white p-1.5 object-contain"
                  />
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  <span>📱 Als App auf Handy speichern</span>
                </Button>
              )
            )}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {visibleNavigationSections(user?.role).map(section => (
              <div key={section.id} className="space-y-1">
                {section.items.map(({ href, label, icon: Icon }) => {
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
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                        navigationItemClasses(user?.role, href, active)
                      )}
                    >
                      <Icon className="h-5 w-5" /> {label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t px-3 py-2">
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
            <LegalFooterLinks
              compact
              className="mt-1.5"
              onOpenImpressum={() => setImpressumOpen(true)}
            />
            <button
              type="button"
              className="mt-1 w-full whitespace-nowrap rounded px-1 text-center text-[10px] leading-none text-gray-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => setImpressumOpen(true)}
            >
              {SIDEBAR_COPYRIGHT_NOTICE}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className="hidden min-w-0 overflow-hidden border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start"
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
      >
        <div
          className={cn(
            "flex h-full w-64 shrink-0 flex-col transition-transform duration-300 ease-in-out",
            !isSidebarOpen && "-translate-x-full"
          )}
        >
        <div className="flex min-h-24 flex-col items-center px-4 py-3 text-slate-950">
          <img
            {...logoLoading}
            src={MYCREWMATE_WORDMARK}
            alt="MyCrewMate"
            className="h-10 w-auto max-w-[210px] bg-transparent object-contain"
          />
          <div className="mt-1 w-full text-center text-[11px] font-medium tracking-[0.08em] text-slate-600">
            VEREINS- &amp; EVENTPLANUNG
          </div>
        </div>
        <div className="flex min-h-10 items-center justify-center border-y border-slate-200 bg-white/35 px-3 py-1.5">
          <OnlinePresenceBadge
            counts={onlinePresence.counts}
            onOpenChat={openChatWidget}
            className="min-h-7 max-w-full"
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
          <div className="mt-2 border-t pt-2">
            <Label className="mb-1 block text-xs text-muted-foreground">
              Projektstand
            </Label>
            <LazySaveLoadControls />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2 pt-1.5 space-y-0.5">
          {visibleNavigationSections(user?.role).map(section => (
            <div key={section.id} className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                      onFocus={() => preloadRoute(href)}
                      onMouseEnter={() => preloadRoute(href)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                        navigationItemClasses(user?.role, href, active)
                      )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex flex-col border-t border-slate-200/70 px-3 pt-0.5 pb-1 leading-none">
          <div className="flex items-center justify-between gap-2 leading-none">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium leading-none">
                {user?.name}
              </div>
              <div className="text-[10px] leading-none text-muted-foreground">
                {user?.role === "admin" ? "Administrator" : "Planungsteam"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Abmelden"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
          <LegalFooterLinks
            compact
            className="mt-px"
            onOpenImpressum={() => setImpressumOpen(true)}
          />
          <button
            type="button"
            className="mt-0.5 block w-full whitespace-nowrap rounded px-0 text-center text-[9px] leading-none text-gray-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => setImpressumOpen(true)}
          >
            {SIDEBAR_COPYRIGHT_NOTICE}
          </button>
        </div>
        </div>
      </aside>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "fixed top-1/2 z-40 hidden h-12 w-7 -translate-y-1/2 place-items-center rounded-r-xl border border-l-0 border-slate-300 bg-white text-slate-600 shadow-md transition-[left,transform] duration-300 ease-in-out hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:grid",
              isSidebarOpen ? "left-[calc(16rem-1px)]" : "left-0"
            )}
            aria-label={isSidebarOpen ? "Seitenleiste einklappen" : "Seitenleiste ausklappen"}
            aria-pressed={isSidebarOpen}
            title={isSidebarOpen ? "Seitenleiste einklappen" : "Seitenleiste ausklappen"}
            onClick={toggleDesktopSidebar}
          >
            {isSidebarOpen ? (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="px-2 py-1 text-[11px] shadow-sm">
          {isSidebarOpen ? "Seitenleiste einklappen" : "Seitenleiste ausklappen"}
        </TooltipContent>
      </Tooltip>
      <main className="min-w-0 lg:h-screen lg:overflow-y-auto">
        <div
          className={cn(
            location === "/helfer" || location === "/einsatzplan"
              ? "w-full p-3 sm:p-4 xl:p-6"
              : "w-full max-w-[1400px] p-3 sm:p-4 lg:p-6",
            !isSidebarOpen && "lg:max-w-none"
          )}
        >
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {selectedEvent?.name ?? "Veranstaltung"} · Planung {year}
            </div>
            {user?.name && (
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                Angemeldet: {user.name} ({user.role === "admin" ? "Administrator" : "Planungsteam"})
              </div>
            )}
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

      <ImpressumDialog open={impressumOpen} onOpenChange={setImpressumOpen} />

      {forcePasswordChangeModal}

      <Dialog open={pwaInstallDialogOpen} onOpenChange={setPwaInstallDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-700" aria-hidden="true" />
              MyCrewMate als App speichern
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
