import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

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
  return (
    <div
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium leading-none text-slate-700 shadow-xs",
        className
      )}
      role="status"
      aria-live="polite"
      title="Aktive Sitzungen mit einer Benutzeraktion innerhalb der letzten 10 Minuten"
    >
      <span
        className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
        aria-hidden="true"
      />
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
    </div>
  );
}
