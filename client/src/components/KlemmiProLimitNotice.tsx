import { KlemmiMascot } from "@/components/KlemmiMascot";
import { CalendarDays, KeyRound, UsersRound } from "lucide-react";

type UsageMetric = {
  used: number;
  limit: number | null;
  percentage: number | null;
  available: boolean;
  context: string | null;
};

type KlemmiProLimitNoticeProps = {
  helpers: UsageMetric;
  personalAccesses: UsageMetric;
};

type WarningMetric = UsageMetric & {
  id: "helpers" | "personalAccesses";
  label: string;
  icon: typeof UsersRound;
};

/**
 * Kein Blocker: Klemmi informiert Pro-Administratoren frühzeitig, damit die
 * Planung nicht erst beim tatsächlichen Paketlimit unterbrochen wird.
 */
export function KlemmiProLimitNotice({
  helpers,
  personalAccesses,
}: KlemmiProLimitNoticeProps) {
  const warningMetrics: WarningMetric[] = [
    {
      ...helpers,
      id: "helpers",
      label: "Helfer in einer Veranstaltung",
      icon: UsersRound,
    },
    {
      ...personalAccesses,
      id: "personalAccesses",
      label: "persönliche Planungsteam-Zugänge",
      icon: KeyRound,
    },
  ].filter(
    (metric): metric is WarningMetric =>
      metric.available &&
      metric.limit !== null &&
      metric.percentage !== null &&
      metric.percentage >= 80
  );

  if (!warningMetrics.length) return null;

  return (
    <section
      data-slot="klemmi-pro-limit-notice"
      aria-label="Klemmis Hinweis zur Pro-Auslastung"
      className="relative overflow-hidden rounded-2xl border border-amber-300 bg-[radial-gradient(circle_at_92%_8%,rgba(254,215,170,0.72),transparent_34%),linear-gradient(135deg,#fff7ed,#fffbeb)] px-4 py-4 pr-24 text-amber-950 shadow-sm sm:px-5 sm:pr-32"
    >
      <div className="pointer-events-none absolute -bottom-7 right-1 size-28 sm:-bottom-9 sm:right-5 sm:size-36" aria-hidden="true">
        <KlemmiMascot decorative />
      </div>
      <div className="relative max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays className="size-4 text-amber-800" aria-hidden="true" />
          Klemmi behält das Pro-Kontingent im Blick
        </p>
        <p className="mt-1 text-sm leading-5 text-amber-900">
          Ihr habt mindestens 80&nbsp;% eines Pro-Limits erreicht. So bleibt genug Zeit,
          die weitere Planung gemeinsam abzustimmen.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {warningMetrics.map(metric => {
            const Icon = metric.icon;
            const percentage = metric.percentage ?? 0;
            return (
              <div key={metric.id} className="rounded-xl border border-amber-200 bg-white/75 p-3 shadow-xs">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <p className="text-xs font-semibold text-slate-800">{metric.label}</p>
                      <span className="text-xs font-bold tabular-nums text-amber-900">
                        {metric.used}/{metric.limit}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100" aria-label={`${percentage}% des Limits genutzt`}>
                      <div
                        className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-amber-900">
                      {metric.context ? `${metric.context} · ` : ""}{percentage}% genutzt
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
