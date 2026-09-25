import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { ForcePasswordChangeModal } from "@/components/ForcePasswordChangeModal";
import { FirstLoginOnboarding } from "@/components/FirstLoginOnboarding";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  activeNavigationAccess,
  navigationItemClasses,
  visibleNavigationSections,
} from "@/lib/nav";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  tenantRoleLabel,
  useTenantAdministration,
} from "@/hooks/useTenantAdministration";
import {
  clearPreviewSessionToken,
  storePreviewSessionToken,
} from "@/lib/preview-session";
import { WEEKDAYS, type Weekday } from "@shared/weekdays";
import { COPYRIGHT_NOTICE } from "@shared/branding";
import { ACTIVE_PILOT_TENANT } from "@shared/tenant";
import {
  eventStartSelectionSessionKey,
  initialAccessibleEvent,
} from "@shared/event-start-selection";
import {
  Bike,
  Building2,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileImage,
  KeyRound,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings2,
  Share,
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
const DESKTOP_SIDEBAR_OPEN_STORAGE_KEY = "mycrewmate:desktop-sidebar-open";
const ACTIVATION_TENANT_STORAGE_KEY = "mycrewmate:activation-tenant";
// Der Wechsler dient nur der lokalen Entwicklungs- und Isolationserprobung.
// Für Vereinszugänge und die veröffentlichte App wird der Mandant später
// ausschließlich serverseitig aus der Konto-Zuordnung bestimmt.
const LOCAL_TENANT_SWITCHER_ENABLED =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".manus.computer") ||
    window.location.hostname.endsWith(".manus.space"));

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

