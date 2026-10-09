import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KlemmiEventClosureRecommendation } from "@/components/KlemmiEventClosureRecommendation";
import { KlemmiUpgradeDialog } from "@/components/KlemmiUpgradeDialog";
import { KlemmiProLimitNotice } from "@/components/KlemmiProLimitNotice";
import { PersonalLocationMapCard } from "@/components/PersonalLocationMapCard";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { LocationMapCard } from "@/components/LocationMapCard";
import { PageTitle } from "@/components/PageTitle";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { useDashboardDetailsLayout } from "@/hooks/useDashboardDetailsLayout";
import { useMyTasksDefault } from "@/hooks/useMyTasksDefault";
import { dashboardDailyQuote } from "@/lib/daily-dashboard-quotes";
import {
  getKlemmiMuted,
  setKlemmiMuted as persistKlemmiMuted,
} from "@/lib/dashboard-klemmi-muted";
import {
  createDashboardKlemmiSteps,
  createPersonalDashboardKlemmiSteps,
} from "@/lib/dashboard-klemmi-tour";
import {
  dashboardTargetHref,
  type DashboardTarget,
} from "@/lib/dashboard-target-filter";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CalendarClock,
  BellRing,
  CheckCircle2,
  ClipboardList,
  CircleX,
  CircleUserRound,
  Gift,
  GitCompareArrows,
  ImageUp,
  ListTodo,
  LockKeyhole,
  Mail,
  Pin,
  ShieldCheck,
  UsersRound,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  eventWeekdays,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_SHORT_LABELS,
  type Weekday,
} from "@shared/weekdays";
import {
  eventCountdownState,
  type EventCountdownState,
} from "@shared/event-dates";
import {
  productAllowsCapability,
  type ProductPackageId,
} from "@shared/product-packages";
import { cn } from "@/lib/utils";

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
  day: Weekday;
  bedarf: number;
  besetzt: number;
  fehlend: number;
  quote: number;
  ungenutzteHelfer: number;
  teilzeitReserve: number;
  ungenutzteHelferIds: number[];
  teilzeitReserveIds: number[];
};

type PersonalDashboardTask = {
  id: number;
  scope: "Vorbereitung" | "Nachbereitung" | "Material" | "Marketing" | "Genehmigungen";
  title: string;
  detail: string | null;
  status: "open" | "in_progress" | "completed" | "rejected";
  href: string;
};

type PersonalDashboardData = {
  displayName: string;
  identityLinked: boolean;
  summary: {
    total: number;
    completed: number;
    open: number;
    inProgress: number;
    rejected: number;
    progress: number;
    allCompleted: boolean;
  };
  nextTasks: PersonalDashboardTask[];
  shifts: Array<{
    id: number;
    helperId: number;
    day: Weekday;
    area: string;
    task: string;
    startTime: string;
    endTime: string;
  }>;
  helpers: {
    total: number;
    firstContactOpen: number;
    feedbackOpen: number;
    assignedShifts: number;
    rows: Array<{
      id: number;
      name: string;
      assignedShifts: number;
      firstContactOpen: boolean;
      feedbackOpen: boolean;
      status: "first_contact_open" | "feedback_open" | "confirmed";
    }>;
  };
  locations: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    logoUrl: string | null;
    entries: Array<{
      section: "preparation" | "shifts" | "materials";
      label: string;
      status: string;
      critical: boolean;
      severity: "critical" | "warning" | "complete" | "neutral";
      href: string;
      actionLabel: string;
    }>;
  }>;
  planInformation: {
    eventId: number | null;
    eventName: string | null;
    eventYear: number | null;
    releasedAt: Date | string | null;
    outstanding: boolean;
    changed: boolean;
    assignedHelperCount: number;
  };
};

const PERSONAL_TASK_STATUS: Record<
  PersonalDashboardTask["status"],
  { label: string; className: string }
