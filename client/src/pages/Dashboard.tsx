import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dashboardTargetHref,
  type DashboardTarget,
} from "@/lib/dashboard-target-filter";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CircleX,
  GitCompareArrows,
  ListTodo,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  eventWeekdays,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_SHORT_LABELS,
  type Weekday,
} from "@shared/weekdays";

type MetricCard = {
  label: string;
  value: number;
  badge: string | null;
  target?: DashboardTarget;
  urgency?: "orange" | "red";
  preparationBreakdown?: {
    offen: number;
    inBearbeitung: number;
    erledigt: number;
    abgelehnt: number;
  };
};

type MetricSection = {
  title: string;
  className: string;
  titleClassName: string;
  cards: MetricCard[];
};

type PriorityAction = {
  id: string;
  label: string;
  value: number;
  detail: string;
  tone: "red" | "orange" | "blue" | "green";
  icon: LucideIcon;
  target: DashboardTarget;
};

type DashboardDeadline = {
  taskId: number;
  task: string;
  category: string | null;
  contactName: string | null;
  dueText: string;
  dueIso: string;
  daysUntil: number;
  status: "offen" | "inArbeit" | "erledigt" | "abgelehnt";
};

type DailyReadiness = {
  day: "Freitag" | "Samstag" | "Sonntag";
  bedarf: number;
  besetzt: number;
  fehlend: number;
  quote: number;
};

const PRIORITY_TONE_CLASSES: Record<
  PriorityAction["tone"],
  { card: string; icon: string; value: string; action: string }
> = {
  red: {
    card: "border-red-300 bg-red-50/90 hover:border-red-500 hover:shadow-red-100",
    icon: "bg-red-100 text-red-700",
    value: "text-red-800",
    action: "text-red-700",
  },
  orange: {
    card: "border-amber-300 bg-amber-50/90 hover:border-amber-500 hover:shadow-amber-100",
    icon: "bg-amber-100 text-amber-700",
    value: "text-amber-800",
    action: "text-amber-800",
  },
  blue: {
    card: "border-blue-300 bg-blue-50/90 hover:border-blue-500 hover:shadow-blue-100",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-800",
    action: "text-blue-700",
  },
  green: {
    card: "border-emerald-300 bg-emerald-50/90 hover:border-emerald-500 hover:shadow-emerald-100",
    icon: "bg-emerald-100 text-emerald-700",
    value: "text-emerald-800",
    action: "text-emerald-700",
  },
};

function PriorityActionCard({
  action,
  openTarget,
}: {
  action: PriorityAction;
  openTarget: (target: DashboardTarget) => void;
}) {
  const Icon = action.icon;
  const tone = PRIORITY_TONE_CLASSES[action.tone];
  return (
    <button
      type="button"
      className="group min-h-24 min-w-0 rounded-xl text-left focus-visible:outline-none"
      aria-label={`${action.label}: ${action.detail}. Zugehörige Einträge anzeigen`}
      onPointerEnter={() => preloadRoute(action.target.path)}
      onFocus={() => preloadRoute(action.target.path)}
      onClick={() => openTarget(action.target)}
    >
      <Card
        className={`h-full min-w-0 border-l-4 text-slate-950 shadow-sm transition-[border-color,box-shadow,transform] duration-150 group-hover:shadow-md group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-offset-2 ${tone.card}`}
      >
        <CardContent className="flex min-h-24 items-center gap-3 p-3 sm:p-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <strong className={`text-2xl leading-none ${tone.value}`}>{action.value}</strong>
              <span className="text-sm font-bold uppercase tracking-wide text-slate-800">
                {action.label}
              </span>
            </span>
            <span className="mt-1 block break-words text-sm text-slate-600">
              {action.detail}
            </span>
          </span>
          <ArrowRight className={`size-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 ${tone.action}`} aria-hidden="true" />
        </CardContent>
      </Card>
    </button>
  );
}

function deadlineTimingLabel(daysUntil: number) {
  if (daysUntil < 0) {
    return daysUntil === -1
      ? "1 Tag überfällig"
      : `${Math.abs(daysUntil)} Tage überfällig`;
  }
  if (daysUntil === 0) return "Heute fällig";
  if (daysUntil === 1) return "Morgen fällig";
  return `In ${daysUntil} Tagen`;
}

