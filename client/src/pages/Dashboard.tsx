import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationMapCard } from "@/components/LocationMapCard";
import {
  dashboardTargetHref,
  type DashboardTarget,
} from "@/lib/dashboard-target-filter";
import { preloadRoute } from "@/lib/route-loaders";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CircleX,
  Gift,
  GitCompareArrows,
  ListTodo,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {deadlines.map(deadline => (
            <button
              key={deadline.taskId}
              type="button"
              className="group flex min-h-28 min-w-0 flex-col items-stretch justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label={`${deadline.dueText}: ${deadline.task}. ${deadlineTimingLabel(deadline.daysUntil)}. Vorbereitung öffnen`}
              onPointerEnter={() => preloadRoute(target.path)}
              onFocus={() => preloadRoute(target.path)}
              onClick={() => openTarget(target)}
            >
              <span className="flex items-start justify-between gap-2">
                <span
                  className={`flex shrink-0 flex-col rounded-lg border px-2 py-1 text-center ${deadlineToneClass(deadline)}`}
                >
                  <span className="text-sm font-bold leading-tight">{deadline.dueText}</span>
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
                <span className="block line-clamp-2 text-sm font-semibold leading-5 text-slate-900" title={deadline.task}>
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
            <strong className="text-lg text-slate-950">{contacted} / {total}</strong>{" "}
            Helfer kontaktiert
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
    glutenFree: number;
    lactoseFree: number;
    containsNuts: number;
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
        style={{ background: `conic-gradient(${accent} ${rate}%, ${track} ${rate}% 100%)` }}
        aria-label={`${rate} Prozent ${title}`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950 shadow-sm">
          {rate}%
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-bold text-slate-900">
          <UsersRound className={`size-3.5 ${tone === "green" ? "text-emerald-700" : "text-blue-700"}`} aria-hidden="true" />
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-700">
          <strong className="text-[13px] text-slate-950">{value} / {total}</strong> Helfer
        </span>
        <span className={`mt-0.5 block text-xs font-semibold ${tone === "green" ? "text-emerald-800" : "text-blue-800"}`}>
          {detail}
        </span>
      </span>
      {actionable && <ArrowRight className={`size-4 shrink-0 ${tone === "green" ? "text-emerald-700" : "text-blue-700"}`} aria-hidden="true" />}
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
    <Card data-dashboard-section="Helfer-Status & Kommunikation" className="h-full gap-2 border-blue-300 bg-blue-50/55 py-2.5 text-slate-950 shadow-sm">
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
          onClick={() => openTarget({ path: "/helfer", confirmed: "nein", assigned: true })}
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
    ["🌱 Vegan", donations.eigenschaften.vegan, "border-emerald-200 bg-emerald-50 text-emerald-800"],
    ["🌾 Glutenfrei", donations.eigenschaften.glutenFree, "border-amber-200 bg-amber-50 text-amber-900"],
    ["🥛 Laktosefrei", donations.eigenschaften.lactoseFree, "border-sky-200 bg-sky-50 text-sky-800"],
    ["🌰 Nüsse", donations.eigenschaften.containsNuts, "border-orange-200 bg-orange-50 text-orange-900"],
    ["🥩 Fleischhaltig", donations.eigenschaften.meat, "border-rose-200 bg-rose-50 text-rose-800"],
  ] as const;
  return (
    <Card data-dashboard-section="Verpflegungsspenden" className="h-full gap-2 border-rose-200 bg-rose-50/45 py-2.5 text-slate-950 shadow-sm">
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
          <ArrowRight className="size-4 shrink-0 text-rose-700 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
        <span className="text-xs text-slate-600">Gesamt: {donations.gesamt} erfasst</span>
      </CardHeader>
      <CardContent className="grid gap-3 px-3 pb-3 pt-0 sm:px-4 sm:pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.8fr)]">
        <div className="space-y-1.5">
          {targetCategories.map(category => {
            const completion = category.target > 0 ? (category.ist / category.target) * 100 : 0;
            const quote = Math.min(100, Math.round(completion));
            const progressTone =
              completion >= 100
                ? { name: "erreicht", track: "bg-emerald-100", fill: "bg-emerald-500" }
                : completion >= 80
                  ? { name: "fast-erreicht", track: "bg-amber-100", fill: "bg-amber-400" }
                  : { name: "offen", track: "bg-rose-100", fill: "bg-rose-500" };
            const text = category.target > 0 ? `${category.ist} / ${category.target}` : `${category.ist} / –`;
            return (
              <div key={category.id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-slate-800">{category.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-950">{text}</span>
                </div>
                <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${progressTone.track}`} role="progressbar" aria-label={`${category.label}: ${category.ist} von ${category.target || 0} Spenden erfasst`} aria-valuemin={0} aria-valuemax={Math.max(category.target, 1)} aria-valuenow={Math.min(category.ist, Math.max(category.target, 1))} data-progress-tone={progressTone.name}>
                  <div className={`h-full rounded-full ${progressTone.fill} transition-[width] duration-200`} style={{ width: `${quote}%` }} />
                </div>
              </div>
            );
          })}
          {sonstiges && (
            <p className="pt-0.5 text-[11px] text-slate-600">📦 Sonstiges: {sonstiges.ist} erfasst</p>
          )}
          {targetCategories.every(category => category.target === 0) && (
            <p className="text-[11px] text-slate-500">Sollwerte können in der Spendenübersicht festgelegt werden.</p>
          )}
        </div>
        <div className="border-t border-rose-200 pt-2 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Eigenschaften</p>
          <div className="flex flex-wrap gap-1">
            {traitTags.map(([label, value, className]) => (
              <span key={label} className={`rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${className}`}>
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
  if (dayCount === 3) return "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3";
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
            <UsersRound className="size-5 text-emerald-700" aria-hidden="true" />
            Einsatzbereitschaft je Festivaltag
          </CardTitle>
          <ArrowRight className="size-4 shrink-0 text-emerald-700 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
        <span className="text-xs text-slate-600">Besetzt / Bedarf</span>
      </CardHeader>
      <CardContent className={`${readinessGridClass(readiness.length)} px-3 pb-3 pt-0 sm:px-4 sm:pb-3`}>
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
                  <strong className="tabular-nums">{day.ungenutzteHelfer}</strong>
                </button>
                <button
                  type="button"
                  disabled={day.teilzeitReserve === 0}
                  className="flex min-h-6 items-baseline justify-between gap-2 rounded text-left text-blue-800 transition-colors hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default disabled:text-slate-500"
                  aria-label={`${day.day}: ${day.teilzeitReserve} Teilzeit-Reserve anzeigen`}
                  onClick={() => onPotentialFilter(day.day, "teilzeit")}
                >
                  <span>Teilzeit-Reserve</span>
                  <strong className="tabular-nums">{day.teilzeitReserve}</strong>
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EventCountdownWidget({
  startDate,
  endDate,
}: {
  startDate?: string | null;
  endDate?: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const state: EventCountdownState = eventCountdownState(
    { startDate, endDate },
    now
  );
  if (state.kind === "unconfigured") {
    return (
      <div
        data-slot="event-countdown"
        data-countdown-state="unconfigured"
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2 text-xs text-slate-500 shadow-sm"
      >
        <Calendar className="h-4 w-4 text-slate-400" />
        <span>Zeitraum konfigurierbar über 📅 in der Seitenleiste</span>
      </div>
    );
  }

  if (state.kind === "upcoming") {
    const isUrgent = state.days < 14;
    return (
      <div
        data-slot="event-countdown"
        data-countdown-state="upcoming"
        data-countdown-urgent={isUrgent ? "true" : "false"}
        className={`flex shrink-0 !min-w-[17.5rem] items-center gap-3 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 px-4 py-3 text-slate-950 shadow-md shadow-amber-200/80 ring-1 ring-amber-200 sm:!min-w-[19rem] sm:px-5${isUrgent ? " countdown-urgent" : ""}`}
      >
        <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-lg shadow-sm shadow-amber-300" aria-hidden="true">
          ⏳
        </span>
        <div className="relative z-10 min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-900">
            Eventstart in
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 font-bold">
            <span className="text-4xl font-black leading-none tabular-nums text-amber-950 sm:text-[2.65rem]">
              {state.days}
            </span>
            <span className="text-sm font-extrabold text-amber-950 sm:text-base">
              {state.days === 1 ? "Tag" : "Tagen"}
            </span>
            <span className="text-xs font-bold text-amber-900 sm:text-sm">
              · {state.hours} Std.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "live") {
    return (
      <div
        data-slot="event-countdown"
        data-countdown-state="live"
        className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2.5 text-emerald-950 shadow-sm"
      >
        <span className="text-base">🚀</span>
        <span className="text-sm font-bold">
          Event läuft! (Tag {state.day} von {state.totalDays})
        </span>
      </div>
    );
  }

  return (
    <div
      data-slot="event-countdown"
      data-countdown-state="completed"
      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm"
    >
      <span className="text-base">🏁</span>
      <span>Veranstaltung abgeschlossen</span>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [workloadFilter, setWorkloadFilter] = useState<{
    day: DailyReadiness["day"];
    kind: "ungenutzt" | "teilzeit";
  } | null>(null);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Die wichtigsten nächsten Schritte stehen zuerst; alle Kennzahlen werden automatisch aus den Planungsdaten berechnet.
          </p>
        </div>
        <EventCountdownWidget
          startDate={currentEvent.startDate}
          endDate={currentEvent.endDate}
        />
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
        <section
          data-dashboard-level="Fristen"
          className="w-full"
        >
          <UpcomingDeadlinesCard
            deadlines={upcomingDeadlines}
            openTarget={target => navigate(dashboardTargetHref(target))}
          />
        </section>
      )}

      <section
        data-dashboard-section="Helfer-Kennzahlen"
        data-dashboard-level="Helfer-Kennzahlen"
        className="grid gap-4 md:grid-cols-3"
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
        <DonationSummaryCard
          donations={s.spenden as DonationDashboardStats}
          openDonations={() => navigate("/spenden")}
        />
      </section>

      <div data-dashboard-level="Tabellendetails" className="grid gap-6 lg:grid-cols-2">
        <Card className="flex h-[250px] flex-col overflow-hidden shadow-sm gap-3 py-4">
          <CardHeader className="shrink-0">
            <CardTitle>Verantwortlichkeiten pro Ansprechpartner</CardTitle>
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
                    <td className="px-1 py-1 text-center tabular-nums">{v.betreuteHelfer}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{v.vorbereitung}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{v.nachbereitung}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{v.material}</td>
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
                  <th className="bg-slate-50 py-1 pl-0.5 text-right sm:pl-1">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {visibleWorkload.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap py-1 pr-1 sm:pr-2"
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
                          className={`px-0.5 py-1 text-right tabular-nums sm:px-1 ${availabilityClass}`}
                          title={availabilityTitle}
                        >
                          {value}
                        </td>
                      );
                    })}
                    <td className="py-1 pl-0.5 text-right font-semibold tabular-nums sm:pl-1">
                      {a.gesamt}
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

      <section data-dashboard-level="Live-Standortkarte" className="w-full">
        <LocationMapCard />
      </section>
    </div>
  );
}