> = {
  open: {
    label: "offen",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  in_progress: {
    label: "in Arbeit",
    className: "border-blue-200 bg-blue-50 text-blue-900",
  },
  completed: {
    label: "erledigt",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  rejected: {
    label: "Klärung nötig",
    className: "border-red-200 bg-red-50 text-red-900",
  },
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
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <strong className={`text-2xl leading-none ${tone.value}`}>
                {action.value}
              </strong>
              <span className="text-sm font-bold uppercase tracking-wide text-slate-800">
                {action.label}
              </span>
            </span>
            <span className="mt-1 block break-words text-sm text-slate-600">
              {action.detail}
            </span>
          </span>
          <ArrowRight
            className={`size-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 ${tone.action}`}
            aria-hidden="true"
          />
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
      className="gap-0 border-blue-200 bg-white py-3 text-slate-950 shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <CalendarClock className="size-5 text-blue-700" aria-hidden="true" />
          Nächste Fristen
        </CardTitle>
        <span className="text-xs text-slate-600">
          Datierte Vorbereitungsaufgaben
        </span>
      </CardHeader>
      <CardContent className="px-3 pb-0 pt-1 sm:px-4 sm:pb-0 sm:pt-1">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {deadlines.map(deadline => (
            <button
              key={deadline.taskId}
              type="button"
              className="group flex min-h-24 min-w-0 flex-col items-stretch justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label={`${deadline.dueText}: ${deadline.task}. ${deadlineTimingLabel(deadline.daysUntil)}. Vorbereitung öffnen`}
              onPointerEnter={() => preloadRoute(target.path)}
              onFocus={() => preloadRoute(target.path)}
              onClick={() => openTarget(target)}
            >
              <span className="flex items-start justify-between gap-2">
                <span
                  className={`flex shrink-0 flex-col rounded-lg border px-2 py-1 text-center ${deadlineToneClass(deadline)}`}
                >
                  <span className="text-sm font-bold leading-tight">
                    {deadline.dueText}
                  </span>
                  <span className="text-[11px] leading-tight">
                    {deadlineTimingLabel(deadline.daysUntil)}
                  </span>
                </span>
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-blue-700 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block line-clamp-2 text-sm font-semibold leading-5 text-slate-900"
                  title={deadline.task}
                >
                  {deadline.task}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs leading-4 text-slate-600">
                  {[deadline.category, deadline.contactName]
                    .filter(Boolean)
                    .join(" · ") || "Ohne Bereich und Verantwortlichen"}
                </span>
              </span>
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
            <strong className="text-lg text-slate-950">
              {confirmed} / {assigned}
            </strong>{" "}
            eingeteilte Helfer bestätigt
          </span>
          <span
            className={`mt-2 flex items-center gap-1 text-sm font-semibold ${
              outstanding > 0 ? "text-blue-800" : "text-emerald-800"
            }`}
          >
            {statusText}
            {isActionable && (
              <ArrowRight className="size-4" aria-hidden="true" />
            )}
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

function FirstContactRateCard({
  total,
  contacted,
  outstanding,
  rate,
  openTarget,
}: {
  total: number;
  contacted: number;
  outstanding: number;
  rate: number;
  openTarget: (target: DashboardTarget) => void;
}) {
  const target: DashboardTarget = { path: "/helfer", firstContact: "offen" };
  const isActionable = total > 0 && outstanding > 0;
  const statusText =
    total === 0
      ? "Noch keine Helfer angelegt"
      : outstanding === 0
        ? "Alle Helfer wurden erstkontaktiert"
        : `${outstanding} Helfer noch ohne Erstkontakt`;

  const card = (
    <Card
      data-dashboard-section="Erstkontakt-Quote"
      className={`h-full min-w-0 border-blue-300 bg-blue-50/70 text-slate-950 shadow-sm ${
        isActionable
          ? "transition-[border-color,box-shadow,transform] duration-150 group-hover:border-blue-500 group-hover:shadow-md group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-blue-500 group-focus-visible:ring-offset-2"
          : ""
      }`}
    >
      <CardContent className="flex min-h-44 items-center gap-4 p-4 sm:p-5">
        <span
          className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#2563eb ${rate}%, #dbeafe ${rate}% 100%)`,
          }}
          aria-label={`${rate} Prozent Erstkontakt-Quote`}
        >
          <span className="flex size-[4.6rem] items-center justify-center rounded-full bg-white text-xl font-bold text-slate-950 shadow-sm">
            {rate}%
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UsersRound className="size-5 text-blue-700" aria-hidden="true" />
            Erstkontakt-Quote
          </span>
          <span className="mt-1 block text-sm text-slate-700">
            <strong className="text-lg text-slate-950">
              {contacted} / {total}
            </strong>{" "}
            Helfer kontaktiert
          </span>
          <span
            className={`mt-2 flex items-center gap-1 text-sm font-semibold ${
              outstanding > 0 ? "text-blue-800" : "text-emerald-800"
            }`}
          >
            {statusText}
            {isActionable && (
              <ArrowRight className="size-4" aria-hidden="true" />
            )}
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
      aria-label={`Erstkontakt-Quote ${rate} Prozent: ${outstanding} Helfer noch ohne Erstkontakt. Gefilterte Helfer anzeigen`}
      onPointerEnter={() => preloadRoute(target.path)}
      onFocus={() => preloadRoute(target.path)}
      onClick={() => openTarget(target)}
    >
      {card}
    </button>
  );
}

type DonationDashboardStats = {
  gesamt: number;
  kategorien: Array<{
    id: "kuchen" | "salat" | "snack" | "sonstiges";
    label: string;
    target: number;
    ist: number;
  }>;
  eigenschaften: {
    vegan: number;
    vegetarian: number;
    glutenFree: number;
    lactoseFree: number;
    containsNuts: number;
    sugarFree: number;
    containsAlcohol: number;
    meat: number;
  };
};

function CommunicationRateRow({
  title,
  value,
  total,
  outstanding,
  rate,
  tone,
  actionLabel,
  onClick,
}: {
  title: string;
  value: number;
  total: number;
  outstanding: number;
  rate: number;
  tone: "green" | "blue";
  actionLabel: string;
  onClick: () => void;
}) {
  const actionable = total > 0 && outstanding > 0;
  const accent = tone === "green" ? "#16a34a" : "#2563eb";
  const track = tone === "green" ? "#dcfce7" : "#dbeafe";
  const detail =
    total === 0
      ? "Noch keine Helfer erfasst"
      : outstanding === 0
        ? "Vollständig erledigt"
        : `${outstanding} noch offen`;
  const content = (
    <div className="flex min-h-20 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2">
      <span
        className="relative flex size-12 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${accent} ${rate}%, ${track} ${rate}% 100%)`,
        }}
        aria-label={`${rate} Prozent ${title}`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950 shadow-sm">
          {rate}%
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-bold text-slate-900">
          <UsersRound
            className={`size-3.5 ${tone === "green" ? "text-emerald-700" : "text-blue-700"}`}
            aria-hidden="true"
          />
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-700">
          <strong className="text-[13px] text-slate-950">
            {value} / {total}
          </strong>{" "}
          Helfer
        </span>
        <span
          className={`mt-0.5 block text-xs font-semibold ${tone === "green" ? "text-emerald-800" : "text-blue-800"}`}
        >
          {detail}
        </span>
      </span>
      {actionable && (
        <ArrowRight
          className={`size-4 shrink-0 ${tone === "green" ? "text-emerald-700" : "text-blue-700"}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
  if (!actionable) return content;
  return (
    <button
      type="button"
      className="group w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      aria-label={`${title}: ${detail}. ${actionLabel}`}
      onPointerEnter={() => preloadRoute("/helfer")}
      onFocus={() => preloadRoute("/helfer")}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function HelperStatusCommunicationCard({
  assigned,
  confirmed,
  feedbackOutstanding,
  feedbackRate,
  total,
  contacted,
  contactOutstanding,
  contactRate,
  openTarget,
}: {
  assigned: number;
  confirmed: number;
  feedbackOutstanding: number;
  feedbackRate: number;
  total: number;
  contacted: number;
  contactOutstanding: number;
  contactRate: number;
  openTarget: (target: DashboardTarget) => void;
}) {
  return (
    <Card
      data-dashboard-section="Helfer-Status & Kommunikation"
      className="h-full gap-2 border-blue-300 bg-blue-50/55 py-2.5 text-slate-950 shadow-sm"
    >
      <CardHeader className="px-3 py-2 sm:px-4 sm:py-2.5">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <UsersRound className="size-5 text-blue-700" aria-hidden="true" />
          Helfer-Status & Kommunikation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-3">
        <CommunicationRateRow
          title="Rückmeldequote"
          value={confirmed}
          total={assigned}
          outstanding={feedbackOutstanding}
          rate={feedbackRate}
          tone="green"
          actionLabel="Unbestätigte Helfer anzeigen"
          onClick={() =>
            openTarget({ path: "/helfer", confirmed: "nein", assigned: true })
          }
        />
        <CommunicationRateRow
          title="Erstkontakt-Quote"
          value={contacted}
          total={total}
          outstanding={contactOutstanding}
          rate={contactRate}
          tone="blue"
          actionLabel="Helfer ohne Erstkontakt anzeigen"
          onClick={() => openTarget({ path: "/helfer", firstContact: "offen" })}
        />
      </CardContent>
    </Card>
  );
}

function DonationSummaryCard({
  donations,
  openDonations,
}: {
  donations: DonationDashboardStats;
  openDonations: () => void;
}) {
  const targetCategories = donations.kategorien.filter(
    category => category.id !== "sonstiges"
  );
  const sonstiges = donations.kategorien.find(
    category => category.id === "sonstiges"
  );
  const traitTags = [
    [
      "🌱 Vegan",
      donations.eigenschaften.vegan,
      "border-emerald-200 bg-emerald-50 text-emerald-800",
    ],
    [
      "🥦 Vegetarisch",
      donations.eigenschaften.vegetarian,
      "border-lime-200 bg-lime-50 text-lime-900",
    ],
    [
      "🌾 Glutenfrei",
      donations.eigenschaften.glutenFree,
      "border-amber-200 bg-amber-50 text-amber-900",
    ],
    [
      "🥛 Laktosefrei",
      donations.eigenschaften.lactoseFree,
      "border-sky-200 bg-sky-50 text-sky-800",
    ],
    [
      "🥜 Nüsse",
      donations.eigenschaften.containsNuts,
      "border-orange-200 bg-orange-50 text-orange-900",
    ],
    [
      "🍬 Zuckerfrei",
      donations.eigenschaften.sugarFree,
      "border-pink-200 bg-pink-50 text-pink-900",
    ],
    [
      "🍷 Alkohol",
      donations.eigenschaften.containsAlcohol,
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
    ],
    [
      "🥩 Fleischhaltig",
      donations.eigenschaften.meat,
      "border-rose-200 bg-rose-50 text-rose-800",
    ],
  ] as const;
  return (
    <Card
      data-dashboard-section="Verpflegungsspenden"
      className="h-full gap-2 border-rose-200 bg-rose-50/45 py-2.5 text-slate-950 shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5">
        <button
          type="button"
          className="group flex min-w-0 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
          aria-label="Verpflegungsspenden verwalten"
          onPointerEnter={() => preloadRoute("/spenden")}
          onFocus={() => preloadRoute("/spenden")}
          onClick={openDonations}
        >
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Gift className="size-5 text-rose-700" aria-hidden="true" />
            Verpflegungsspenden
          </CardTitle>
          <ArrowRight
            className="size-4 shrink-0 text-rose-700 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
        <span className="text-xs text-slate-600">
          Gesamt: {donations.gesamt} erfasst
        </span>
      </CardHeader>
      <CardContent className="grid gap-3 px-3 pb-3 pt-0 sm:px-4 sm:pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.8fr)]">
        <div className="space-y-1.5">
          {targetCategories.map(category => {
            const completion =
              category.target > 0 ? (category.ist / category.target) * 100 : 0;
            const quote = Math.min(100, Math.round(completion));
            const progressTone =
              completion >= 100
                ? {
                    name: "erreicht",
                    track: "bg-emerald-100",
                    fill: "bg-emerald-500",
                  }
                : completion >= 80
                  ? {
                      name: "fast-erreicht",
                      track: "bg-amber-100",
                      fill: "bg-amber-400",
                    }
                  : {
                      name: "offen",
                      track: "bg-rose-100",
                      fill: "bg-rose-500",
                    };
            const text =
              category.target > 0
                ? `${category.ist} / ${category.target}`
                : `${category.ist} / –`;
            return (
              <div key={category.id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-slate-800">
                    {category.label}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-950">
                    {text}
                  </span>
                </div>
                <div
                  className={`mt-1 h-1.5 overflow-hidden rounded-full ${progressTone.track}`}
                  role="progressbar"
                  aria-label={`${category.label}: ${category.ist} von ${category.target || 0} Spenden erfasst`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(category.target, 1)}
                  aria-valuenow={Math.min(
                    category.ist,
                    Math.max(category.target, 1)
                  )}
                  data-progress-tone={progressTone.name}
                >
                  <div
                    className={`h-full rounded-full ${progressTone.fill} transition-[width] duration-200`}
                    style={{ width: `${quote}%` }}
                  />
                </div>
              </div>
            );
          })}
          {sonstiges && (
            <p className="pt-0.5 text-[11px] text-slate-600">
              📦 Sonstiges: {sonstiges.ist} erfasst
            </p>
          )}
          {targetCategories.every(category => category.target === 0) && (
            <p className="text-[11px] text-slate-500">
              Sollwerte können in der Spendenübersicht festgelegt werden.
            </p>
          )}
        </div>
        <div className="border-t border-rose-200 pt-2 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Eigenschaften
          </p>
          <div className="flex flex-wrap gap-1">
            {traitTags.map(([label, value, className]) => (
              <span
                key={label}
                className={`rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${className}`}
              >
                {label}: {value}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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

function readinessGridClass(dayCount: number) {
  if (dayCount <= 1) return "grid grid-cols-1 gap-3";
  if (dayCount === 2) return "grid grid-cols-1 gap-3 md:grid-cols-2";
  if (dayCount === 3)
    return "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3";
  return "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4";
}

function DailyReadinessCard({
  readiness,
  openTarget,
  onPotentialFilter,
}: {
  readiness: DailyReadiness[];
  openTarget: (target: DashboardTarget) => void;
  onPotentialFilter: (
    day: DailyReadiness["day"],
    kind: "ungenutzt" | "teilzeit"
  ) => void;
}) {
  const target: DashboardTarget = { path: "/einsatzplan" };
  return (
    <Card
      data-dashboard-section="Einsatzbereitschaft je Festivaltag"
      className="h-full gap-2 border-emerald-300 bg-white py-2.5 text-slate-950 shadow-sm"
    >
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5">
        <button
          type="button"
          className="group flex min-w-0 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          aria-label="Einsatzbereitschaft je Festivaltag. Einsatzplan anzeigen"
          onPointerEnter={() => preloadRoute(target.path)}
          onFocus={() => preloadRoute(target.path)}
          onClick={() => openTarget(target)}
        >
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <UsersRound
              className="size-5 text-emerald-700"
              aria-hidden="true"
            />
            Einsatzbereitschaft je Festivaltag
          </CardTitle>
          <ArrowRight
            className="size-4 shrink-0 text-emerald-700 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
        <span className="text-xs text-slate-600">Besetzt / Bedarf</span>
      </CardHeader>
      <CardContent
        className={`${readinessGridClass(readiness.length)} px-3 pb-3 pt-0 sm:px-4 sm:pb-3`}
      >
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
                className={`mt-1.5 h-2 overflow-hidden rounded-full ${tone.track}`}
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
              <p className={`mt-1 text-xs font-semibold ${tone.text}`}>
                {tone.label}
              </p>
              <div className="mt-1.5 grid gap-0.5 border-t border-slate-200 pt-1.5 text-xs">
                <button
                  type="button"
                  disabled={day.ungenutzteHelfer === 0}
                  className="flex min-h-6 items-baseline justify-between gap-2 rounded text-left text-violet-800 transition-colors hover:text-violet-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-default disabled:text-slate-500"
                  aria-label={`${day.day}: ${day.ungenutzteHelfer} komplett ungenutzte Helfer anzeigen`}
                  onClick={() => onPotentialFilter(day.day, "ungenutzt")}
                >
                  <span>Komplett ungenutzt</span>
                  <strong className="tabular-nums">
                    {day.ungenutzteHelfer}
                  </strong>
                </button>
                <button
                  type="button"
                  disabled={day.teilzeitReserve === 0}
                  className="flex min-h-6 items-baseline justify-between gap-2 rounded text-left text-blue-800 transition-colors hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default disabled:text-slate-500"
                  aria-label={`${day.day}: ${day.teilzeitReserve} Teilzeit-Reserve anzeigen`}
                  onClick={() => onPotentialFilter(day.day, "teilzeit")}
                >
                  <span>Teilzeit-Reserve</span>
                  <strong className="tabular-nums">
                    {day.teilzeitReserve}
                  </strong>
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const DEFAULT_DASHBOARD_COUNTER_LOGO =
  "/brand/dashboard-counter-default-logo.png";
const MAX_EVENT_LOGO_BYTES = 3_000_000;

function EventCountdownWidget({
  event,
  packageId,
}: {
  event: {
    id: number;
    year: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    pdfLogoKey?: string | null;
  };
  packageId: ProductPackageId;
}) {
  const { user } = useAuth();
  const isPublicDemoSession =
    user?.openId.startsWith("tenant-admin:demo-session-") === true;
  const { isTenantAdmin: canManageLogo } = useTenantAdministration();
  const allowsCustomBranding = productAllowsCapability(
    packageId,
    "custom_branding"
  );
  const canManageEventLogo =
    !isPublicDemoSession && canManageLogo && allowsCustomBranding;
  const canInteractWithEventLogo = !isPublicDemoSession && canManageLogo;
  const [upgradeCapability, setUpgradeCapability] = useState<
    "custom_branding" | null
  >(null);
  const utils = trpc.useUtils();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const quoteViewportRef = useRef<HTMLDivElement>(null);
  const quoteTextRef = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [quoteDistance, setQuoteDistance] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    setLogoLoadFailed(false);
  }, [event.pdfLogoKey]);

  const state: EventCountdownState = eventCountdownState(
    { startDate: event.startDate, endDate: event.endDate },
    now
  );
  const uploadLogo = trpc.pdf.uploadLogo.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.events.current.invalidate(),
        utils.pdf.settings.invalidate(),
      ]);
      toast.success("Eventlogo für Dashboard und PDFs gespeichert");
    },
    onError: error => toast.error(error.message),
  });
  const showEventLogo =
    allowsCustomBranding && Boolean(event.pdfLogoKey) && !logoLoadFailed;
  const logoSrc = showEventLogo
    ? `/api/pdf/event-image/${event.year}/${event.id}`
    : DEFAULT_DASHBOARD_COUNTER_LOGO;
  const quote = dashboardDailyQuote(now);
  const isUrgent = state.kind === "upcoming" && state.days < 14;

  useLayoutEffect(() => {
    const viewport = quoteViewportRef.current;
    const text = quoteTextRef.current;
    if (!viewport || !text) return;

    const updateQuoteMotion = () => {
      const distance = Math.ceil(viewport.clientWidth + text.scrollWidth);
      setQuoteDistance(current => (current === distance ? current : distance));
    };

    updateQuoteMotion();
    const observer = new ResizeObserver(updateQuoteMotion);
    observer.observe(viewport);
    observer.observe(text);
    return () => observer.disconnect();
  }, [quote]);

  const quoteTrackStyle = {
    "--dashboard-daily-quote-distance": `-${quoteDistance}px`,
    "--dashboard-daily-quote-duration": "19s",
  } as CSSProperties;

  const selectLogo = () => {
    if (!canInteractWithEventLogo || uploadLogo.isPending) return;
    if (!allowsCustomBranding) {
      setUpgradeCapability("custom_branding");
      return;
    }
    logoInputRef.current?.click();
  };
  const onLogoSelected = (file?: File) => {
    if (!allowsCustomBranding) {
      setUpgradeCapability("custom_branding");
      return;
    }
    if (!file) return;
    if (!(file.type === "image/png" || file.type === "image/jpeg")) {
      toast.error("Bitte ein PNG- oder JPEG-Logo auswählen");
      return;
    }
    if (file.size > MAX_EVENT_LOGO_BYTES) {
      toast.error("Das Eventlogo darf höchstens 3 MB groß sein");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",", 2)[1];
      if (!base64) {
        toast.error("Das Eventlogo konnte nicht gelesen werden");
        return;
      }
      uploadLogo.mutate({
        base64,
        mimeType: file.type as "image/png" | "image/jpeg",
      });
    };
    reader.onerror = () =>
      toast.error("Das Eventlogo konnte nicht gelesen werden");
    reader.readAsDataURL(file);
  };

  const counterContent = (() => {
    if (state.kind === "upcoming") {
      return (
        <p className="flex items-baseline justify-start gap-1.5 whitespace-nowrap font-black tracking-[-0.055em]">
          <span className="text-sm font-extrabold tracking-[-0.035em] text-slate-950">
            nur noch
          </span>
          <span className="text-[2.45rem] leading-none tabular-nums text-blue-600 sm:text-[2.55rem]">
            {state.days}
          </span>
          <span className="text-lg font-black text-orange-500">
            {state.days === 1 ? "Tag" : "Tage"}
          </span>
        </p>
      );
    }
    if (state.kind === "live") {
      return (
        <p className="text-center text-base font-black tracking-[-0.035em] text-emerald-800">
          Event läuft · Tag {state.day}/{state.totalDays}
        </p>
      );
    }
    if (state.kind === "completed") {
      return (
        <p className="text-center text-base font-black tracking-[-0.035em] text-slate-600">
          Event abgeschlossen
        </p>
      );
    }
    return (
      <p className="flex items-center justify-center gap-1.5 text-center text-sm font-bold leading-snug text-slate-600">
        <Calendar
          className="size-4 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        Zeitraum im Event einstellen
      </p>
    );
  })();

  return (
    <>
      <section
        data-slot="event-countdown"
        data-countdown-state={state.kind}
        data-countdown-urgent={isUrgent ? "true" : "false"}
        className={`dashboard-event-countdown w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md shadow-slate-200/70${isUrgent ? " countdown-urgent" : ""}`}
        aria-label="Event-Zähler mit Tagesimpuls"
      >
        <div className="grid min-h-[3.95rem] grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-1 bg-gradient-to-r from-sky-50 via-white to-orange-50 px-2 py-1.5">
          {!isPublicDemoSession && <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={event => {
              onLogoSelected(event.target.files?.[0]);
              event.target.value = "";
            }}
          />}
          <button
            type="button"
            className="group relative mx-auto grid size-[3.4rem] place-items-center overflow-hidden rounded-full border border-black/35 bg-white shadow-sm transition-transform duration-150 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default disabled:hover:scale-100"
            onClick={selectLogo}
            disabled={!canInteractWithEventLogo || uploadLogo.isPending}
            title={
              isPublicDemoSession
                ? "Eventlogo der Testdemo – Upload deaktiviert"
                : canManageEventLogo
                ? "Eventlogo für Dashboard und PDFs ändern"
                : canManageLogo
                    ? "Eigenes Eventlogo ab Pro verfügbar"
                    : "Eventlogo dieser Veranstaltung"
            }
            aria-label={
              isPublicDemoSession
                ? "Eventlogo der Testdemo – Upload deaktiviert"
                : canManageEventLogo
                ? "Eventlogo für Dashboard und PDFs ändern"
                : canManageLogo
                    ? "Eigenes Eventlogo ab Pro verfügbar"
                    : "Eventlogo dieser Veranstaltung"
            }
          >
            <img
              src={logoSrc}
              alt="Eventlogo"
              className="size-[3.05rem] object-contain"
              onError={() => setLogoLoadFailed(true)}
            />
            {canInteractWithEventLogo && (
              <span className="absolute inset-0 grid place-items-center bg-blue-950/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {canManageEventLogo ? (
                  <ImageUp className="size-4" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="size-4" aria-hidden="true" />
                )}
              </span>
            )}
          </button>
          <div className="min-w-0">{counterContent}</div>
        </div>
        <div
          ref={quoteViewportRef}
          className="dashboard-daily-quote-viewport relative flex h-8 items-center overflow-hidden border-t border-slate-200 bg-slate-50 text-base text-slate-600"
        >
          <div
            style={quoteTrackStyle}
            className="dashboard-daily-quote-track flex min-w-max items-center whitespace-nowrap font-medium leading-none"
          >
            <span ref={quoteTextRef} className="dashboard-daily-quote-segment">
              {quote}
            </span>
          </div>
        </div>
      </section>
      <KlemmiUpgradeDialog
        open={Boolean(upgradeCapability)}
        onOpenChange={open => {
          if (!open) setUpgradeCapability(null);
        }}
        currentPackageId={packageId}
        capability={upgradeCapability}
      />
    </>
  );
}

function PilotTenantInfoCard({
  tenant,
  eventName,
  showSupport,
}: {
  tenant: { name: string; contactEmail: string; supportEmail: string };
  eventName: string;
  showSupport: boolean;
}) {
  return (
    <section
      data-dashboard-section="Pilotbetrieb"
      className="overflow-hidden rounded-2xl border border-blue-200 bg-white text-slate-950 shadow-sm"
    >
      <div className="grid gap-4 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100/80 px-2.5 py-1 text-xs font-bold text-blue-900">
              <Building2 className="size-3.5" aria-hidden="true" />
              {tenant.name}
            </span>
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
              Pilotbetrieb
            </span>
          </div>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
            Gemeinsam testen. Sicher weiterentwickeln.
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-700">
            {tenant.name} nutzt MyCrewMate als geschlossenen Pilotverein. Die
            aktuelle Veranstaltung <strong>{eventName}</strong> dient als Test-
            und Demoplanung; es gibt keine offenen Zugänge, keine Abrechnung und
            keine öffentliche Buchungsfunktion.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[22rem] lg:grid-cols-1">
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Building2
              className="size-4 shrink-0 text-blue-700"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              Pilotkontakt: {tenant.contactEmail}
            </span>
          </a>
          {showSupport && <a
            href={`mailto:${tenant.supportEmail}`}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Mail
              className="size-4 shrink-0 text-blue-700"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              Pilot-Support: {tenant.supportEmail}
            </span>
          </a>}
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <ShieldCheck
              className="size-4 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>Keine Bezahl- oder Freischaltfunktion aktiv</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonalDashboardContent({
  data,
  onOpen,
  onPlanInformationConfirmed,
}: {
  data: PersonalDashboardData;
  onOpen: (href: string) => void;
  onPlanInformationConfirmed: () => void;
}) {
  const [planInformationConfirmed, setPlanInformationConfirmed] = useState(false);
  useEffect(() => {
    setPlanInformationConfirmed(false);
  }, [data.planInformation.releasedAt, data.planInformation.changed]);

  if (!data.identityLinked) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <CircleUserRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold">Persönliche Ansicht wird vorbereitet</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Dein Zugang ist noch keinem Ansprechpartner oder Helfereintrag
              zugeordnet. Sobald die Zuordnung in der Planung hinterlegt ist,
              erscheinen hier automatisch deine Aufgaben und Einsätze.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { summary } = data;
  const progressTone = summary.allCompleted
    ? "border-emerald-300 bg-emerald-50"
    : summary.rejected > 0
      ? "border-red-300 bg-red-50"
      : "border-blue-200 bg-white";

  return (
    <div className="space-y-6" data-dashboard-mode="personal">
      <section
        data-klemmi-target="personal-dashboard-progress"
        className={`overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-5 ${progressTone}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                <Pin className="size-3.5" aria-hidden="true" />
                Meine Ansicht aktiv
              </span>
              {summary.allCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Alles erledigt
                </span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
              Mein Fortschritt
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {summary.total === 0
                ? "Dir sind aktuell keine persönlichen Aufgaben zugeordnet."
                : summary.allCompleted
                  ? "Dein persönlicher Bereich ist aktuell vollständig erledigt."
                  : `${summary.completed} von ${summary.total} persönlichen Aufgaben sind erledigt.`}
            </p>
          </div>
          <div className="min-w-44 rounded-xl border border-white/90 bg-white/90 p-3 text-center shadow-sm">
            <strong className="text-3xl font-extrabold tabular-nums text-slate-950">
              {summary.progress} %
            </strong>
            <span className="mt-0.5 block text-xs font-semibold tracking-wide text-slate-600 uppercase">
              erledigt
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" aria-label={`${summary.progress} Prozent deiner Aufgaben erledigt`}>
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${summary.allCompleted ? "bg-emerald-500" : summary.rejected > 0 ? "bg-red-500" : "bg-blue-600"}`}
            style={{ width: `${summary.progress}%` }}
          />
        </div>
        {summary.total > 0 && !summary.allCompleted && (
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              <strong>{summary.open}</strong> offen
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
              <strong>{summary.inProgress}</strong> in Arbeit
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-950">
              <strong>{summary.rejected}</strong> Klärung nötig
            </div>
          </div>
        )}
      </section>

      {data.planInformation.outstanding && data.planInformation.assignedHelperCount > 0 && (
        <section className={cn(
          "overflow-hidden rounded-2xl border p-4 text-white shadow-lg sm:p-5",
          data.planInformation.changed
            ? "border-amber-300 bg-gradient-to-r from-amber-600 to-orange-500 shadow-amber-200"
            : "border-blue-300 bg-gradient-to-r from-blue-600 to-sky-500 shadow-blue-200"
        )}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/35">
                <BellRing className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-blue-100 uppercase">
                  {data.planInformation.changed ? "Änderung im Einsatzplan" : "Einsatzplan steht"}
                </p>
                <h2 className="mt-1 text-lg font-extrabold sm:text-xl">
                  {data.planInformation.changed
                    ? "Einsatzplan geändert – betroffene Helfer prüfen"
                    : `Helferplan steht – ${data.planInformation.eventName ?? "Veranstaltung"}`}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-50">
                  {data.planInformation.changed
                    ? "Mindestens eine Einteilung deiner Helfer wurde geändert. Öffne deine Helferübersicht und informiere nur die betroffenen Personen erneut."
                    : "Für deine zugeordneten Helfer liegen Einsätze vor. Öffne die Helferübersicht und versende die zweite WhatsApp-Vorlage oder informiere persönlich."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                if (!data.planInformation.eventId || !data.planInformation.eventYear) return;
                onOpen(
                  `/helfer?meine=1&eingeteilt=1&event=${data.planInformation.eventId}&jahr=${data.planInformation.eventYear}`
                );
              }}
              className="h-11 shrink-0 rounded-xl bg-white px-4 font-bold text-blue-800 shadow-sm hover:bg-blue-50"
            >
              Meine eingeteilten Helfer öffnen
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-sm leading-5 text-white">
            <input
              type="checkbox"
              checked={planInformationConfirmed}
              onChange={event => setPlanInformationConfirmed(event.target.checked)}
              className="mt-0.5 size-4 rounded border-white/60 accent-white"
            />
            <span>
              Nicht mehr anzeigen – meine zugeordneten Helfer wurden informiert.
            </span>
          </label>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!planInformationConfirmed}
              onClick={onPlanInformationConfirmed}
              className="h-10 border-white/55 bg-white/15 text-white hover:bg-white/25 hover:text-white disabled:border-white/20 disabled:bg-white/5 disabled:text-white/55"
            >
              Hinweis ausblenden
            </Button>
          </div>
        </section>
      )}

      <section
        data-klemmi-target="personal-dashboard-work"
        className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"
      >
        <Card className="border-slate-200 py-4 text-slate-950 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ListTodo className="size-5 text-blue-700" aria-hidden="true" />
              Jetzt für mich wichtig
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.nextTasks.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                {summary.total === 0
                  ? "Sobald dir eine Aufgabe zugeordnet wird, erscheint sie hier."
                  : "Keine offenen persönlichen Aufgaben – sehr gut!"}
              </div>
            ) : (
              data.nextTasks.map(task => {
                const status = PERSONAL_TASK_STATUS[task.status];
                return (
                  <button
                    key={`${task.scope}-${task.id}`}
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    onPointerEnter={() => preloadRoute(task.href.split("?", 1)[0] || "/vorbereitung")}
                    onFocus={() => preloadRoute(task.href.split("?", 1)[0] || "/vorbereitung")}
                    onClick={() => onOpen(task.href)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="break-words text-sm text-slate-950">{task.title}</strong>
                        <span className="text-xs font-medium text-slate-500">{task.scope}</span>
                      </span>
                      {task.detail && <span className="mt-0.5 block text-sm text-slate-600">{task.detail}</span>}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 py-4 text-slate-950 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarClock className="size-5 text-blue-700" aria-hidden="true" />
              Meine Einsätze
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.shifts.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                Dir ist aktuell keine Schicht direkt zugeordnet.
              </p>
            ) : (
              data.shifts.map(shift => (
                <button
                  key={shift.id}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  onPointerEnter={() => preloadRoute("/einsatzplan")}
                  onFocus={() => preloadRoute("/einsatzplan")}
                  onClick={() => onOpen(`/einsatzplan?helfer=${shift.helperId}`)}
                >
                  <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                    <strong className="text-xs leading-none">{WEEKDAY_SHORT_LABELS[shift.day]}</strong>
                    <Calendar className="mt-1 size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-slate-950">{shift.task}</strong>
                    <span className="mt-0.5 block truncate text-sm text-slate-600">
                      {shift.area} · {shift.startTime || "Zeit offen"}–{shift.endTime || "Zeit offen"}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))
            )}
            {data.shifts.length > 0 && (
              <p className="pt-1 text-xs leading-5 text-slate-500">
                Einsätze werden separat angezeigt: Sie erhalten erst nach dem tatsächlichen Einsatz einen persönlichen Abschlussstatus.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card
          data-klemmi-target="personal-dashboard-helpers"
          className="border-slate-200 py-4 text-slate-950 shadow-sm"
        >
          <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UsersRound className="size-5 text-blue-700" aria-hidden="true" />
              Meine betreuten Helfer
            </CardTitle>
            <span className="text-xs text-slate-600">
              {data.helpers.total} zugeordnet · {data.helpers.assignedShifts} Einsätze
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onOpen("/helfer?meine=1&erstkontakt=1")}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-amber-950 transition hover:border-amber-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <strong className="text-xl tabular-nums">{data.helpers.firstContactOpen}</strong>
                <span className="mt-0.5 block text-sm font-medium">ohne Erstkontakt</span>
              </button>
              <button
                type="button"
                onClick={() => onOpen("/helfer?meine=1&rueckmeldung=1")}
                className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-blue-950 transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <strong className="text-xl tabular-nums">{data.helpers.feedbackOpen}</strong>
                <span className="mt-0.5 block text-sm font-medium">ohne Rückmeldung</span>
              </button>
            </div>
            {data.helpers.rows.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                Dir sind aktuell noch keine Helfer als Ansprechpartner zugeordnet.
              </p>
            ) : (
              <div className="divide-y rounded-xl border border-slate-200 bg-white">
                {data.helpers.rows.map(helper => {
                  const status = helper.firstContactOpen
                    ? "Erstkontakt offen"
                    : helper.feedbackOpen
                      ? "Rückmeldung offen"
                      : "Rückmeldung vorhanden";
                  const statusClass = helper.firstContactOpen
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : helper.feedbackOpen
                      ? "bg-blue-50 text-blue-900 border-blue-200"
                      : "bg-emerald-50 text-emerald-900 border-emerald-200";
                  return (
                    <button
                      key={helper.id}
                      type="button"
                      onClick={() => onOpen(`/helfer?meine=1&helfer=${helper.id}`)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-slate-950">{helper.name}</strong>
                        <span className="mt-0.5 block text-xs text-slate-600">
                          {helper.assignedShifts === 1
                            ? "1 Einsatz zugeordnet"
                            : `${helper.assignedShifts} Einsätze zugeordnet`}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-bold ${statusClass}`}>
                        {status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <PersonalLocationMapCard locations={data.locations} />
      </section>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const detailsLayout = useDashboardDetailsLayout();
  const { canReadModule, isTenantAdmin, isPrimaryTenantAdmin } =
    useTenantAdministration();
  const {
    isDefaultMyTasks,
    setDefaultMyTasks,
    hasSeenPersonalDashboardExplanation,
    markPersonalDashboardExplanationSeen,
  } = useMyTasksDefault(user);
  const utils = trpc.useUtils();
  const tenantProduct = trpc.tenantProduct.current.useQuery();
  const isEventPass = tenantProduct.data?.packageId === "event_pass";
  const canReadLocations = canReadModule("locations");
  const [workloadFilter, setWorkloadFilter] = useState<{
    day: DailyReadiness["day"];
    kind: "ungenutzt" | "teilzeit";
  } | null>(null);
  const [klemmiMuted, setKlemmiMuted] = useState(getKlemmiMuted);
  const [isPersonalDashboard, setIsPersonalDashboard] = useState(
    () => !isEventPass && isDefaultMyTasks
  );
  const [showPersonalDashboardExplanation, setShowPersonalDashboardExplanation] =
    useState(false);
  const { data: s, isLoading } = trpc.dashboard.stats.useQuery();
  const personalDashboard = trpc.dashboard.personal.useQuery(undefined, {
    enabled: isPersonalDashboard && !isEventPass,
  });
  const acknowledgePlanInformation = trpc.dashboard.acknowledgePlanInformation.useMutation({
    onSuccess: async () => {
      await utils.dashboard.personal.invalidate();
      toast.success("Der Hinweis wurde ausgeblendet.");
    },
    onError: error => toast.error(error.message),
  });
  const { data: helpers = [], isLoading: areHelpersLoading } =
    trpc.helpers.list.useQuery();
  const { data: currentEvent, isLoading: isEventLoading } =
    trpc.events.current.useQuery();
  const { data: currentTenant, isLoading: isTenantLoading } =
    trpc.tenants.current.useQuery();
  const closureRecommendations = trpc.events.closureRecommendations.useQuery(
    undefined,
    {
      enabled: isTenantAdmin,
      retry: false,
    }
  );
  const closeEvent = trpc.events.close.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.events.closureRecommendations.invalidate(),
        utils.events.list.invalidate(),
        utils.events.manage.invalidate(),
        utils.events.all.invalidate(),
        utils.events.current.invalidate(),
        utils.years.list.invalidate(),
        utils.dashboard.invalidate(),
      ]);
      toast.success(`„${result.name}“ wurde als Historie abgeschlossen.`);
    },
    onError: error => toast.error(error.message),
  });
  const productUsage = trpc.tenantProduct.usage.useQuery(undefined, {
    enabled:
      isTenantAdmin &&
      tenantProduct.isSuccess &&
      tenantProduct.data?.packageId === "pro",
    retry: false,
  });
  const canUseMapsGpx =
    tenantProduct.isSuccess &&
    productAllowsCapability(tenantProduct.data?.packageId ?? "event_pass", "maps_gpx");
  const canUseChat =
    tenantProduct.isSuccess &&
    productAllowsCapability(tenantProduct.data?.packageId ?? "event_pass", "chat");
  const allowsDonations = productAllowsCapability(
    tenantProduct.data?.packageId ?? "event_pass",
    "donations"
  );
  const { data: dashboardLocations = [] } = trpc.locations.list.useQuery(
    undefined,
    {
      enabled: canReadLocations,
    }
  );
  useEffect(() => {
    if (isEventPass) {
      setIsPersonalDashboard(false);
      return;
    }
    if (isDefaultMyTasks) {
      setIsPersonalDashboard(true);
      if (!hasSeenPersonalDashboardExplanation) {
        setShowPersonalDashboardExplanation(true);
      }
    }
  }, [isDefaultMyTasks, hasSeenPersonalDashboardExplanation, isEventPass]);
  const selectDashboardView = (mode: "club" | "personal") => {
    const personal = mode === "personal";
    if (isEventPass && personal) return;
    setIsPersonalDashboard(personal);
    setDefaultMyTasks(personal);
    if (personal && !hasSeenPersonalDashboardExplanation) {
      setShowPersonalDashboardExplanation(true);
    }
  };
  const closePersonalDashboardExplanation = () => {
    markPersonalDashboardExplanationSeen();
    setShowPersonalDashboardExplanation(false);
  };
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const helperByName = new Map(helpers.map(helper => [helper.name, helper]));
  const zeroAvailability = (helperName: string, day: Weekday) => {
    const helper = helperByName.get(helperName);
    return helper?.[WEEKDAY_AVAILABILITY_FIELDS[day]];
  };
  if (
    isLoading ||
    isEventLoading ||
    isTenantLoading ||
    areHelpersLoading ||
    !s ||
    !currentEvent ||
    !currentTenant
  )
    return <div className="text-muted-foreground">Lade Dashboard …</div>;

  const openHelperWorkload = (helperName: string, day?: Weekday) => {
    const helper = helperByName.get(helperName);
    if (!helper) return;
    const target: DashboardTarget = {
      path: "/einsatzplan",
      helperId: helper.id,
      ...(day ? { day } : {}),
    };
    preloadRoute(target.path);
    navigate(dashboardTargetHref(target));
  };

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
  if (
    s.schichtenGesamt > 0 &&
    isShiftPlanStable &&
    priorityActions.length < 4
  ) {
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

  const upcomingDeadlines =
    s.naechsteVorbereitungsfristen as DashboardDeadline[];
  const dailyReadiness = s.taeglicheEinsatzbereitschaft as DailyReadiness[];
  const hasMappableLocations = dashboardLocations.some(location => {
    const candidate = location as {
      latitude?: number | null;
      longitude?: number | null;
    };
    return (
      Number.isFinite(candidate.latitude) &&
      Number.isFinite(candidate.longitude)
    );
  });
  const dashboardKlemmiSteps = createDashboardKlemmiSteps({
    hasEventPeriod: Boolean(currentEvent.startDate),
    hasPriorityActions: priorityActions.length > 0,
    hasDeadlines: upcomingDeadlines.length > 0,
    hasHelpers: helpers.length > 0,
    hasAssignments: s.schichtenGesamt > 0,
    hasContacts: s.verantwortlichkeiten.length > 0,
    hasMappableLocations,
    canUseMapsGpx,
    canUseChat,
    canUseDonations: allowsDonations,
    currentPackageId: tenantProduct.data?.packageId ?? "event_pass",
    detailsLayout,
  });
  const personalDashboardKlemmiSteps = createPersonalDashboardKlemmiSteps();
  const activePotentialDay = workloadFilter
    ? dailyReadiness.find(day => day.day === workloadFilter.day)
    : undefined;
  const workloadHelperIds = new Set(
    workloadFilter && activePotentialDay
      ? workloadFilter.kind === "ungenutzt"
        ? activePotentialDay.ungenutzteHelferIds
        : activePotentialDay.teilzeitReserveIds
      : []
  );
  const defaultWorkload = s.auslastung.filter(entry => entry.gesamt > 0);
  const visibleWorkload = workloadFilter
    ? s.auslastung.filter(entry => workloadHelperIds.has(entry.id))
    : defaultWorkload;
  const workloadFilterLabel = workloadFilter
    ? `${workloadFilter.day}: ${
        workloadFilter.kind === "ungenutzt"
          ? "komplett ungenutzte Helfer"
          : "Teilzeit-Reserve"
      }`
    : null;
  const showPotentialInWorkload = (
    day: DailyReadiness["day"],
    kind: "ungenutzt" | "teilzeit"
  ) => {
    setWorkloadFilter(current =>
      current?.day === day && current.kind === kind ? null : { day, kind }
    );
    window.setTimeout(() => {
      document.getElementById("helferauslastung")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div className="space-y-8">
      <Dialog
        open={showPersonalDashboardExplanation}
        onOpenChange={open => {
          if (!open) closePersonalDashboardExplanation();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}
          className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] bg-white text-slate-950 sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950">
              <Pin className="size-5 text-blue-700" aria-hidden="true" />
              Persönliche Ansicht aktiviert
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              Ab jetzt zeigt dein Dashboard nur noch deine eigenen Aufgaben,
              Nachbereitungen und direkt zugeordneten Einsätze.
            </p>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950">
              <strong>Dein Fortschritt wird persönlich bewertet.</strong>
              <br />
              Sobald alle dir zugeordneten Aufgaben als erledigt markiert sind,
              wird dein persönlicher Bereich grün angezeigt.
            </div>
            <p>
              Über <strong>Vereinssicht</strong> wechselst du jederzeit zurück
              zur gesamten Veranstaltungsplanung.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto"
              onClick={closePersonalDashboardExplanation}
            >
              Verstanden – meine Ansicht anzeigen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageTitle icon="dashboard">Dashboard</PageTitle>
          <p className="text-muted-foreground">
            {isPersonalDashboard
              ? "Deine zugeordneten Aufgaben und Einsätze – klar auf deinen Bereich fokussiert."
              : "Die wichtigsten nächsten Schritte stehen zuerst; alle Kennzahlen werden automatisch aus den Planungsdaten berechnet."}
          </p>
          {!isEventPass && <div
            className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm"
            role="group"
            aria-label="Dashboard-Ansicht auswählen"
          >
            <button
              type="button"
              className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${!isPersonalDashboard ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"}`}
              aria-pressed={!isPersonalDashboard}
              onClick={() => selectDashboardView("club")}
            >
              Vereinssicht
            </button>
            <button
              type="button"
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isPersonalDashboard ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-950"}`}
              aria-pressed={isPersonalDashboard}
              onClick={() => selectDashboardView("personal")}
            >
              <Pin className="size-3.5" aria-hidden="true" />
              Meine Ansicht
            </button>
          </div>}
        </div>
        {isPersonalDashboard && (
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <KlemmiSurfaceGuide
              guideId="dashboard-personal"
              title="Deine persönliche Dashboard-Ansicht"
              introText="Ich zeige dir, wie du in deiner persönlichen Ansicht Fortschritt, eigene Einsätze, betreute Helfer und zugehörige Standorte im Blick behältst."
              steps={personalDashboardKlemmiSteps}
              successSignal={null}
              completionTitle="Deine Aufgaben im Blick!"
              completionText="Du weißt jetzt, wo du deinen persönlichen Fortschritt, betreute Helfer und deine Standorte findest. Über den Umschalter kannst du jederzeit wieder zur Vereinssicht wechseln."
              voiceMuted={klemmiMuted}
              onVoiceMutedChange={muted => {
                setKlemmiMuted(muted);
                persistKlemmiMuted(muted);
              }}
            />
          </div>
        )}
        {!isPersonalDashboard && (
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
            <KlemmiSurfaceGuide
              guideId="dashboard"
              title="Dein Dashboard auf einen Blick"
              introText="Hier laufen die Informationen aus deiner Planung zusammen. Ich zeige dir jetzt nur die Bereiche, die auf diesem Dashboard wirklich sichtbar sind."
              steps={dashboardKlemmiSteps}
              successSignal={null}
              completionTitle="Alles im Blick!"
              completionText="Du weißt jetzt, wo das Dashboard den aktuellen Planungsstand zeigt – und welche Eingaben die einzelnen Übersichten füllen."
              voiceMuted={klemmiMuted}
              onVoiceMutedChange={muted => {
                setKlemmiMuted(muted);
                persistKlemmiMuted(muted);
              }}
            />
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => {
                const next = !klemmiMuted;
                setKlemmiMuted(next);
                persistKlemmiMuted(next);
              }}
              aria-pressed={klemmiMuted}
              aria-label={
                klemmiMuted
                  ? "Klemmi-Stimme einschalten"
                  : "Klemmi-Stimme stummschalten"
              }
              title={
                klemmiMuted
                  ? "Klemmi-Stimme einschalten"
                  : "Klemmi-Stimme stummschalten"
              }
            >
              {klemmiMuted ? (
                <VolumeX className="size-4" aria-hidden="true" />
              ) : (
                <Volume2 className="size-4" aria-hidden="true" />
              )}
              <span>{klemmiMuted ? "Klemmi stumm" : "Klemmi-Stimme"}</span>
            </button>
            </div>
            <EventCountdownWidget
              event={currentEvent}
              packageId={tenantProduct.data?.packageId ?? "event_pass"}
            />
          </div>
        )}
      </div>

      {isPersonalDashboard ? (
        personalDashboard.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Meine Aufgaben werden geladen …
          </div>
        ) : personalDashboard.data ? (
          <PersonalDashboardContent
            data={personalDashboard.data as PersonalDashboardData}
            onOpen={href => navigate(href)}
            onPlanInformationConfirmed={() => acknowledgePlanInformation.mutate()}
          />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 shadow-sm">
            Die persönliche Ansicht konnte gerade nicht geladen werden. Bitte
            versuche es gleich noch einmal.
          </div>
        )
      ) : (
        <>
      {currentTenant.status === "pilot" && (
        <PilotTenantInfoCard
          tenant={currentTenant}
          eventName={currentEvent.name}
          showSupport={!isEventPass || isPrimaryTenantAdmin}
        />
      )}

      {isTenantAdmin && closureRecommendations.data && (
        <KlemmiEventClosureRecommendation
          recommendations={closureRecommendations.data}
          isClosing={closeEvent.isPending}
          onCloseEvent={eventId => closeEvent.mutate({ id: eventId })}
        />
      )}

      {tenantProduct.data?.packageId === "pro" && productUsage.data && (
        <KlemmiProLimitNotice
          helpers={productUsage.data.helpersPerEvent}
          personalAccesses={productUsage.data.personalPlanningAccesses}
        />
      )}

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
          <div
            className={`grid gap-3 md:grid-cols-2 ${
              priorityActions.length === 1
                ? "xl:grid-cols-1"
                : priorityActions.length === 2
                  ? "xl:grid-cols-2"
                  : "xl:grid-cols-4"
            }`}
          >
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

      {upcomingDeadlines.length > 0 && (
        <section data-dashboard-level="Fristen" className="w-full">
          <UpcomingDeadlinesCard
            deadlines={upcomingDeadlines}
            openTarget={target => navigate(dashboardTargetHref(target))}
          />
        </section>
      )}

      <section
        data-dashboard-section="Helfer-Kennzahlen"
        data-dashboard-level="Helfer-Kennzahlen"
        className={cn(
          "grid gap-4",
          allowsDonations ? "md:grid-cols-3" : "md:grid-cols-2"
        )}
      >
        <DailyReadinessCard
          readiness={dailyReadiness}
          openTarget={target => navigate(dashboardTargetHref(target))}
          onPotentialFilter={showPotentialInWorkload}
        />
        <HelperStatusCommunicationCard
          assigned={s.helferEingeteilt}
          confirmed={s.helferEingeteiltBestaetigt}
          feedbackOutstanding={s.helferEingeteiltUnbestaetigt}
          feedbackRate={s.rueckmeldequote}
          total={s.helferGesamt}
          contacted={s.helferKontaktiert}
          contactOutstanding={s.helferOhneErstkontakt}
          contactRate={s.erstkontaktquote}
          openTarget={target => navigate(dashboardTargetHref(target))}
        />
        {allowsDonations && (
          <DonationSummaryCard
            donations={s.spenden as DonationDashboardStats}
            openDonations={() => navigate("/spenden")}
          />
        )}
      </section>

      <div
        data-dashboard-level="Tabellendetails"
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card className="flex h-[250px] flex-col overflow-hidden shadow-sm gap-3 py-4">
          <CardHeader className="shrink-0">
            <CardTitle>
              {isEventPass
                ? "Hauptansprechpartner (Vereinsadministrator)"
                : "Verantwortlichkeiten pro Ansprechpartner"}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto pt-0">
            <table className="w-full min-w-[420px] table-fixed text-sm">
              <colgroup>
                <col className="w-2/5" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-muted-foreground">
                  <th className="bg-slate-50 py-1 pr-3">Ansprechpartner</th>
                  <th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Helfer</th>
                  <th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Vorb.</th>
                  <th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Nachb.</th>
                  <th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Mat.</th>
                  <th className="bg-slate-50 px-1 py-1 text-center whitespace-nowrap">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.verantwortlichkeiten.map(v => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="break-words py-1 pr-3">{v.name}</td>
                    <td className="px-1 py-1 text-center tabular-nums">
                      {v.betreuteHelfer}
                    </td>
                    <td className="px-1 py-1 text-center tabular-nums">
                      {v.vorbereitung}
                    </td>
                    <td className="px-1 py-1 text-center tabular-nums">
                      {v.nachbereitung}
                    </td>
                    <td className="px-1 py-1 text-center tabular-nums">
                      {v.material}
                    </td>
                    <td className="px-1 py-1 text-center font-semibold tabular-nums">
                      {v.gesamt}
                    </td>
                  </tr>
                ))}
                {s.verantwortlichkeiten.length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={6}>
                      Noch keine Ansprechpartner angelegt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card
          id="helferauslastung"
          data-dashboard-section="Helferauslastung"
          className="scroll-mt-4 flex h-[250px] flex-col overflow-hidden shadow-sm gap-3 py-4"
        >
          <CardHeader className="shrink-0 flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle>Helferauslastung (eingeteilte Schichten)</CardTitle>
              {workloadFilterLabel && (
                <div
                  data-workload-filter
                  className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700"
                >
                  <span className="rounded-full bg-violet-100 px-2 py-1 font-semibold text-violet-900">
                    Filter: {workloadFilterLabel}
                  </span>
                  <button
                    type="button"
                    className="rounded px-1 font-medium text-blue-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => setWorkloadFilter(null)}
                  >
                    Filter aufheben
                  </button>
                </div>
              )}
            </div>
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
          <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pt-0 sm:px-6">
            <table className="w-full table-fixed text-xs sm:text-sm">
              <colgroup>
                <col className="w-[36%]" />
                {activeDays.map(day => (
                  <col key={day} />
                ))}
                <col className="w-[13%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-muted-foreground">
                  <th className="bg-slate-50 py-1 pr-1 sm:pr-2">Helfer</th>
                  {activeDays.map(day => (
                    <th
                      key={day}
                      className="bg-slate-50 px-0.5 py-1 text-right sm:px-1"
                      title={day}
                    >
                      {WEEKDAY_SHORT_LABELS[day]}
                    </th>
                  ))}
                  <th className="bg-slate-50 py-1 pl-0.5 text-right sm:pl-1">
                    Gesamt
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleWorkload.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="overflow-hidden py-1 pr-1 sm:pr-2">
                      <button
                        type="button"
                        data-dashboard-workload-cell="helper"
                        className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left font-medium text-slate-900 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        title={`${a.name}: alle eingeteilten Schichten anzeigen`}
                        aria-label={`${a.name}: alle eingeteilten Schichten im Einsatzplan anzeigen`}
                        onPointerEnter={() => preloadRoute("/einsatzplan")}
                        onFocus={() => preloadRoute("/einsatzplan")}
                        onClick={() => openHelperWorkload(a.name)}
                      >
                        {a.name}
                      </button>
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
                          className="px-0.5 py-1 text-right sm:px-1"
                        >
                          <button
                            type="button"
                            data-dashboard-workload-cell={day}
                            className={`w-full rounded px-0.5 text-right tabular-nums underline-offset-2 hover:bg-blue-50 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${availabilityClass}`}
                            title={`${availabilityTitle ?? `${day}: ${value} eingeteilte Schichten`}. Einsatzplan anzeigen`}
                            aria-label={`${a.name}, ${day}: ${value} eingeteilte Schichten im Einsatzplan anzeigen`}
                            onPointerEnter={() => preloadRoute("/einsatzplan")}
                            onFocus={() => preloadRoute("/einsatzplan")}
                            onClick={() => openHelperWorkload(a.name, day)}
                          >
                            {value}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-1 pl-0.5 text-right sm:pl-1">
                      <button
                        type="button"
                        data-dashboard-workload-cell="gesamt"
                        className="w-full rounded px-0.5 text-right font-semibold tabular-nums underline-offset-2 hover:bg-blue-50 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        title={`${a.name}: alle eingeteilten Schichten anzeigen`}
                        aria-label={`${a.name}: insgesamt ${a.gesamt} eingeteilte Schichten im Einsatzplan anzeigen`}
                        onPointerEnter={() => preloadRoute("/einsatzplan")}
                        onFocus={() => preloadRoute("/einsatzplan")}
                        onClick={() => openHelperWorkload(a.name)}
                      >
                        {a.gesamt}
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleWorkload.length === 0 && (
                  <tr>
                    <td
                      className="py-3 text-muted-foreground"
                      colSpan={activeDays.length + 2}
                    >
                      {workloadFilterLabel
                        ? `Keine verfügbaren Helfer für ${workloadFilterLabel}.`
                        : "Noch keine Helfer eingeteilt."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {canUseMapsGpx && (
        <section data-dashboard-level="Live-Standortkarte" className="w-full">
          <LocationMapCard />
        </section>
      )}
        </>
      )}
    </div>
  );
}
