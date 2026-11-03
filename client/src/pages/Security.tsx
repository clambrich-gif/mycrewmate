import { useAuth } from "@/_core/hooks/useAuth";
import { MfaEnrollmentQr } from "@/components/MfaEnrollmentQr";
import { PageTitle } from "@/components/PageTitle";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { PlanningTeamAccessManager } from "@/components/PlanningTeamAccessManager";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { AuditCenter } from "@/pages/Permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventYear } from "@/contexts/YearContext";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { ProductPackageId } from "@shared/product-packages";
import { getSecurityKlemmiSteps } from "@/lib/klemmi-area-tours";
import {
  ChevronDown,
  FileText,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

function SecurityAccordion({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children,
  klemmiTarget,
  open: controlledOpen,
  onOpenChange: onControlledOpenChange,
}: {
  title: string;
  description: string;
  icon: typeof KeyRound;
  tone?: "slate" | "blue" | "red" | "amber";
  children: ReactNode;
  klemmiTarget?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const toneClasses = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50/35",
    red: "border-red-200 bg-red-50/40",
    amber: "border-amber-200 bg-amber-50/35",
  }[tone];
  const iconClasses = {
    slate: "text-slate-600",
    blue: "text-blue-700",
    red: "text-red-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <Collapsible
      open={open}
      onOpenChange={nextOpen => {
        if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
        onControlledOpenChange?.(nextOpen);
      }}
    >
      <Card
        data-klemmi-target={klemmiTarget}
        className={cn("overflow-hidden shadow-sm", toneClasses)}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Icon className={cn("h-5 w-5 shrink-0", iconClasses)} />
                {title}
              </span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 data-[state=closed]:animate-none">
          <CardContent className="space-y-4 pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PasswordEditor({
  enabled,
  onSave,
  saving,
}: {
  enabled: boolean;
  onSave: (input: { password: string; currentAdminPassword: string }) => void;
  saving: boolean;
}) {
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const matches = password === confirmation;
  const valid =
    Boolean(currentAdminPassword) && password.length >= 10 && matches;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {enabled
          ? "Vergibt ein neues Administratorpasswort. Die aktuelle Eingabe ist als Sicherheitsbestätigung erforderlich."
          : "Richtet erstmals ein Administratorpasswort für diese Planung ein."}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="security-current-admin-password">
          Aktuelles Administratorpasswort
        </Label>
        <Input
          id="security-current-admin-password"
          type="password"
          autoComplete="current-password"
          value={currentAdminPassword}
          onChange={event => setCurrentAdminPassword(event.target.value)}
          placeholder="Zur Bestätigung eingeben"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="security-new-admin-password">Neues Passwort</Label>
          <Input
            id="security-new-admin-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 10 Zeichen"
            disabled={!currentAdminPassword || saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="security-confirm-admin-password">
            Neues Passwort bestätigen
          </Label>
          <Input
            id="security-confirm-admin-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder="Passwort wiederholen"
            disabled={!currentAdminPassword || saving}
          />
          {confirmation && !matches && (
            <p className="text-xs text-destructive">
              Die Passwörter stimmen nicht überein.
            </p>
          )}
        </div>
      </div>
      <Button
        disabled={!valid || saving}
        onClick={() => {
          onSave({ password, currentAdminPassword });
          setCurrentAdminPassword("");
          setPassword("");
          setConfirmation("");
        }}
      >
        {saving ? "Wird gespeichert …" : "Administratorpasswort speichern"}
      </Button>
    </div>
  );
}

/**
 * Der Event Pass verzichtet bewusst auf persönliche Teamkonten. Stattdessen
 * richtet die verantwortliche Vereinsadministration genau eine neutrale
 * Teamkennung für die zugehörige Veranstaltung ein. Das Kennwort kann hier
 * jederzeit ersetzt werden; durch die Session-Version verlieren alle bisher
 * angemeldeten Geräte dann sofort ihren Zugriff.
 */
function EventPassSharedAccessManager() {
  const utils = trpc.useUtils();
  const status = trpc.eventPassSharedAccess.status.useQuery(undefined, {
    staleTime: 15_000,
  });
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const save = trpc.eventPassSharedAccess.save.useMutation({
    onSuccess: async result => {
      setCurrentAdminPassword("");
      setPassword("");
      setConfirmation("");
      await Promise.all([
        utils.eventPassSharedAccess.status.invalidate(),
        utils.audit.activities.invalidate(),
      ]);
      toast.success(
        result.replacedExistingAccess
          ? "Teamkennwort geändert. Alle bisher angemeldeten Teamgeräte wurden abgemeldet."
          : "Gemeinsamer Event-Pass-Zugang wurde eingerichtet."
      );
    },
    onError: error => toast.error(error.message),
  });
  const canSave =
    currentAdminPassword.length > 0 &&
    password.length >= 10 &&
    password === confirmation &&
    !save.isPending;
  const copyIdentifier = async () => {
    if (!status.data?.identifier) return;
    try {
      await navigator.clipboard.writeText(status.data.identifier);
      toast.success("Teamkennung wurde kopiert");
    } catch {
      toast.error("Teamkennung konnte nicht kopiert werden. Bitte manuell übernehmen.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
        <p className="font-semibold">Ein gemeinsamer Zugang – nur für diese Veranstaltung</p>
        <p className="mt-1 text-xs leading-5 text-blue-900">
          Die Teamkennung ist keine private E-Mail-Adresse und darf zusammen mit dem
          Passwort nur an die Personen weitergegeben werden, die die Veranstaltung
          tatsächlich planen. Änderungen am Kennwort melden alle offenen Team-Sitzungen ab.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Teamkennung</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-slate-900">
            {status.data?.identifier ?? "Wird geladen …"}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyIdentifier()}
            disabled={!status.data?.identifier}
          >
            Kennung kopieren
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Diese Kennung wird auf der Anmeldeseite anstelle einer E-Mail-Adresse eingegeben.
          Sie ist nur eine Bezeichnung; geschützt wird der Zugang durch das Kennwort.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-pass-shared-password">
            {status.data?.configured ? "Neues Teamkennwort" : "Teamkennwort festlegen"}
          </Label>
          <Input
            id="event-pass-shared-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 10 Zeichen"
            disabled={save.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-pass-shared-password-confirmation">Teamkennwort wiederholen</Label>
          <Input
            id="event-pass-shared-password-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder="Kennwort wiederholen"
            disabled={save.isPending}
          />
          {confirmation && password !== confirmation && (
            <p className="text-xs text-destructive">Die beiden Kennwörter stimmen nicht überein.</p>
          )}
        </div>
      </div>
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="event-pass-shared-admin-password">Eigenes Administratorpasswort</Label>
        <Input
          id="event-pass-shared-admin-password"
          type="password"
          autoComplete="current-password"
          value={currentAdminPassword}
          onChange={event => setCurrentAdminPassword(event.target.value)}
          placeholder="Zur bewussten Freigabe eingeben"
          disabled={save.isPending}
        />
      </div>
      <Button
        type="button"
        disabled={!canSave}
        className="bg-blue-600 text-white hover:bg-blue-700"
        onClick={() =>
          save.mutate({
            password,
            passwordConfirmation: confirmation,
            currentAdminPassword,
          })
        }
      >
        {save.isPending
          ? "Wird sicher gespeichert …"
          : status.data?.configured
            ? "Teamkennwort ändern & alle Geräte abmelden"
            : "Gemeinsamen Teamzugang einrichten"}
      </Button>
    </div>
  );
}

function MfaManager() {
  const utils = trpc.useUtils();
  const status = trpc.auth.mfaStatus.useQuery();
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);
  const [code, setCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [regeneratedRecoveryCodes, setRegeneratedRecoveryCodes] = useState<string[] | null>(
    null
  );
  const begin = trpc.auth.beginMfaEnrollment.useMutation({
    onSuccess: result => {
      setSetup({
        secret: result.secret,
        otpauthUri: result.otpauthUri,
        recoveryCodes: result.recoveryCodes,
      });
      setCode("");
      setCurrentPassword("");
    },
    onError: error => toast.error(error.message),
  });
  const confirm = trpc.auth.confirmMfaEnrollment.useMutation({
    onSuccess: async () => {
      setSetup(null);
      setCode("");
      setCurrentPassword("");
      await Promise.all([utils.auth.mfaStatus.invalidate(), utils.audit.activities.invalidate()]);
      toast.success("Authenticator-App erfolgreich als zweite Sicherheitsstufe eingerichtet");
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.auth.disableMfa.useMutation({
    onSuccess: async () => {
      setDisablePassword("");
      await Promise.all([utils.auth.mfaStatus.invalidate(), utils.audit.activities.invalidate()]);
      toast.success("Zweite Sicherheitsstufe wurde deaktiviert");
    },
    onError: error => toast.error(error.message),
  });
  const regenerateRecoveryCodes = trpc.auth.regenerateMfaRecoveryCodes.useMutation({
    onSuccess: async result => {
      setRecoveryPassword("");
      setRegeneratedRecoveryCodes(result.recoveryCodes);
      await Promise.all([utils.auth.mfaStatus.invalidate(), utils.audit.activities.invalidate()]);
      toast.success("Neue Notfallcodes wurden einmalig angezeigt. Die bisherigen Codes sind ungültig.");
    },
    onError: error => toast.error(error.message),
  });

  if (!status.data?.eligible) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Die zweite Anmeldestufe steht für persönliche Vereinsadministratoren bereit. Planungsteam-Zugänge erhalten keine globale Administratorberechtigung.
      </p>
    );
  }

  if (status.data.enabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Aktiv: Authenticator-App erforderlich</p>
          <p className="mt-1 text-xs leading-5 text-emerald-900">
            Nach dem Passwort wird ein zeitbasierter Code abgefragt. Noch verfügbare Wiederherstellungscodes: {status.data.remainingRecoveryCodes}.
          </p>
        </div>
        {regeneratedRecoveryCodes && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" aria-live="polite">
            <p className="font-semibold">Neue Notfallcodes – jetzt sicher ablegen</p>
            <p className="mt-1 text-xs leading-5 text-amber-900">
              Jeder Code funktioniert einmal. Diese Anzeige ist nur für den aktuellen Moment bestimmt; die vorherigen Codes sind sofort ungültig.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-900 sm:grid-cols-4">
              {regeneratedRecoveryCodes.map(recoveryCode => (
                <code key={recoveryCode} className="rounded bg-white px-2 py-1.5 text-center ring-1 ring-amber-200 [font-variant-numeric:slashed-zero]">
                  {recoveryCode}
                </code>
              ))}
            </div>
          </div>
        )}
        <div className="max-w-md space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Acht Notfallcodes neu erzeugen</p>
          <p className="text-xs leading-5 text-slate-600">
            Nur nötig, wenn die Codes verloren gegangen sind oder ersetzt werden sollen. Die bisherigen Codes werden sofort ungültig.
          </p>
          <Label htmlFor="mfa-regenerate-recovery-password">Aktuelles Administratorpasswort</Label>
          <Input
            id="mfa-regenerate-recovery-password"
            type="password"
            autoComplete="current-password"
            value={recoveryPassword}
            onChange={event => setRecoveryPassword(event.target.value)}
            placeholder="Zur Bestätigung eingeben"
          />
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
            disabled={!recoveryPassword || regenerateRecoveryCodes.isPending}
            onClick={() => {
              if (window.confirm("Acht neue Notfallcodes erzeugen? Alle bisherigen Notfallcodes werden sofort ungültig.")) {
                regenerateRecoveryCodes.mutate({ currentPassword: recoveryPassword });
              }
            }}
          >
            {regenerateRecoveryCodes.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Acht neue Notfallcodes erzeugen
          </Button>
        </div>
        <div className="max-w-md space-y-2">
          <Label htmlFor="mfa-disable-password">Aktuelles Administratorpasswort</Label>
          <Input
            id="mfa-disable-password"
            type="password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={event => setDisablePassword(event.target.value)}
            placeholder="Nur zur bewussten Deaktivierung"
          />
          <Button
            type="button"
            variant="outline"
            className="border-red-300 text-red-800 hover:bg-red-50 hover:text-red-900"
            disabled={!disablePassword || disable.isPending}
            onClick={() => {
              if (window.confirm("Die zweite Anmeldestufe wirklich deaktivieren? Der Zugang wird damit weniger geschützt.")) {
                disable.mutate({ currentPassword: disablePassword });
              }
            }}
          >
            {disable.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Unlock className="size-4" />}
            Zweite Sicherheitsstufe deaktivieren
          </Button>
        </div>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Nach der Einrichtung ist zusätzlich zum Passwort ein sechsstelliger Code aus einer Authenticator-App nötig. Das schützt insbesondere bei einem kompromittierten Passwort.
        </p>
        <Button type="button" onClick={() => begin.mutate()} disabled={begin.isPending}>
          {begin.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Authenticator-App einrichten
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
        <p className="font-semibold">1. QR-Code mit der Authenticator-App scannen</p>
        <p className="mt-1 text-xs leading-5 text-blue-900">
          Öffnen Sie Ihre Authenticator-App, wählen Sie „Konto hinzufügen“ und scannen Sie den QR-Code. Der Schlüssel wird vollständig lokal im Browser erzeugt und nicht an einen externen QR-Dienst übertragen.
        </p>
        <MfaEnrollmentQr
          otpauthUri={setup.otpauthUri}
          alt="QR-Code für die MFA-Einrichtung des Vereinsadministratorzugangs"
          className="mx-auto mt-4"
        />
      </section>
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <summary className="cursor-pointer font-semibold text-slate-950">
          QR-Code kann nicht gescannt werden? Schlüssel manuell eingeben
        </summary>
        <p className="mt-2 text-xs leading-5 text-slate-700">
          Nur als Ausweichweg: Der Schlüssel nutzt Base32 (A–Z und 2–7). Eine Ziffer <strong>0</strong> kommt darin nie vor; ein <strong>O</strong> ist immer ein Buchstabe.
        </p>
        <code className="mt-3 block select-all break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-950 ring-1 ring-blue-200 [font-variant-numeric:slashed-zero]">
          {setup.secret}
        </code>
      </details>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">2. Wiederherstellungscodes sicher offline aufbewahren</p>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          Jeder Code funktioniert genau einmal. Speichern Sie sie in einem Passwortmanager oder drucken Sie sie aus; sie werden nach diesem Schritt nicht erneut angezeigt.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-900 sm:grid-cols-4">
          {setup.recoveryCodes.map(recoveryCode => <code key={recoveryCode} className="rounded bg-white px-2 py-1.5 text-center ring-1 ring-amber-200 [font-variant-numeric:slashed-zero]">{recoveryCode}</code>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mfa-confirm-code">3. Aktueller App-Code</Label>
          <Input id="mfa-confirm-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)} placeholder="123456" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-confirm-password">Administratorpasswort</Label>
          <Input id="mfa-confirm-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Zur Bestätigung" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!code || !currentPassword || confirm.isPending}
          onClick={() => confirm.mutate({ secret: setup.secret, code, recoveryCodes: setup.recoveryCodes, currentPassword })}
        >
          {confirm.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Sicherheit aktivieren
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSetup(null)} disabled={confirm.isPending}>Abbrechen</Button>
      </div>
    </div>
  );
}

export default function Security() {
  const { data: tenantProduct } = trpc.tenantProduct.current.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const currentPackageId: ProductPackageId =
    tenantProduct?.packageId ?? "event_pass";
  const { user } = useAuth();
  const { year } = useEventYear();
  const utils = trpc.useUtils();
  const {
    isCoAdmin,
    isPrimaryTenantAdmin,
    isTenantAdmin: isAdmin,
    administrativeContext,
  } = useTenantAdministration();
  const { data: status, isLoading: statusLoading } =
    trpc.auth.passwordStatus.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    });
  const setAdminPassword = trpc.auth.setAdminPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      toast.success("Administratorpasswort wurde geändert");
    },
    onError: error => toast.error(error.message),
  });
  const unlockPlanningTeam = trpc.auth.unlockPlanningTeamLock.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.passwordStatus.invalidate(),
        utils.audit.activities.invalidate(),
      ]);
      toast.success(
        "Globaler Notfall-Stopp für das Planungsteam wurde aufgehoben"
      );
    },
    onError: error => toast.error(error.message),
  });
  const lockPlanningTeam = trpc.auth.lockPlanningTeam.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.passwordStatus.invalidate(),
        utils.audit.activities.invalidate(),
      ]);
      toast.success(
        "Globaler Notfall-Stopp für alle Planungsteam-Zugänge wurde aktiviert"
      );
    },
    onError: error => toast.error(error.message),
  });
  const downloadClubPrivacyNotice = trpc.pdf.privacyNoticeTemplate.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success(
        "Vereinsmuster für Helfer und Ansprechpartner wurde heruntergeladen"
      );
    },
    onError: error => toast.error(error.message),
  });
  const downloadDataSubjectRequest = trpc.pdf.dataSubjectRequestTemplate.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Vorlage für Datenschutzanfragen wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const downloadPrivacyIncident = trpc.pdf.privacyIncidentTemplate.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Vorlage für Datenschutzvorfälle wurde heruntergeladen");
    },
    onError: error => toast.error(error.message),
  });
  const downloadContractAcceptanceReceipt =
    trpc.auth.contractAcceptanceReceipt.useMutation({
      onSuccess: result => {
        downloadBase64File(result.base64, result.mimeType, result.filename);
        toast.success("Digitaler Vertragsnachweis wurde heruntergeladen");
      },
      onError: error => toast.error(error.message),
    });
  const downloadAcceptedContractDocuments =
    trpc.auth.contractAcceptedDocuments.useMutation({
      onSuccess: result => {
        downloadBase64File(result.base64, result.mimeType, result.filename);
        toast.success("Bestätigte Vertragsunterlagen wurden heruntergeladen");
      },
      onError: error => toast.error(error.message),
    });
  type SecurityGuidePanel =
    | "password"
    | "accesses"
    | "emergency"
    | "audit"
    | "danger";
  const [openGuidePanels, setOpenGuidePanels] = useState<SecurityGuidePanel[]>(
    []
  );
  const [accessGuideFocus, setAccessGuideFocus] = useState<
    "existing" | "create"
  >("existing");
  const [auditGuideFocus, setAuditGuideFocus] = useState<
    "security" | "activity" | "files"
  >("security");
  const setGuidePanelOpen = useCallback(
    (panel: SecurityGuidePanel, open: boolean) => {
      setOpenGuidePanels(current =>
        open
          ? Array.from(new Set([...current, panel]))
          : current.filter(item => item !== panel)
      );
    },
    []
  );
  const focusGuidePanel = useCallback((panel: SecurityGuidePanel) => {
    setOpenGuidePanels([panel]);
  }, []);
  const handleSecurityGuideStep = useCallback(
    (stepKey: string) => {
      switch (stepKey) {
        case "intro":
        case "password":
          focusGuidePanel("password");
          break;
        case "accesses-overview":
        case "accesses-filter":
        case "accesses-list":
          setAccessGuideFocus("existing");
          focusGuidePanel("accesses");
          break;
        case "accesses-create":
        case "accesses-identity":
        case "accesses-rights":
        case "accesses-coadmin":
        case "accesses-events":
          setAccessGuideFocus("create");
          focusGuidePanel("accesses");
          break;
        case "emergency":
          focusGuidePanel("emergency");
          break;
        case "audit-logins":
          setAuditGuideFocus("security");
          focusGuidePanel("audit");
          break;
        case "audit-activity":
          setAuditGuideFocus("activity");
          focusGuidePanel("audit");
          break;
        case "audit-files":
          setAuditGuideFocus("files");
          focusGuidePanel("audit");
          break;
        case "danger":
          focusGuidePanel("danger");
          break;
      }
    },
    [focusGuidePanel]
  );
  if (administrativeContext.isLoading && user?.role === "user") {
    return (
      <div className="text-sm text-muted-foreground">
        Berechtigungen werden geprüft …
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-8 text-center text-muted-foreground">
          Diese Seite ist ausschließlich für Administratoren verfügbar.
        </CardContent>
      </Card>
    );
  }

  const lockBusy = lockPlanningTeam.isPending || unlockPlanningTeam.isPending;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <PageTitle icon="security">Schutz &amp; Protokoll</PageTitle>
        <p className="text-muted-foreground">
          Zugänge, Passwörter, Notfallmaßnahmen und alle Systemprotokolle sicher
          verwalten.
        </p>
        <div className="mt-3">
          <KlemmiSurfaceGuide
            guideId="security"
            title="Schutz und Protokoll für Administratoren"
            introText="Ich führe dich jetzt ausführlich und ohne Änderungen durch Passwort, Zugänge, Rechte, Notfall-Stopp und die drei Protokollbereiche."
            steps={getSecurityKlemmiSteps(currentPackageId)}
            successSignal={null}
            onStepChange={handleSecurityGuideStep}
            onOpenChange={open => !open && setOpenGuidePanels([])}
            completionTitle="Sicherheit nachvollziehbar verwaltet"
            completionText="Du weißt jetzt, wie du Zugänge passend begrenzt, Ereignisse prüfst und geschützte Notfallfunktionen bewusst einsetzt."
          />
        </div>
      </div>

      <div className="space-y-4" data-security-accordions>
        {isPrimaryTenantAdmin && (
          <SecurityAccordion
            klemmiTarget="security-password"
            title="Administratorpasswort neu vergeben"
            description="Administratorpasswort einrichten oder sicher ändern."
            icon={KeyRound}
            tone="amber"
            open={openGuidePanels.includes("password")}
            onOpenChange={open => setGuidePanelOpen("password", open)}
          >
            <PasswordEditor
              enabled={Boolean(status?.adminEnabled)}
              saving={setAdminPassword.isPending}
              onSave={input => setAdminPassword.mutate(input)}
            />
          </SecurityAccordion>
        )}

        {isAdmin && (
          <SecurityAccordion
            title="Zweite Anmeldestufe (Authenticator-App)"
            description="Schützt persönliche Administratorzugänge zusätzlich zum Passwort mit einem zeitbasierten Sicherheitscode."
            icon={ShieldCheck}
            tone="blue"
          >
            <MfaManager />
          </SecurityAccordion>
        )}

        {currentPackageId === "event_pass" ? (
          <SecurityAccordion
            klemmiTarget="security-accesses"
            title="Gemeinsamer Event-Pass-Teamzugang"
            description="Neutrale Teamkennung für die eine Event-Pass-Veranstaltung einrichten oder sicher ändern."
            icon={UsersRound}
            tone="blue"
            open={openGuidePanels.includes("accesses")}
            onOpenChange={open => setGuidePanelOpen("accesses", open)}
          >
            <EventPassSharedAccessManager />
          </SecurityAccordion>
        ) : (
          <SecurityAccordion
            klemmiTarget="security-accesses"
            title="Planungsteam-Zugänge verwalten"
            description="Ansprechpartnerzugänge, Eventfreigaben, Initialcodes und Zugangsblätter verwalten."
            icon={UsersRound}
            tone="blue"
            open={openGuidePanels.includes("accesses")}
            onOpenChange={open => setGuidePanelOpen("accesses", open)}
          >
            <PlanningTeamAccessManager guideFocus={accessGuideFocus} />
          </SecurityAccordion>
        )}

        {isPrimaryTenantAdmin && (
          <SecurityAccordion
            klemmiTarget="security-emergency"
            title="Notfall-Sperrstatus Planungsteam (Global)"
            description="Sperrt bei einem Sicherheitsvorfall sofort alle Planungsteam-Logins und offenen Sitzungen."
            icon={ShieldAlert}
            tone="red"
            open={openGuidePanels.includes("emergency")}
            onOpenChange={open => setGuidePanelOpen("emergency", open)}
          >
            <div className="space-y-4" aria-live="polite">
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  statusLoading
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : status?.planningTeamLocked
                      ? "border-red-300 bg-red-50 text-red-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                )}
              >
                <p className="font-semibold">
                  {statusLoading
                    ? "Sperrstatus wird geladen …"
                    : status?.planningTeamLocked
                      ? "Notfall-Stopp ist aktiv: Planungsteam-Zugänge sind global gesperrt."
                      : "Notfall-Stopp ist inaktiv: Planungsteam-Zugänge sind freigegeben."}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  Bei Aktivierung verlieren auch bereits angemeldete
                  Planungsteam-Sitzungen den Zugriff und müssen nach der
                  Freigabe erneut angemeldet werden.
                </p>
              </div>
              <Button
                type="button"
                variant={status?.planningTeamLocked ? "destructive" : "outline"}
                className={cn(
                  "w-full sm:w-auto",
                  status?.planningTeamLocked
                    ? "!bg-emerald-600 !text-white hover:!bg-emerald-700"
                    : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-900"
                )}
                disabled={statusLoading || lockBusy}
                onClick={() => {
                  if (status?.planningTeamLocked) {
                    unlockPlanningTeam.mutate();
                  } else {
                    lockPlanningTeam.mutate();
                  }
                }}
              >
                {lockBusy ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : status?.planningTeamLocked ? (
                  <Unlock className="mr-2 h-4 w-4" />
                ) : (
                  <LockKeyhole className="mr-2 h-4 w-4" />
                )}
                {status?.planningTeamLocked
                  ? "Globalen Notfall-Stopp aufheben"
                  : "Globaler Notfall-Stopp: Alle Planungsteam-Zugänge sperren"}
              </Button>
            </div>
          </SecurityAccordion>
        )}

        <SecurityAccordion
          klemmiTarget="security-audit"
          title="System- & Sicherheitsprotokoll (Logbuch)"
          description="Sicherheitsereignisse, Aktivitäts- und Löschverlauf sowie Datei- und Import-Historie zentral prüfen."
          icon={ShieldCheck}
          tone="slate"
          open={openGuidePanels.includes("audit")}
          onOpenChange={open => setGuidePanelOpen("audit", open)}
        >
          <AuditCenter guideFocus={auditGuideFocus} />
        </SecurityAccordion>

        {isPrimaryTenantAdmin && (
          <SecurityAccordion
            title="Digitaler Vertragsnachweis"
            description="PDF-Nachweis der bestätigten AGB, AVV und Datenschutzhinweise für den eigenen Verein."
            icon={FileText}
            tone="blue"
          >
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Hier stehen sowohl der kurze Annahmenachweis als auch die vollständigen Wortlaute der exakt bestätigten AGB, AVV und Datenschutzhinweise bereit. Beide Dokumente enthalten keine Passwörter oder Sicherheitscodes.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Der Annahmenachweis wird bei jeder neuen oder erneuten Vertragsbestätigung zusätzlich an die hinterlegte Vereinsadmin-E-Mail angehängt. Die vollständigen Unterlagen bleiben hier mit Version und Prüfsumme abrufbar.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  className="w-full bg-blue-800 text-white hover:bg-blue-900 sm:w-auto"
                  disabled={downloadAcceptedContractDocuments.isPending}
                  onClick={() => downloadAcceptedContractDocuments.mutate()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {downloadAcceptedContractDocuments.isPending
                    ? "Vertragsunterlagen werden erstellt …"
                    : "Meine bestätigten Vertragsunterlagen herunterladen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={downloadContractAcceptanceReceipt.isPending}
                  onClick={() => downloadContractAcceptanceReceipt.mutate()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {downloadContractAcceptanceReceipt.isPending
                    ? "Nachweis wird erstellt …"
                    : "Kurzen Vertragsnachweis herunterladen"}
                </Button>
              </div>
            </div>
          </SecurityAccordion>
        )}

        <SecurityAccordion
          title="Datenschutzvorlagen für Vereine"
          description="Ausfüllbares Vereinsmuster für Helfer und Ansprechpartner sowie direkter Zugriff auf den App-Datenschutzhinweis."
          icon={FileText}
          tone="blue"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-950">
              <p className="font-semibold">
                Datenschutzhinweis für Helferinnen, Helfer und Ansprechpartner
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-900/85">
                Das PDF ist eine ausfüllbare Vereinsvorlage. Es erläutert
                Helferplanung, freiwillige WhatsApp-Kommunikation, geschützte
                Einsatzpläne, Basis- und Teamansicht sowie die freiwillige
                Telefonnummernfreigabe von Ansprechpartnern.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="w-full bg-blue-800 text-white hover:bg-blue-900 sm:w-auto"
                disabled={downloadClubPrivacyNotice.isPending}
                onClick={() => downloadClubPrivacyNotice.mutate()}
              >
                <FileText className="mr-2 h-4 w-4" />
                {downloadClubPrivacyNotice.isPending
                  ? "Vereinsmuster wird erstellt …"
                  : "Vereinsmuster als PDF herunterladen"}
              </Button>
              <a
                href="/datenschutz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                App-Datenschutzhinweis öffnen
              </a>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={downloadDataSubjectRequest.isPending}
                onClick={() => downloadDataSubjectRequest.mutate()}
              >
                <FileText className="mr-2 h-4 w-4" />
                {downloadDataSubjectRequest.isPending
                  ? "Vorlage wird erstellt …"
                  : "Anfragevorlage herunterladen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={downloadPrivacyIncident.isPending}
                onClick={() => downloadPrivacyIncident.mutate()}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                {downloadPrivacyIncident.isPending
                  ? "Vorlage wird erstellt …"
                  : "Vorfallvorlage herunterladen"}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Bitte ergänzt vor Verwendung Vereinsname, Veranstaltung,
              Datenschutzkontakt, tatsächlich genutzte Kommunikationswege und
              die individuelle Aufbewahrungsfrist. Die Vorlage unterstützt die
              Organisation, ersetzt aber keine rechtliche Prüfung des Vereins.
              Die beiden internen Vorlagen helfen bei Auskunfts- oder Löschanfragen
              sowie beim dokumentierten Erstvorgehen bei einem Datenschutzvorfall.
            </p>
          </div>
        </SecurityAccordion>

        <SecurityAccordion
          klemmiTarget="security-danger"
          title={`Gefahrenbereich (Planung ${year})`}
          description="Unwiderrufliche Löschung aller Planungsdaten des aktuell gewählten Jahres."
          icon={ShieldAlert}
          tone="red"
          open={openGuidePanels.includes("danger")}
          onOpenChange={open => setGuidePanelOpen("danger", open)}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="h-5 w-5" /> Gefahrenbereich – Planung{" "}
              {year}
            </div>
            <p className="text-sm text-muted-foreground">
              Löscht alle Ansprechpartner, Helfer, Schichten, Zuordnungen,
              Aufgaben, Materialien, Kuchen- und Finanzdaten des aktuell
              gewählten Jahres. Andere Veranstaltungsjahre und die Passwörter
              bleiben erhalten.
            </p>
            <ResetAreaButton area="all" label={`Alle Planungsdaten ${year}`} />
          </div>
        </SecurityAccordion>
      </div>

    </div>
  );
}
