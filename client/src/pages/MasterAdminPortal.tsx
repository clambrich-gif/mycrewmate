import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MfaEnrollmentQr } from "@/components/MfaEnrollmentQr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { pilotInquiryPhoneLink } from "@/lib/pilot-inquiry-phone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { storePreviewSessionToken } from "@/lib/preview-session";
import { appUrl } from "@/lib/site-host";
import {
  PRODUCT_ASSIGNMENT_STATUSES,
  PRODUCT_PACKAGE_IDS,
  PRODUCT_PACKAGE_META,
  type ProductAssignmentStatus,
  type ProductPackageId,
} from "@shared/product-packages";
import {
  TENANT_ACCESS_MODES,
  TENANT_ACCESS_MODE_META,
  tenantAccessModeFromState,
  type TenantAccessMode,
} from "@shared/tenant-access-mode";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  PauseCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type TenantStatus = "pilot" | "sample" | "active" | "suspended" | "archived";

const STATUS_META: Record<
  TenantStatus,
  { label: string; className: string }
> = {
  pilot: { label: "Pilot", className: "border-blue-200 bg-blue-50 text-blue-800" },
  sample: { label: "Muster", className: "border-slate-200 bg-slate-50 text-slate-700" },
  active: { label: "Aktiv", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  suspended: { label: "Pausiert", className: "border-amber-200 bg-amber-50 text-amber-800" },
  archived: { label: "Archiv", className: "border-slate-200 bg-slate-100 text-slate-600" },
};

const INITIAL_EVENT_DAYS = ["Freitag", "Samstag", "Sonntag"] as const;
const EVENT_DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

type CreateTenantForm = {
  name: string;
  contactEmail: string;
  accessMode: TenantAccessMode;
  packageId: ProductPackageId;
  packageStartsOn: string;
  packageEndsOn: string;
  initialEventName: string;
  initialEventYear: string;
  activeDays: string[];
  createInitialAdmin: boolean;
  initialAdminName: string;
  initialAdminEmail: string;
  initialAdminPassword: string;
  initialAdminPasswordConfirmation: string;
};

type TenantOverviewItem = {
  id: string;
  name: string;
  legalName: string;
  status: TenantStatus;
  planName: string;
  contactEmail: string;
  supportEmail: string;
  createdAt?: Date;
  archivedAt?: Date | null;
  retentionEndsAt?: Date | null;
  archiveReason?: "pilot_expired" | "manual" | null;
  eventCount: number;
  events: Array<{
    id: number;
    name: string;
    year: number;
    startDate: string | null;
    endDate: string | null;
    status: "active" | "closed";
    closedAt: Date | null;
  }>;
  nextEvent: {
    id?: number;
    name: string;
    year?: number;
    startDate: string | null;
    endDate: string | null;
  } | null;
  productAssignment: {
    packageId: ProductPackageId;
    status: ProductAssignmentStatus;
    startsOn: string | null;
    endsOn: string | null;
    eventId: number | null;
    internalNote: string | null;
  };
  productUsage: {
    packageId: ProductPackageId;
    eventsPerYear: ProductLimitUsageMetric;
    helpersPerEvent: ProductLimitUsageMetric;
    personalPlanningAccesses: ProductLimitUsageMetric;
  };
  adminActivation: {
    total: number;
    passwordConfigured: number;
    initialSetupPending: number;
    mfaEnabled: number;
    adminName: string | null;
    adminEmail: string | null;
  };
  contractAcceptance: {
    isCurrent: boolean;
    confirmedDocumentCount: number;
    requiredDocumentCount: number;
    acceptedAt: Date | null;
  };
};

type ProductLimitUsageMetric = {
  used: number;
  limit: number | null;
  percentage: number | null;
  available: boolean;
  context: string | null;
};

type ProductAssignmentForm = {
  packageId: ProductPackageId;
  status: ProductAssignmentStatus;
  startsOn: string;
  endsOn: string;
  eventId: string;
  internalNote: string;
};

type PilotInquiryItem = {
  id: number;
  clubName: string;
  contactName: string;
  email: string;
  phone: string | null;
  organizationType: string;
  occasion: string;
  desiredStart: string;
  note: string | null;
  status: "open" | "accepted" | "declined";
  privacyAcceptedAt: Date;
  eligibilityConfirmedAt: Date;
  closedAt: Date | null;
  retentionEndsAt: Date | null;
  createdAt: Date;
};

const PRODUCT_BADGE_CLASS: Record<ProductPackageId, string> = {
  event_pass: "border-orange-200 bg-orange-50 text-orange-900",
  light: "border-slate-200 bg-slate-50 text-slate-800",
  pro: "border-blue-200 bg-blue-50 text-blue-800",
  enterprise: "border-violet-200 bg-violet-50 text-violet-800",
};

const PRODUCT_DISTRIBUTION_STYLE: Record<
  ProductPackageId,
  { bar: string; icon: string; count: string }
> = {
  event_pass: {
    bar: "bg-orange-500",
    icon: "bg-orange-100 text-orange-800",
    count: "text-orange-800",
  },
  light: {
    bar: "bg-slate-500",
    icon: "bg-slate-100 text-slate-800",
    count: "text-slate-800",
  },
  pro: {
    bar: "bg-blue-600",
    icon: "bg-blue-100 text-blue-800",
    count: "text-blue-800",
  },
  enterprise: {
    bar: "bg-violet-600",
    icon: "bg-violet-100 text-violet-800",
    count: "text-violet-800",
  },
};

const PRODUCT_ASSIGNMENT_STATUS_CLASS: Record<ProductAssignmentStatus, string> = {
  test: "border-slate-200 bg-slate-50 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  expired: "border-red-200 bg-red-50 text-red-800",
};

function masterAssignmentStatusLabel(
  status: ProductAssignmentStatus,
  tenantStatus: TenantStatus = "sample"
) {
  return TENANT_ACCESS_MODE_META[
    tenantAccessModeFromState({ tenantStatus, packageStatus: status })
  ].label;
}

function productUsageTone(metric: ProductLimitUsageMetric) {
  if (!metric.available) {
    return { bar: "bg-slate-300", text: "text-slate-500" };
  }
  if (metric.limit === null) {
    return { bar: "bg-violet-500", text: "text-violet-800" };
  }
  if ((metric.percentage ?? 0) >= 100) {
    return { bar: "bg-red-500", text: "text-red-800" };
  }
  if ((metric.percentage ?? 0) >= 80) {
    return { bar: "bg-amber-500", text: "text-amber-800" };
  }
  return { bar: "bg-emerald-500", text: "text-emerald-800" };
}

function TenantProductUsage({
  usage,
  events,
}: {
  usage: TenantOverviewItem["productUsage"];
  events: TenantOverviewItem["events"];
}) {
  const metrics = [
    { id: "events", label: "Aktive Events/Jahr", metric: usage.eventsPerYear },
    { id: "helpers", label: "Helfer · aktivstes Event", metric: usage.helpersPerEvent },
    {
      id: "accesses",
      label: "persönliche Zugänge",
      metric: usage.personalPlanningAccesses,
    },
  ];
  const enterprise = usage.packageId === "enterprise";
  const activeEventCount = events.filter(event => event.status === "active").length;
  const closedEventCount = events.length - activeEventCount;

  return (
    <section
      data-slot="tenant-product-usage"
      aria-label="Auslastung der Paketgrenzen"
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Paket-Auslastung
        </p>
        <p className="text-[11px] text-slate-500">
          {enterprise ? "Enterprise · unbegrenzt" : "Nur aktive Events zählen"}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Verein gesamt: {activeEventCount} aktiv
        {closedEventCount > 0 ? ` · ${closedEventCount} abgeschlossen` : ""}
        {" · "}{events.length} insgesamt
      </p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {metrics.map(({ id, label, metric }) => {
          const tone = productUsageTone(metric);
          const percent = metric.percentage ?? 0;
          const value = !metric.available
            ? "Nicht enthalten"
            : metric.limit === null
              ? `${metric.used} · unbegrenzt`
              : `${metric.used}/${metric.limit}`;
          return (
            <div key={id} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-slate-600">{label}</span>
                <span className={`shrink-0 text-[11px] font-bold tabular-nums ${tone.text}`}>{value}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${tone.bar}`}
                  style={{ width: `${metric.limit === null ? 100 : Math.min(percent, 100)}%` }}
                />
              </div>
              <p className="mt-1 truncate text-[10px] text-slate-500">
                {!metric.available
                  ? "Im Paket nicht verfügbar"
                  : metric.context ?? (metric.limit === null ? "Keine Obergrenze" : `${percent}% genutzt`)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TenantAdminActivationStatus({
  activation,
}: {
  activation: TenantOverviewItem["adminActivation"];
}) {
  if (activation.total === 0) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
        <KeyRound className="mt-0.5 size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span><strong>Admin-Zugang noch nicht eingerichtet.</strong> Über „Admin-Zugang einrichten“ wird ein persönlicher Zugang vorbereitet.</span>
      </div>
    );
  }

  if (activation.passwordConfigured > 0) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950" role="status">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
        <span>
          <strong>
            {activation.passwordConfigured === 1
              ? "Vereinsadministrator hat sein Passwort eingerichtet."
              : `${activation.passwordConfigured} Vereinsadministratoren haben ihr Passwort eingerichtet.`}
          </strong>
          {activation.initialSetupPending > 0
            ? ` ${activation.initialSetupPending} weitere${activation.initialSetupPending === 1 ? " Ersteinrichtung ist" : " Ersteinrichtungen sind"} noch offen.`
            : " Der persönliche Zugang ist einsatzbereit."}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950" role="status">
      <Loader2 className="mt-0.5 size-3.5 shrink-0 text-blue-700" aria-hidden="true" />
      <span><strong>Ersteinrichtung offen.</strong> Der Vereinsadministrator muss sich einmal anmelden und das Initialpasswort durch ein eigenes Passwort ersetzen.</span>
    </div>
  );
}

function TenantMfaStatus({
  activation,
}: {
  activation: TenantOverviewItem["adminActivation"];
}) {
  if (activation.total === 0) return null;
  const fullyProtected = activation.mfaEnabled === activation.total;
  return (
    <div
      data-slot="tenant-mfa-status"
      className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${
        fullyProtected
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
      role="status"
    >
      {fullyProtected ? (
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
      )}
      <span>
        <strong>MFA-Status:</strong> {activation.mfaEnabled} von {activation.total} persönlichem
        {activation.total === 1 ? " Vereinsadmin" : " Vereinsadmins"} mit Authenticator-App
        geschützt.
      </span>
    </div>
  );
}

function TenantContractAcceptanceStatus({
  acceptance,
}: {
  acceptance: TenantOverviewItem["contractAcceptance"];
}) {
  if (acceptance.isCurrent) {
    return (
      <div
        data-slot="tenant-contract-acceptance"
        className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950"
        role="status"
      >
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
        <span>
          <strong>Zustimmungen für den Vereinszugang vollständig.</strong>{" "}
          {acceptance.requiredDocumentCount} von {acceptance.requiredDocumentCount} aktuellen
          Zugangsdokumenten sind bestätigt
          {acceptance.acceptedAt
            ? ` · zuletzt bestätigt am ${formatAccessCreatedAt(acceptance.acceptedAt)}.`
            : "."}
        </span>
      </div>
    );
  }

  return (
    <div
      data-slot="tenant-contract-acceptance"
      className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
      role="status"
      >
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          <strong>Zustimmungen für den Vereinszugang noch offen.</strong>{" "}
          {acceptance.confirmedDocumentCount} von {acceptance.requiredDocumentCount} aktuellen
          Zugangsdokumenten sind bestätigt. Fehlende Zustimmungen werden vor der Freigabe des
          Vereinszugangs verbindlich abgefragt.
      </span>
    </div>
  );
}

function demoProductUsage(): TenantOverviewItem["productUsage"] {
  return {
    packageId: "pro",
    eventsPerYear: {
      used: 1,
      limit: 5,
      percentage: 20,
      available: true,
      context: "Spitzenjahr 2027",
    },
    helpersPerEvent: {
      used: 0,
      limit: 350,
      percentage: 0,
      available: true,
      context: "MyEifelRide 2027",
    },
    personalPlanningAccesses: {
      used: 0,
      limit: 14,
      percentage: 0,
      available: true,
      context: "Co-Admins zusätzlich",
    },
  };
}

type PlatformAccessInventoryItem = {
  type: "tenant_admin" | "planning_team";
  accessId: number;
  name: string;
  email: string | null;
  status: "active" | "suspended" | "legacy";
  tenantNames: string[];
  tenantIds: string[];
  createdAt: Date;
  hasDuplicateEmail: boolean;
};

function defaultCreateTenantForm(): CreateTenantForm {
  return {
    name: "",
    contactEmail: "",
    accessMode: "pilot",
    packageId: "pro",
    packageStartsOn: "",
    packageEndsOn: "",
    initialEventName: "",
    initialEventYear: "2027",
    activeDays: [...INITIAL_EVENT_DAYS],
    createInitialAdmin: false,
    initialAdminName: "",
    initialAdminEmail: "",
    initialAdminPassword: "",
    initialAdminPasswordConfirmation: "",
  };
}

function TenantAccessPanel({
  accesses,
  deleting,
  onRequestDelete,
}: {
  accesses: PlatformAccessInventoryItem[];
  deleting: boolean;
  onRequestDelete: (access: PlatformAccessInventoryItem) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div data-slot="tenant-access-panel" className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
          >
            <span className="flex min-w-0 items-center gap-2"><UsersRound className="size-4 shrink-0 text-blue-700" /> Zugänge ({accesses.length})</span>
            <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-200">
          <div className="space-y-2 p-3">
            {accesses.length === 0 ? (
              <p className="text-xs leading-5 text-slate-600">Für diesen Verein sind noch keine persönlichen Zugänge angelegt.</p>
            ) : accesses.map(access => {
              const sharedAcrossTenants = access.tenantIds.length > 1;
              return (
                <article key={`${access.type}-${access.accessId}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-slate-900">{access.name}</p>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">{access.type === "tenant_admin" ? "Vereinsadmin" : "Planungsteam"}</Badge>
                      {access.hasDuplicateEmail && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">E-Mail-Dublette</Badge>}
                      {access.status === "legacy" && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">ohne E-Mail</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{access.email ?? "Keine persönliche E-Mail hinterlegt"} · angelegt am {formatAccessCreatedAt(access.createdAt)}</p>
                    {sharedAcrossTenants && <p className="mt-1 text-xs leading-5 text-amber-800">Dieser Zugang ist mehreren Vereinen zugeordnet. Eine Löschung wird hier vorsichtshalber nicht angeboten.</p>}
                  </div>
                  {!sharedAcrossTenants && (
                    <Button size="sm" variant="outline" className="shrink-0 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleting} onClick={() => onRequestDelete(access)}>
                      <Trash2 className="size-3.5" /> Zugang entfernen
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Termin offen";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function defaultProductAssignmentForm(
  assignment: TenantOverviewItem["productAssignment"],
  events: TenantOverviewItem["events"]
): ProductAssignmentForm {
  return {
    packageId: assignment.packageId,
    status: assignment.status,
    startsOn: assignment.startsOn ?? "",
    endsOn: assignment.endsOn ?? "",
    eventId:
      assignment.eventId?.toString() ??
      (assignment.packageId === "event_pass" ? events[0]?.id.toString() ?? "" : ""),
    internalNote: assignment.internalNote ?? "",
  };
}

function formatAccessCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function PortalLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_6%_6%,rgba(219,234,254,0.9),transparent_33%),radial-gradient(circle_at_95%_95%,rgba(224,242,254,0.75),transparent_30%),#f8fafc] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white/80" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MasterLogin() {
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const login = trpc.auth.adminPasswordLogin.useMutation({
    mutationKey: ["auth", "adminPasswordLogin", "master-portal"],
    onSuccess: async result => {
      if ("requiresMfa" in result && result.requiresMfa) {
        setMfaChallengeToken(result.mfaChallengeToken);
        setMfaCode("");
        setPassword("");
        setError(null);
        return;
      }
      if (result.requiresIdentity) {
        setError("Die Master-Identität konnte nicht bestätigt werden.");
        return;
      }
      storePreviewSessionToken(result.previewSessionToken);
      setPassword("");
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: mutationError => setError(mutationError.message),
  });
  const verifyMfaLogin = trpc.auth.verifyMfaLogin.useMutation({
    mutationKey: ["auth", "verifyMfaLogin", "master-portal"],
    onSuccess: async result => {
      setMfaChallengeToken(null);
      setMfaCode("");
      setError(null);
      storePreviewSessionToken(result.previewSessionToken);
      await utils.auth.me.invalidate();
    },
    onError: mutationError => setError(mutationError.message),
  });
  const requestReset = trpc.auth.requestAdminPasswordReset.useMutation({
    onSuccess: () => {
      setError(null);
      setResetNotice(
        "Falls ein Masterzugang eingerichtet ist, wurde ein einmaliger Reset-Link an die hinterlegte Sicherheitsadresse gesendet."
      );
    },
    onError: () => {
      setResetNotice(
        "Falls ein Masterzugang eingerichtet ist, wurde ein einmaliger Reset-Link an die hinterlegte Sicherheitsadresse gesendet."
      );
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    login.mutate({
      password,
      administratorName: "Plattform-Inhaber",
    });
  };
  const submitMfa = (event: FormEvent) => {
    event.preventDefault();
    if (!mfaChallengeToken || !mfaCode.trim()) return;
    verifyMfaLogin.mutate({ mfaChallengeToken, code: mfaCode.trim() });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_8%_7%,rgba(219,234,254,0.92),transparent_34%),radial-gradient(circle_at_96%_94%,rgba(224,242,254,0.76),transparent_32%),#f8fafc] p-4">
      <Card className="w-full max-w-md border-slate-200 bg-white/95 py-0 text-slate-950 shadow-xl shadow-blue-100/60">
        <CardHeader className="border-b border-slate-100 px-6 py-6 text-center sm:px-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-3 text-xl">MyCrewMate · Master-Admin</CardTitle>
          <CardDescription className="leading-5">
            Geschützter Bereich für die Plattformverwaltung. Kein Vereinszugang.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 sm:px-8">
          {mfaChallengeToken ? (
            <form className="space-y-4" onSubmit={submitMfa}>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-950">
                <p className="font-semibold">Zweite Sicherheitsstufe</p>
                <p className="mt-1 text-xs text-blue-900">
                  Geben Sie den sechsstelligen Code Ihrer Authenticator-App oder einen unbenutzten Wiederherstellungscode ein.
                </p>
              </div>
              <label className="block space-y-1.5" htmlFor="master-admin-mfa">
                <span className="text-sm font-semibold text-slate-800">Sicherheitscode</span>
                <input
                  id="master-admin-mfa"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={event => setMfaCode(event.target.value)}
                  disabled={verifyMfaLogin.isPending}
                  placeholder="123456 oder ABC12-34567"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                  autoFocus
                />
              </label>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
              <Button className="h-11 w-full" type="submit" disabled={!mfaCode.trim() || verifyMfaLogin.isPending}>
                {verifyMfaLogin.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                Sicher anmelden
              </Button>
              <Button type="button" variant="ghost" className="w-full text-slate-600" disabled={verifyMfaLogin.isPending} onClick={() => { setMfaChallengeToken(null); setMfaCode(""); setError(null); }}>
                Zurück zur Anmeldung
              </Button>
            </form>
          ) : (
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5" htmlFor="master-admin-password">
              <span className="text-sm font-semibold text-slate-800">Master-Passwort</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="master-admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={login.isPending}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  placeholder="Passwort eingeben"
                />
              </div>
            </label>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}
            {resetNotice && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-5 text-blue-900" role="status">
                {resetNotice}
              </p>
            )}
            <Button className="h-11 w-full" type="submit" disabled={!password || login.isPending}>
              {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              Master-Portal öffnen
            </Button>
          </form>
          )}
          <div className="mt-3 text-center">
            <Button
              type="button"
              variant="link"
              className="h-auto px-1 text-sm text-blue-700"
              onClick={() => requestReset.mutate()}
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
              Master-Passwort vergessen?
            </Button>
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Nach fünf Fehlversuchen wird der Zugang gesperrt. Die Wiederherstellung erfolgt ausschließlich über einen zeitlich begrenzten E-Mail-Link.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function MasterPasswordReset({
  token,
  onCompleted,
}: {
  token: string;
  onCompleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = trpc.auth.resetAdminPasswordWithEmailToken.useMutation({
    onSuccess: () => {
      setPassword("");
      setConfirmation("");
      setError(null);
      onCompleted();
      toast.success("Master-Passwort wurde geändert. Bitte melden Sie sich jetzt neu an.");
    },
    onError: mutationError => setError(mutationError.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Die beiden Passwortangaben stimmen nicht überein.");
      return;
    }
    reset.mutate({ token, newPassword: password });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_8%_7%,rgba(219,234,254,0.92),transparent_34%),radial-gradient(circle_at_96%_94%,rgba(224,242,254,0.76),transparent_32%),#f8fafc] p-4">
      <Card className="w-full max-w-md border-slate-200 bg-white/95 py-0 text-slate-950 shadow-xl shadow-blue-100/60">
        <CardHeader className="border-b border-slate-100 px-6 py-6 text-center sm:px-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <KeyRound className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-3 text-xl">Neues Master-Passwort</CardTitle>
          <CardDescription className="leading-5">
            Nach dem Speichern werden alle bestehenden MyCrewMate-Sitzungen sicher abgemeldet.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 sm:px-8">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5" htmlFor="master-reset-password">
              <span className="text-sm font-semibold text-slate-800">Neues Master-Passwort</span>
              <Input
                id="master-reset-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={reset.isPending}
                placeholder="Mindestens 10 Zeichen"
              />
            </label>
            <label className="block space-y-1.5" htmlFor="master-reset-password-confirmation">
              <span className="text-sm font-semibold text-slate-800">Passwort wiederholen</span>
              <Input
                id="master-reset-password-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                disabled={reset.isPending}
                placeholder="Passwort wiederholen"
              />
            </label>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}
            <Button
              className="h-11 w-full"
              type="submit"
              disabled={password.length < 10 || confirmation.length < 10 || reset.isPending}
            >
              {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Passwort sicher speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AccessDenied({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg border-amber-200 bg-white py-0 text-center text-slate-950 shadow-sm">
        <CardHeader className="items-center px-6 py-7">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="mt-3 text-xl">Kein Master-Zugriff</CardTitle>
          <CardDescription className="max-w-sm leading-5">
            Dieses Portal ist ausschließlich für den Plattform-Inhaber vorgesehen. Vereinszugänge bleiben getrennt.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7">
          <Button variant="outline" onClick={() => void onLogout()}>
            <LogOut className="size-4" /> Abmelden
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function MasterMfaCard() {
  const utils = trpc.useUtils();
  const status = trpc.auth.mfaStatus.useQuery();
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [regeneratedRecoveryCodes, setRegeneratedRecoveryCodes] = useState<string[] | null>(
    null
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const begin = trpc.auth.beginMfaEnrollment.useMutation({
    onSuccess: result =>
      setSetup({
        secret: result.secret,
        otpauthUri: result.otpauthUri,
        recoveryCodes: result.recoveryCodes,
      }),
    onError: error => toast.error(error.message),
  });
  const confirm = trpc.auth.confirmMfaEnrollment.useMutation({
    onSuccess: async () => {
      setSetup(null);
      setCode("");
      setPassword("");
      await utils.auth.mfaStatus.invalidate();
      toast.success("MFA für das Masterportal ist jetzt aktiv.");
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.auth.disableMfa.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.auth.mfaStatus.invalidate();
      toast.success("MFA für das Masterportal wurde deaktiviert.");
    },
    onError: error => toast.error(error.message),
  });
  const regenerateRecoveryCodes = trpc.auth.regenerateMfaRecoveryCodes.useMutation({
    onSuccess: async result => {
      setRecoveryPassword("");
      setRegeneratedRecoveryCodes(result.recoveryCodes);
      await utils.auth.mfaStatus.invalidate();
      toast.success("Neue Master-Notfallcodes wurden einmalig angezeigt.");
    },
    onError: error => toast.error(error.message),
  });

  if (!status.data?.eligible) return null;
  if (status.data.enabled) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60">
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold text-emerald-950"><ShieldCheck className="size-5" /> Master-MFA ist aktiv</p>
                <p className="mt-1 text-sm text-emerald-900">Authenticator-Code beim Login erforderlich · {status.data.remainingRecoveryCodes} Wiederherstellungscodes verbleibend.</p>
              </div>
              <CollapsibleTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="w-fit border-emerald-300 bg-white text-emerald-950 hover:bg-emerald-100">
                  Sicherheitsdetails
                  <ChevronDown className={`size-4 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t border-emerald-200">
              <div className="space-y-4 p-4">
                <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-white/80 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Master-MFA deaktivieren</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Nur bewusst und mit dem aktuellen Master-Passwort.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="password" autoComplete="current-password" className="h-9 w-52 bg-white" placeholder="Passwort für Deaktivierung" value={password} onChange={event => setPassword(event.target.value)} />
                    <Button type="button" variant="outline" className="border-red-300 bg-white text-red-800 hover:bg-red-50" disabled={!password || disable.isPending} onClick={() => { if (window.confirm("Master-MFA wirklich deaktivieren?")) disable.mutate({ currentPassword: password }); }}>
                      {disable.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Deaktivieren
                    </Button>
                  </div>
                </div>
                {regeneratedRecoveryCodes && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" aria-live="polite">
                    <p className="font-semibold">Neue Master-Notfallcodes – jetzt sicher ablegen</p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">Die bisherigen Codes sind sofort ungültig. Jeder neue Code funktioniert genau einmal und wird nach dieser Anzeige nicht erneut eingeblendet.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-900 sm:grid-cols-4">
                      {regeneratedRecoveryCodes.map(recoveryCode => (
                        <code key={recoveryCode} className="rounded bg-white px-2 py-1.5 text-center ring-1 ring-amber-200 [font-variant-numeric:slashed-zero]">{recoveryCode}</code>
                      ))}
                    </div>
                  </div>
                )}
                <div className="max-w-xl space-y-2 rounded-xl border border-emerald-200 bg-white/75 p-3.5">
                  <p className="text-sm font-semibold text-slate-900">Acht Master-Notfallcodes neu erzeugen</p>
                  <p className="text-xs leading-5 text-slate-600">Nur bei Verlust oder bewusstem Austausch. Als Bestätigung ist das aktuelle Master-Passwort erforderlich.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input type="password" autoComplete="current-password" className="bg-white sm:max-w-xs" placeholder="Aktuelles Master-Passwort" value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} />
                    <Button type="button" variant="outline" className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100" disabled={!recoveryPassword || regenerateRecoveryCodes.isPending} onClick={() => { if (window.confirm("Acht neue Master-Notfallcodes erzeugen? Alle bisherigen Notfallcodes werden sofort ungültig.")) regenerateRecoveryCodes.mutate({ currentPassword: recoveryPassword }); }}>
                      {regenerateRecoveryCodes.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Neue Notfallcodes erzeugen
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>
    );
  }
  if (!setup) {
    return (
      <Card className="border-amber-200 bg-amber-50/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold text-amber-950"><ShieldCheck className="size-5" /> Masterportal zusätzlich absichern</p>
            <p className="mt-1 text-sm text-amber-900">Authenticator-App als zweite Anmeldestufe aktivieren. Für die Plattformverwaltung dringend empfohlen.</p>
          </div>
          <Button type="button" onClick={() => begin.mutate()} disabled={begin.isPending}>
            {begin.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} MFA einrichten
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Master-MFA einrichten</CardTitle>
        <CardDescription>
          QR-Code mit einer Authenticator-App scannen, Wiederherstellungscodes sicher ablegen und anschließend mit einem aktuellen App-Code bestätigen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="rounded-xl border border-blue-200 bg-white/90 p-4">
          <p className="text-sm font-semibold text-slate-950">1. QR-Code mit dem Smartphone scannen</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">
            Öffnen Sie Ihre Authenticator-App, wählen Sie <strong>Konto hinzufügen</strong> und scannen Sie diesen QR-Code. Der Schlüssel bleibt dabei in Ihrem Browser und bei MyCrewMate.
          </p>
          <MfaEnrollmentQr
            otpauthUri={setup.otpauthUri}
            alt="QR-Code für die Master-MFA-Einrichtung von MyCrewMate"
            className="mx-auto mt-4"
          />
        </section>

        <details className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
          <summary className="cursor-pointer font-semibold text-slate-900">QR-Code kann nicht gescannt werden? Schlüssel manuell eingeben</summary>
          <p className="mt-2 text-xs leading-5 text-slate-700">
            Nur als Ausweichweg: Der Schlüssel nutzt Base32 (A–Z und 2–7). Eine Ziffer <strong>0</strong> kommt darin nie vor; ein <strong>O</strong> ist also immer ein Buchstabe.
          </p>
          <code className="mt-2 block select-all break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-950 ring-1 ring-blue-200 [font-variant-numeric:slashed-zero]">{setup.secret}</code>
        </details>

        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-950">2. Wiederherstellungscodes offline sichern</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Speichern Sie jeden Code separat an einem sicheren Ort. Jeder Code funktioniert nur einmal, falls das Smartphone nicht verfügbar ist.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {setup.recoveryCodes.map(recoveryCode => (
              <code key={recoveryCode} className="rounded bg-white px-2 py-1.5 text-center font-mono text-xs text-slate-950 ring-1 ring-amber-200 [font-variant-numeric:slashed-zero]">
                {recoveryCode}
              </code>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-slate-950">3. Einrichtung verbindlich aktivieren</p>
          <p className="text-xs leading-5 text-slate-700">Erst nach einem korrekt geprüften App-Code wird die Master-MFA gespeichert und beim nächsten Login verlangt.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Sechsstelliger App-Code" value={code} onChange={event => setCode(event.target.value)} />
            <Input type="password" autoComplete="current-password" placeholder="Master-Passwort zur Bestätigung" value={password} onChange={event => setPassword(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!code || !password || confirm.isPending} onClick={() => confirm.mutate({ secret: setup.secret, code, recoveryCodes: setup.recoveryCodes, currentPassword: password })}>
              {confirm.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} MFA aktivieren
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>Abbrechen</Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export default function MasterAdminPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantForm>(
    defaultCreateTenantForm
  );
  const [tenantPackageFilter, setTenantPackageFilter] = useState<
    "all" | ProductPackageId
  >("all");
  const [productModalTenant, setProductModalTenant] = useState<TenantOverviewItem | null>(null);
  const [productAssignmentForm, setProductAssignmentForm] = useState<ProductAssignmentForm | null>(null);
  const [adminModalTenant, setAdminModalTenant] = useState<{ id: string; name: string } | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [sendInvitationEmail, setSendInvitationEmail] = useState(false);
  const [issuedAdminSheet, setIssuedAdminSheet] = useState<{
    tenantName: string;
    adminName: string;
    email: string;
    invitationUrl: string;
    expiresAt: Date;
    emailSent?: boolean;
  } | null>(null);
  const [archiveModalTenant, setArchiveModalTenant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [testTenantToDelete, setTestTenantToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [accessToDelete, setAccessToDelete] = useState<PlatformAccessInventoryItem | null>(null);
  const [pilotInquiryToDelete, setPilotInquiryToDelete] = useState<PilotInquiryItem | null>(null);
  const resetToken = new URLSearchParams(window.location.search).get("reset");

  const createTenantAdmin = trpc.platformAdmin.createTenantAdmin.useMutation({
    onSuccess: async result => {
      if (adminModalTenant) {
        setIssuedAdminSheet({
          tenantName: adminModalTenant.name,
          adminName: result.name,
          email: result.email,
          invitationUrl: result.invitationUrl,
          expiresAt: result.expiresAt,
          emailSent: result.emailSent,
        });
      }
      setAdminModalTenant(null);
      setAdminName("");
      setAdminEmail("");
      setSendInvitationEmail(false);
      await Promise.all([
        utils.platformAdmin.tenantOverview.invalidate(),
        utils.platformAdmin.accessInventory.invalidate(),
      ]);
      toast.success("Vereins-Administrator erfolgreich angelegt");
    },
    onError: err => toast.error(err.message),
  });

  const createHandoff = trpc.platformAdmin.createHandoffLink.useMutation({
    onSuccess: result => {
      // Der Handoff darf nie auf der aktuellen Master-Domain landen: Die
      // Vereinsansicht lebt ausschließlich unter app.mycrewmate.de.
      const targetUrl = appUrl("/", `?handoff=${encodeURIComponent(result.handoffToken)}`);
      window.open(targetUrl, "_blank");
      toast.success("Vereinsansicht in neuem Tab geöffnet (5 Min. gültig)");
    },
    onError: err => toast.error(err.message),
  });
  const overview = trpc.platformAdmin.tenantOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const accessInventory = trpc.platformAdmin.accessInventory.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const pilotInquiries = trpc.platformAdmin.pilotInquiries.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
    refetchOnWindowFocus: true,
  });
  const completePilotInquiry = trpc.platformAdmin.completePilotInquiry.useMutation({
    onSuccess: async result => {
      await pilotInquiries.refetch();
      toast.success(
        result.status === "accepted"
          ? "Pilotanfrage als übernommen dokumentiert."
          : "Pilotanfrage als nicht weiterverfolgt dokumentiert."
      );
    },
    onError: error => toast.error(error.message),
  });
  const deletePilotInquiry = trpc.platformAdmin.deletePilotInquiry.useMutation({
    onSuccess: async () => {
      await pilotInquiries.refetch();
      setPilotInquiryToDelete(null);
      toast.success("Pilotanfrage vollständig gelöscht.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteTestAccess = trpc.platformAdmin.deleteTestAccess.useMutation({
    onSuccess: async result => {
      await accessInventory.refetch();
      setAccessToDelete(null);
      toast.success(`Persönlicher Zugang „${result.name}“ wurde entfernt.`);
    },
    onError: error => toast.error(error.message),
  });
  const createTenant = trpc.platformAdmin.createTenant.useMutation({
    onSuccess: async result => {
      await utils.platformAdmin.tenantOverview.invalidate();
      setCreateOpen(false);
      setCreateForm(defaultCreateTenantForm());
      toast.success(
        result.initialAdminCreated
          ? `„${result.tenantId}“ und der persönliche Adminzugang wurden angelegt.`
          : `„${result.tenantId}“ wurde als interner Verein angelegt.`
      );
    },
    onError: error => toast.error(error.message),
  });
  const updateTenantProductAssignment = trpc.platformAdmin.updateTenantProductAssignment.useMutation({
    onSuccess: async result => {
      await utils.platformAdmin.tenantOverview.invalidate();
      setProductModalTenant(null);
      setProductAssignmentForm(null);
      const notificationHint = result.notification.recipientCount
        ? ` ${result.notification.deliveredCount}/${result.notification.recipientCount} Administratoren wurden per E-Mail informiert.`
        : "";
      toast.success(`${PRODUCT_PACKAGE_META[result.packageId].name} wurde für den Verein gespeichert.${notificationHint}`);
    },
    onError: error => toast.error(error.message),
  });
  const updateLifecycle = trpc.platformAdmin.updateTenantLifecycle.useMutation({
    onSuccess: async result => {
      // Archivierungen entfernen persönliche Zugänge vollständig. Beide
      // Übersichten werden daher gemeinsam aktualisiert, damit auch ohne
      // Seitenneuladen niemals ein alter Zugang in der Inventarliste steht.
      await Promise.all([
        utils.platformAdmin.tenantOverview.invalidate(),
        utils.platformAdmin.accessInventory.invalidate(),
      ]);
      const notificationHint = result.notification.recipientCount
        ? ` ${result.notification.deliveredCount}/${result.notification.recipientCount} Administratoren wurden per E-Mail informiert.`
        : "";
      toast.success(`Vereinsstatus wurde auf „${STATUS_META[result.status].label}“ gesetzt.${notificationHint}`);
    },
    onError: error => toast.error(error.message),
  });
  const deleteInternalTestTenant = trpc.platformAdmin.deleteInternalTestTenant.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.platformAdmin.tenantOverview.invalidate(),
        utils.platformAdmin.accessInventory.invalidate(),
      ]);
      setTestTenantToDelete(null);
      toast.success(`Testverein „${result.tenantName}“ wurde einschließlich seiner Testdaten entfernt.`);
    },
    onError: error => toast.error(error.message),
  });

  const toggleEventDay = (day: string) => {
    setCreateForm(current => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter(value => value !== day)
        : [...current.activeDays, day],
    }));
  };

  const submitCreateTenant = (event: FormEvent) => {
    event.preventDefault();
    const initialEventYear = Number(createForm.initialEventYear);
    if (!Number.isInteger(initialEventYear) || initialEventYear < 2020 || initialEventYear > 2100) {
      toast.error("Bitte geben Sie ein gültiges Veranstaltungsjahr ein.");
      return;
    }
    if (!createForm.activeDays.length) {
      toast.error("Bitte wählen Sie mindestens einen Veranstaltungstag.");
      return;
    }
    if (createForm.createInitialAdmin) {
      if (
        !createForm.initialAdminName.trim() ||
        !createForm.initialAdminEmail.trim() ||
        createForm.initialAdminPassword.length < 10
      ) {
        toast.error("Bitte vervollständigen Sie Name, E-Mail und ein Initialpasswort mit mindestens 10 Zeichen.");
        return;
      }
      if (createForm.initialAdminPassword !== createForm.initialAdminPasswordConfirmation) {
        toast.error("Die beiden Initialpasswörter stimmen nicht überein.");
        return;
      }
    }
    createTenant.mutate({
      name: createForm.name,
      contactEmail: createForm.contactEmail,
      accessMode: createForm.accessMode,
      packageId: createForm.packageId,
      initialEventName: createForm.initialEventName,
      initialEventYear,
      packageStartsOn: createForm.packageStartsOn || null,
      packageEndsOn: createForm.packageEndsOn || null,
      initialAdmin: createForm.createInitialAdmin
        ? {
            name: createForm.initialAdminName.trim(),
            email: createForm.initialAdminEmail.trim(),
            password: createForm.initialAdminPassword,
            passwordConfirmation: createForm.initialAdminPasswordConfirmation,
          }
        : undefined,
      activeDays: createForm.activeDays as Array<
        "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag" | "Samstag" | "Sonntag"
      >,
    });
  };

  const isVisualPreview =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("manus.computer") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    new URLSearchParams(window.location.search).get("demo") === "true";

  if (loading) return <PortalLoading />;
  if (!isAuthenticated && !isVisualPreview && resetToken) {
    return (
      <MasterPasswordReset
        token={resetToken}
        onCompleted={() => window.history.replaceState({}, "", window.location.pathname)}
      />
    );
  }
  if (!isAuthenticated && !isVisualPreview) return <MasterLogin />;
  if (!isVisualPreview && (user?.role !== "admin" || overview.error?.data?.code === "FORBIDDEN")) {
    return <AccessDenied onLogout={logout} />;
  }
  if (overview.isLoading) return <PortalLoading />;
  // Beim allerersten Laden ohne Daten bleibt eine sichere Fehlerseite sinnvoll.
  // Bei einem späteren Refetch liegen hingegen bereits Daten und möglicherweise
  // offene Dialoge vor. In diesem Fall darf ein temporärer Netzwerkfehler weder
  // den Portalbaum noch einen laufenden Entwurf entfernen.
  if (overview.error && !overview.data && !isVisualPreview) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <Card className="w-full max-w-lg border-red-200 bg-white py-0 text-slate-950 shadow-sm">
          <CardHeader className="px-6 py-6">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <CircleAlert className="size-5" /> Übersicht momentan nicht verfügbar
            </CardTitle>
            <CardDescription>{overview.error.message}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const tenants = overview.data ?? [];
  const displayTenants =
    tenants.length > 0
      ? tenants
      : [
          {
            id: "admin-vorschau-verein",
            name: "Vereinsvorschau e. V.",
            legalName: "Vereinsvorschau e. V.",
            contactEmail: "kontakt@vereinsvorschau.de",
            supportEmail: "support@mycrewmate.de",
            status: "pilot",
            planName: "Pilotbetrieb",
            productAssignment: {
              packageId: "pro",
              status: "test",
              startsOn: null,
              endsOn: null,
              eventId: null,
              internalNote: null,
            },
            productUsage: demoProductUsage(),
            adminActivation: { total: 0, passwordConfigured: 0, initialSetupPending: 0, mfaEnabled: 0, adminName: null, adminEmail: null },
            contractAcceptance: {
              isCurrent: true,
              confirmedDocumentCount: 3,
              requiredDocumentCount: 3,
              acceptedAt: new Date("2026-10-01T10:00:00.000Z"),
            },
            eventCount: 1,
            events: [{ id: 1, name: "Musterveranstaltung 2027", year: 2027, startDate: "2027-06-11", endDate: "2027-06-13", status: "active", closedAt: null }],
            nextEvent: {
              id: 1,
              name: "Musterveranstaltung 2027",
              startDate: "2027-06-11",
              endDate: "2027-06-13",
            },
          },
          {
            id: "kirmesgesellschaft-mayen",
            name: "Kirmesgesellschaft Mayen e. V.",
            legalName: "Kirmesgesellschaft Mayen e. V.",
            contactEmail: "orga@kirmes-mayen.de",
            supportEmail: "support@mycrewmate.de",
            status: "sample",
            planName: "Musterverein",
            productAssignment: {
              packageId: "pro",
              status: "test",
              startsOn: null,
              endsOn: null,
              eventId: null,
              internalNote: null,
            },
            productUsage: demoProductUsage(),
            adminActivation: { total: 0, passwordConfigured: 0, initialSetupPending: 0, mfaEnabled: 0, adminName: null, adminEmail: null },
            contractAcceptance: {
              isCurrent: false,
              confirmedDocumentCount: 0,
              requiredDocumentCount: 3,
              acceptedAt: null,
            },
            eventCount: 1,
            events: [{ id: 2, name: "Lukasmarkt 2027", year: 2027, startDate: "2027-10-15", endDate: "2027-10-17", status: "active", closedAt: null }],
            nextEvent: {
              id: 2,
              name: "Lukasmarkt 2027",
              startDate: "2027-10-15",
              endDate: "2027-10-17",
            },
          },
          {
            id: "schuetzenbruderschaft-mayen",
            name: "St. Sebastianus Schützenbruderschaft",
            legalName: "St. Sebastianus Schützenbruderschaft Mayen e. V.",
            contactEmail: "vorstand@schuetzen-mayen.de",
            supportEmail: "support@mycrewmate.de",
            status: "sample",
            planName: "Musterverein",
            productAssignment: {
              packageId: "pro",
              status: "test",
              startsOn: null,
              endsOn: null,
              eventId: null,
              internalNote: null,
            },
            productUsage: demoProductUsage(),
            adminActivation: { total: 0, passwordConfigured: 0, initialSetupPending: 0, mfaEnabled: 0, adminName: null, adminEmail: null },
            contractAcceptance: {
              isCurrent: false,
              confirmedDocumentCount: 0,
              requiredDocumentCount: 3,
              acceptedAt: null,
            },
            eventCount: 1,
            events: [{ id: 3, name: "Schützenfest 2027", year: 2027, startDate: "2027-07-02", endDate: "2027-07-04", status: "active", closedAt: null }],
            nextEvent: {
              id: 3,
              name: "Schützenfest 2027",
              startDate: "2027-07-02",
              endDate: "2027-07-04",
            },
          },
        ];
  const allTenants = (tenants.length > 0 ? tenants : displayTenants) as TenantOverviewItem[];
  const activeTenants = allTenants.filter(tenant => tenant.status !== "archived");
  const archivedTenants = allTenants.filter(tenant => tenant.status === "archived");
  const filteredActiveTenants = activeTenants.filter(
    tenant =>
      tenantPackageFilter === "all" ||
      tenant.productAssignment.packageId === tenantPackageFilter
  );
  const filteredArchivedTenants = archivedTenants.filter(
    tenant =>
      tenantPackageFilter === "all" ||
      tenant.productAssignment.packageId === tenantPackageFilter
  );
  const pilotCount = activeTenants.filter(tenant => tenant.status === "pilot").length;
  const managedEventCount = activeTenants.reduce((sum, tenant) => sum + tenant.eventCount, 0);
  const personalAccesses = (accessInventory.data ?? []) as PlatformAccessInventoryItem[];
  const pilotInquiryItems = (pilotInquiries.data ?? []) as PilotInquiryItem[];
  const openPilotInquiryCount = pilotInquiryItems.filter(inquiry => inquiry.status === "open").length;
  const overviewNeedsRenewedLogin = /please login|unauthorized|10001/i.test(overview.error?.message ?? "");
  const packageDistribution = PRODUCT_PACKAGE_IDS.map(packageId => {
    const assignedTenants = activeTenants.filter(
      tenant => tenant.productAssignment.packageId === packageId
    );
    return {
      packageId,
      count: assignedTenants.length,
      testCount: assignedTenants.filter(
        tenant => tenant.productAssignment.status === "test"
      ).length,
      pausedOrExpiredCount: assignedTenants.filter(
        tenant =>
          tenant.productAssignment.status === "paused" ||
          tenant.productAssignment.status === "expired"
      ).length,
      share: activeTenants.length
        ? Math.round((assignedTenants.length / activeTenants.length) * 100)
        : 0,
    };
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_5%_4%,rgba(219,234,254,0.95),transparent_32%),radial-gradient(circle_at_98%_96%,rgba(224,242,254,0.82),transparent_30%),#f8fafc] p-4 text-slate-950 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">MyCrewMate Plattform</p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Master-Admin-Portal</h1>
              </div>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                Vorab-Betrieb
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-5 text-slate-600">
              Zentrale, vereinsübergreifende Übersicht für den Plattform-Inhaber. Vereinsdaten und Zugänge bleiben voneinander getrennt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden text-right text-xs text-slate-500 sm:block">
              Angemeldet als<br />
              <strong className="font-semibold text-slate-700">{user?.name ?? "Plattform-Inhaber"}</strong>
            </span>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Verein anlegen
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" /> Abmelden
            </Button>
          </div>
        </header>

        <MasterMfaCard />

        {overview.error && !isVisualPreview && (
          <section
            data-slot="master-overview-refresh-error"
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="leading-5">
                <strong>{overviewNeedsRenewedLogin ? "Sitzung abgelaufen." : "Übersicht vorübergehend nicht aktualisiert."}</strong>{" "}
                {overviewNeedsRenewedLogin
                  ? "Bitte melde dich zum Schutz der Vereinsdaten erneut an."
                  : <>Bereits geladene Daten und offene Eingaben bleiben erhalten. {overview.error.message}</>}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
              disabled={overviewNeedsRenewedLogin ? false : overview.isFetching}
              onClick={() => overviewNeedsRenewedLogin ? void logout() : void overview.refetch()}
            >
              {overviewNeedsRenewedLogin ? <LogOut className="size-3.5" /> : overview.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              {overviewNeedsRenewedLogin ? "Abmelden und neu anmelden" : "Erneut versuchen"}
            </Button>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Plattformkennzahlen">
          <Card className="border-blue-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Building2 className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{activeTenants.length}</p><p className="mt-1 text-sm text-slate-600">Vereine in Verwaltung</p></div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><UsersRound className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{pilotCount}</p><p className="mt-1 text-sm text-slate-600">Pilotverein{pilotCount === 1 ? "" : "e"}</p></div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-white/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><CalendarDays className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{managedEventCount}</p><p className="mt-1 text-sm text-slate-600">Veranstaltungen in Verwaltung</p></div>
            </CardContent>
          </Card>
          <Card className="border-slate-300 bg-slate-50/95 py-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-slate-200 text-slate-700"><Archive className="size-5" /></span>
              <div><p className="text-2xl font-bold leading-none">{archivedTenants.length}</p><p className="mt-1 text-sm text-slate-600">Vereine im Archiv</p></div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="paketverteilung">
          <Card className="border-slate-200 bg-white/95 py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <CardTitle id="paketverteilung" className="flex items-center gap-2 text-base">
                    <CreditCard className="size-5 text-blue-700" /> Paketzuordnungen im Überblick
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-3xl">
                    Aktuelle Paketzuordnung für alle Vereine in Verwaltung. Pilotzugänge bleiben bewusst in der Verteilung sichtbar.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-700">
                  {activeTenants.length} zugeordnete{activeTenants.length === 1 ? "r Verein" : " Vereine"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-5 sm:px-6">
              <div
                className="flex h-3 overflow-hidden rounded-full bg-slate-100"
                aria-label="Verteilung der Paketzuordnungen"
              >
                {packageDistribution.map(item =>
                  item.count > 0 ? (
                    <div
                      key={item.packageId}
                      className={`${PRODUCT_DISTRIBUTION_STYLE[item.packageId].bar} min-w-0 transition-[width] duration-300`}
                      style={{ width: `${item.share}%` }}
                      title={`${PRODUCT_PACKAGE_META[item.packageId].name}: ${item.count}`}
                    />
                  ) : null
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {packageDistribution.map(item => {
                  const meta = PRODUCT_PACKAGE_META[item.packageId];
                  const style = PRODUCT_DISTRIBUTION_STYLE[item.packageId];
                  return (
                    <article key={item.packageId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
                          <CreditCard className="size-4" aria-hidden="true" />
                        </span>
                        <span className={`text-2xl font-bold leading-none ${style.count}`}>{item.count}</span>
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">{meta.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{meta.priceLabel}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        {item.share}% der aktiven Zuordnungen
                        {item.testCount > 0 ? ` · ${item.testCount} Pilotzugang${item.testCount === 1 ? "" : "e"}` : ""}
                        {item.pausedOrExpiredCount > 0
                          ? ` · ${item.pausedOrExpiredCount} pausiert/abgelaufen`
                          : ""}
                      </p>
                    </article>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="pilotanfragen">
          <Card className="border-slate-200 bg-white/95 py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <CardTitle id="pilotanfragen" className="flex items-center gap-2 text-base">
                    <Mail className="size-5 text-orange-600" /> Pilotanfragen
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-3xl">
                    Öffentliche Anfragen werden persönlich abgestimmt. Mit der Entscheidung beginnt die dreijährige Aufbewahrungsfrist; ein Löschwunsch entfernt die Anfrage sofort.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={openPilotInquiryCount > 0 ? "border-orange-200 bg-orange-50 text-orange-900" : "border-slate-200 bg-slate-50 text-slate-700"}
                >
                  {openPilotInquiryCount} offene
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 sm:px-6">
              {pilotInquiries.isLoading ? (
                <p className="text-sm text-slate-500">Pilotanfragen werden geladen …</p>
              ) : pilotInquiryItems.length === 0 ? (
                <p className="text-sm text-slate-500">Noch keine Pilotanfrage eingegangen.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {pilotInquiryItems.map(inquiry => {
                    const isOpen = inquiry.status === "open";
                    const phoneLink = pilotInquiryPhoneLink(inquiry.phone);
                    const statusLabel = isOpen
                      ? "Offen"
                      : inquiry.status === "accepted"
                        ? "Als Pilot übernommen"
                        : "Nicht weiterverfolgt";
                    const statusClass = isOpen
                      ? "border-orange-200 bg-orange-50 text-orange-900"
                      : inquiry.status === "accepted"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-700";
                    return (
                      <article key={inquiry.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{inquiry.clubName}</p>
                            <p className="mt-0.5 text-sm text-slate-700">{inquiry.contactName}</p>
                          </div>
                          <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
                        </div>
                        <dl className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-Mail</dt><dd><a className="text-blue-700 underline underline-offset-2" href={`mailto:${inquiry.email}`}>{inquiry.email}</a></dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefon</dt><dd>{phoneLink ? <a className="text-blue-700 underline underline-offset-2" href={phoneLink.telHref}>{phoneLink.label}</a> : <span className="text-slate-500">Nicht angegeben</span>}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organisationsform</dt><dd>{inquiry.organizationType}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anlass</dt><dd>{inquiry.occasion}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wunschstart</dt><dd>{inquiry.desiredStart}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ehrenamtlicher Bezug</dt><dd>Bestätigt am {formatAccessCreatedAt(inquiry.eligibilityConfirmedAt)}</dd></div>
                        </dl>
                        {inquiry.note ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm leading-5 text-slate-700">{inquiry.note}</p> : null}
                        <p className="mt-3 text-xs text-slate-500">
                          Eingegangen am {formatAccessCreatedAt(inquiry.createdAt)}
                          {inquiry.retentionEndsAt ? ` · automatische Löschung nach ${formatAccessCreatedAt(inquiry.retentionEndsAt)}` : ""}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {isOpen ? (
                            <>
                              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={completePilotInquiry.isPending} onClick={() => completePilotInquiry.mutate({ id: inquiry.id, status: "accepted" })}>
                                <CheckCircle2 className="size-3.5" /> Als Pilot übernehmen
                              </Button>
                              <Button size="sm" variant="outline" disabled={completePilotInquiry.isPending} onClick={() => completePilotInquiry.mutate({ id: inquiry.id, status: "declined" })}>
                                Nicht weiterverfolgen
                              </Button>
                            </>
                          ) : null}
                          <Button size="sm" variant="outline" className="border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deletePilotInquiry.isPending} onClick={() => setPilotInquiryToDelete(inquiry)}>
                            <Trash2 className="size-3.5" /> Löschen
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-slate-200 bg-white/95 py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-5 text-blue-700" /> Vereine &amp; Pilotprojekte</CardTitle>
                  <CardDescription className="mt-1">Aktive, pausierte sowie interne Pilot- und Mustervereine sicher verwalten. Archivierte Vereine werden getrennt geführt; eine öffentliche Freischaltung bleibt gesperrt.</CardDescription>
                </div>
                <label className="grid min-w-48 gap-1.5 text-xs font-semibold text-slate-700" data-slot="tenant-package-filter">
                  Produktpaket filtern
                  <Select
                    value={tenantPackageFilter}
                    onValueChange={(value: "all" | ProductPackageId) => setTenantPackageFilter(value)}
                  >
                    <SelectTrigger className="h-9 bg-white text-sm font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Produktpakete</SelectItem>
                      {PRODUCT_PACKAGE_IDS.map(packageId => (
                        <SelectItem key={packageId} value={packageId}>
                          {PRODUCT_PACKAGE_META[packageId].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 px-5 sm:px-6">
              {filteredActiveTenants.length === 0 && (
                <p className="py-6 text-sm text-slate-500">
                  {tenantPackageFilter === "all"
                    ? "Aktuell befinden sich keine Vereine in der laufenden Verwaltung."
                    : `Keine laufenden Vereine mit ${PRODUCT_PACKAGE_META[tenantPackageFilter].name} gefunden.`}
                </p>
              )}
              {filteredActiveTenants.map(tenant => {
                const tenantAccesses = personalAccesses.filter(access => access.tenantIds.includes(tenant.id));
                const accessMode = tenantAccessModeFromState({
                  tenantStatus: tenant.status as TenantStatus,
                  packageStatus: tenant.productAssignment.status,
                });
                return (
                  <article key={tenant.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-slate-900">{tenant.name}</h2>
                        <Badge variant="outline" className={PRODUCT_BADGE_CLASS[tenant.productAssignment.packageId]}>
                          {PRODUCT_PACKAGE_META[tenant.productAssignment.packageId].name}
                        </Badge>
                        <Badge variant="outline" className={PRODUCT_ASSIGNMENT_STATUS_CLASS[tenant.productAssignment.status]}>
                          {TENANT_ACCESS_MODE_META[accessMode].label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{tenant.legalName}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-slate-400" /> {tenant.eventCount} Veranstaltung{tenant.eventCount === 1 ? "" : "en"}</span>
                        <span className="inline-flex items-center gap-1"><Mail className="size-3.5 text-slate-400" /> {tenant.contactEmail}</span>
                        {tenant.adminActivation.adminName && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <UsersRound className="size-3.5 text-slate-400" /> Admin: {tenant.adminActivation.adminName}
                            {tenant.adminActivation.adminEmail && tenant.adminActivation.adminEmail !== tenant.contactEmail && (
                              <span className="text-slate-400 font-normal">({tenant.adminActivation.adminEmail})</span>
                            )}
                          </span>
                        )}
                      </div>
                      <TenantProductUsage usage={tenant.productUsage} events={tenant.events} />
                      <TenantAdminActivationStatus activation={tenant.adminActivation} />
                      <TenantMfaStatus activation={tenant.adminActivation} />
                      <TenantAccessPanel accesses={tenantAccesses} deleting={deleteTestAccess.isPending} onRequestDelete={setAccessToDelete} />
                      <TenantContractAcceptanceStatus acceptance={tenant.contractAcceptance} />
                    </div>
                    <div className="space-y-2 sm:min-w-48">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left sm:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nächste Veranstaltung</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">{tenant.nextEvent?.name ?? "Noch nicht angelegt"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{tenant.nextEvent ? formatDate(tenant.nextEvent.startDate) : "Termin offen"}</p>
                      </div>
                      {(tenant.status === "pilot" || tenant.status === "sample") && (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
                            onClick={() => {
                              setProductModalTenant(tenant);
                              setProductAssignmentForm(
                                defaultProductAssignmentForm(tenant.productAssignment, tenant.events)
                              );
                            }}
                          >
                            <CreditCard className="size-3.5" /> Produkt verwalten
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full bg-blue-600 text-white hover:bg-blue-700"
                            disabled={createHandoff.isPending}
                            onClick={() => createHandoff.mutate({ tenantId: tenant.id })}
                          >
                            {createHandoff.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <UsersRound className="size-3.5" />}
                            In Vereinsansicht wechseln
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setAdminModalTenant({ id: tenant.id, name: tenant.name });
                              setAdminName("");
                              setAdminEmail("");
                              setSendInvitationEmail(false);
                            }}
                          >
                            <KeyRound className="size-3.5" /> Admin-Zugang einrichten
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            disabled={updateLifecycle.isPending}
                            onClick={() => updateLifecycle.mutate({ tenantId: tenant.id, status: "suspended" })}
                          >
                            {updateLifecycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PauseCircle className="size-3.5" />}
                            Pilot pausieren
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            disabled={updateLifecycle.isPending}
                            onClick={() => setArchiveModalTenant({ id: tenant.id, name: tenant.name })}
                          >
                            <Archive className="size-3.5" /> Verein archivieren
                          </Button>
                        </div>
                      )}
                      {tenant.status === "suspended" && (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                            disabled={updateLifecycle.isPending}
                            onClick={() => updateLifecycle.mutate({ tenantId: tenant.id, status: "pilot" })}
                          >
                            {updateLifecycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                            Als Pilot reaktivieren
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            disabled={updateLifecycle.isPending}
                            onClick={() => setArchiveModalTenant({ id: tenant.id, name: tenant.name })}
                          >
                            <Archive className="size-3.5" /> Verein archivieren
                          </Button>
                        </div>
                      )}
                      {tenant.status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={deleteInternalTestTenant.isPending}
                          onClick={() => setTestTenantToDelete({ id: tenant.id, name: tenant.name })}
                        >
                          {deleteInternalTestTenant.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          Verein endgültig löschen
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>

        </section>

        <section aria-labelledby="archivierte-vereine">
          <Card className="border-slate-300 bg-slate-50/90 py-0 shadow-sm">
            <CardHeader className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <CardTitle id="archivierte-vereine" className="flex items-center gap-2 text-base text-slate-800">
                <Archive className="size-5 text-slate-600" /> Archivierte Vereine
              </CardTitle>
              <CardDescription>
                Archivierte Vereine sind vollständig vom Vereinszugang ausgeschlossen. Beendete Pilotvereine bleiben bis zur angezeigten Frist reaktivierbar und werden anschließend technisch vollständig gelöscht.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-200 px-5 sm:px-6">
              {filteredArchivedTenants.length === 0 ? (
                <p className="py-5 text-sm text-slate-500">
                  {tenantPackageFilter === "all"
                    ? "Keine archivierten Vereine vorhanden."
                    : `Keine archivierten Vereine mit ${PRODUCT_PACKAGE_META[tenantPackageFilter].name} gefunden.`}
                </p>
              ) : (
                filteredArchivedTenants.map(tenant => (
                  <article key={tenant.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-slate-800">{tenant.name}</h2>
                        <Badge variant="outline" className={STATUS_META.archived.className}>{STATUS_META.archived.label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{tenant.legalName}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-slate-400" /> {tenant.eventCount} Veranstaltung{tenant.eventCount === 1 ? "" : "en"}</span>
                        <span className="inline-flex items-center gap-1"><Mail className="size-3.5 text-slate-400" /> {tenant.contactEmail}</span>
                        {tenant.retentionEndsAt ? <span className="inline-flex items-center gap-1 text-amber-800"><Archive className="size-3.5" /> Löschung nach {formatAccessCreatedAt(tenant.retentionEndsAt)}</span> : null}
                      </div>
                    </div>
                    <div className="space-y-2 sm:min-w-48">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                        disabled={updateLifecycle.isPending}
                        onClick={() => updateLifecycle.mutate({ tenantId: tenant.id, status: "pilot" })}
                      >
                        {updateLifecycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                        Als Pilot reaktivieren
                      </Button>
                      {!tenant.retentionEndsAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={deleteInternalTestTenant.isPending}
                          onClick={() => setTestTenantToDelete({ id: tenant.id, name: tenant.name })}
                        >
                          {deleteInternalTestTenant.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          Verein endgültig löschen
                        </Button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={open => {
          if (!createTenant.isPending) setCreateOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-blue-700" /> Neuen internen Verein anlegen
            </DialogTitle>
            <DialogDescription>
              Der Verein wird ausschließlich über dieses geschützte Master-Portal angelegt. Eine öffentliche Registrierung, Buchung oder Zahlung wird dadurch nicht ausgelöst.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={submitCreateTenant}>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Vereinsangaben</legend>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Vereinsname / offizielle Bezeichnung</span>
                <Input
                  value={createForm.name}
                  onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="z. B. SV Musterstadt e. V."
                  required
                  maxLength={240}
                />
                <p className="text-xs leading-5 text-slate-600">Dieser Name wird auch als offizielle Bezeichnung gespeichert.</p>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Vereinskontakt</span>
                <Input
                  type="email"
                  value={createForm.contactEmail}
                  onChange={event => setCreateForm(current => ({ ...current, contactEmail: event.target.value }))}
                  placeholder="kontakt@verein.de"
                  required
                  maxLength={320}
                />
              </label>
            </fieldset>

            <fieldset className="grid gap-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4 sm:grid-cols-2">
              <legend className="sr-only">Paket und Zugangsstatus</legend>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold text-slate-800">Paket &amp; Zugangsstatus</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Mit diesen beiden Angaben legen Sie fest, welche Funktionen der Verein erhält und ob er sich anmelden darf.
                </p>
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-800">Paket</span>
                <Select
                  value={createForm.packageId}
                  onValueChange={(packageId: ProductPackageId) =>
                    setCreateForm(current => ({ ...current, packageId }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_PACKAGE_IDS.map(packageId => (
                      <SelectItem key={packageId} value={packageId}>
                        {PRODUCT_PACKAGE_META[packageId].name} · {PRODUCT_PACKAGE_META[packageId].priceLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600">{PRODUCT_PACKAGE_META[createForm.packageId].shortDescription}</p>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-800">Zugangsstatus</span>
                <Select
                  value={createForm.accessMode}
                  onValueChange={(accessMode: TenantAccessMode) =>
                    setCreateForm(current => ({ ...current, accessMode }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TENANT_ACCESS_MODES.map(accessMode => (
                      <SelectItem key={accessMode} value={accessMode}>
                        {TENANT_ACCESS_MODE_META[accessMode].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-slate-600">{TENANT_ACCESS_MODE_META[createForm.accessMode].description}</p>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-800">Beginn (optional)</span>
                <Input
                  type="date"
                  value={createForm.packageStartsOn}
                  onChange={event => setCreateForm(current => ({ ...current, packageStartsOn: event.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-800">Ende (optional)</span>
                <Input
                  type="date"
                  value={createForm.packageEndsOn}
                  onChange={event => setCreateForm(current => ({ ...current, packageEndsOn: event.target.value }))}
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">Erste Veranstaltung</legend>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="space-y-1.5">
                  <span className="text-sm text-slate-600">Bezeichnung</span>
                  <Input
                    value={createForm.initialEventName}
                    onChange={event => setCreateForm(current => ({ ...current, initialEventName: event.target.value }))}
                    placeholder="z. B. Vereinsfest 2027"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm text-slate-600">Jahr</span>
                  <Input
                    type="number"
                    min="2020"
                    max="2100"
                    value={createForm.initialEventYear}
                    onChange={event => setCreateForm(current => ({ ...current, initialEventYear: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-600">Veranstaltungstage</p>
                <div className="flex flex-wrap gap-2">
                  {EVENT_DAYS.map(day => {
                    const selected = createForm.activeDays.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={selected}
                        className={selected ? "border-blue-300 bg-blue-600 text-white hover:bg-blue-700" : "bg-white"}
                        onClick={() => toggleEventDay(day)}
                      >
                        {day}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <legend className="px-1 text-sm font-semibold text-blue-950">Vereinsadministrator (optional)</legend>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={createForm.createInitialAdmin}
                  onChange={event =>
                    setCreateForm(current => ({
                      ...current,
                      createInitialAdmin: event.target.checked,
                      initialAdminEmail:
                        event.target.checked && !current.initialAdminEmail
                          ? current.contactEmail
                          : current.initialAdminEmail,
                    }))
                  }
                  className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm leading-5 text-slate-800">
                  <strong>Admin direkt mit Initialpasswort einrichten</strong>
                  <span className="mt-0.5 block text-xs text-slate-600">Ohne E-Mail-Link: Das Initialpasswort wird nur verschlüsselt gespeichert und muss beim ersten Login durch ein eigenes Passwort ersetzt werden.</span>
                </span>
              </label>
              {createForm.createInitialAdmin && (
                <div className="grid gap-4 border-t border-blue-100 pt-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-800">Name des Administrators</span>
                    <Input
                      value={createForm.initialAdminName}
                      onChange={event => setCreateForm(current => ({ ...current, initialAdminName: event.target.value }))}
                      placeholder="z. B. Max Mustermann"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-800">E-Mail-Adresse</span>
                    <Input
                      type="email"
                      value={createForm.initialAdminEmail}
                      onChange={event => setCreateForm(current => ({ ...current, initialAdminEmail: event.target.value }))}
                      placeholder="admin@verein.de"
                      required
                      maxLength={320}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-800">Initialpasswort</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={createForm.initialAdminPassword}
                      onChange={event => setCreateForm(current => ({ ...current, initialAdminPassword: event.target.value }))}
                      placeholder="Mindestens 10 Zeichen"
                      minLength={10}
                      required
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-800">Initialpasswort wiederholen</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={createForm.initialAdminPasswordConfirmation}
                      onChange={event => setCreateForm(current => ({ ...current, initialAdminPasswordConfirmation: event.target.value }))}
                      placeholder="Passwort wiederholen"
                      minLength={10}
                      required
                    />
                  </label>
                </div>
              )}
            </fieldset>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createTenant.isPending}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Internen Verein anlegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(productModalTenant && productAssignmentForm)}
        onOpenChange={open => {
          if (!open && !updateTenantProductAssignment.isPending) {
            setProductModalTenant(null);
            setProductAssignmentForm(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-slate-950 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-violet-700" /> Produkt für {productModalTenant?.name} verwalten
            </DialogTitle>
            <DialogDescription>
              Paket, Status und Laufzeit werden zentral im Master-Admin hinterlegt. Die persönliche Fachbereichsrechteverwaltung des Vereins bleibt davon getrennt.
            </DialogDescription>
          </DialogHeader>
          {productModalTenant && productAssignmentForm && (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                const eventId = productAssignmentForm.eventId
                  ? Number(productAssignmentForm.eventId)
                  : null;
                updateTenantProductAssignment.mutate({
                  tenantId: productModalTenant.id,
                  packageId: productAssignmentForm.packageId,
                  status: productAssignmentForm.status,
                  startsOn: productAssignmentForm.startsOn || null,
                  endsOn: productAssignmentForm.endsOn || null,
                  eventId,
                  internalNote: productAssignmentForm.internalNote || null,
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-800">Paket</span>
                  <Select
                    value={productAssignmentForm.packageId}
                    onValueChange={(packageId: ProductPackageId) =>
                      setProductAssignmentForm(current => current && ({
                        ...current,
                        packageId,
                        eventId:
                          packageId === "event_pass"
                            ? current.eventId || productModalTenant.events[0]?.id.toString() || ""
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_PACKAGE_IDS.map(packageId => (
                        <SelectItem key={packageId} value={packageId}>
                          {PRODUCT_PACKAGE_META[packageId].name} · {PRODUCT_PACKAGE_META[packageId].priceLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-800">Status</span>
                  <Select
                    value={productAssignmentForm.status}
                    onValueChange={(status: ProductAssignmentStatus) =>
                      setProductAssignmentForm(current => current && ({ ...current, status }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_ASSIGNMENT_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {masterAssignmentStatusLabel(
                            status,
                            productModalTenant.status
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-sm text-violet-950">
                <strong>{PRODUCT_PACKAGE_META[productAssignmentForm.packageId].name}:</strong>{" "}
                {PRODUCT_PACKAGE_META[productAssignmentForm.packageId].shortDescription}
                <span className="ml-1 text-violet-800">({PRODUCT_PACKAGE_META[productAssignmentForm.packageId].priceLabel})</span>
              </div>
              {productModalTenant.productAssignment.packageId === "event_pass" &&
                productAssignmentForm.packageId !== "event_pass" && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm leading-5 text-sky-950">
                    <strong>Sichere Überleitung aus dem Event Pass:</strong> Die bisher als verantwortlich gewählten Helfer bleiben bei ihren Vorbereitungsaufgaben sichtbar. Nach dem Paketwechsel kann der Verein ihnen in Ruhe einen Ansprechpartner zuordnen; es wird nichts gelöscht oder automatisch umgedeutet. Der gemeinsame Event-Pass-Zugang wird beim ersten Anmelden eines persönlichen Zugangs nicht weiter verwendet.
                  </div>
                )}
              {productAssignmentForm.packageId === "event_pass" && (
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-800">Zugeordnete Einzelveranstaltung</span>
                  <Select
                    value={productAssignmentForm.eventId}
                    onValueChange={eventId => setProductAssignmentForm(current => current && ({ ...current, eventId }))}
                    disabled={productModalTenant.events.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Veranstaltung wählen" /></SelectTrigger>
                    <SelectContent>
                      {productModalTenant.events.map(eventItem => (
                        <SelectItem key={eventItem.id} value={eventItem.id.toString()}>
                          {eventItem.name} · {eventItem.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-slate-600">Der Event Pass wird technisch auf diese einzelne Veranstaltung begrenzt.</p>
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-800">Beginn (optional)</span>
                  <Input
                    type="date"
                    value={productAssignmentForm.startsOn}
                    onChange={event => setProductAssignmentForm(current => current && ({ ...current, startsOn: event.target.value }))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-800">Ende (optional)</span>
                  <Input
                    type="date"
                    value={productAssignmentForm.endsOn}
                    onChange={event => setProductAssignmentForm(current => current && ({ ...current, endsOn: event.target.value }))}
                  />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Interne Notiz (optional)</span>
                <textarea
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                  value={productAssignmentForm.internalNote}
                  maxLength={2_000}
                  placeholder="z. B. individuelle Enterprise-Erweiterung oder interner Vertragsvermerk"
                  onChange={event => setProductAssignmentForm(current => current && ({ ...current, internalNote: event.target.value }))}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProductModalTenant(null)} disabled={updateTenantProductAssignment.isPending}>
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={
                    updateTenantProductAssignment.isPending ||
                    (productAssignmentForm.packageId === "event_pass" && !productAssignmentForm.eventId)
                  }
                >
                  {updateTenantProductAssignment.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Produkt speichern
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(adminModalTenant)}
        onOpenChange={open => {
          if (open) return;
          setAdminModalTenant(null);
          setAdminName("");
          setAdminEmail("");
          setSendInvitationEmail(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vereins-Administrator anlegen</DialogTitle>
            <DialogDescription>
              Erstellt einen persönlichen Zugang für {adminModalTenant?.name}. Der Administrator setzt sein Passwort über einen einmaligen Aktivierungslink selbst.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              if (!adminModalTenant || !adminName.trim() || !adminEmail.trim()) return;
              createTenantAdmin.mutate({
                tenantId: adminModalTenant.id,
                name: adminName.trim(),
                email: adminEmail.trim(),
                sendEmailInvitation: sendInvitationEmail,
              });
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Name des Administrators</label>
              <Input
                placeholder="z. B. Max Mustermann"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">E-Mail-Adresse</label>
              <Input
                type="email"
                placeholder="admin@verein.de"
                value={adminEmail}
                onChange={e => {
                  setAdminEmail(e.target.value);
                  setSendInvitationEmail(false);
                }}
                required
              />
            </div>
            {adminName.trim() && adminEmail.trim() ? (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={sendInvitationEmail}
                  onChange={e => setSendInvitationEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700">
                  Einladungs-E-Mail direkt per SMTP versenden
                </span>
              </label>
            ) : (
              <p className="text-xs text-slate-500">
                Erst Name und E-Mail der Person eintragen, dann kann der Versand bewusst gewählt werden.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminModalTenant(null)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createTenantAdmin.isPending}>
                {createTenantAdmin.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Aktivierungslink erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(issuedAdminSheet)} onOpenChange={open => !open && setIssuedAdminSheet(null)}>
        <DialogContent className="max-w-md border-emerald-200 bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="size-5" /> Vereins-Zugang erstellt
            </DialogTitle>
            <DialogDescription>
              Aktivierungslink für {issuedAdminSheet?.tenantName}. Er ist nur einmal nutzbar und führt direkt zur eigenen Passwortvergabe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500">Name</span>
              <p className="font-medium text-slate-900">{issuedAdminSheet?.adminName}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500">E-Mail</span>
              <p className="font-medium text-slate-900">{issuedAdminSheet?.email}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500">Einmaliger Aktivierungslink</span>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs text-slate-800">
                  {issuedAdminSheet?.invitationUrl}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  aria-label="Aktivierungslink kopieren"
                  onClick={async () => {
                    if (!issuedAdminSheet?.invitationUrl) return;
                    await navigator.clipboard.writeText(issuedAdminSheet.invitationUrl);
                    toast.success("Aktivierungslink kopiert");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            {issuedAdminSheet?.emailSent && (
              <div className="rounded-lg bg-emerald-100 p-2.5 text-xs text-emerald-900 font-medium">
                ✓ Einladungs-E-Mail wurde vom Mailserver für {issuedAdminSheet.email} angenommen.
              </div>
            )}
            {!issuedAdminSheet?.emailSent && (
              <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                Die E-Mail konnte nicht an den Mailserver übergeben werden. Kopieren Sie den Aktivierungslink und geben Sie ihn sicher manuell weiter.
              </div>
            )}
            <p className="text-xs text-slate-500">
              Gültig bis {issuedAdminSheet?.expiresAt.toLocaleString("de-DE")}. Nach der Nutzung ist der Link automatisch ungültig.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssuedAdminSheet(null)}>Verstanden &amp; Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(accessToDelete)}
        onOpenChange={open => {
          if (!open && !deleteTestAccess.isPending) setAccessToDelete(null);
        }}
      >
        <AlertDialogContent className="border-red-200 bg-white text-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-900">
              <UserRoundX className="size-5 text-red-700" /> Zugang endgültig entfernen?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-5 text-slate-600">
              Der persönliche Zugang von <strong className="font-semibold text-slate-800">{accessToDelete?.name}</strong>{" "}
              ({accessToDelete?.email ?? "ohne E-Mail"}) kann sich danach nicht mehr anmelden. Offene Aktivierungslinks und bestehende Sitzungen werden ungültig.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
            Ansprechpartner, Helfer, Aufgaben und Veranstaltungsdaten bleiben unverändert erhalten. Diese Aktion entfernt ausschließlich die Zugangsdaten und deren Zuordnung.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTestAccess.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!accessToDelete || deleteTestAccess.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                if (!accessToDelete) return;
                deleteTestAccess.mutate({
                  type: accessToDelete.type,
                  accessId: accessToDelete.accessId,
                });
              }}
            >
              {deleteTestAccess.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Zugang endgültig entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pilotInquiryToDelete)}
        onOpenChange={open => {
          if (!open && !deletePilotInquiry.isPending) setPilotInquiryToDelete(null);
        }}
      >
        <AlertDialogContent className="border-red-200 bg-white text-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-900">
              <Trash2 className="size-5 text-red-700" /> Pilotanfrage vollständig löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-5 text-slate-600">
              Die Anfrage von <strong className="font-semibold text-slate-800">{pilotInquiryToDelete?.clubName}</strong> wird sofort aus der MyCrewMate-Datenbank entfernt. Nutzen Sie diese Aktion für einen dokumentierten Löschwunsch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
            Bereits eingegangene E-Mail-Korrespondenz im betrieblichen Postfach ist separat nach derselben Vorgabe zu bereinigen.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePilotInquiry.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pilotInquiryToDelete || deletePilotInquiry.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                if (!pilotInquiryToDelete) return;
                deletePilotInquiry.mutate({ id: pilotInquiryToDelete.id });
              }}
            >
              {deletePilotInquiry.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Anfrage endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(archiveModalTenant)}
        onOpenChange={open => {
          if (!open && !updateLifecycle.isPending) setArchiveModalTenant(null);
        }}
      >
        <AlertDialogContent className="border-slate-300 bg-white text-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
              <Archive className="size-5 text-slate-700" /> Verein archivieren?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-5 text-slate-600">
              Die Planungsdaten und Veranstaltungen von <strong className="font-semibold text-slate-800">{archiveModalTenant?.name}</strong> bleiben ausschließlich für den historischen Nachweis im Archiv erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-900">
            <strong>Alle Vereinsberechtigungen werden endgültig entfernt:</strong> persönliche Vereinsadmin- und Co-Admin-Zugänge, Planungsteamzugänge, Aktivierungslinks, Sitzungen und Mandantenverknüpfungen. Bei einer späteren Reaktivierung müssen sämtliche Zugänge bewusst neu vergeben werden.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateLifecycle.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!archiveModalTenant || updateLifecycle.isPending}
              className="bg-slate-800 text-white hover:bg-slate-900"
              onClick={() => {
                if (!archiveModalTenant) return;
                updateLifecycle.mutate({ tenantId: archiveModalTenant.id, status: "archived" });
                setArchiveModalTenant(null);
              }}
            >
              {updateLifecycle.isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Verein archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(testTenantToDelete)}
        onOpenChange={open => {
          if (!open && !deleteInternalTestTenant.isPending) setTestTenantToDelete(null);
        }}
      >
        <AlertDialogContent className="border-red-200 bg-white text-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-800">
              <Trash2 className="size-5" /> Verein mit allen Daten endgültig löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-5 text-slate-600">
              <strong className="font-semibold text-slate-800">{testTenantToDelete?.name}</strong> wird mit allen Veranstaltungen, Planungsdaten und persönlichen Zugängen dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
            Für ein reguläres Ende eines Pilotzugangs verwenden Sie bitte weiterhin die Archivierung. Die endgültige Löschung ist nur für Pilot- und Mustervereine vorgesehen; aktive Vereine bleiben geschützt.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInternalTestTenant.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!testTenantToDelete || deleteInternalTestTenant.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                if (!testTenantToDelete) return;
                deleteInternalTestTenant.mutate({ tenantId: testTenantToDelete.id });
              }}
            >
              {deleteInternalTestTenant.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Verein endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
