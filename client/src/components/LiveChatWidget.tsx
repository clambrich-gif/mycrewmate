import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import {
  Badge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { shouldRenewTypingStatus } from "./live-chat-logic";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Maximize2,
  MessageSquare,
  Minus,
  Send,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const SESSION_NAME_STORAGE_PREFIX = "rsc-live-notes-sender-name-";
const SOUND_ENABLED_STORAGE_PREFIX = "rsc-live-notes-important-sound-";
const CUSTOM_NAME_VALUE = "__custom_name__";
const TYPING_IDLE_MS = 3_500;

export type LiveChatWidgetState = "closed" | "minimized" | "open";

export type TeamNoteItem = {
  id: number;
  year: number;
  eventId: number;
  senderUserId: number | null;
  senderName: string;
  senderRole: "user" | "admin";
  message: string;
  important?: boolean;
  createdAt: string | Date;
};

export type ActiveTyperItem = {
  sessionKey: string;
  senderName: string;
  senderRole: "user" | "admin";
  updatedAt: string | Date;
};

export type TeamNotesSnapshot = {
  notes: TeamNoteItem[];
  typing: ActiveTyperItem[];
};

export function formatNoteTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function roleBadgeText(role: "user" | "admin") {
  return role === "admin" ? "Admin" : "Planer";
}

export function LiveChatWidget({
  state,
  snapshot,
  snapshotInitialized,
  unreadCount,
  hasImportantUnread = false,
  onOpen,
  onMinimize,
  onClose,
  onRequestSnapshotRefresh,
}: {
  state: LiveChatWidgetState;
  snapshot: TeamNotesSnapshot;
  /** True erst nach dem ersten bestätigten Server-Snapshot des aktuellen Scopes. */
  snapshotInitialized: boolean;
  unreadCount: number;
  hasImportantUnread?: boolean;
  onOpen: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onRequestSnapshotRefresh: () => Promise<void>;
}) {
  const { user, isAuthenticated } = useAuth();
  const { year, eventId } = useEventYear();

  const [message, setMessage] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [importantSoundEnabled, setImportantSoundEnabled] = useState(false);
  const [selectedContactValue, setSelectedContactValue] = useState("");
  const [customName, setCustomName] = useState("");
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const typingMutation = trpc.notes.typing.useMutation();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const playedImportantNoteIdsRef = useRef<Set<number>>(new Set());
  const receivedInitialSnapshotRef = useRef(false);
  const typingDebounceTimerRef = useRef<number | null>(null);
  const typingMutateRef = useRef(typingMutation.mutate);
  const isTypingReportedRef = useRef(false);
  const typingLastRenewedAtRef = useRef(0);

  const storageKey = useMemo(
    () => `${SESSION_NAME_STORAGE_PREFIX}${year}-${eventId}`,
    [year, eventId]
  );
  const soundStorageKey = useMemo(
    () => `${SOUND_ENABLED_STORAGE_PREFIX}${year}-${eventId}`,
    [year, eventId]
  );

  const contactsQuery = trpc.contacts.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const contacts = useMemo(
    () => contactsQuery.data ?? [],
    [contactsQuery.data]
  );

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && stored.trim().length >= 2) {
        setConfirmedName(stored.trim());
      } else {
        setConfirmedName(null);
        setSelectedContactValue("");
        setCustomName("");
      }
    } catch {
      setConfirmedName(null);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      setImportantSoundEnabled(sessionStorage.getItem(soundStorageKey) === "on");
    } catch {
      setImportantSoundEnabled(false);
    }
  }, [soundStorageKey]);

  useEffect(() => {
    playedImportantNoteIdsRef.current.clear();
    receivedInitialSnapshotRef.current = false;
  }, [year, eventId]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  }, []);

  const playImportantAlertTone = useCallback(() => {
    if (!importantSoundEnabled || typeof window === "undefined") return;
    try {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      oscillator.addEventListener("ended", () => void context.close());
    } catch {
      // Browser kann Audio ohne vorherige Interaktion blockieren.
    }
  }, [importantSoundEnabled]);

  const toggleImportantSound = () => {
    const next = !importantSoundEnabled;
    setImportantSoundEnabled(next);
    try {
      sessionStorage.setItem(soundStorageKey, next ? "on" : "off");
    } catch {}
    if (next) {
      toast.success("Warnton für wichtige Durchsagen aktiviert");
      window.setTimeout(playImportantAlertTone, 0);
    } else {
      toast.message("Warnton für wichtige Durchsagen stummgeschaltet");
    }
  };

  useEffect(() => {
    typingMutateRef.current = typingMutation.mutate;
  }, [typingMutation.mutate]);

  const reportTyping = useCallback(
    (typingState: boolean, forceRenewal = false) => {
      if (!confirmedName) return;
      if (
        isTypingReportedRef.current === typingState &&
        !(typingState && forceRenewal)
      ) {
        return;
      }
      isTypingReportedRef.current = typingState;
      typingLastRenewedAtRef.current = typingState ? Date.now() : 0;
      typingMutateRef.current({
        senderName: confirmedName,
        isTyping: typingState,
      });
    },
    [confirmedName]
  );

  const handleMessageChange = (newText: string) => {
    setMessage(newText);
    if (!confirmedName) return;

    if (newText.trim().length > 0) {
      const now = Date.now();
      if (
        !isTypingReportedRef.current ||
        shouldRenewTypingStatus(typingLastRenewedAtRef.current, now)
      ) {
        // Der Server bereinigt Typing nach 8 Sekunden. Während fortlaufender
        // Eingabe erneuern wir gedrosselt spätestens alle 4 Sekunden.
        reportTyping(true, true);
      }
      if (typingDebounceTimerRef.current) {
        window.clearTimeout(typingDebounceTimerRef.current);
      }
      typingDebounceTimerRef.current = window.setTimeout(() => {
        reportTyping(false);
        typingDebounceTimerRef.current = null;
      }, TYPING_IDLE_MS);
    } else {
      if (typingDebounceTimerRef.current) {
        window.clearTimeout(typingDebounceTimerRef.current);
        typingDebounceTimerRef.current = null;
      }
      reportTyping(false);
    }
  };

  const sendMutation = trpc.notes.send.useMutation({
    onSuccess: newNote => {
      setMessage("");
      setIsImportant(false);
      reportTyping(false);
      scrollToBottom(true);
      // Der zentrale Layout-Owner liest nach jeder Mutation den kanonischen
      // Server-Snapshot. Damit sind Reihenfolge, Clear und Parallelupdates konsistent.
      void onRequestSnapshotRefresh();
    },
    onError: error => {
      toast.error(error.message || "Nachricht konnte nicht gesendet werden");
    },
  });

  const clearMutation = trpc.notes.clear.useMutation({
    onSuccess: result => {
      setClearDialogOpen(false);
      toast.success(`Chatverlauf geleert (${result.deletedCount} Notizen entfernt)`);
      void onRequestSnapshotRefresh();
    },
    onError: error => {
      toast.error(error.message || "Verlauf konnte nicht geleert werden");
    },
  });

  const saveIdentity = (e: FormEvent) => {
    e.preventDefault();
    const finalName =
      selectedContactValue === CUSTOM_NAME_VALUE
        ? customName.trim()
        : selectedContactValue.trim();

    if (finalName.length < 2) {
      toast.error("Bitte wähle deinen Namen aus oder trage einen Namen ein");
      return;
    }

    try {
      sessionStorage.setItem(storageKey, finalName);
    } catch {
      // SessionStorage evtl. restriktiv
    }
    setConfirmedName(finalName);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!confirmedName) return;
    const cleanText = message.trim();
    if (!cleanText || sendMutation.isPending) return;

    sendMutation.mutate({
      senderName: confirmedName,
      message: cleanText,
      important: isImportant,
    });
  };

  const isExpanded = state === "open";
  const isMinimized = state === "minimized";

  // Der zentrale Layout-Owner liefert genau einen serialisierten Snapshot für
  // alle Widgetzustände. Initial geladene 24h-Historie löst keinen Warnton aus.
  useEffect(() => {
    if (!snapshotInitialized) return;
    const isInitialSnapshot = !receivedInitialSnapshotRef.current;
    const newImportantNoteIds = snapshot.notes
      .filter(
        note => note.important && !playedImportantNoteIdsRef.current.has(note.id)
      )
      .map(note => note.id);
    snapshot.notes.forEach(note => playedImportantNoteIdsRef.current.add(note.id));
    receivedInitialSnapshotRef.current = true;

    if (!isInitialSnapshot && newImportantNoteIds.length > 0 && !isExpanded) {
      playImportantAlertTone();
    }
    if (isExpanded) scrollToBottom(true);
  }, [
    isExpanded,
    playImportantAlertTone,
    scrollToBottom,
    snapshot.notes,
    snapshotInitialized,
  ]);

  // Beim Schließen/Minimieren und beim vollständigen Unmount wird ein evtl.
  // laufendes Debounce verworfen und der flüchtige Tippstatus zuverlässig beendet.
  useEffect(() => {
    if (!isExpanded) {
      if (typingDebounceTimerRef.current) {
        window.clearTimeout(typingDebounceTimerRef.current);
        typingDebounceTimerRef.current = null;
      }
      reportTyping(false);
    }
  }, [isExpanded, reportTyping]);

  useEffect(() => {
    return () => {
      if (typingDebounceTimerRef.current) {
        window.clearTimeout(typingDebounceTimerRef.current);
        typingDebounceTimerRef.current = null;
      }
      if (isTypingReportedRef.current && confirmedName) {
        isTypingReportedRef.current = false;
        typingMutateRef.current({ senderName: confirmedName, isTyping: false });
      }
    };
  }, [confirmedName]);

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom(false);
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [isExpanded, scrollToBottom]);

  if (!isAuthenticated) return null;

  if (state === "closed") {
    const hasUnread = unreadCount > 0;
    return (
      <aside aria-label="Live-Notizen und Team-Chat">
        <Button
          type="button"
          onClick={onOpen}
          className={cn(
            "fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-6 z-40 flex h-16 w-16 min-h-16 min-w-16 items-center justify-center rounded-full border-2 border-white p-0 text-white shadow-2xl transition-[background-color,transform,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 motion-safe:hover:scale-105 md:bottom-8 md:right-8 md:h-20 md:w-20 md:min-h-20 md:min-w-20 md:border-[3px] md:shadow-[0_12px_28px_rgba(37,99,235,0.38)]",
            hasUnread
              ? hasImportantUnread
                ? "animate-pulse bg-red-600 ring-4 ring-red-400 hover:bg-red-700 focus-visible:ring-red-400"
                : "animate-pulse bg-red-600 ring-2 ring-red-300 hover:bg-red-700 focus-visible:ring-red-300"
              : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
          )}
          aria-label={
            unreadCount > 0
              ? `Team-Notizen öffnen (${unreadCount} ungelesene Nachrichten)`
              : "Team-Notizen & Live-Chat öffnen"
          }
          title="Live-Notizen & Team-Chat öffnen"
        >
          <MessageSquare className="h-7 w-7 md:!h-10 md:!w-10" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-2 -right-2 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-black text-white shadow-lg ring-2 ring-white md:-top-2.5 md:-right-2.5 md:h-9 md:min-w-9 md:px-2 md:text-sm md:ring-[3px]",
                hasImportantUnread ? "bg-red-700 ring-yellow-200" : "bg-red-600"
              )}
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </aside>
    );
  }

  // MINIMIERT: Schmale Statusleiste unten rechts
  if (isMinimized) {
    return (
      <aside
        aria-label="Minimierte Team-Notizen"
        className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] right-4 z-40 flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xl ring-1 ring-black/5 sm:bottom-4"
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 items-center gap-2 rounded-full px-2 py-1 text-left font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:min-h-8"
          aria-label="Team-Notizen maximieren"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
          </span>
          <span>Team-Notizen</span>
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white md:text-[10px]">
              <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
              <span>{unreadCount}</span>
              <span className="sr-only">ungelesene Notizen</span>
            </span>
          )}
        </button>
        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpen}
            className="h-11 w-11 text-slate-600 hover:text-slate-900 md:h-7 md:w-7"
            title="Fenster vergrößern"
            aria-label="Fenster vergrößern"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-11 w-11 text-slate-600 hover:text-red-600 md:h-7 md:w-7"
            title="Schließen"
            aria-label="Schließen"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>
    );
  }

  // GEÖFFNET: Picture-in-Picture Drawer / Floating Box
  return (
    <>
      <div
        role="dialog"
        aria-label="Live-Team-Notizen und Chat"
        aria-modal="false"
        className={cn(
          "fixed z-40 flex w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-white text-slate-950 shadow-2xl ring-1 ring-black/10 duration-200",
          // Mobile: Breitenfüllendes Bottom-Sheet, dessen dynamische Höhe über der Tastatur bleibt
          "inset-x-0 bottom-0 h-[85dvh] w-full max-h-[85vh] rounded-t-2xl border-t border-slate-200 [overscroll-behavior:contain] sm:inset-x-auto",
          // Desktop: Schwebendes PIP-Fenster unten rechts
          "sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[380px] sm:max-h-[85vh] sm:rounded-xl sm:border sm:border-slate-200"
        )}
      >
        {/* Header mit Titel, Badge & Fenster-Aktionen */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 sm:rounded-t-xl">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">
                Team-Notizen
              </h2>
              <p className="truncate text-[10px] text-slate-500">
                Live-Chat · 24h Speicher
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleImportantSound}
              className={cn(
                "h-9 w-9 border",
                importantSoundEnabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
              title={
                importantSoundEnabled
                  ? "Warnton für wichtige Durchsagen aktiv – zum Stummschalten klicken"
                  : "Warnton für wichtige Durchsagen stumm – zum Aktivieren klicken"
              }
              aria-label={
                importantSoundEnabled
                  ? "Warnton für wichtige Durchsagen stummschalten"
                  : "Warnton für wichtige Durchsagen aktivieren"
              }
              aria-pressed={importantSoundEnabled}
            >
              {importantSoundEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
            {user?.role === "admin" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setClearDialogOpen(true)}
                className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
                title="Verlauf für alle leeren (nur Admin)"
                aria-label="Verlauf leeren"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              className="h-8 w-8 text-slate-600 hover:bg-slate-200"
              title="Minimieren (⎯)"
              aria-label="Minimieren"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              title="Schließen (✕)"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* STEP 1: Name auswählen (falls in dieser Sitzung noch nicht gesetzt) */}
        {!confirmedName ? (
          <div className="flex flex-1 flex-col justify-center p-4">
            <div className="mx-auto w-full max-w-xs space-y-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Wer schreibt hier?
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Wähle deinen Namen aus den Ansprechpartnern dieser Veranstaltung
                  oder trage dich frei ein.
                </p>
              </div>

              <form onSubmit={saveIdentity} className="space-y-3 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="chat-contact-select" className="text-xs">
                    Name auswählen
                  </Label>
                  <Select
                    value={selectedContactValue}
                    onValueChange={setSelectedContactValue}
                  >
                    <SelectTrigger
                      id="chat-contact-select"
                      className="h-11 w-full bg-white text-base md:h-10 md:text-xs"
                    >
                      <SelectValue placeholder="Ansprechpartner wählen …" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {contacts.map(c => (
                        <SelectItem key={c.id} value={c.name} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_NAME_VALUE} className="text-xs font-semibold text-blue-700">
                        + Andere Person / Freie Eingabe
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedContactValue === CUSTOM_NAME_VALUE && (
                  <div className="space-y-1.5">
                    <Label htmlFor="chat-custom-name" className="text-xs">
                      Dein Name
                    </Label>
                    <Input
                      id="chat-custom-name"
                      placeholder="z. B. Max Mustermann"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      className="h-11 bg-white text-base md:h-9 md:text-xs"
                      autoFocus
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  disabled={
                    selectedContactValue === CUSTOM_NAME_VALUE
                      ? customName.trim().length < 2
                      : !selectedContactValue
                  }
                >
                  Bestätigen & Beitreten
                </Button>
              </form>
            </div>
          </div>
        ) : (
          /* STEP 2: Chat-Verlauf und Eingabezeile */
          <>
            {/* Kopfzeile mit aktuellem Absendernamen */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-1.5 text-[11px] text-slate-500">
              <span className="truncate">
                Angemeldet als:{" "}
                <strong className="text-slate-800">{confirmedName}</strong> (
                {roleBadgeText(user?.role ?? "user")})
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmedName(null);
                  try {
                    sessionStorage.removeItem(storageKey);
                  } catch {}
                }}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-base text-blue-700 hover:bg-blue-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:min-h-0 md:min-w-0 md:px-0 md:text-xs"
              >
                Ändern
              </button>
            </div>

            {/* Scrollbarer Nachrichtenbereich */}
            <div
              ref={scrollContainerRef}
              className="flex-1 space-y-2.5 overflow-y-auto p-3 text-sm sm:text-xs"
            >
              {snapshot.notes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                  <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
                  <p className="font-medium text-slate-600">Noch keine Notizen</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Schreibe eine kurze Live-Nachricht an das Planungsteam und die
                    Administratoren.
                  </p>
                </div>
              ) : (
                snapshot.notes.map(note => {
                  const isOwn =
                    note.senderName.trim().toLowerCase() ===
                    confirmedName.trim().toLowerCase();
                  return (
                    <div
                      key={note.id}
                      className={cn(
                        "flex flex-col gap-0.5",
                        isOwn ? "items-end" : "items-start"
                      )}
                    >
                      <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {note.senderName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1 py-0 text-[9px] font-normal leading-tight",
                            note.senderRole === "admin"
                              ? "border-purple-200 bg-purple-50 text-purple-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          )}
                        >
                          {roleBadgeText(note.senderRole)}
                        </Badge>
                        <span className="text-slate-400">
                          {formatNoteTime(note.createdAt)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-base sm:text-xs leading-relaxed break-words shadow-xs sm:px-3 sm:py-2",
                          isOwn
                            ? "bg-blue-600 text-white rounded-tr-xs"
                            : "bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200/70",
                          note.important &&
                            "border-2 border-red-500 bg-red-50 text-red-950 font-medium shadow-md shadow-red-100"
                        )}
                      >
                        {note.important && (
                          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold tracking-wide text-red-600 uppercase">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Wichtige Durchsage
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{note.message}</p>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Synchronisierter Tipp-Indikator */}
              {snapshot.typing.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs sm:text-[11px] text-blue-700">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600" />
                  </span>
                  <span className="font-medium italic">
                    {snapshot.typing.map(t => t.senderName).join(", ")} tippt gerade …
                  </span>
                </div>
              )}
            </div>

            {/* Eingabebereich unten */}
            <div className="sticky bottom-0 z-10 w-full shrink-0 border-t border-slate-200 bg-slate-50/95 px-4 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:bg-slate-50/70 sm:p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportant(prev => !prev)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1 rounded-md px-2 py-1 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:min-h-0 md:text-xs",
                    isImportant
                      ? "border border-red-300 bg-red-100 text-red-800"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  )}
                  title="Nachricht als wichtige Durchsage hervorheben"
                  aria-pressed={isImportant}
                >
                  <AlertTriangle
                    className={cn(
                      "h-3.5 w-3.5",
                      isImportant ? "text-red-600" : "text-slate-400"
                    )}
                  />
                  <span>{isImportant ? "Wichtig aktiv" : "[ ] Als Wichtig markieren"}</span>
                </button>
                {isImportant && (
                  <span className="text-[10px] font-semibold text-red-600 animate-pulse">
                    Löst bei allen aktiven Planern Warnsignal aus
                  </span>
                )}
              </div>
              <div className="flex w-full items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => handleMessageChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Notiz eingeben (Enter zum Senden) …"
                  className="min-h-12 min-w-0 flex-1 max-h-28 resize-none bg-white text-base leading-normal [-webkit-text-size-adjust:100%] [text-size-adjust:100%] xl:min-h-[40px]"
                  rows={1}
                />
                <Button
                  type="button"
                  size="icon"
                  disabled={!message.trim() || sendMutation.isPending}
                  onClick={handleSend}
                  className={cn(
                    "h-12 w-12 shrink-0 text-white transition-colors sm:h-10 sm:w-10",
                    isImportant
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                  aria-label="Nachricht senden"
                  title="Senden"
                >
                  <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Admin-Reset mit Passwort-Reauthentifizierung */}
      <AdminPasswordDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Team-Chatverlauf leeren?"
        description="Möchtest du alle Chat-Notizen dieser Veranstaltung unwiderruflich löschen? Diese Aktion wird auditiert und leert den Verlauf sofort bei allen Benutzern."
        confirmLabel="Verlauf leeren"
        busy={clearMutation.isPending}
        destructive
        onConfirm={adminPassword => {
          clearMutation.mutate({ adminPassword, scope: "current_event" });
        }}
      />
    </>
  );
}