function ActiveNavigationAccessIndicator({
  access,
}: {
  access: "edit" | "read";
}) {
  const canEdit = access === "edit";
  const label = canEdit ? "Bearbeiten erlaubt" : "Nur lesen";
  const AccessIcon = canEdit ? Pencil : Eye;

  return (
    <span
      data-slot="active-navigation-access"
      data-access={access}
      role="img"
      aria-label={label}
      title={label}
      className="ml-auto inline-flex shrink-0 items-center justify-center"
    >
      <AccessIcon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

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

function storedActivationTenantId() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(ACTIVATION_TENANT_STORAGE_KEY)?.trim();
    return value && /^[a-z0-9-]{3,96}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberActivationTenantId(tenantId: string) {
  try {
    window.sessionStorage.setItem(ACTIVATION_TENANT_STORAGE_KEY, tenantId);
  } catch {
    // Der Speicher ist nur eine Darstellungs-Sicherung, niemals eine Berechtigung.
  }
}

function clearRememberedActivationTenantId() {
  try {
    window.sessionStorage.removeItem(ACTIVATION_TENANT_STORAGE_KEY);
  } catch {
    // Ohne SessionStorage wird der Benutzer nach dem Passwortwechsel trotzdem korrekt geladen.
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

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const onlinePresence = useOnlinePresence();
  const {
    isCoAdmin,
    isPrimaryTenantAdmin,
    isTenantAdmin,
  } = useTenantAdministration();
  const {
    tenantId,
    year,
    eventId,
    selectTenant,
    synchronizeTenant,
    selectYear,
    selectEvent,
  } =
    useEventYear();
  const [location] = useLocation();
  const myPermissions = trpc.planningTeamAccesses.myPermissions.useQuery(undefined, {
    enabled:
      isAuthenticated &&
      user?.role === "user" &&
      location !== "/aktivieren",
  });
  const myModuleAccess = trpc.planningTeamAccesses.myModuleAccess.useQuery(undefined, {
    enabled:
      isAuthenticated &&
      user?.role === "user" &&
      location !== "/aktivieren",
  });
  const effectiveNavigationRole = isTenantAdmin ? "admin" : user?.role;
  const effectiveRoleLabel = tenantRoleLabel({
    isTenantAdmin,
    isPrimaryTenantAdmin,
    isCoAdmin,
  });
  const isReadOnlyPlanningAccess =
    user?.role === "user" &&
    !isTenantAdmin &&
    Array.isArray(myPermissions.data) &&
    myPermissions.data.length === 0;
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginFailureCount, setLoginFailureCount] = useState(0);
  const [forcePasswordChangeOpen, setForcePasswordChangeOpen] = useState(false);
  const [initialPassword, setInitialPassword] = useState("");
  const [initialPasswordConfirmation, setInitialPasswordConfirmation] = useState("");
  const [initialPasswordError, setInitialPasswordError] = useState<string | null>(null);
  const [activationTenantId, setActivationTenantId] = useState(
    storedActivationTenantId
  );
  // Ein Aktivierungslink übernimmt eine neue persönliche Sitzung. Bis der
  // Zielverein nach dem Passwortwechsel vollständig geladen ist, bleibt die
  // alte Vereinsansicht bewusst unsichtbar.
  const isTenantActivationRoute = location === "/aktivieren";
  const isCredentialBootstrapPending =
    isTenantActivationRoute ||
    forcePasswordChangeOpen ||
    activationTenantId !== null;
  const firstLoginOnboarding = trpc.auth.firstLoginOnboardingStatus.useQuery(
    undefined,
    {
      enabled: isAuthenticated && !isCredentialBootstrapPending,
      staleTime: 0,
    }
  );
  const [impressumOpen, setImpressumOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getDesktopSidebarOpenPreference);
  const [newYear, setNewYear] = useState(year + 1);
  const [newYearInitialEventName, setNewYearInitialEventName] = useState("");
  const [newYearInitialEventDays, setNewYearInitialEventDays] = useState<Weekday[]>([]);
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
  const [clearEventDatesTarget, setClearEventDatesTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  // Ein verbrauchter oder abgelaufener Einmal-Link darf keinesfalls erneut
  // ausgelöst werden: Die Mutation würde sonst nach jedem Rendern wiederholen.
  const attemptedHandoffTokenRef = useRef<string | null>(null);
  const removeHandoffFromAddress = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("handoff");
    window.history.replaceState({}, "", url.toString());
  };
  const consumeHandoff = trpc.auth.consumeHandoffToken.useMutation({
    onSuccess: async result => {
      storePreviewSessionToken(result.previewSessionToken);
      selectTenant(result.tenantId);
      await utils.auth.me.invalidate();
      toast.success("Wechsel in Vereinsansicht erfolgreich");
      removeHandoffFromAddress();
    },
    onError: err => {
      // Nach genau einem fehlgeschlagenen Abruf den Einmal-Link aus der URL
      // entfernen, damit weder Schleife noch erneuter Tokenabruf entstehen.
      removeHandoffFromAddress();
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("handoff");
    if (
      token &&
      token.length >= 10 &&
      attemptedHandoffTokenRef.current !== token &&
      !consumeHandoff.isPending
    ) {
      attemptedHandoffTokenRef.current = token;
      consumeHandoff.mutate({ token });
    }
  }, [consumeHandoff]);
  const consumeActivationInvitation = trpc.auth.consumeActivationInvitation.useMutation({
    onSuccess: async result => {
      storePreviewSessionToken(result.previewSessionToken);
      rememberActivationTenantId(result.tenantId);
      setActivationTenantId(result.tenantId);
      // Den Einmal-Link vor dem bewusst vollständigen Kontextwechsel aus der
      // Adresse entfernen. Der nachfolgende Reload darf nur Bunefix (bzw. den
      // jeweiligen Zielverein) laden und nie den noch sichtbaren Altverein.
      window.history.replaceState({}, "", "/");
      selectTenant(result.tenantId);
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.auth.initialPasswordChangeStatus.invalidate(),
      ]);
      toast.success("Zugang bestätigt – bitte jetzt ein eigenes Passwort festlegen.");
    },
    onError: err => {
      clearRememberedActivationTenantId();
      setActivationTenantId(null);
      toast.error(err.message);
      window.history.replaceState({}, "", "/login");
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/aktivieren") return;
    const token = new URLSearchParams(window.location.search).get("token");
    if (
      token &&
      token.length >= 32 &&
      !consumeActivationInvitation.isPending &&
      !consumeActivationInvitation.isSuccess
    ) {
      consumeActivationInvitation.mutate({ token });
    }
  }, [consumeActivationInvitation]);
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
  const [chatSnapshotError, setChatSnapshotError] = useState<string | null>(null);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [hasImportantUnread, setHasImportantUnread] = useState(false);
  const lastSeenChatNoteIdRef = useRef<number>(0);
  const hasLoadedChatSnapshotRef = useRef(false);
  const chatStateRef = useRef<LiveChatWidgetState>("closed");
  const chatSnapshotEpochRef = useRef(0);
  const chatSnapshotPollInFlightRef = useRef<Promise<void> | null>(null);
  const chatSnapshotPollQueuedRef = useRef(false);
  const loginErrorRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const showCooldownHint = loginFailureCount >= 2;
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
    enabled: isAuthenticated && !isCredentialBootstrapPending,
  });
  const tenants = trpc.tenants.list.useQuery(undefined, {
    enabled:
      LOCAL_TENANT_SWITCHER_ENABLED &&
      isAuthenticated &&
      user?.role === "admin",
  });
  const currentTenant = trpc.tenants.current.useQuery(undefined, {
    enabled: isAuthenticated && !isCredentialBootstrapPending,
  });
  const events = trpc.events.list.useQuery(undefined, {
    enabled: isAuthenticated && !isCredentialBootstrapPending,
  });
  // Die Route liefert für Vereinsadmins alle und für Planungsteamzugänge nur
  // die tatsächlich freigegebenen Veranstaltungen über sämtliche Jahre.
  // Sie dient ausschließlich der Startauswahl und verändert keine Rechte.
  const accessibleEvents = trpc.events.all.useQuery(undefined, {
    enabled: isAuthenticated && !isCredentialBootstrapPending,
  });
  // Ein persönlicher Planungsteamzugang darf keine Fachseite und keinen Chat
  // mit einer vom Browser geerbten, noch nicht freigegebenen Event-ID starten.
  // Erst die serverseitig gefilterte Eventliste bestätigt den Arbeitskontext.
  const isPlanningTeamEventScopeResolving =
    isAuthenticated &&
    user?.role === "user" &&
    !isTenantAdmin &&
    (accessibleEvents.isPending ||
      (accessibleEvents.isSuccess &&
        accessibleEvents.data.length > 0 &&
        !accessibleEvents.data.some(event => event.id === eventId)));
  const selectedEvent = events.data?.find(item => item.id === eventId);
  const selectedTenantRecord = tenants.data?.find(item => item.id === tenantId);
  const activeTenantName =
    selectedTenantRecord?.name ??
    currentTenant.data?.name ??
    ACTIVE_PILOT_TENANT.name;
  const activeTenantStatus =
    selectedTenantRecord?.status ?? currentTenant.data?.status ?? "pilot";
  const activeTenantBadge =
    activeTenantStatus === "sample"
      ? "Muster"
      : activeTenantStatus === "active"
        ? "Aktiv"
        : activeTenantStatus === "suspended"
          ? "Pausiert"
          : activeTenantStatus === "archived"
            ? "Archiv"
            : "Pilot";

  useEffect(() => {
    const authorizedTenantId = currentTenant.data?.id;
    if (authorizedTenantId) synchronizeTenant(authorizedTenantId);
  }, [currentTenant.data?.id, synchronizeTenant]);

  useEffect(() => {
    chatSnapshotEpochRef.current += 1;
    chatSnapshotPollQueuedRef.current = true;
    setChatSnapshot({ notes: [], typing: [] });
    setChatSnapshotInitialized(false);
    setChatSnapshotError(null);
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
          setChatSnapshotError(null);
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
        } catch (error) {
          // Der Verlauf darf für eingeladene Planer nie scheinbar leer bleiben,
          // wenn der Browser noch auf einen nicht freigegebenen Eventkontext
          // zeigt. Die konkrete, servergeprüfte Ursache wird stattdessen im
          // Chat sichtbar und der nächste Tick versucht die Synchronisierung erneut.
          const message = error instanceof Error ? error.message : "Chat konnte nicht aktualisiert werden.";
          setChatSnapshotError(message);
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
    if (
      !isAuthenticated ||
      isCredentialBootstrapPending ||
      isPlanningTeamEventScopeResolving
    ) {
      return;
    }
    void refreshChatSnapshot();
    const timer = window.setInterval(refreshChatSnapshot, CHAT_SNAPSHOT_POLL_MS);
    return () => {
      // Laufende Antworten aus der abgemeldeten bzw. alten Sitzung dürfen den
      // aktuellen State nicht mehr überschreiben.
      chatSnapshotEpochRef.current += 1;
      chatSnapshotPollQueuedRef.current = false;
      window.clearInterval(timer);
    };
  }, [
    isAuthenticated,
    isCredentialBootstrapPending,
    isPlanningTeamEventScopeResolving,
    refreshChatSnapshot,
    year,
    eventId,
  ]);

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
    if (
      !isAuthenticated ||
      isCredentialBootstrapPending ||
      !accessibleEvents.data
    ) {
      return;
    }

    // Nach einem App-Start wird genau einmal die nächste bevorstehende,
    // für diesen Zugang erlaubte Veranstaltung gewählt. Das Merkmal bleibt
    // bis zum Schließen des Tabs bestehen, damit eine danach manuell gewählte
    // Veranstaltung nicht durch Refetches oder Seitenwechsel überschrieben wird.
    const selectionKey = eventStartSelectionSessionKey(tenantId);
    if (window.sessionStorage.getItem(selectionKey)) return;

    const initialEvent = initialAccessibleEvent(accessibleEvents.data);
    if (!initialEvent) return;
    window.sessionStorage.setItem(selectionKey, "done");
    if (initialEvent.year !== year) {
      selectYear(initialEvent.year, initialEvent.id);
      return;
    }
    if (initialEvent.id !== eventId) selectEvent(initialEvent.id);
  }, [
    accessibleEvents.data,
    eventId,
    isAuthenticated,
    isCredentialBootstrapPending,
    selectEvent,
    selectYear,
    tenantId,
    year,
  ]);

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

  // Wenn der Benutzer ein Planungsteam-Mitglied ist und accessibleEvents geladen
  // sind, aber die aktuell im Browser aktive eventId nicht darin vorkommt, korrigieren
  // wir sofort automatisch auf ein gültiges, freigegebenes Event, damit der Chat
  // und die Fachbereiche ohne störende Kontext-Fehlermeldung laden.
  useEffect(() => {
    if (
      !isAuthenticated ||
      isCredentialBootstrapPending ||
      user?.role !== "user" ||
      isTenantAdmin ||
      !accessibleEvents.data ||
      accessibleEvents.data.length === 0
    ) {
      return;
    }
    const hasValidEventSelected = accessibleEvents.data.some(
      e => e.id === eventId
    );
    if (!hasValidEventSelected) {
      const targetEvent = initialAccessibleEvent(accessibleEvents.data) ?? accessibleEvents.data[0];
      if (targetEvent) {
        if (targetEvent.year !== year) {
          selectYear(targetEvent.year, targetEvent.id);
        } else {
          selectEvent(targetEvent.id);
        }
      }
    }
  }, [
    accessibleEvents.data,
    eventId,
    isAuthenticated,
    isCredentialBootstrapPending,
    isTenantAdmin,
    selectEvent,
    selectYear,
    user?.role,
    year,
  ]);
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    mutationKey: ["auth", "passwordLogin"],
    onSuccess: result => {
      setLoginFailureCount(0);
      setLoginNotice(null);
      storePreviewSessionToken(result.previewSessionToken);
      // Der Loginserver bestimmt den Verein. Dadurch kann ein RSC-Wert aus
      // LocalStorage niemals die frisch angemeldete Vereinsadministration
      // in eine fremde Planung umleiten.
      selectTenant(
        result.tenantId,
        "startEvent" in result ? result.startEvent : null
      );
    },
    onError: async error => {
      setLoginError(error.message);
      if (error.data?.code === "BAD_REQUEST") {
        setLoginFailureCount(current => current + 1);
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
        clearPreviewSessionToken();
        clearRememberedActivationTenantId();
        setActivationTenantId(null);
        setInitialPassword("");
        setInitialPasswordConfirmation("");
        setInitialPasswordError(null);
        setForcePasswordChangeOpen(false);
        setPassword("");
        setLoginEmail("");
        setLoginNotice(
          "Passwort gespeichert. Bitte melden Sie sich jetzt einmal regulär mit Ihrer E-Mail-Adresse und dem neuen Passwort an."
        );
        utils.auth.me.setData(undefined, null);
        await Promise.all([
          utils.auth.me.invalidate(),
          utils.auth.initialPasswordChangeStatus.invalidate(),
        ]);
        toast.success("Passwort gespeichert – bitte jetzt regulär anmelden");
      },
      onError: error => setInitialPasswordError(error.message),
    });
  const completeTenantAdminInitialPasswordChange =
    trpc.auth.completeTenantAdminInitialPasswordChange.useMutation({
      mutationKey: ["auth", "completeTenantAdminInitialPasswordChange"],
      onSuccess: async () => {
        clearPreviewSessionToken();
        clearRememberedActivationTenantId();
        setActivationTenantId(null);
        setInitialPassword("");
        setInitialPasswordConfirmation("");
        setInitialPasswordError(null);
        setForcePasswordChangeOpen(false);
        setPassword("");
        setLoginEmail("");
        setLoginNotice(
          "Passwort gespeichert. Bitte melden Sie sich jetzt einmal regulär mit Ihrer E-Mail-Adresse und dem neuen Passwort an."
        );
        utils.auth.me.setData(undefined, null);
        await Promise.all([
          utils.auth.me.invalidate(),
          utils.auth.initialPasswordChangeStatus.invalidate(),
        ]);
        toast.success("Passwort gespeichert – bitte jetzt regulär anmelden");
      },
      onError: error => setInitialPasswordError(error.message),
    });
  const completeFirstLoginOnboarding =
    trpc.auth.completeFirstLoginOnboarding.useMutation({
      onSuccess: async () => {
        await firstLoginOnboarding.refetch();
      },
      onError: error => toast.error(error.message),
  });
  const finishFirstLoginOnboarding = useCallback(() => {
    completeFirstLoginOnboarding.mutate();
  }, [completeFirstLoginOnboarding.mutate]);
  const createYear = trpc.years.create.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.years.list.invalidate(),
        utils.events.list.invalidate(),
      ]);
      setYearDialogOpen(false);
      setNewYearInitialEventName("");
      setNewYearInitialEventDays([]);
      selectYear(result.event.year, result.event.id);
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
      setClearEventDatesTarget(null);
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

  const openYearDialog = () => {
    setMobileMenuOpen(false);
    setNewYear(year + 1);
    setNewYearInitialEventName("");
    setNewYearInitialEventDays([]);
    setYearDialogOpen(true);
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
    if (!password || !loginEmail.trim()) return;
    passwordLogin.mutate({ password, email: loginEmail.trim() });
  };
  const planningTeamLocked = Boolean(passwordStatus.data?.planningTeamLocked);
  const loginPending = passwordLogin.isPending;
  const submitInitialPasswordChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInitialPasswordError(null);
    if (initialPassword !== initialPasswordConfirmation) {
      setInitialPasswordError("Die Passwörter stimmen nicht überein.");
      return;
    }
    const payload = {
      password: initialPassword,
      passwordConfirmation: initialPasswordConfirmation,
    };
    if (
      user?.role === "admin" &&
      user.openId.startsWith("tenant-admin:")
    ) {
      completeTenantAdminInitialPasswordChange.mutate(payload);
      return;
    }
    completeInitialPasswordChange.mutate(payload);
  };
  const forcePasswordChangeModal = (
    <ForcePasswordChangeModal
      open={forcePasswordChangeOpen}
      password={initialPassword}
      passwordConfirmation={initialPasswordConfirmation}
      busy={
        completeInitialPasswordChange.isPending ||
        completeTenantAdminInitialPasswordChange.isPending
      }
      error={initialPasswordError}
      identityName={user?.name ?? null}
      invitationEmail={initialPasswordStatus.data?.invitationEmail ?? null}
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

  const credentialBootstrapScreen = (
    <div className="login-page-background relative grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_center,_#ffffff_20%,_#f0f9ff_66%,_#dbeafe_100%)] px-4 py-5 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-6 text-center text-card-foreground shadow-xl backdrop-blur-sm">
        <img
          {...logoLoading}
          src={MYCREWMATE_WORDMARK}
          alt="MyCrewMate"
          className="mx-auto h-10 w-auto max-w-full bg-transparent object-contain sm:h-12"
        />
        <p className="mt-2 text-[11px] font-medium tracking-[0.08em] text-slate-600">
          VEREINS- &amp; EVENTPLANUNG
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-700" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none text-blue-700" aria-hidden="true" />
          Persönlicher Zugang wird sicher eingerichtet …
        </div>
      </div>
      {forcePasswordChangeModal}
    </div>
  );

  const eventScopeBootstrapScreen = (
    <div className="login-page-background relative grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_center,_#ffffff_20%,_#f0f9ff_66%,_#dbeafe_100%)] px-4 py-5 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-6 text-center text-card-foreground shadow-xl backdrop-blur-sm">
        <img
          {...logoLoading}
          src={MYCREWMATE_WORDMARK}
          alt="MyCrewMate"
          className="mx-auto h-10 w-auto max-w-full bg-transparent object-contain sm:h-12"
        />
        <p className="mt-2 text-[11px] font-medium tracking-[0.08em] text-slate-600">
          VEREINS- &amp; EVENTPLANUNG
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-700" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none text-blue-700" aria-hidden="true" />
          Freigegebene Veranstaltung wird geöffnet …
        </div>
      </div>
      {forcePasswordChangeModal}
    </div>
  );

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
  // Weder ein zuvor offener RSC-Tab noch dessen Jahr oder Veranstaltung dürfen
  // unter dem Aktivierungsdialog sichtbar werden. Erst nach dem erfolgreichen
  // Passwortwechsel wird die serverseitig bestätigte Vereinsansicht geladen.
  if (isCredentialBootstrapPending) {
    return credentialBootstrapScreen;
  }
  if (isPlanningTeamEventScopeResolving) {
    return eventScopeBootstrapScreen;
  }
  if (!isAuthenticated) {
    return (
      <div className="login-page-background relative grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_center,_#ffffff_20%,_#f0f9ff_66%,_#dbeafe_100%)] px-4 py-5 sm:p-6">
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-5 text-card-foreground shadow-xl backdrop-blur-sm transition-all duration-200 ease-in-out sm:p-6">
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

          <form className="space-y-4" onSubmit={submitPassword}>
            <p className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-center text-xs leading-5 text-slate-700">
              Melden Sie sich mit Ihrer persönlichen E-Mail-Adresse und Ihrem Passwort an.
              Ihre Berechtigungen erkennt MyCrewMate automatisch.
            </p>
            {loginNotice && (
              <div
                className="rounded-xl border border-emerald-300 bg-emerald-50/95 px-4 py-3 text-left text-sm leading-5 text-emerald-950 shadow-sm"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-semibold">Passwort erfolgreich gespeichert.</p>
                    <p className="text-xs leading-5 text-emerald-900">
                      {loginNotice} Nutzen Sie dafür Ihre persönliche E-Mail-Adresse und das gerade vergebene neue Passwort.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="personal-login-email" className="text-sm font-semibold text-slate-800">
                E-Mail-Adresse
              </Label>
              <Input
                id="personal-login-email"
                type="email"
                autoComplete="username"
                placeholder="beispiel@verein.de"
                value={loginEmail}
                onChange={event => {
                  setLoginEmail(event.target.value);
                  if (loginError) setLoginError(null);
                }}
                disabled={loginPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personal-login-password" className="text-sm font-semibold text-slate-800">
                Passwort
              </Label>
              <div className="relative">
                <Input
                  id="personal-login-password"
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
                  disabled={loginPending}
                  aria-describedby={
                    [
                      loginError ? "password-login-error" : "",
                      capsLockOn ? "password-caps-lock-warning" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex min-h-12 min-w-12 items-center justify-center rounded-r-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
                  aria-label={passwordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
                  aria-pressed={passwordVisible}
                  title={passwordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
                  disabled={loginPending}
                  onClick={() => setPasswordVisible(visible => !visible)}
                >
                  {passwordVisible ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
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
              className="h-12 w-full rounded-lg bg-blue-600 py-2.5 text-base font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-blue-700 hover:text-white hover:shadow-lg hover:shadow-blue-600/25 sm:hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:ring-blue-500 disabled:transform-none disabled:shadow-sm"
              size="lg"
              type="submit"
              disabled={!password || !loginEmail.trim() || loginPending}
              aria-describedby={loginError ? "password-login-error" : undefined}
            >
              {loginPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span role="status" aria-live="polite">Wird geprüft …</span></>
              ) : (
                <><KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />Anmelden</>
              )}
            </Button>
            {loginError && (
              <div
                ref={loginErrorRef}
                id="password-login-error"
                className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 shadow-sm"
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}
            {showCooldownHint && (
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
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs leading-5 text-amber-950">
                Planungsteam-Zugänge sind derzeit gesperrt. Persönliche Vereins-Administratoren können sich weiterhin anmelden.
              </p>
            )}
          </form>
        </div>
          <div className="absolute inset-x-4 bottom-3 text-center sm:bottom-4">
            <LegalFooterLinks onOpenImpressum={() => setImpressumOpen(true)} />
            <button
              type="button"
              className="text-xs text-muted-foreground/80 hover:text-foreground transition-colors underline-offset-4 hover:underline"
              onClick={() => setImpressumOpen(true)}
            >
              {COPYRIGHT_NOTICE}
            </button>
          </div>
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
        "min-h-screen bg-[radial-gradient(ellipse_at_center,_#ffffff_20%,_#f0f9ff_66%,_#dbeafe_100%)] flex flex-col lg:h-screen lg:overflow-hidden lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out lg:grid",
        isSidebarOpen
          ? "lg:grid-cols-[16rem_minmax(0,1fr)]"
          : "lg:grid-cols-[0px_minmax(0,1fr)]"
      )}
      data-sidebar-open={isSidebarOpen ? "true" : "false"}
      data-workspace-mode={isSidebarOpen ? "standard" : "focus"}
    >
      <FirstLoginOnboarding
        open={firstLoginOnboarding.data?.pending === true}
        name={firstLoginOnboarding.data?.name ?? user?.name ?? "Planungsteam"}
        isCoAdmin={firstLoginOnboarding.data?.isCoAdmin === true}
        completing={completeFirstLoginOnboarding.isPending}
        onComplete={finishFirstLoginOnboarding}
      />
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
              : [{ year, label: `Veranstaltungsjahr ${year}` }]
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
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-2.5 py-0.5 text-[10px] font-semibold text-blue-900 shadow-xs">
              <span className="truncate">{activeTenantName}</span>
              <span className="rounded bg-blue-600/15 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-blue-800">
                {activeTenantBadge}
              </span>
            </div>
          </SheetHeader>
          <div className="flex min-h-10 items-center justify-center border-y border-slate-200 bg-slate-50 px-3 py-1.5">
            <OnlinePresenceBadge
              counts={onlinePresence.counts}
              onOpenChat={openChatWidget}
              className="min-h-7 max-w-full"
            />
          </div>
          <div className="border-b p-3">
            {LOCAL_TENANT_SWITCHER_ENABLED && user?.role === "admin" && tenants.data && (
              <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 p-2.5">
                <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-950">
                  <Building2 className="h-3.5 w-3.5" /> Testmandant
                </Label>
                <Select value={tenantId} onValueChange={selectTenant}>
                  <SelectTrigger className="w-full bg-white text-sm font-semibold text-slate-950">
                    <SelectValue placeholder="Verein wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.data.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.status === "pilot" ? "Pilot" : "Muster"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] leading-4 text-blue-800">
                  Nur für interne Tests – keine offenen Vereinszugänge.
                </p>
              </div>
            )}
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
              </Label>
              {effectiveNavigationRole === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Weiteres Jahr anlegen"
                  onClick={openYearDialog}
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
                  : [{ year, label: `Veranstaltungsjahr ${year}` }]
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
              {effectiveNavigationRole === "admin" && (
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
                  className="mt-3 flex min-h-11 w-full min-w-0 items-center justify-start overflow-hidden border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                  onClick={() => void installPwa()}
                >
                  <img
                    {...logoLoading}
                    src={MYCREWMATE_ICON}
                    alt=""
                    aria-hidden="true"
                    className="mr-2 h-10 w-10 shrink-0 rounded-xl bg-white p-1.5 object-contain shadow-md"
                  />
                  <Download className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 whitespace-normal text-left text-sm leading-tight">
                    Als App speichern
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 flex min-h-11 w-full min-w-0 items-center justify-start overflow-hidden border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
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
                    className="mr-2 h-10 w-10 shrink-0 rounded-xl bg-white p-1.5 object-contain shadow-md"
                  />
                  <Download className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 whitespace-normal text-left text-sm leading-tight">
                    Als App speichern
                  </span>
                </Button>
              )
            )}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {visibleNavigationSections(effectiveNavigationRole, myPermissions.data, myModuleAccess.data).map(section => (
              <div key={section.id} className="space-y-1">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = location === href;
                  const access = active
                    ? activeNavigationAccess(
                        effectiveNavigationRole,
                        href,
                        myPermissions.data
                      )
                    : null;
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
                        navigationItemClasses(effectiveNavigationRole, href, active)
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1">{label}</span>
                      {access && <ActiveNavigationAccessIndicator access={access} />}
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
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-2.5 py-0.5 text-[10px] font-semibold text-blue-900 shadow-xs">
            <span className="truncate">{activeTenantName}</span>
            <span className="rounded bg-blue-600/15 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-blue-800">
              {activeTenantBadge}
            </span>
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
          {LOCAL_TENANT_SWITCHER_ENABLED && user?.role === "admin" && tenants.data && (
            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 p-2.5">
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-950">
                <Building2 className="h-3.5 w-3.5" /> Testmandant
              </Label>
              <Select value={tenantId} onValueChange={selectTenant}>
                <SelectTrigger className="w-full bg-white text-sm font-semibold text-slate-950">
                  <SelectValue placeholder="Verein wählen" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.data.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.status === "pilot" ? "Pilot" : "Muster"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] leading-4 text-blue-800">
                Nur für interne Tests – keine offenen Vereinszugänge.
              </p>
            </div>
          )}
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Veranstaltungsjahr
            </Label>
            {effectiveNavigationRole === "admin" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Weiteres Jahr anlegen"
                onClick={openYearDialog}
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
                : [{ year, label: `Veranstaltungsjahr ${year}` }]
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
            {effectiveNavigationRole === "admin" && (
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
          {visibleNavigationSections(effectiveNavigationRole, myPermissions.data, myModuleAccess.data).map(section => (
            <div key={section.id} className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = location === href;
                const access = active
                  ? activeNavigationAccess(
                      effectiveNavigationRole,
                      href,
                      myPermissions.data
                    )
                  : null;
                return (
                  <Link
                    key={href}
                    href={href}
                      onFocus={() => preloadRoute(href)}
                      onMouseEnter={() => preloadRoute(href)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                        navigationItemClasses(effectiveNavigationRole, href, active)
                      )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{label}</span>
                    {access && <ActiveNavigationAccessIndicator access={access} />}
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
                {effectiveRoleLabel}
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
                Angemeldet: {user.name} ({effectiveRoleLabel})
              </div>
            )}
          </div>
          {isReadOnlyPlanningAccess && (
            <aside
              data-slot="readonly-access-notice"
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3 text-sm text-sky-950 shadow-sm"
            >
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">Lesezugriff aktiv</p>
                <p className="mt-0.5 text-xs leading-5 text-sky-800">
                  Sie können die freigegebene Veranstaltung und den Team-Chat nutzen. Änderungen an Planungsdaten, Einstellungen oder Zugängen sind für diesen Zugang gesperrt.
                </p>
              </div>
            </aside>
          )}
          {children}
        </div>
      </main>

      <Dialog
        open={yearDialogOpen}
        onOpenChange={open => {
          setYearDialogOpen(open);
          if (!open) {
            setNewYearInitialEventName("");
            setNewYearInitialEventDays([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weiteres Veranstaltungsjahr anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-year-initial-event-name">
                Erste Veranstaltung
              </Label>
              <Input
                id="new-year-initial-event-name"
                value={newYearInitialEventName}
                placeholder="Name der Veranstaltung eingeben"
                onChange={event => setNewYearInitialEventName(event.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Aktive Veranstaltungstage
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WEEKDAYS.map(day => {
                  const checked = newYearInitialEventDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-950"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={value =>
                          setNewYearInitialEventDays(current =>
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
              {newYearInitialEventDays.length === 0 && (
                <p className="text-sm font-medium text-red-700">
                  Bitte mindestens einen Veranstaltungstag auswählen.
                </p>
              )}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Das Jahr wird ausschließlich mit Ihren Angaben angelegt. Weitere
              Veranstaltungen oder den Einsatzplan können Sie anschließend
              ergänzen oder aus einem Vorjahr übernehmen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                !Number.isInteger(newYear) ||
                newYear < 2020 ||
                newYear > 2100 ||
                newYearInitialEventName.trim().length < 2 ||
                newYearInitialEventDays.length === 0 ||
                createYear.isPending
              }
              onClick={() =>
                createYear.mutate({
                  year: newYear,
                  initialEventName: newYearInitialEventName,
                  activeDays: newYearInitialEventDays,
                })
              }
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
                    {item.startDate && item.endDate && (
                      <p className="text-xs text-muted-foreground">
                        Zum Entfernen des gespeicherten Zeitraums bitte die separate Löschaktion verwenden.
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
                      {item.startDate && item.endDate && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-slot="event-date-range-clear"
                          className="w-full border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 sm:w-auto"
                          disabled={updateEvent.isPending}
                          onClick={() =>
                            setClearEventDatesTarget({
                              id: item.id,
                              name: item.name,
                            })
                          }
                        >
                          Zeitraum löschen
                        </Button>
                      )}
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

      <AlertDialog
        open={Boolean(clearEventDatesTarget)}
        onOpenChange={open => {
          if (!open && !updateEvent.isPending) setClearEventDatesTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zeitraum wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der gespeicherte Zeitraum von „{clearEventDatesTarget?.name ?? ""}“ wird entfernt. Andere Veranstaltungsdaten bleiben unverändert erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateEvent.isPending}
              onClick={() => setClearEventDatesTarget(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!clearEventDatesTarget || updateEvent.isPending}
              onClick={() =>
                clearEventDatesTarget &&
                updateEvent.mutate({
                  id: clearEventDatesTarget.id,
                  startDate: null,
                  endDate: null,
                  clearDateRange: true,
                })
              }
            >
              Zeitraum löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        snapshotError={chatSnapshotError}
        eventName={selectedEvent?.name ?? null}
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
