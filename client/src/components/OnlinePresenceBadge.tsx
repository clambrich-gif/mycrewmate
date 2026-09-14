import { useAuth } from "@/_core/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const PRESENCE_POLL_MS = 60_000;
const ACTIVITY_HEARTBEAT_THROTTLE_MS = 30_000;

type OnlinePresenceCounts = {
  planningTeam: number;
  administrators: number;
};

export function useOnlinePresence() {
  const { isAuthenticated } = useAuth();
  const lastHeartbeatAt = useRef(0);
  const heartbeatPending = useRef(false);

  const status = trpc.presence.status.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: PRESENCE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 30_000,
  });
  const heartbeat = trpc.presence.heartbeat.useMutation({
    onSettled: () => {
      heartbeatPending.current = false;
    },
    onSuccess: () => {
      void status.refetch();
    },
  });
  const heartbeatRef = useRef(heartbeat.mutate);
  heartbeatRef.current = heartbeat.mutate;

  useEffect(() => {
    if (!isAuthenticated) return;
    const sendHeartbeat = (force = false) => {
      if (heartbeatPending.current) return;
      const now = Date.now();
      if (
        !force &&
        now - lastHeartbeatAt.current < ACTIVITY_HEARTBEAT_THROTTLE_MS
      ) {
        return;
      }
      lastHeartbeatAt.current = now;
      heartbeatPending.current = true;
      heartbeatRef.current();
    };
    sendHeartbeat(true);

    const recordActivity = () => sendHeartbeat();
    const recordVisibility = () => {
      if (document.visibilityState === "visible") sendHeartbeat(true);
    };

    document.addEventListener("pointerdown", recordActivity, { passive: true });
    document.addEventListener("keydown", recordActivity);
    document.addEventListener("scroll", recordActivity, {
      capture: true,
      passive: true,
    });
    document.addEventListener("visibilitychange", recordVisibility);
    return () => {
      document.removeEventListener("pointerdown", recordActivity);
      document.removeEventListener("keydown", recordActivity);
      document.removeEventListener("scroll", recordActivity, true);
      document.removeEventListener("visibilitychange", recordVisibility);
    };
  }, [isAuthenticated]);

  return {
    isAuthenticated,
    counts: status.data as OnlinePresenceCounts | undefined,
  };
}

export function OnlinePresenceBadge({
  counts,
  className,
}: {
  counts: OnlinePresenceCounts | undefined;
  className?: string;
}) {
  const previousCounts = useRef<OnlinePresenceCounts | null>(null);
  const [countsChanged, setCountsChanged] = useState(false);

  useEffect(() => {
    if (!counts) return;
    const previous = previousCounts.current;
    previousCounts.current = counts;
    if (
      !previous ||
      (previous.planningTeam === counts.planningTeam &&
        previous.administrators === counts.administrators)
    ) {
      return;
    }

    setCountsChanged(true);
    const timeout = window.setTimeout(() => setCountsChanged(false), 650);
    return () => window.clearTimeout(timeout);
  }, [counts?.administrators, counts?.planningTeam]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium leading-none text-slate-700 shadow-xs transition-[transform,box-shadow,border-color] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-emerald-300 hover:bg-emerald-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 lg:min-h-7",
            countsChanged &&
              "scale-[1.04] border-emerald-400 shadow-md shadow-emerald-100 ring-2 ring-emerald-200 motion-reduce:scale-100 motion-reduce:shadow-xs motion-reduce:ring-0",
            className
          )}
          aria-label="Online-Status und Erklärung anzeigen"
          title="Erklärung zum Online-Status anzeigen"
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100",
              countsChanged && "motion-safe:animate-pulse"
            )}
            aria-hidden="true"
          />
          <span role="status" aria-live="polite">
            {counts ? (
              <span className="whitespace-nowrap">
                Online: <strong>{counts.planningTeam}</strong> Planer
                <span className="px-1 text-slate-400" aria-hidden="true">
                  |
                </span>
                <strong>{counts.administrators}</strong> Admins
              </span>
            ) : (
              <span className="whitespace-nowrap">Online wird ermittelt …</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="z-50 w-[min(19rem,calc(100vw-1.5rem))] space-y-3 border border-slate-200 bg-white text-slate-900 opacity-100 shadow-lg"
      >
        <div>
          <p className="text-sm font-semibold">Wer wird als online gezählt?</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Als online gilt jede eindeutige Sitzung, in der innerhalb der letzten
            10 Minuten eine Benutzeraktion erfasst wurde.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-md bg-blue-50 px-3 py-2">
            <span className="font-medium text-blue-900">Planungsteam</span>
            <strong className="text-blue-950">
              {counts?.planningTeam ?? "–"} aktiv
            </strong>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-violet-50 px-3 py-2">
            <span className="font-medium text-violet-900">Administratoren</span>
            <strong className="text-violet-950">
              {counts?.administrators ?? "–"} aktiv
            </strong>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Die Anzeige nennt nur Anzahlen und keine Namen. Sitzungen ohne neue
          Aktivität verschwinden automatisch aus dem Zähler.
        </p>
      </PopoverContent>
    </Popover>
  );
}