function deadlineToneClass(deadline: DashboardDeadline) {
  if (deadline.status === "abgelehnt" || deadline.daysUntil < 0) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (deadline.daysUntil <= 14) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function UpcomingDeadlinesCard({
  deadlines,
  openTarget,
}: {
  deadlines: DashboardDeadline[];
  openTarget: (target: DashboardTarget) => void;
}) {
  if (deadlines.length === 0) return null;

  const target: DashboardTarget = { path: "/vorbereitung" };
  return (
    <Card
      data-dashboard-section="Nächste Fristen"
      className="border-blue-200 bg-white text-slate-950 shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 p-3 pb-2 sm:p-4 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <CalendarClock className="size-5 text-blue-700" aria-hidden="true" />
          Nächste Fristen
        </CardTitle>
        <span className="text-xs text-slate-600">
          Datierte Vorbereitungsaufgaben
        </span>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div className="divide-y divide-slate-100">
          {deadlines.map(deadline => (
            <button
              key={deadline.taskId}
              type="button"
              className="group flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-none"
              aria-label={`${deadline.dueText}: ${deadline.task}. ${deadlineTimingLabel(deadline.daysUntil)}. Vorbereitung öffnen`}
              onPointerEnter={() => preloadRoute(target.path)}
              onFocus={() => preloadRoute(target.path)}
              onClick={() => openTarget(target)}
            >
              <span
                className={`flex min-w-[5.35rem] shrink-0 flex-col rounded-lg border px-2 py-1 text-center ${deadlineToneClass(deadline)}`}
              >
                <span className="text-sm font-bold leading-tight">{deadline.dueText}</span>
                <span className="text-[11px] leading-tight">
                  {deadlineTimingLabel(deadline.daysUntil)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900" title={deadline.task}>
                  {deadline.task}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-600">
                  {[deadline.category, deadline.contactName]
                    .filter(Boolean)
                    .join(" · ") || "Ohne Bereich und Verantwortlichen"}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-blue-700 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackRateCard({
  assigned,
  confirmed,
  outstanding,
  rate,
  openTarget,
}: {
  assigned: number;
  confirmed: number;
  outstanding: number;
  rate: number;
  openTarget: (target: DashboardTarget) => void;
}) {
  const target: DashboardTarget = {
    path: "/helfer",
    confirmed: "nein",
    assigned: true,
  };
  const isActionable = assigned > 0 && outstanding > 0;
  const statusText =
    assigned === 0
      ? "Noch keine Helfer eingeteilt"
      : outstanding === 0
        ? "Alle eingeteilten Helfer bestätigt"
        : `${outstanding} noch ohne Rückmeldung`;

  const card = (
    <Card
      data-dashboard-section="Rückmeldequote"
      className={`h-full min-w-0 text-slate-950 shadow-sm ${
        outstanding > 0
          ? "border-blue-300 bg-blue-50/70"
          : "border-emerald-300 bg-emerald-50/70"
      } ${
        isActionable
          ? "transition-[border-color,box-shadow,transform] duration-150 group-hover:border-blue-500 group-hover:shadow-md group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-blue-500 group-focus-visible:ring-offset-2"
          : ""
      }`}
    >
      <CardContent className="flex min-h-44 items-center gap-4 p-4 sm:p-5">
        <span
          className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#16a34a ${rate}%, #dbeafe ${rate}% 100%)`,
          }}
          aria-label={`${rate} Prozent Rückmeldequote`}
        >
          <span className="flex size-[4.6rem] items-center justify-center rounded-full bg-white text-xl font-bold text-slate-950 shadow-sm">
            {rate}%
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UsersRound className="size-5 text-blue-700" aria-hidden="true" />
            Rückmeldequote
          </span>
          <span className="mt-1 block text-sm text-slate-700">
            <strong className="text-lg text-slate-950">{confirmed} / {assigned}</strong>{" "}
            eingeteilte Helfer bestätigt
          </span>
          <span
            className={`mt-2 flex items-center gap-1 text-sm font-semibold ${
              outstanding > 0 ? "text-blue-800" : "text-emerald-800"
            }`}
          >
            {statusText}
            {isActionable && <ArrowRight className="size-4" aria-hidden="true" />}
          </span>
        </span>
      </CardContent>
    </Card>
  );

  if (!isActionable) return card;
  return (
    <button
      type="button"
      className="group min-h-44 min-w-0 rounded-xl text-left focus-visible:outline-none"
      aria-label={`Rückmeldequote ${rate} Prozent: ${outstanding} eingeteilte Helfer noch ohne Rückmeldung. Gefilterte Helfer anzeigen`}
      onPointerEnter={() => preloadRoute(target.path)}
      onFocus={() => preloadRoute(target.path)}
      onClick={() => openTarget(target)}
    >
      {card}
    </button>
  );
}

function readinessTone(readiness: DailyReadiness) {
  if (readiness.bedarf === 0) {
    return {
      label: "Keine Schichten geplant",
      text: "text-slate-600",
      track: "bg-slate-200",
      fill: "bg-slate-400",
    };
  }
  if (readiness.fehlend === 0) {
    return {
      label: "Voll besetzt",
      text: "text-emerald-800",
      track: "bg-emerald-100",
      fill: "bg-emerald-500",
    };
  }
  if (readiness.quote >= 75) {
    return {
      label: `${readiness.fehlend} Helfer fehlen`,
      text: "text-amber-800",
      track: "bg-amber-100",
      fill: "bg-amber-500",
    };
  }
  return {
    label: `${readiness.fehlend} Helfer fehlen`,
    text: "text-red-800",
    track: "bg-red-100",
    fill: "bg-red-500",
  };
}

function DailyReadinessCard({
  readiness,
  openTarget,
}: {
  readiness: DailyReadiness[];
  openTarget: (target: DashboardTarget) => void;
}) {
  const target: DashboardTarget = { path: "/einsatzplan" };
  const hasPlannedShifts = readiness.some(day => day.bedarf > 0);
  const card = (
    <Card
      data-dashboard-section="Einsatzbereitschaft je Festivaltag"
      className="h-full border-emerald-300 bg-white text-slate-950 shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 p-3 pb-2 sm:p-4 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <UsersRound className="size-5 text-emerald-700" aria-hidden="true" />
          Einsatzbereitschaft je Festivaltag
        </CardTitle>
        <span className="text-xs text-slate-600">Besetzt / Bedarf</span>
      </CardHeader>
      <CardContent className="grid gap-4 p-3 pt-1 sm:grid-cols-3 sm:p-4 sm:pt-1">
        {readiness.map(day => {
          const tone = readinessTone(day);
          return (
            <div key={day.day} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-900">{day.day}</span>
                <span className="whitespace-nowrap text-sm font-bold text-slate-950">
                  {day.besetzt} / {day.bedarf}
                </span>
              </div>
              <div
                className={`mt-2 h-2.5 overflow-hidden rounded-full ${tone.track}`}
                role="progressbar"
                aria-label={`${day.day}: ${day.besetzt} von ${day.bedarf} Helferplätzen besetzt`}
                aria-valuemin={0}
                aria-valuemax={day.bedarf}
                aria-valuenow={Math.min(day.besetzt, day.bedarf)}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${tone.fill}`}
                  style={{ width: `${day.quote}%` }}
                />
              </div>
              <p className={`mt-1.5 text-xs font-semibold ${tone.text}`}>
                {tone.label}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  if (!hasPlannedShifts) return card;
  return (
    <button
      type="button"
      className="group min-h-44 min-w-0 rounded-xl text-left focus-visible:outline-none"
      aria-label="Einsatzbereitschaft je Festivaltag. Einsatzplan anzeigen"
      onPointerEnter={() => preloadRoute(target.path)}
      onFocus={() => preloadRoute(target.path)}
      onClick={() => openTarget(target)}
    >
      {card}
    </button>
  );
}

function PreparationMetricCardView({
  metric,
  openTarget,
}: {
  metric: MetricCard;
  openTarget: (target: DashboardTarget) => void;
}) {
  const breakdown = metric.preparationBreakdown;
  const target = metric.target;
  if (!breakdown || !target) return null;

  const statuses = [
    {
      label: "Offen",
      value: breakdown.offen,
      className: "border-amber-200 bg-amber-50 text-amber-950",
    },
    {
      label: "In Bearbeitung / Beantragt",
      value: breakdown.inBearbeitung,
      className: "border-blue-200 bg-blue-50 text-blue-950",
    },
    {
      label: "Erledigt / Genehmigt",
      value: breakdown.erledigt,
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    },
    {
      label: "Abgelehnt",
      value: breakdown.abgelehnt,
      className:
        breakdown.abgelehnt > 0
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-rose-200 bg-rose-50/70 text-rose-900",
    },
  ];

  return (
    <button
      type="button"
      className="group col-span-2 min-h-11 min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-none lg:col-span-1"
      aria-label={`Vorbereitung: Gesamt ${metric.value}. Vorbereitungsübersicht anzeigen`}
      onPointerEnter={() => preloadRoute(target.path)}
      onFocus={() => preloadRoute(target.path)}
      onClick={() => openTarget(target)}
    >
      <Card className="h-full min-w-0 border-amber-300 bg-white text-slate-950 shadow-sm transition-[border-color,box-shadow,transform] duration-150 group-hover:border-amber-500 group-hover:shadow-md group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-amber-500 group-focus-visible:ring-offset-2">
        <CardHeader className="flex min-w-0 flex-row items-baseline justify-between gap-2 p-3 pb-2 sm:p-4 sm:pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 sm:text-base">
            Vorbereitung
          </CardTitle>
          <span className="whitespace-nowrap text-xs font-medium text-slate-600">
            Gesamt: <strong className="text-base text-slate-950">{metric.value}</strong>
          </span>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          <div className="grid grid-cols-2 gap-2">
            {statuses.map(status => (
              <div
                key={status.label}
                className={`min-w-0 rounded-lg border px-2.5 py-2 ${status.className}`}
              >
                <p className="min-h-8 break-words text-[11px] font-medium leading-tight sm:text-xs">
                  {status.label}
                </p>
                <p className="mt-1 text-xl font-bold leading-none">{status.value}</p>
              </div>
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-800">
            Vorbereitungen anzeigen
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

function MetricCardView({
  metric,
  openTarget,
}: {
  metric: MetricCard;
  openTarget: (target: DashboardTarget) => void;
}) {
  if (metric.preparationBreakdown) {
    return <PreparationMetricCardView metric={metric} openTarget={openTarget} />;
  }
  const isEmpty = metric.value === 0;
  const interactiveCardClass =
    metric.urgency === "red"
      ? "border-red-300 bg-red-50/90 group-hover:border-red-500 group-hover:shadow-red-200/70 group-focus-visible:border-red-500 group-focus-visible:ring-red-500"
      : metric.urgency === "orange"
        ? "border-orange-300 bg-orange-50/90 group-hover:border-orange-500 group-hover:shadow-orange-200/70 group-focus-visible:border-orange-500 group-focus-visible:ring-orange-500"
        : "border-slate-200 bg-white group-hover:border-blue-400 group-hover:shadow-blue-100/80 group-focus-visible:border-blue-500 group-focus-visible:ring-blue-500";
  const actionClass =
    metric.urgency === "red"
      ? "text-red-700"
      : metric.urgency === "orange"
        ? "text-orange-700"
        : "text-blue-700";
  const card = (
    <Card
      className={`h-full min-w-0 text-slate-950 shadow-sm ${
        isEmpty
          ? "border-slate-200 bg-slate-100 text-slate-600"
          : metric.target
          ? `${interactiveCardClass} transition-[border-color,box-shadow,transform] duration-150 group-hover:shadow-md group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-offset-2`
          : "border-slate-200 bg-white"
      }`}
    >
      <CardHeader className="min-w-0 p-3 pb-1 sm:p-6 sm:pb-1">
        <CardTitle
          className="min-w-0 break-words text-xs leading-snug font-medium whitespace-normal text-slate-600 sm:text-sm"
        >
          {metric.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-wrap items-end justify-between gap-1 p-3 pt-0 sm:p-6 sm:pt-0">
        <span
          className={`text-2xl font-bold sm:text-3xl ${
            isEmpty ? "text-slate-600" : ""
          }`}
        >
          {metric.value}
        </span>
        <span className="flex flex-col items-end gap-1">
          {!isEmpty && metric.badge && <StatusBadge status={metric.badge} />}
          {!isEmpty && metric.target && (
            <span
              className={`flex items-center gap-1 text-[11px] font-semibold sm:text-xs ${actionClass}`}
            >
              Anzeigen
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </span>
      </CardContent>
    </Card>
  );

  const target = metric.target;
  if (!target || isEmpty) return card;

  return (
    <button
      type="button"
      className="group min-h-11 min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-none"
      aria-label={`${metric.label}: ${metric.value}. Gefilterte Einträge anzeigen`}
      onPointerEnter={() => preloadRoute(target.path)}
      onFocus={() => preloadRoute(target.path)}
      onClick={() => openTarget(target)}
    >
      {card}
    </button>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: s, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: helpers = [], isLoading: areHelpersLoading } =
    trpc.helpers.list.useQuery();
  const { data: currentEvent, isLoading: isEventLoading } =
    trpc.events.current.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const helperByName = new Map(helpers.map(helper => [helper.name, helper]));
  const zeroAvailability = (helperName: string, day: Weekday) => {
    const helper = helperByName.get(helperName);
    return helper?.[WEEKDAY_AVAILABILITY_FIELDS[day]];
  };
  if (isLoading || isEventLoading || areHelpersLoading || !s || !currentEvent)
    return <div className="text-muted-foreground">Lade Dashboard …</div>;

  const priorityActions: PriorityAction[] = [
    ...(s.ausfallGesamt > 0
      ? [
          {
            id: "ausfaelle",
            label: "Ausfälle",
            value: s.ausfallGesamt,
            detail: "Schichten sofort nachbesetzen",
            tone: "red" as const,
            icon: AlertTriangle,
            target: { path: "/einsatzplan", warning: "ausfaelle" } as const,
          },
        ]
      : []),
    ...(s.abgelehnteVorbereitung > 0
      ? [
          {
            id: "vorbereitung-abgelehnt",
            label: "Vorbereitung abgelehnt",
            value: s.abgelehnteVorbereitung,
            detail: "Blockierte Aufgabe zeitnah klären",
            tone: "red" as const,
            icon: CircleX,
            target: { path: "/vorbereitung", status: "abgelehnt" } as const,
          },
        ]
      : []),
    ...(s.doppelGesamt > 0
      ? [
          {
            id: "doppelbelegungen",
            label: "Doppelbelegungen",
            value: s.doppelGesamt,
            detail: "Zeitliche Konflikte prüfen",
            tone: "orange" as const,
            icon: GitCompareArrows,
            target: { path: "/einsatzplan", warning: "konflikte" } as const,
          },
        ]
      : []),
    ...(s.offen > 0
      ? [
          {
            id: "offene-schichten",
            label: "Offene Schichten",
            value: s.offen,
            detail: "Helferbedarf noch nicht gedeckt",
            tone: "red" as const,
            icon: AlertTriangle,
            target: { path: "/einsatzplan", status: "OFFEN" } as const,
          },
        ]
      : []),
    ...(s.knapp > 0
      ? [
          {
            id: "knappe-schichten",
            label: "Knapp besetzt",
            value: s.knapp,
            detail: "Besetzung vorsorglich absichern",
            tone: "orange" as const,
            icon: AlertTriangle,
            target: { path: "/einsatzplan", status: "KNAPP" } as const,
          },
        ]
      : []),
    ...(s.offeneVorbereitung > 0
      ? [
          {
            id: "offene-vorbereitung",
            label: "Offene Vorbereitungen",
            value: s.offeneVorbereitung,
            detail:
              s.vorbereitungInBearbeitung > 0
                ? `Weitere ${s.vorbereitungInBearbeitung} bereits in Arbeit`
                : "Aufgaben und Verantwortlichkeiten prüfen",
            tone: "orange" as const,
            icon: ClipboardList,
            target: { path: "/vorbereitung", status: "offen" } as const,
          },
        ]
      : []),
    ...(s.offeneNachbereitung > 0
      ? [
          {
            id: "offene-nachbereitung",
            label: "Offene Nachbereitungen",
            value: s.offeneNachbereitung,
            detail: "Restaufgaben abschließen",
            tone: "blue" as const,
            icon: ListTodo,
            target: { path: "/nachbereitung", status: "offen" } as const,
          },
        ]
      : []),
  ].slice(0, 4);

  const isShiftPlanStable =
    s.ausfallGesamt === 0 &&
    s.doppelGesamt === 0 &&
    s.offen === 0 &&
    s.knapp === 0;
  if (s.schichtenGesamt > 0 && isShiftPlanStable && priorityActions.length < 4) {
    priorityActions.push({
      id: "einsatzplan-stabil",
      label: "Einsatzplan stabil",
      value: s.ok,
      detail:
        s.ok === 1
          ? "1 Schicht vollständig besetzt"
          : `${s.ok} Schichten vollständig besetzt`,
      tone: "green",
      icon: CheckCircle2,
      target: { path: "/einsatzplan", status: "OK" },
    });
  }

  const upcomingDeadlines = s.naechsteVorbereitungsfristen as DashboardDeadline[];
  const dailyReadiness = s.taeglicheEinsatzbereitschaft as DailyReadiness[];

  const sections: MetricSection[] = [
    {
      title: "Einsatzplanung",
      className: "border-sky-300 bg-sky-50/90",
      titleClassName: "text-sky-950",
      cards: [
        { label: "Schichten gesamt", value: s.schichtenGesamt, badge: null },
        {
          label: "Offen",
          value: s.offen,
          badge: "OFFEN",
          target: { path: "/einsatzplan", status: "OFFEN" },
        },
        {
          label: "Knapp besetzt",
          value: s.knapp,
          badge: "KNAPP",
          target: { path: "/einsatzplan", status: "KNAPP" },
        },
        { label: "Voll besetzt", value: s.ok, badge: "OK" },
      ],
    },
    {
      title: "Helferbedarf & Belegung",
      className: "border-emerald-300 bg-emerald-50/90",
      titleClassName: "text-emerald-950",
      cards: [
        { label: "Helferbedarf", value: s.bedarfGesamt, badge: null },
        { label: "Besetzt", value: s.besetztGesamt, badge: null },
        { label: "Helfer gesamt", value: s.helferGesamt, badge: null },
        { label: "Bestätigt", value: s.helferBestaetigt, badge: null },
      ],
    },
    {
      title: "Aufgabenstatus",
      className: "border-amber-300 bg-amber-50/90",
      titleClassName: "text-amber-950",
      cards: [
        {
          label: "Vorbereitung",
          value: s.vorbereitungGesamt,
          badge: null,
          target: { path: "/vorbereitung" },
          preparationBreakdown: {
            offen: s.offeneVorbereitung,
            inBearbeitung: s.vorbereitungInBearbeitung,
            erledigt: s.vorbereitungErledigt,
            abgelehnt: s.abgelehnteVorbereitung,
          },
        },
        {
          label: "Offene Nachbereitung",
          value: s.offeneNachbereitung,
          badge: null,
          target: { path: "/nachbereitung", status: "offen" },
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Die wichtigsten nächsten Schritte stehen zuerst; alle Kennzahlen werden automatisch aus den Planungsdaten berechnet.
        </p>
      </div>

      <section
        data-dashboard-section="Heute priorisieren"
        className="rounded-2xl border border-slate-300 bg-slate-50/90 p-3 shadow-sm sm:p-4"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold tracking-wide text-slate-950 uppercase sm:text-base">
            Heute priorisieren
          </h2>
          <p className="text-xs text-slate-600 sm:text-sm">
            Nur Punkte mit direktem Handlungsbedarf
          </p>
        </div>
        {priorityActions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {priorityActions.map(action => (
              <PriorityActionCard
                key={action.id}
                action={action}
                openTarget={target => navigate(dashboardTargetHref(target))}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-24 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-emerald-950">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">Keine dringenden Punkte</p>
              <p className="text-sm text-emerald-800">
                Für die aktuelle Planung liegen keine offenen Warnungen vor.
              </p>
            </div>
          </div>
        )}
      </section>

      <DailyReadinessCard
        readiness={dailyReadiness}
        openTarget={target => navigate(dashboardTargetHref(target))}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {upcomingDeadlines.length > 0 && (
          <UpcomingDeadlinesCard
            deadlines={upcomingDeadlines}
            openTarget={target => navigate(dashboardTargetHref(target))}
          />
        )}
        <FeedbackRateCard
          assigned={s.helferEingeteilt}
          confirmed={s.helferEingeteiltBestaetigt}
          outstanding={s.helferEingeteiltUnbestaetigt}
          rate={s.rueckmeldequote}
          openTarget={target => navigate(dashboardTargetHref(target))}
        />
      </section>

      <div className="space-y-4">
        {sections.map(section => (
          <section
            key={section.title}
            data-dashboard-section={section.title}
            className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${section.className}`}
          >
            <h2
              className={`mb-3 text-sm font-extrabold tracking-wide uppercase sm:text-base ${section.titleClassName}`}
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {section.cards.map(metric => (
                <MetricCardView
                  key={metric.label}
                  metric={metric}
                  openTarget={target => navigate(dashboardTargetHref(target))}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Verantwortlichkeiten pro Ansprechpartner</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Ansprechpartner</th>
                  <th className="px-2 py-2 text-right">Helfer</th>
                  <th className="px-2 py-2 text-right">Vorb.</th>
                  <th className="px-2 py-2 text-right">Nachb.</th>
                  <th className="px-2 py-2 text-right">Mat.</th>
                  <th className="px-2 py-2 text-right">Mark.</th>
                  <th className="px-2 py-2 text-right">Genehm.</th>
                  <th className="py-2 pl-2 text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.verantwortlichkeiten.map(v => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="py-2 pr-3">{v.name}</td>
                    <td className="px-2 py-2 text-right">{v.betreuteHelfer}</td>
                    <td className="px-2 py-2 text-right">{v.vorbereitung}</td>
                    <td className="px-2 py-2 text-right">{v.nachbereitung}</td>
                    <td className="px-2 py-2 text-right">{v.material}</td>
                    <td className="px-2 py-2 text-right">{v.marketing}</td>
                    <td className="px-2 py-2 text-right">{v.genehmigungen}</td>
                    <td className="py-2 pl-2 text-right font-semibold">
                      {v.gesamt}
                    </td>
                  </tr>
                ))}
                {s.verantwortlichkeiten.length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={8}>
                      Noch keine Ansprechpartner angelegt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Helferauslastung (eingeteilte Schichten)</CardTitle>
            <div
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium sm:text-xs"
              aria-label="Legende: Null in Grün bedeutet verfügbar, Null in Rot bedeutet nicht verfügbar"
            >
              <span className="text-emerald-700">
                <strong>0</strong> = verfügbar
              </span>
              <span className="text-muted-foreground" aria-hidden="true">
                |
              </span>
              <span className="text-red-700">
                <strong>0</strong> = nicht verfügbar
              </span>
            </div>
          </CardHeader>
          <CardContent className="overflow-hidden px-3 sm:px-6">
            <table className="w-full table-fixed text-xs sm:text-sm">
              <colgroup>
                <col className="w-[36%]" />
                {activeDays.map(day => (
                  <col key={day} />
                ))}
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-1 sm:pr-2">Helfer</th>
                  {activeDays.map(day => (
                    <th
                      key={day}
                      className="px-0.5 py-2 text-right sm:px-1"
                      title={day}
                    >
                      {WEEKDAY_SHORT_LABELS[day]}
                    </th>
                  ))}
                  <th className="py-2 pl-0.5 text-right sm:pl-1">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.auslastung.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap py-2 pr-1 sm:pr-2"
                      title={a.name}
                    >
                      {a.name}
                    </td>
                    {activeDays.map(day => {
                      const value = a.byDay[day];
                      const availability = zeroAvailability(a.name, day);
                      const availabilityClass =
                        value !== 0
                          ? ""
                          : availability === "ja"
                            ? "font-semibold text-emerald-700"
                            : availability === "nein"
                              ? "font-semibold text-red-700"
                              : "";
                      const availabilityTitle =
                        value !== 0
                          ? undefined
                          : availability === "ja"
                            ? `${day}: verfügbar, noch keine Schicht`
                            : availability === "nein"
                              ? `${day}: nicht verfügbar`
                              : `${day}: Verfügbarkeit vielleicht`;
                      return (
                        <td
                          key={day}
                          className={`px-0.5 py-2 text-right tabular-nums sm:px-1 ${availabilityClass}`}
                          title={availabilityTitle}
                        >
                          {value}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-0.5 text-right font-semibold tabular-nums sm:pl-1">
                      {a.gesamt}
                    </td>
                  </tr>
                ))}
                {s.auslastung.length === 0 && (
                  <tr>
                    <td
                      className="py-3 text-muted-foreground"
                      colSpan={activeDays.length + 2}
                    >
                      Noch keine Helfer eingeteilt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
