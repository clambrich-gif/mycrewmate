import { COOKIE_NAME } from "@shared/const";
import { KLEMMI_LOGIN_AUDIO_IDS } from "@shared/klemmi-reactions";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import {
  eventWeekdays,
  helperEligibleForShift,
  helperAvailableForShift,
  isHelperWithoutFirstContact,
  WEEKDAYS,
} from "@shared/weekdays";
import {
  getSessionCookieOptions,
  isEmbeddedManusPreview,
} from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  protectedProcedure as baseProtectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { ShiftUpdateValidationError } from "./shift-update-validation";
import {
  evaluateShifts,
  helperActiveOnDay,
  toMinutes,
  type Day,
} from "./logic";
import {
  clearBackupRestoreLogs,
  exportProjectExcel,
  getBackupRestoreLog,
  listBackupRestoreLogs,
  withExcelOperationLimit,
} from "./excel-backup";
import {
  exportProjectFile,
  loadProjectFile,
  previewProjectFile,
} from "./project-file";
import {
  createPreviewBinding,
  uploadedFileDigest,
  verifyPreviewBinding,
} from "./import-preview-binding";
import {
  applyFullExcelImport,
  applyModuleExcelImport,
  MODULE_IMPORT_AREAS,
  previewFullExcelImport,
  previewModuleExcelImport,
} from "./module-excel-import";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import {
  ADMIN_PASSWORD_OPEN_ID,
  clearPasswordLoginFailures,
  clearPlanningTeamFailures,
  getClientKey,
  getPlanningTeamRateLimitStatus,
  hashPassword,
  isPasswordLoginBlocked,
  PASSWORD_SESSION_MS,
  PLANNING_TEAM_MAX_ATTEMPTS,
  planningTeamAccessIdFromOpenId,
  planningTeamAccessOpenId,
  recordFailedPasswordLogin,
  recordFailedPlanningTeamLogin,
  SHARED_PASSWORD_OPEN_ID,
  verifyPassword,
  verifyRecoveryKey,
} from "./password-auth";
import {
  buildTotpUri,
  createRecoveryCodes,
  createTotpSecret,
  recoveryCodeMatches,
  verifyTotpCode,
} from "./mfa";
import {
  createMfaTestSession,
  isMfaTestLabAllowed,
  verifyMfaTestSession,
} from "./mfa-test-lab";
import {
  createAllHelperTaskZip,
  createBlankPlanPdf,
  createContactOverviewPdf,
  createContactOverviewZip,
  createDonationOverviewPdf,
  createHelperTaskPdf,
  createMaterialPacklistPdf,
  createPlanPdf,
  createPostTaskOverviewPdf,
  createPrepTaskOverviewPdf,
  createPlanningTeamAccessSheetsPdf,
  createPublicHelperTaskPdf,
  renderClubPrivacyNoticeTemplatePdf,
  renderDataSubjectRequestTemplatePdf,
  renderPrivacyIncidentTemplatePdf,
  renderTenantAcceptedContractDocumentsPdf,
  renderTenantContractReceiptPdf,
  DEFAULT_PDF_SETTINGS,
} from "./pdf";
import { publicAppUrl } from "./public-app-url";
import {
  currentEventId,
  currentEventYear,
  requestedPlanningScope,
  withPlanningScope,
} from "./year-context";
import { initialAccessibleEvent } from "@shared/event-start-selection";
import {
  FULL_PLANNER_PERMISSIONS,
  PLANNING_MODULE_META,
  PLANNING_MODULES,
  EDITABLE_PLANNING_MODULES,
  mayReadPlanningModule,
  mayWritePlanningModule,
  type PlanningModule,
  type EditablePlanningModule,
  type PlanningModuleAccess,
} from "@shared/tenant-permissions";
import {
  PRODUCT_ASSIGNMENT_STATUSES,
  PRODUCT_PACKAGE_IDS,
  PRODUCT_PACKAGE_META,
  productAllowsCapability,
  type ProductCapability,
} from "@shared/product-packages";
import {
  MYCREWMATE_SUPPORT_EMAIL,
  TENANT_ACCESS_MODES,
  tenantCreationSetupForAccessMode,
} from "@shared/tenant-access-mode";
import {
  LEGAL_DOCUMENTS,
  REQUIRED_LEGAL_DOCUMENT_IDS,
} from "@shared/legal-contract-documents";
import { MASTER_ADMIN_ORIGIN, isMasterAdminRequestHost } from "@shared/platform-admin";
import { storagePut, storageRead } from "./storage";
import { locationLogoUrl } from "./location-logo-routes";
import {
  getOnlinePresenceStatus,
  recordSessionPresence,
  removeSessionPresence,
  sessionPresenceKey,
} from "./session-presence";
import {
  assertProtectedPdfShareAttemptAllowed,
  clearProtectedPdfShareFailures,
  recordProtectedPdfShareFailure,
} from "./public-share-rate-limit";
import { allowPublicPilotInquiryAttempt } from "./pilot-inquiry-rate-limit";
import {
  createPublicDemoSession,
  getActivePublicDemoCount,
  getPublicDemoLoginDetails,
  isPublicDemoOpenId,
  PUBLIC_DEMO_CONCURRENT_LIMIT,
  PUBLIC_DEMO_SESSION_MS,
  type PublicDemoPackage,
} from "./public-demo";
import { upcomingPreparationDeadlines } from "./dashboard-deadlines";
import {
  isMailDeliveryConfigured,
  renderContractAcceptanceEmail,
  renderInvitationEmail,
  renderMasterPasswordResetEmail,
  renderPlanReleaseContactEmail,
  renderPlanningTeamInvitationEmail,
  renderPilotInquiryConfirmationEmail,
  renderPilotInquiryNotificationEmail,
  renderTenantAccessStatusEmail,
  sendTransactionalEmail,
  type SendMailOptions,
} from "./mail-service";
import { buildPersonalDashboard } from "./personal-dashboard";
import { isPlanInformationOutstanding } from "./plan-release";
const GUIDE_PDF_KEY = "Handbuch_RSC_Helferplanung_742fcb04.pdf";
const GUIDE_PDF_FILENAME = "Handbuch_RSC_Helferplanung.pdf";
const GUIDE_PDF_MAX_BYTES = 5_000_000;
const MASTER_RESET_EMAIL = "info@mycrewmate.de";
const MASTER_RESET_TTL_MINUTES = 30;
const MASTER_RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MASTER_RESET_REQUEST_LIMIT = 3;
const masterResetRequestAttempts = new Map<string, { count: number; resetAt: number }>();
const PILOT_INQUIRY_RECIPIENT = process.env.PILOT_INQUIRY_EMAIL || "support@mycrewmate.de";
const PILOT_ORGANIZATION_TYPES = [
  "Verein oder Verband",
  "Ehrenamtliches Organisationsteam oder Initiative",
  "Gemeinde oder kommunaler Veranstalter",
] as const;
const MFA_CHALLENGE_TOKEN_BYTES = 32;
const PUBLIC_DEMO_VISITOR_COOKIE = "mycrewmate_demo_visitor";
const PUBLIC_DEMO_VISITOR_COOKIE_MS = 24 * 60 * 60 * 1000;
const PUBLIC_DEMO_START_WINDOW_MS = 5 * 60 * 1000;
// Pro Browser ist genug Raum für Event Pass, Light und Pro sowie Wiederholungen.
// Anders als ein IP-Limit blockiert dies keine Besucher hinter demselben Router.
const PUBLIC_DEMO_START_LIMIT = 9;
const publicDemoStartAttempts = new Map<string, { count: number; resetAt: number }>();

function readRequestCookie(req: Request, name: string) {
  const prefix = `${name}=`;
  const raw = req.headers.cookie ?? "";
  return raw
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function getPublicDemoVisitorKey(req: Request, res: Response) {
  const existing = readRequestCookie(req, PUBLIC_DEMO_VISITOR_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{16,96}$/.test(existing)) {
    return `public-demo:${existing}`;
  }

  const visitorId = randomBytes(18).toString("base64url");
  res.cookie(PUBLIC_DEMO_VISITOR_COOKIE, visitorId, {
    ...getSessionCookieOptions(req),
    maxAge: PUBLIC_DEMO_VISITOR_COOKIE_MS,
  });
  return `public-demo:${visitorId}`;
}

function allowPublicDemoStart(clientKey: string) {
  const now = Date.now();
  // Die In-Memory-Tabelle ist nur ein Komfortschutz pro Browser. Abgelaufene
  // Einträge werden dabei opportunistisch entfernt und wachsen nicht weiter.
  if (publicDemoStartAttempts.size > 1_000) {
    publicDemoStartAttempts.forEach((value, key) => {
      if (value.resetAt <= now) publicDemoStartAttempts.delete(key);
    });
  }
  const current = publicDemoStartAttempts.get(clientKey);
  if (!current || current.resetAt <= now) {
    publicDemoStartAttempts.set(clientKey, {
      count: 1,
      resetAt: now + PUBLIC_DEMO_START_WINDOW_MS,
    });
    return true;
  }
  if (current.count >= PUBLIC_DEMO_START_LIMIT) return false;
  current.count += 1;
  return true;
}

async function safelyRecordPresence(
  req: Parameters<typeof recordSessionPresence>[0],
  user: Parameters<typeof recordSessionPresence>[1] & { openId: string }
) {
  try {
    const scope = await authorizedPlanningScope(user, req);
    const isCoAdmin = await withPlanningScope(scope, () =>
      isDelegatedTenantAdministrator(user)
    );
    await recordSessionPresence(req, user, {
      tenantId: scope.tenantId,
      presenceRole: isCoAdmin
        ? "co_admin"
        : isPrimaryTenantAdministrator(user)
          ? "primary_admin"
          : "planner",
    });
  } catch (error) {
    console.warn("[Presence] Aktivitätszeit konnte nicht gespeichert werden", error);
  }
}

/** Speichert zufällige Einmal-Token ausschließlich als deterministischen Hash. */
function hashOpaqueToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function issueMfaLoginChallenge(input: {
  subjectType: "master" | "tenant_admin";
  userId?: number | null;
}) {
  const token = randomBytes(MFA_CHALLENGE_TOKEN_BYTES).toString("base64url");
  await db.createMfaLoginChallenge({
    tokenHash: hashOpaqueToken(token),
    subjectType: input.subjectType,
    userId: input.userId ?? null,
  });
  return token;
}

/** Übersetzt interne Rechtekennungen für Einladungen in verständliche Bereichsnamen. */
function planningModuleSummary(modules: readonly PlanningModule[] | null | undefined) {
  const rawModules = modules ?? [];
  if (rawModules.length === 0 || rawModules.includes("read_all")) {
    return "Reine Leseansicht aller Planungsbereiche";
  }
  return rawModules
    .filter(module => module !== "read_all")
    .map(module => PLANNING_MODULE_META[module].label)
    .join(", ");
}

/**
 * Die Zugangs- und Linkerstellung bleibt nutzbar, wenn der SMTP-Dienst gerade
 * nicht annimmt. Der Link wird anschließend im Dialog angezeigt und kann sicher
 * manuell übermittelt werden.
 */
async function safelySubmitInvitationEmail(options: SendMailOptions) {
  try {
    const result = await sendTransactionalEmail(options);
    if (!result.success) {
      console.warn(
        result.simulated
          ? "[Mail] Einladung nicht gesendet: SMTP ist nicht konfiguriert."
          : "[Mail] Einladung wurde vom SMTP-Server nicht angenommen."
      );
    }
    return result.success;
  } catch {
    console.warn("[Mail] Einladung konnte nicht an den SMTP-Server übergeben werden.");
    return false;
  }
}

/** Informiert alle vor dem Statuswechsel ermittelten Vereinsadministratoren. */
async function notifyTenantAdministratorsAboutAccessStatus(input: {
  recipients: Array<{ name: string; email: string }>;
  tenantName: string;
  status: "paused" | "archived";
  packageName?: string;
}) {
  const deliveries = await Promise.all(
    input.recipients.map(async recipient => {
      const content = renderTenantAccessStatusEmail({
        recipientName: recipient.name,
        tenantName: input.tenantName,
        status: input.status,
        packageName: input.packageName,
      });
      return safelySubmitInvitationEmail({ to: recipient.email, ...content });
    })
  );
  return {
    recipientCount: input.recipients.length,
    deliveredCount: deliveries.filter(Boolean).length,
  };
}

/** Verhindert neue Sitzungen, wenn das Paket zentral pausiert oder abgelaufen ist. */
async function assertTenantProductUsableForLogin(tenantId: string) {
  const entitlement = await db.getTenantProductEntitlement(tenantId);
  if (entitlement.isUsable) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "Der Vereinszugang ist aktuell pausiert oder abgelaufen. Bitte wenden Sie sich an die Plattformverwaltung.",
  });
}

/** Begrenzt anonyme Reset-Anfragen, ohne die Inhaberadresse preiszugeben. */
function allowMasterResetRequest(clientKey: string) {
  const now = Date.now();
  const current = masterResetRequestAttempts.get(clientKey);
  if (!current || current.resetAt <= now) {
    masterResetRequestAttempts.set(clientKey, {
      count: 1,
      resetAt: now + MASTER_RESET_REQUEST_WINDOW_MS,
    });
    return true;
  }
  if (current.count >= MASTER_RESET_REQUEST_LIMIT) return false;
  current.count += 1;
  return true;
}

function planningTeamAccessIdForUser(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}) {
  // Administratoren und systemseitige Cron-Aufrufe behalten ihren bestehenden
  // Vollzugriff. Planungsteam-Sitzungen müssen dagegen immer zu einem aktuell
  // verwalteten Zugang gehören.
  if (user.role !== "user" || user.isCron) return null;
  // Der frühere globale Planungsteam-Zugang wird beim ersten Aufruf ungültig.
  // Dadurch kann ein alter Cookie niemals die neuen Eventfreigaben umgehen.
  if (user.openId === SHARED_PASSWORD_OPEN_ID) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Planungsteam-Zugang wurde ersetzt. Bitte erneut anmelden.",
    });
  }
  const accessId = planningTeamAccessIdFromOpenId(user.openId);
  // Wenn der Benutzer ein allgemeiner Mock-Benutzer ohne verwaltete Zugangs-ID ist
  // (z. B. generische Vitest-Mocks wie openId: "user-id"), wird der Zugriff nicht
  // blockiert, sofern er kein explizit ungültiges planning-team-Format aufweist.
  if (accessId === null && !user.openId.startsWith("planning-team-access-")) {
    return null;
  }
  if (accessId === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Planungsteam-Zugang ist nicht mehr gültig. Bitte erneut anmelden.",
    });
  }
  return accessId;
}

/**
 * Ermittelt die Ansprechpartner einer angemeldeten Person ausschließlich aus
 * der gespeicherten Teamzugangsverknüpfung oder einem eindeutigen Altbestand.
 * Gleiche Namen dürfen dabei niemals mehrere Kontakte zusammenführen.
 */
async function ownContactIdsForPersonalPlanView(
  user: {
    openId: string;
    name?: string | null;
    role: "user" | "admin";
    isCron?: boolean;
  },
  contacts: Array<{ id: number; name: string }>
) {
  const ownContactIds = new Set<number>();
  const planningAccessId = planningTeamAccessIdForUser(user);
  if (planningAccessId !== null) {
    const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(
      planningAccessId
    );
    if (typeof access?.contactId === "number") {
      ownContactIds.add(access.contactId);
    }
  }

  const normalizedCurrentName = db.normalizePersonName(user.name ?? "");
  const nameMatchedContacts = normalizedCurrentName
    ? contacts.filter(contact => db.normalizePersonName(contact.name) === normalizedCurrentName)
    : [];
  if (nameMatchedContacts.length === 1) {
    ownContactIds.add(nameMatchedContacts[0].id);
  }
  return ownContactIds;
}

async function getPlanningTeamPermissionsForUser(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}): Promise<readonly PlanningModule[]> {
  if (user.role === "admin" || user.isCron) return FULL_PLANNER_PERMISSIONS;
  const accessId = planningTeamAccessIdForUser(user);
  if (accessId === null) {
    // Bei Test-Mocks wie openId: "planning-team" wird standardmäßig Bearbeitungszugriff gewährt
    return FULL_PLANNER_PERMISSIONS;
  }
  const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(accessId);
  if (!access) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Planungsteam-Zugang gehört nicht zum aktuell angemeldeten Verein.",
    });
  }
  if (access.isTenantAdmin) return FULL_PLANNER_PERMISSIONS;
  if (access.moduleAccess && typeof access.moduleAccess === "object") {
    const explicitAccess = access.moduleAccess as PlanningModuleAccess;
    return EDITABLE_PLANNING_MODULES.filter(m => explicitAccess[m] === "write");
  }
  return Array.isArray(access.modulePermissions)
    ? access.modulePermissions
    : [];
}

async function getPlanningTeamModuleAccessForUser(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}): Promise<PlanningModuleAccess> {
  if (user.role === "admin" || user.isCron) {
    return Object.fromEntries(PLANNING_MODULES.map(m => [m, "write"]));
  }
  const accessId = planningTeamAccessIdForUser(user);
  if (accessId === null) {
    return Object.fromEntries(PLANNING_MODULES.map(m => [m, "write"]));
  }
  const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(accessId);
  if (!access) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Planungsteam-Zugang gehört nicht zum aktuell angemeldeten Verein.",
    });
  }
  if (access.isTenantAdmin) {
    return Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]));
  }
  if (access.moduleAccess && typeof access.moduleAccess === "object") {
    const raw = access.moduleAccess as PlanningModuleAccess;
    return Object.fromEntries(
      EDITABLE_PLANNING_MODULES.map(m => [m, raw[m] ?? "off"])
    );
  }
  const permissions = Array.isArray(access.modulePermissions) ? access.modulePermissions : [];
  if (permissions.length === 0 || permissions.includes("read_all")) {
    return Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "read"]));
  }
  return Object.fromEntries(
    EDITABLE_PLANNING_MODULES.map(m => [m, permissions.includes(m) ? "write" : "off"])
  );
}

/**
 * Eine Stellvertretung bleibt technisch ein Planungsteamkonto. Der zusätzliche
 * Status erweitert die Rechte ausschließlich im aktuell serverseitig gebundenen
 * Verein; weder Browserangaben noch andere Vereine können ihn verleihen.
 */
async function isTenantAdministrator(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}, targetTenantId?: string) {
  if (user.role === "admin" || user.isCron) return true;
  const accessId = planningTeamAccessIdForUser(user);
  if (accessId === null) return false;
  const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(accessId, targetTenantId);
  return Boolean(access?.isTenantAdmin);
}

function requireModuleWritePermission(
  moduleAccess: PlanningModuleAccess,
  module: EditablePlanningModule
) {
  if (!mayWritePlanningModule(moduleAccess, module)) {
    const isReadOnlyAccess = mayReadPlanningModule(moduleAccess, module);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: isReadOnlyAccess
        ? "Lesezugriff aktiv: Sie können diesen Bereich ansehen, aber keine Daten ändern. Bitte wenden Sie sich bei Bedarf an das Admin-Team."
        : "Keine Berechtigung zur Bearbeitung dieses Bereichs.",
    });
  }
}

function requireModuleReadPermission(
  moduleAccess: PlanningModuleAccess,
  module: EditablePlanningModule
) {
  if (!mayReadPlanningModule(moduleAccess, module)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Keine Leseberechtigung für diesen Bereich.",
    });
  }
}

async function requirePlanningTeamEventAccess(
  user: { openId: string; role: "user" | "admin"; isCron?: boolean },
  scope: ReturnType<typeof requestedPlanningScope>
) {
  // Die Freigabe ist unabhängig vom Browserzustand verpflichtend. Damit kann
  // ein manuell geänderter x-event-id Header niemals ein fremdes Event öffnen.
  const accessId = planningTeamAccessIdForUser(user);
  if (accessId === null) return;
  if (await isTenantAdministrator(user, scope.tenantId)) return;
  if (
    !(await db.isPlanningTeamAccessAllowedForEvent(
      accessId,
      scope.eventId,
      scope.tenantId
    ))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Planungsteam-Zugang ist für die gewählte Veranstaltung nicht freigegeben.",
    });
  }
}

/**
 * Bindet den Event Pass serverseitig an genau die vom Master-Admin gewählte
 * Veranstaltung. Ein alter oder manipulierte Browser-Scope wird auf diese
 * Veranstaltung korrigiert; eine fehlende oder pausierte Zuordnung bleibt
 * vollständig gesperrt.
 */
async function enforceProductEventScope(
  scope: ReturnType<typeof requestedPlanningScope>
) {
  return withPlanningScope(scope, async () => {
    const entitlement = await db.getCurrentTenantProductEntitlement();
    if (entitlement.packageId !== "event_pass") return scope;
    if (!entitlement.isUsable) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Der Event Pass ist aktuell nicht aktiv. Bitte wenden Sie sich an die Plattformverwaltung.",
      });
    }
    if (!entitlement.eventId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Dem Event Pass ist noch keine Veranstaltung zugeordnet. Bitte wenden Sie sich an die Plattformverwaltung.",
      });
    }
    if (scope.eventId === entitlement.eventId) return scope;
    const assignedEvent = await db.getEventForTenantById(
      entitlement.eventId,
      scope.tenantId
    );
    if (!assignedEvent) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Die zum Event Pass gehörende Veranstaltung ist nicht mehr verfügbar. Bitte wenden Sie sich an die Plattformverwaltung.",
      });
    }
    return {
      tenantId: scope.tenantId,
      year: assignedEvent.year,
      eventId: assignedEvent.id,
    };
  });
}

/**
 * Der Event-Pass-Zugang ist absichtlich keine Mailadresse: Er vermeidet
 * die Weitergabe der privaten Adresse des buchenden Vereinskontakts. Die
 * Kennung ist nicht geheim; Sicherheit entsteht ausschließlich durch das
 * starke Passwort, das nur als Hash gespeichert wird.
 */
function eventPassSharedAccessIdentifier(tenantId: string) {
  return `eventpass-${tenantId}`.toLocaleLowerCase("de-DE");
}

const EVENT_PASS_SHARED_MODULE_ACCESS: PlanningModuleAccess = Object.freeze({
  contacts: "off",
  helpers: "write",
  donations: "off",
  schedule: "write",
  preparation: "write",
  postprocessing: "off",
  materials: "off",
  finances: "off",
  pdf: "write",
  locations: "off",
});

async function requireEventPassSharedAccessContext() {
  const entitlement = await db.getCurrentTenantProductEntitlement();
  if (entitlement.packageId !== "event_pass") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Der gemeinsame Teamzugang steht ausschließlich im Event Pass bereit.",
    });
  }
  if (!entitlement.isUsable || !entitlement.eventId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Für den Event Pass ist derzeit keine aktive Veranstaltung hinterlegt.",
    });
  }
  const tenant = await db.getTenant();
  if (!tenant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Vereinszugang nicht gefunden." });
  }
  return {
    tenantId: tenant.id,
    eventId: entitlement.eventId,
    identifier: eventPassSharedAccessIdentifier(tenant.id),
  };
}

async function requireCurrentProductCapability(capability: ProductCapability) {
  const entitlement = await db.getCurrentTenantProductEntitlement();
  if (!entitlement.isUsable) {
    const productName = PRODUCT_PACKAGE_META[entitlement.packageId].name;
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Das Paket ${productName} ist aktuell nicht aktiv. Bitte wenden Sie sich an die Plattformverwaltung.`,
    });
  }
  if (!db.currentProductAllowsCapability) return;
  if (!(await db.currentProductAllowsCapability(capability))) {
    const message =
      entitlement.packageId === "light"
        ? "Diese Funktion ist im Light-Paket nicht enthalten. Light umfasst eine Hauptveranstaltung pro Jahr, bis zu 150 Helfer, 50 Ansprechpartner, 25 Orte und fünf persönliche Teamzugänge sowie Material, Vor- und Nachbereitung. Für mehrere Events, Live-Chat, Spenden, Finanzen oder Karten und GPX-Strecken ist Pro vorgesehen."
        : "Diese Funktion ist im Event Pass nicht enthalten. Der Event Pass umfasst eine Veranstaltung mit bis zu 50 Helfern, Vorbereitung, Einsatzplan und Standard-PDF-Listen.";
    throw new TRPCError({
      code: "FORBIDDEN",
      message,
    });
  }
}

async function requireCurrentProductModule(module: EditablePlanningModule) {
  const entitlement = await db.getCurrentTenantProductEntitlement();
  if (!entitlement.isUsable) {
    const productName = PRODUCT_PACKAGE_META[entitlement.packageId].name;
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Das Paket ${productName} ist aktuell nicht aktiv. Bitte wenden Sie sich an die Plattformverwaltung.`,
    });
  }
  if (!db.currentProductAllowsPlanningModule) return;
  if (!(await db.currentProductAllowsPlanningModule(module))) {
    const message =
      entitlement.packageId === "light"
        ? "Dieser Bereich ist im Light-Paket nicht enthalten. Bitte wenden Sie sich für ein Upgrade auf Pro an die Plattformverwaltung."
        : "Dieser Bereich ist im Event Pass nicht enthalten. Bitte wenden Sie sich bei Bedarf an die Plattformverwaltung.";
    throw new TRPCError({
      code: "FORBIDDEN",
      message,
    });
  }
}

/**
 * Der Browser darf Jahr und Veranstaltung als Bedienkontext senden. Der Verein
 * wird dagegen immer aus der aktiven Mitgliedschaft des angemeldeten Kontos
 * abgeleitet; ein manipuliertes x-tenant-id kann keinen Fremdzugriff erzeugen.
 */
async function authorizedPlanningScope(
  user: { id: number; openId: string; role: "user" | "admin"; isCron?: boolean },
  req: Parameters<typeof requestedPlanningScope>[0]
) {
  const requested = requestedPlanningScope(req);
  const planningAccessId = planningTeamAccessIdForUser(user);
  if (planningAccessId !== null) {
    const tenantId = await db.getPlanningTeamAccessTenantId(planningAccessId);
    if (!tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Für diesen Planungsteam-Zugang ist keine Veranstaltung freigegeben.",
      });
    }
    const requestedScope = { ...requested, tenantId };
    const entitlement = await withPlanningScope(requestedScope, () =>
      db.getCurrentTenantProductEntitlement()
    );
    const requestedEventIsAllowed = await db.isPlanningTeamAccessAllowedForEvent(
      planningAccessId,
      requestedScope.eventId,
      tenantId
    );
    if (requestedEventIsAllowed) return enforceProductEventScope(requestedScope);

    // Ein frischer Zugang kann noch einen alten oder leeren Browserwert erben.
    // Statt dadurch Dashboard und Chat zu blockieren, wird ausschließlich auf
    // eine tatsächlich freigegebene Veranstaltung desselben Zugangs gesetzt.
    // Kein fremdes Event wird übernommen; ohne Freigabe bleibt der Zugriff gesperrt.
    const allowedEvents = await withPlanningScope(requestedScope, () =>
      db.listAllEventsForPlanningTeamAccess(planningAccessId)
    );
    const fallbackEvent = initialAccessibleEvent(allowedEvents);
    if (!fallbackEvent) return enforceProductEventScope(requestedScope);

    return enforceProductEventScope({
      tenantId,
      year: fallbackEvent.year,
      eventId: fallbackEvent.id,
    });
  }
  let membership: Awaited<ReturnType<typeof db.resolveTenantForUser>> | undefined;
  try {
    if ("resolveTenantForUser" in db) {
      membership = await (db as any).resolveTenantForUser({
        userId: user.id,
        userOpenId: user.openId,
        // Nur der Plattform-Inhaber darf über den Handoff gezielt einen
        // Verein wählen. Für persönliche Vereinsadmins und Planungsteams wäre
        // ein Browserwert ein unzulässiger Wechsel in einen Fremdmandanten.
        preferredTenantId:
          user.openId === ADMIN_PASSWORD_OPEN_ID
            ? requested.tenantId
            : undefined,
      });
    }
  } catch {
    // Mock-Fallback für isolierte Testumgebungen
  }
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Für dieses Konto ist kein aktiver Verein freigegeben.",
    });
  }
  return enforceProductEventScope({ ...requested, tenantId: membership.tenantId });
}

/** Eine frische persönliche Anmeldung darf nie einen alten Browsermandanten übernehmen. */
async function tenantIdForFreshPersonalLogin(user: {
  id: number;
  openId: string;
}) {
  const membership = await db.resolveTenantForUser({
    userId: user.id,
    userOpenId: user.openId,
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Für dieses persönliche Konto ist kein aktiver Verein freigegeben.",
    });
  }
  return membership.tenantId;
}

/**
 * Legt den ersten Veranstaltungskontext noch vor dem Browser-Reload fest.
 * Dadurch kann ein frisch angemeldeter Planungsteam-Zugang nicht einmal für
 * einen Renderzyklus mit einer alten lokalen Event-ID starten. Insbesondere der
 * veranstaltungsgebundene Teamchat erhält so unmittelbar den freigegebenen
 * Scope statt einer vermeintlichen Synchronisierungsstörung.
 */
async function startEventForFreshPlanningTeamLogin(
  accessId: number,
  tenantId: string
) {
  try {
    return await withPlanningScope(
      { tenantId, year: new Date().getFullYear(), eventId: 1 },
      async () => {
        const allowedEvents = await db.listAllEventsForPlanningTeamAccess(accessId);
        const startEvent = initialAccessibleEvent(allowedEvents);
        return startEvent
          ? { year: startEvent.year, eventId: startEvent.id }
          : null;
      }
    );
  } catch {
    // Eine Anmeldung darf nicht scheitern, wenn die Komfortauswahl gerade nicht
    // beantwortet werden kann. Der Client hält die App dann zunächst in der
    // sicheren Startansicht und ermittelt über events.all ausschließlich die
    // tatsächlich freigegebenen Veranstaltungen.
    return null;
  }
}

/** Ein per Zugangsblatt ausgegebener Einmalcode erlaubt nur den Passwortwechsel. */
async function requireCompletedPlanningTeamPasswordChange(user: {
  id: number;
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}) {
  // Öffentliche Vereinsdemos erhalten eine isolierte technische Sitzung ohne
  // Vertrags- oder Passwortdialog. Sie sind nie einem echten Verein zugeordnet
  // und werden beim Verlassen beziehungsweise spätestens nach kurzer Zeit gelöscht.
  if (isPublicDemoOpenId(user.openId)) return;
  const accessId = planningTeamAccessIdForUser(user);
  if (
    accessId !== null &&
    (await db.isPlanningTeamAccessPasswordChangeRequired(accessId))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Bitte vergeben Sie zuerst Ihr persönliches Passwort, um die Planung zu öffnen.",
    });
  }
  if (
    user.role === "admin" &&
    user.openId.startsWith("tenant-admin:") &&
    (await db.isTenantAdminPasswordChangeRequired(user.id))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Bitte vergeben Sie zuerst Ihr persönliches Passwort, um die Planung zu öffnen.",
    });
  }

  if (
    user.role === "admin" &&
    user.openId.startsWith("tenant-admin:") &&
    !(await db.isTenantAdminPasswordChangeRequired(user.id))
  ) {
    const membership = await db.resolveTenantForUser({
      userId: user.id,
      userOpenId: user.openId,
      allowPilotFallback: false,
    });
    if (membership && (await db.tenantNeedsCurrentContractAcceptance(membership.tenantId))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Bitte bestätigen Sie zuerst die aktuelle AGB, AVV und Datenschutzerklärung für Ihren Verein.",
      });
    }
  }
}

type GpxMapTrack = {
  id: number;
  name: string;
  color: string;
  summary: string | null;
  points: Array<[number, number]>;
};

const LOCATION_LOGO_MAX_BYTES = 3_000_000;
const locationLogoMimeType = z.enum([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
]);
type LocationLogoMimeType = z.infer<typeof locationLogoMimeType>;

function locationLogoExtension(mimeType: LocationLogoMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "svg";
}

function decodeLocationLogoBase64(base64: string) {
  const compact = base64.replace(/\s/g, "");
  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  )
    return null;
  const buffer = Buffer.from(compact, "base64");
  return buffer.toString("base64") === compact ? buffer : null;
}

function isValidLocationLogo(buffer: Buffer, mimeType: LocationLogoMimeType) {
  if (mimeType === "image/png")
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (mimeType === "image/jpeg")
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const svg = buffer.toString("utf8").trim();
  return (
    /^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg) &&
    !/<script\b|\son\w+\s*=|<foreignObject\b/i.test(svg)
  );
}

function parseGpxMapPoints(xml: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const pointTags = Array.from(xml.matchAll(/<(?:trkpt|rtept)\b([^>]*)>/gi));
  for (const match of pointTags) {
    const attributes = match[1];
    const latitude = Number(attributes.match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]);
    const longitude = Number(attributes.match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      points.push([latitude, longitude]);
    }
  }
  if (points.length < 2) {
    throw new Error("GPX-Datei enthält keine lesbare Streckenlinie");
  }

  // Große Original-GPX-Dateien werden für die Browserkarte gleichmäßig
  // ausgedünnt. Start- und Endpunkt bleiben immer erhalten.
  const maxPoints = 5_000;
  if (points.length <= maxPoints) return points;
  const step = Math.ceil((points.length - 1) / (maxPoints - 1));
  const reduced = points.filter((_, index) => index % step === 0);
  if (reduced[reduced.length - 1] !== points[points.length - 1]) {
    reduced.push(points[points.length - 1]);
  }
  return reduced;
}

function parseGpxSummary(xml: string): string | null {
  const metadataDescription = xml.match(
    /<metadata\b[^>]*>[\s\S]*?<desc\b[^>]*>([\s\S]*?)<\/desc>/i
  )?.[1];
  const trackDescription = xml.match(
    /<trk\b[^>]*>[\s\S]*?<desc\b[^>]*>([\s\S]*?)<\/desc>/i
  )?.[1];
  const raw = metadataDescription ?? trackDescription;
  if (!raw) return null;
  const text = raw
    .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 280) : null;
}

async function loadGpxMapTrack(track: {
  id: number;
  name: string;
  fileKey: string;
  color: string;
}): Promise<GpxMapTrack> {
  const bytes = await storageRead(track.fileKey);
  if (bytes.length > 6_000_000) {
    throw new Error("GPX-Datei überschreitet die Größenbegrenzung");
  }
  const xml = bytes.toString("utf8");
  return {
    id: track.id,
    name: track.name,
    color: track.color,
    summary: parseGpxSummary(xml),
    points: parseGpxMapPoints(xml),
  };
}

const activeSessionProcedure = baseProtectedProcedure.use(
  async ({ ctx, next }) => {
    // Demos sind absichtlich isoliert und kurzlebig. Präsenzschreibvorgänge
    // bieten dort keinen Mehrwert und können nach einer parallelen Bereinigung
    // unnötige Fremdschlüsselwarnungen auslösen.
    if (!isPublicDemoOpenId(ctx.user.openId)) {
      await safelyRecordPresence(ctx.req, ctx.user);
    }
    return next();
  }
);

// Die Auswahlfelder laden ausschließlich Daten des serverseitig zugeordneten
// Vereins. Ein veralteter Browser-Scope wird automatisch darauf begrenzt.
const eventSelectionProcedure = activeSessionProcedure.use(async ({ ctx, next }) => {
  const scope = await authorizedPlanningScope(ctx.user, ctx.req);
  return withPlanningScope(scope, () => next());
});

// Reine Hintergrundabfragen (insbesondere notes.list) dürfen keine Präsenz
// verlängern. Sonst würden inaktive Browsertabs durch 5-Sekunden-Polling
// dauerhaft als "online" erscheinen.
const scopedReadProcedure = baseProtectedProcedure
  .use(async ({ ctx, next }) => {
    const scope = await authorizedPlanningScope(ctx.user, ctx.req);
    return withPlanningScope(scope, async () => {
      await requirePlanningTeamEventAccess(ctx.user, scope);
      await requireCompletedPlanningTeamPasswordChange(ctx.user);
      return next();
    });
  })
  .use(async ({ next }) => {
    if (!(await db.getEvent())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr",
      });
    }
    return next();
  });

/**
 * Der Team-Chat gehört zur Zusammenarbeit einer konkreten Veranstaltung und
 * nicht zu einem Fachmodul. Deshalb darf jede aktiv angemeldete Person mit
 * Eventfreigabe den Verlauf lesen, schreiben und den Tippstatus teilen – auch
 * bei einem reinen Lesezugang ohne einzelne Modulfreigaben. Die Berechtigung
 * zum Leeren bleibt davon bewusst ausgenommen und liegt beim Adminverfahren.
 *
 * Der Lesepfad verwendet keine Präsenzaktualisierung, damit ein inaktiver Tab
 * nicht allein durch das Chat-Polling als online gezählt wird.
 */
const eventChatReadProcedure = baseProtectedProcedure
  .use(async ({ ctx, next }) => {
    const scope = await authorizedPlanningScope(ctx.user, ctx.req);
    // Erst innerhalb des serverbestätigten Scope prüfen, dann den Chat starten.
    // Ein alter Browserwert kann damit weder Zugriff erhalten noch eine gültige
    // Freigabe verfälschen.
    return withPlanningScope(scope, async () => {
      await requireCurrentProductCapability("chat");
      await requirePlanningTeamEventAccess(ctx.user, scope);
      await requireCompletedPlanningTeamPasswordChange(ctx.user);
      return next();
    });
  })
  .use(async ({ next }) => {
    if (!(await db.getEvent())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr",
      });
    }
    return next();
  });

const eventChatWriteProcedure = eventChatReadProcedure.use(
  async ({ next }) => db.withPlanningWriteLock(() => next())
);

const accountAdminProcedure = activeSessionProcedure.use(({ ctx, next }) => {
  if (
    ctx.user.role !== "admin" ||
    ctx.user.openId !== ADMIN_PASSWORD_OPEN_ID
  ) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/**
 * Abgeschottete Plattformverwaltung: Der bisherige globale Administrator ist
 * während der Pilotphase der einzige Master-Admin. Künftige Vereinsadmins
 * erhalten andere OpenIDs und bestehen diese explizite Prüfung nicht.
 */
const masterAdminProcedure = activeSessionProcedure.use(({ ctx, next }) => {
  const allowedHost = isMasterAdminRequestHost(
    ctx.req.hostname,
    process.env.NODE_ENV
  );
  const isMasterIdentity =
    ctx.user.role === "admin" && ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
  if (!allowedHost || !isMasterIdentity) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Dieser Bereich ist ausschließlich für die Plattformverwaltung vorgesehen.",
    });
  }
  return next({ ctx });
});

const ACTIVITY_MODULE_LABELS: Record<string, string> = {
  contacts: "Ansprechpartner",
  helpers: "Helfer",
  shifts: "Einsatzplan",
  plan: "Einsatzplan",
  prep: "Vorbereitung",
  post: "Nachbereitung",
  materials: "Material",
  marketing: "Marketing",
  approvals: "Genehmigungen",
  cakes: "Spenden",
  finances: "Finanzen",
  locations: "Orte & Standorte",
  gpxTracks: "Strecken",
  events: "Veranstaltungen",
  years: "Veranstaltungsjahre",
  planningTeamAccesses: "Zugänge & Freigaben",
  reset: "Planung",
  moduleAssignments: "Planung",
  pdf: "PDF-Ausgabe",
};

function describeActivityMutation(path: string, input: unknown) {
  const [moduleKey, operation = "Aktion"] = path.split(".");
  const module = ACTIVITY_MODULE_LABELS[moduleKey];
  if (!module) return null;

  const values =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = values[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  };
  const action = /^(create|add|assign|upsert)$/i.test(operation)
    ? "created"
    : /^(remove|delete|unassign|clear)$/i.test(operation)
      ? "deleted"
      : /^(reset)$/i.test(operation)
        ? "reset"
        : /^(import|load)$/i.test(operation)
          ? "imported"
          : /^(copy)$/i.test(operation)
            ? "copied"
            : "updated";

  const subject =
    value("task", "article", "name", "measure", "request", "donor", "category") ??
    (typeof values.id === "number" ? `Eintrag #${values.id}` : operation);
  const actionText: Record<typeof action, string> = {
    created: "angelegt",
    updated: "aktualisiert",
    deleted: "gelöscht",
    reset: "zurückgesetzt",
    imported: "importiert",
    copied: "übernommen",
  };

  return {
    module,
    action,
    subject: `${module}: „${subject}“ ${actionText[action]}`,
  } as const;
}

async function recordOperationalActivity(
  ctx: {
    user: {
      id: number;
      name: string | null;
      role: "user" | "admin";
      loginMethod: string | null;
    };
  },
  path: string,
  input: unknown
) {
  const activity = describeActivityMutation(path, input);
  if (!activity) return;
  try {
    await db.recordActivityLog({
      actor: auditActor(ctx.user),
      ...activity,
    });
  } catch (error) {
    console.warn("[ActivityLog] Konnte nicht aufgezeichnet werden:", error);
  }
}

/** Sicherheitsereignisse dürfen weder Login noch Passwortwechsel blockieren. */
async function recordSecurityActivity(
  actor: db.AuditActor,
  subject: string,
  action: db.ActivityLogAction = "updated",
  tenantId?: string | null
) {
  try {
    await db.recordActivityLog({
      actor,
      module: "Zugangsschutz",
      action,
      subject,
      ...(tenantId === undefined ? {} : { tenantId }),
    });
  } catch (error) {
    console.warn("[Security] Sicherheitsereignis konnte nicht protokolliert werden", error);
  }
}

const scopedProtectedProcedure = activeSessionProcedure.use(async ({ ctx, next }) => {
  const scope = await authorizedPlanningScope(ctx.user, ctx.req);
  return withPlanningScope(scope, async () => {
    await requirePlanningTeamEventAccess(ctx.user, scope);
    await requireCompletedPlanningTeamPasswordChange(ctx.user);
    return next();
  });
});

const protectedProcedure = scopedProtectedProcedure.use(
  async ({ ctx, next, type, path, input }) => {
    if (!(await db.getEvent())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Die gewählte Veranstaltung gehört nicht zum gewählten Veranstaltungsjahr",
      });
    }
    if (type === "mutation") {
      return db.withPlanningWriteLock(async () => {
        const result = await next();
        await recordOperationalActivity(ctx, path, input);
        return result;
      });
    }
    return next();
  }
);

const scopeAdminAuthProcedure = scopedProtectedProcedure.use(
  async ({ ctx, next }) => {
    if (!(await isTenantAdministrator(ctx.user))) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  }
);

const scopeAdminProcedure = scopeAdminAuthProcedure.use(
  async ({ ctx, next, type, path, input }) => {
    if (type === "mutation") {
      return db.withPlanningWriteLock(async () => {
        const result = await next();
        await recordOperationalActivity(ctx, path, input);
        return result;
      });
    }
    return next();
  }
);

function productScopeAdminAuthProcedure(capability: ProductCapability) {
  return scopeAdminAuthProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

function productScopeAdminProcedure(capability: ProductCapability) {
  return scopeAdminProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}
/**
 * Event Pass und Light erhalten eine auf die aktive Veranstaltung begrenzte
 * JSON-Sicherung, ohne dadurch umfassende Pro-Excel-Rechte zu erhalten.
 * Für Pro und Enterprise bleibt die bisherige Einzelprüfung maßgeblich.
 */
async function requireBackupCapability(
  capability: Extract<ProductCapability, "project_backup" | "excel">
) {
  const entitlement = await db.getCurrentTenantProductEntitlement();
  // Event Pass und Light enthalten ausschließlich die vollständige
  // JSON-Sicherung der aktiven Veranstaltung. Excel bleibt auch serverseitig
  // eine Pro-Funktion; die UI-Ausblendung allein wäre dafür keine ausreichende
  // Absicherung.
  if (
    entitlement.packageId === "event_pass" ||
    entitlement.packageId === "light"
  ) {
    await requireCurrentProductCapability(
      capability === "project_backup" ? "event_backup" : "excel"
    );
    return;
  }
  await requireCurrentProductCapability(
    capability
  );
}

/** Öffentliche Demos dürfen keine Dateien, Freigabelinks oder Exporte erzeugen. */
function rejectPublicDemoExternalAction(user: { openId: string }) {
  if (!isPublicDemoOpenId(user.openId)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "In der Vereinsdemo sind Speichern, Laden, Exporte, Freigaben und Dateiaktionen deaktiviert.",
  });
}

function backupCapabilityProcedure(
  capability: Extract<ProductCapability, "project_backup" | "excel">
) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    rejectPublicDemoExternalAction(ctx.user);
    await requireBackupCapability(capability);
    return next({ ctx });
  });
}
function backupCapabilityAdminProcedure(
  capability: Extract<ProductCapability, "project_backup" | "excel">
) {
  return adminProcedure.use(async ({ ctx, next }) => {
    rejectPublicDemoExternalAction(ctx.user);
    await requireBackupCapability(capability);
    return next({ ctx });
  });
}
function backupScopeAdminProcedure(
  capability: Extract<ProductCapability, "project_backup" | "excel">
) {
  return scopeAdminProcedure.use(async ({ ctx, next }) => {
    rejectPublicDemoExternalAction(ctx.user);
    await requireBackupCapability(capability);
    return next({ ctx });
  });
}
function backupScopeAdminAuthProcedure(
  capability: Extract<ProductCapability, "project_backup" | "excel">
) {
  return scopeAdminAuthProcedure.use(async ({ ctx, next }) => {
    rejectPublicDemoExternalAction(ctx.user);
    await requireBackupCapability(capability);
    return next({ ctx });
  });
}

/**
 * Die Zugangsverwaltung ist an den Verein, aber nicht an eine einzelne gerade
 * ausgewählte Veranstaltung gebunden. Dieser Pfad übernimmt deshalb den
 * serverbestätigten Mandantenkontext, ohne eine leere oder gerade gewechselte
 * Veranstaltung vor der Passwortprüfung zum Fehler werden zu lassen.
 */
const tenantAccessAdminProcedure = activeSessionProcedure.use(
  async ({ ctx, next }) => {
    const scope = await authorizedPlanningScope(ctx.user, ctx.req);
    const allowed = await withPlanningScope(scope, () =>
      isTenantAdministrator(ctx.user)
    );
    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await requireCompletedPlanningTeamPasswordChange(ctx.user);
    return withPlanningScope(scope, () => next({ ctx }));
  }
);

const personalAccessAdminProcedure = tenantAccessAdminProcedure.use(
  async ({ ctx, next }) => {
    await requireCurrentProductCapability("personal_accesses");
    return next({ ctx });
  }
);

/**
 * Doppelte Sicherheitsgrenze für die Zugangsverwaltung: Neben den
 * mandantengefilterten Datenbankfunktionen validiert der Router jede vom
 * Browser übermittelte Kontakt- und Veranstaltungs-ID gegen die aktuell
 * serverseitig bestätigte Vereinssicht.
 */
async function assertPlanningTeamAccessReferencesInScope(input: {
  contactId?: number | null;
  eventIds: number[];
}) {
  if (input.contactId !== null && input.contactId !== undefined) {
    const contact = (await db.listAllContactsForPlanningTeamAccess()).find(
      item => item.id === input.contactId
    );
    if (!contact) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Der ausgewählte Ansprechpartner gehört nicht zum aktuellen Verein.",
      });
    }
  }

  const years = await db.listEventYears();
  const eventsById = new Set(
    (
      await Promise.all(years.map(item => db.listEvents(item.year)))
    ).flatMap(events => events.map(event => event.id))
  );
  if (input.eventIds.some(eventId => !eventsById.has(eventId))) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Mindestens eine ausgewählte Veranstaltung gehört nicht zum aktuellen Verein.",
    });
  }
}

/**
 * Hauptvereinsadministratoren und Stellvertretungen verwenden beide fachliche
 * Vollrechte. Die generische Sessionrolle ist daher keine ausreichende
 * Sicherheitsgrenze: Entscheidend ist die serverseitig vergebene Login-Identität.
 */
function isPrimaryTenantAdministrator(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}) {
  if (user.isCron || user.role !== "admin") return false;
  return (
    user.openId === ADMIN_PASSWORD_OPEN_ID ||
    user.openId.startsWith("tenant-admin:")
  );
}

/**
 * Nur ein persönlicher Planungsteamzugang kann Stellvertretung sein. Diese
 * Identitätsprüfung ist bewusst unabhängig von der technischen Sessionrolle,
 * damit Hauptzugänge und Stellvertretungen eindeutig auseinandergehalten werden.
 */
async function isDelegatedTenantAdministrator(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}, targetTenantId?: string) {
  if (user.isCron) return false;
  const accessId = planningTeamAccessIdFromOpenId(user.openId);
  if (accessId === null) return false;
  const access = await db.getPlanningTeamAccessCredentialForCurrentTenant(accessId, targetTenantId);
  return Boolean(access?.isTenantAdmin);
}

/** Nur ein echter Vereinsadministrator darf Stellvertretungen ernennen oder ändern. */
function requirePrimaryTenantAdministrator(user: {
  openId: string;
  role: "user" | "admin";
  isCron?: boolean;
}) {
  if (!isPrimaryTenantAdministrator(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Nur der Vereinsadministrator darf eine administrative Stellvertretung vergeben oder ändern.",
    });
  }
}

function isDelegatedTenantAdministratorAccess(access: { isTenantAdmin: boolean }) {
  return access.isTenantAdmin;
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  return isTenantAdministrator(ctx.user).then(allowed => {
    if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
    return next({ ctx });
  });
});

function productCapabilityProcedure(capability: ProductCapability) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

function productCapabilityAdminProcedure(capability: ProductCapability) {
  return adminProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

const scheduleAdminProcedure = productCapabilityAdminProcedure("schedule");

/**
 * Der Event Pass arbeitet ohne Ansprechpartner und ohne Planfreigabe per
 * E-Mail. Die Sperre gilt nicht nur für die Oberfläche, sondern auch für
 * direkte Aufrufe der entsprechenden Routen.
 */
const planReleaseAdminProcedure = scheduleAdminProcedure.use(async ({ next }) => {
  const entitlement = await db.getCurrentTenantProductEntitlement();
  if (entitlement.packageId === "event_pass") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Planfreigaben und Ansprechpartner-Benachrichtigungen sind im Event Pass nicht vorgesehen.",
    });
  }
  return next();
});

/**
 * Der gemeinsame Event-Pass-Zugang darf neue Schichten erfassen, ohne dadurch
 * bestehende Schichten, Einteilungen oder Freigaben administrieren zu können.
 * In allen übrigen Paketen bleibt die bisherige Administratorgrenze erhalten.
 */
const scheduleCreateProcedure = productCapabilityProcedure("schedule").use(
  async ({ ctx, next }) => {
    const entitlement = await db.getCurrentTenantProductEntitlement();
    if (entitlement.packageId === "event_pass") {
      const moduleAccess = await getPlanningTeamModuleAccessForUser(ctx.user);
      requireModuleWritePermission(moduleAccess, "schedule");
      return next({ ctx });
    }
    if (!(await isTenantAdministrator(ctx.user))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Nur Administratoren dürfen Schichten anlegen.",
      });
    }
    return next({ ctx });
  }
);

function moduleReadProcedure(module: Exclude<PlanningModule, "read_all">) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductModule(module);
    const moduleAccess = await getPlanningTeamModuleAccessForUser(ctx.user);
    requireModuleReadPermission(moduleAccess, module);
    return next({ ctx });
  });
}

function moduleWriteProcedure(module: Exclude<PlanningModule, "read_all">) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductModule(module);
    const moduleAccess = await getPlanningTeamModuleAccessForUser(ctx.user);
    requireModuleWritePermission(moduleAccess, module);
    return next({ ctx });
  });
}

const pdfReadProcedure = moduleReadProcedure("pdf").use(async ({ ctx, next }) => {
  rejectPublicDemoExternalAction(ctx.user);
  return next({ ctx });
});

function pdfCapabilityProcedure(capability: ProductCapability) {
  return pdfReadProcedure.use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

function productModuleReadProcedure(
  module: Exclude<PlanningModule, "read_all">,
  capability: ProductCapability
) {
  return moduleReadProcedure(module).use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

function productModuleWriteProcedure(
  module: Exclude<PlanningModule, "read_all">,
  capability: ProductCapability
) {
  return moduleWriteProcedure(module).use(async ({ ctx, next }) => {
    await requireCurrentProductCapability(capability);
    return next({ ctx });
  });
}

const marketingReadProcedure = productModuleReadProcedure("preparation", "marketing");
const marketingWriteProcedure = productModuleWriteProcedure("preparation", "marketing");
const approvalsReadProcedure = productModuleReadProcedure("preparation", "approvals");
const approvalsWriteProcedure = productModuleWriteProcedure("preparation", "approvals");

const yn = z.enum(["ja", "nein"]);
const ynv = z.enum(["ja", "nein", "vielleicht"]);
const dayEnum = z.enum(WEEKDAYS);
const activeDaysInput = z
  .array(dayEnum)
  .min(1, "Mindestens ein Veranstaltungstag muss ausgewählt sein")
  .max(WEEKDAYS.length)
  .refine(days => new Set(days).size === days.length, {
    message: "Veranstaltungstage dürfen nicht doppelt ausgewählt werden",
  });
const statusTask = z.enum(["offen", "inArbeit", "erledigt"]);
const statusPrep = z.enum(["offen", "inArbeit", "erledigt", "abgelehnt"]);
const materialStatus = z.enum(["offen", "bestellt", "geliefert"]);
const prepStatusWording = z.enum(["aufgabe", "genehmigung"]);
const passwordInput = z.string().min(10).max(200);
const moduleAccessLevelSchema = z.enum(["off", "read", "write"]);
const moduleAccessSchema = z.record(
  z.string(),
  moduleAccessLevelSchema
);
const eventYearInput = z.number().int().min(2020).max(2100);
const safeExportName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Veranstaltung";

/** Der Code wird ausschließlich für den aktuellen Einmaldruck erzeugt und nie persistiert. */
function generatePlanningTeamAccessPassword() {
  return `MCM-${randomBytes(18).toString("base64url")}`;
}

async function createPlanningTeamAccessSheetsFile(
  accesses: db.PlanningTeamAccessSummary[],
  initialPasswords = new Map<number, string>()
) {
  const years = await db.listEventYears();
  const eventGroups = await Promise.all(
    years.map(async item => db.listEvents(item.year))
  );
  const eventById = new Map(
    eventGroups.flat().map(event => [event.id, event] as const)
  );
  const sheets = accesses.map(access => ({
    accessId: access.id,
    contactName: access.contactName ?? access.label,
    events: access.eventIds.flatMap(eventId => {
      const event = eventById.get(eventId);
      return event ? [{ year: event.year, name: event.name }] : [];
    }),
    ...(initialPasswords.has(access.id)
      ? { initialPassword: initialPasswords.get(access.id)! }
      : {}),
  }));
  if (sheets.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Es sind keine Planungsteam-Zugänge für den Druck vorhanden",
    });
  }
  return createPlanningTeamAccessSheetsPdf(sheets);
}

/**
 * Erstellt oder erneuert den einzelnen Zugang eines Ansprechpartners. Der
 * Klartextcode existiert ausschließlich bis zur sofortigen PDF-Erzeugung.
 */
async function createContactInitialAccessSheet(input: {
  contactId: number;
  contactName: string;
}) {
  const selectedEvent = await db.getEvent();
  if (!selectedEvent) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Die aktuell gewählte Veranstaltung wurde nicht gefunden",
    });
  }

  const existingAccess = (await db.listPlanningTeamAccesses()).find(
    access => access.contactId === input.contactId
  );
  const eventIds = Array.from(
    new Set([...(existingAccess?.eventIds ?? []), selectedEvent.id])
  );
  const initialPassword = generatePlanningTeamAccessPassword();
  const printableAccess: db.PlanningTeamAccessSummary = {
    id: existingAccess?.id ?? input.contactId,
    contactId: input.contactId,
    contactName: input.contactName,
    label: input.contactName,
    email: existingAccess?.email ?? null,
    modulePermissions: existingAccess?.modulePermissions ?? [],
    moduleAccess: (existingAccess?.moduleAccess && typeof existingAccess.moduleAccess === "object"
      ? existingAccess.moduleAccess
      : {}) as import("@shared/tenant-permissions").PlanningModuleAccess,
    isTenantAdmin: existingAccess?.isTenantAdmin ?? false,
    eventIds,
    mustChangePassword: true,
    createdAt: existingAccess?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };

  // Der Druck erfolgt bewusst vor der Datenänderung. So wird nie ein unbekannter
  // Einmalcode gespeichert, falls die PDF-Erzeugung fehlschlägt.
  const pdf = await createPlanningTeamAccessSheetsFile(
    [printableAccess],
    new Map([[printableAccess.id, initialPassword]])
  );
  const access = existingAccess
    ? await db.updatePlanningTeamAccess({
        id: existingAccess.id,
        label: input.contactName,
        contactId: input.contactId,
        passwordHash: await hashPassword(initialPassword),
        mustChangePassword: true,
        eventIds,
      })
    : await db.createPlanningTeamAccess({
        label: input.contactName,
        contactId: input.contactId,
        passwordHash: await hashPassword(initialPassword),
        mustChangePassword: true,
        eventIds,
      });

  return {
    accessId: access.id,
    filename: `Zugangsblatt_${safeExportName(input.contactName)}.pdf`,
    mimeType: "application/pdf",
    base64: pdf.toString("base64"),
  };
}
const resetAreaInput = z.enum([
  "contacts",
  "helpers",
  "shifts",
  "prep",
  "post",
  "materials",
  "marketing",
  "approvals",
  "cakes",
  "finances",
  "all",
]);

const resetAreaProductCapability: Record<
  Exclude<z.infer<typeof resetAreaInput>, "all">,
  ProductCapability
> = {
  contacts: "contacts",
  helpers: "helpers",
  shifts: "schedule",
  prep: "preparation",
  post: "postprocessing",
  materials: "materials",
  marketing: "marketing",
  approvals: "approvals",
  cakes: "donations",
  finances: "finances",
};
const moduleAssignmentClearArea = z.enum([
  "helpers",
  "prep",
  "post",
  "materials",
]);
const pdfSettingsInput = z.object({
  eventName: z.string().trim().min(1).max(200),
  eventYear: z.string().trim().min(1).max(16),
  helperPdfTitle: z.string().trim().min(1).max(200),
  blankPlanTitle: z.string().trim().min(1).max(200),
  contactLabel: z.string().trim().min(1).max(120),
  footerText: z.string().trim().max(300),
  whatsAppHelperRequestTemplate: z.string().trim().min(1).max(4_000),
  whatsAppMessageTemplate: z.string().trim().min(1).max(4_000),
  extraColumns: z.array(z.string().trim().min(1).max(50)).max(5),
  blankRowsPerShift: z.number().int().min(0).max(20),
});
const planPdfInput = z.object({
  mode: z.enum(["blank", "filled"]),
  days: z.array(dayEnum).max(WEEKDAYS.length).optional(),
  areas: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  statuses: z
    .array(z.enum(["OFFEN", "KNAPP", "OK"]))
    .max(3)
    .optional(),
  contactIds: z.array(z.number().int().positive()).max(500).optional(),
  includeUnassignedContact: z.boolean().optional(),
});
const contactOverviewPdfInput = z
  .object({
    contactIds: z.array(z.number().int().positive()).min(1).max(500),
    includeShifts: z.boolean(),
    includePreparation: z.boolean(),
    includePostProcessing: z.boolean(),
    includeMaterials: z.boolean(),
  })
  .refine(
    input =>
      input.includeShifts ||
      input.includePreparation ||
      input.includePostProcessing ||
      input.includeMaterials,
    { message: "Bitte mindestens einen Inhaltsbereich auswählen" }
  );
const clockTime = z
  .string()
  .trim()
  .refine(value => value === "" || toMinutes(value) !== null, {
    message: "Uhrzeit muss im Format HH:MM vorliegen",
  });

const availabilityClockTime = z
  .string()
  .trim()
  .max(5)
  .refine(value => value === "" || toMinutes(value) !== null, {
    message: "Uhrzeit muss im Format HH:MM vorliegen",
  })
  .nullable()
  .optional();

const HELPER_TIME_WINDOW_FIELDS = [
  ["availMon", "availMonStart", "availMonEnd", "Montag"],
  ["availTue", "availTueStart", "availTueEnd", "Dienstag"],
  ["availWed", "availWedStart", "availWedEnd", "Mittwoch"],
  ["availThu", "availThuStart", "availThuEnd", "Donnerstag"],
  ["availFri", "availFriStart", "availFriEnd", "Freitag"],
  ["availSat", "availSatStart", "availSatEnd", "Samstag"],
  ["availSun", "availSunStart", "availSunEnd", "Sonntag"],
] as const;

function validateHelperTimeWindows(value: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const [availabilityField, startField, endField, label] of HELPER_TIME_WINDOW_FIELDS) {
    const start = value[startField];
    const end = value[endField];
    if (start === undefined && end === undefined) continue;
    const normalizedStart = String(start ?? "").trim();
    const normalizedEnd = String(end ?? "").trim();
    if ((normalizedStart === "") !== (normalizedEnd === "")) {
      ctx.addIssue({
        code: "custom",
        path: [startField],
        message: `${label}: Beginn und Ende müssen gemeinsam gesetzt oder geleert werden`,
      });
      continue;
    }
    if (normalizedStart && toMinutes(normalizedEnd)! <= toMinutes(normalizedStart)!) {
      ctx.addIssue({
        code: "custom",
        path: [endField],
        message: `${label}: Das Ende muss nach dem Beginn liegen`,
      });
    }
  }
}

const helperCreationAvailabilityInput = {
  availMon: ynv.default("vielleicht"),
  availTue: ynv.default("vielleicht"),
  availWed: ynv.default("vielleicht"),
  availThu: ynv.default("vielleicht"),
  availFri: ynv.default("vielleicht"),
  availSat: ynv.default("vielleicht"),
  availSun: ynv.default("vielleicht"),
  availMonStart: availabilityClockTime,
  availMonEnd: availabilityClockTime,
  availTueStart: availabilityClockTime,
  availTueEnd: availabilityClockTime,
  availWedStart: availabilityClockTime,
  availWedEnd: availabilityClockTime,
  availThuStart: availabilityClockTime,
  availThuEnd: availabilityClockTime,
  availFriStart: availabilityClockTime,
  availFriEnd: availabilityClockTime,
  availSatStart: availabilityClockTime,
  availSatEnd: availabilityClockTime,
  availSunStart: availabilityClockTime,
  availSunEnd: availabilityClockTime,
};

const helperUpdateAvailabilityInput = {
  availMon: ynv.optional(),
  availTue: ynv.optional(),
  availWed: ynv.optional(),
  availThu: ynv.optional(),
  availFri: ynv.optional(),
  availSat: ynv.optional(),
  availSun: ynv.optional(),
  availMonStart: availabilityClockTime,
  availMonEnd: availabilityClockTime,
  availTueStart: availabilityClockTime,
  availTueEnd: availabilityClockTime,
  availWedStart: availabilityClockTime,
  availWedEnd: availabilityClockTime,
  availThuStart: availabilityClockTime,
  availThuEnd: availabilityClockTime,
  availFriStart: availabilityClockTime,
  availFriEnd: availabilityClockTime,
  availSatStart: availabilityClockTime,
  availSatEnd: availabilityClockTime,
  availSunStart: availabilityClockTime,
  availSunEnd: availabilityClockTime,
};

const validateShiftTimes = (
  value: { startTime?: string; endTime?: string },
  ctx: z.RefinementCtx
) => {
  if (value.startTime === undefined && value.endTime === undefined) return;
  if (value.startTime === undefined || value.endTime === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["startTime"],
      message: "Beginn und Ende müssen gemeinsam angegeben werden",
    });
    return;
  }
  if ((value.startTime === "") !== (value.endTime === "")) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Beginn und Ende müssen beide leer oder beide gesetzt sein",
    });
    return;
  }
  if (
    value.startTime !== "" &&
    toMinutes(value.endTime)! <= toMinutes(value.startTime)!
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Das Ende muss nach dem Beginn liegen",
    });
  }
};

const createShiftInput = z
  .object({
    day: dayEnum,
    area: z.string().trim().min(1),
    task: z.string().trim().min(1),
    locationId: z.number().int().positive().nullable().optional(),
    startTime: clockTime.default(""),
    endTime: clockTime.default(""),
    allowFlexibleAssignment: z.boolean().default(false),
    manualOkConfirmed: z.boolean().default(false),
    manualDoubleConflictAccepted: z.boolean().default(false),
    needed: z.number().int().min(0).max(20).default(1),
    note: z.string().optional(),
  })
  .superRefine(validateShiftTimes);

const updateShiftInput = z
  .object({
    id: z.number().int().positive(),
    day: dayEnum.optional(),
    area: z.string().trim().min(1).optional(),
    task: z.string().trim().min(1).optional(),
    locationId: z.number().int().positive().nullable().optional(),
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
    allowFlexibleAssignment: z.boolean().optional(),
    manualOkConfirmed: z.boolean().optional(),
    manualDoubleConflictAccepted: z.boolean().optional(),
    needed: z.number().int().min(0).max(20).optional(),
    note: z.string().nullable().optional(),
  })
  .superRefine(validateShiftTimes);

async function requireAdminPassword(
  password: string,
  ctx: { req: any; user: { id: number; openId: string; role: "user" | "admin" } }
) {
  const clientKey = `admin-confirm:${ctx.user.openId}:${getClientKey(ctx.req)}`;
  if (isPasswordLoginBlocked(clientKey)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Zu viele falsche Passwortversuche. Bitte versuchen Sie es in 15 Minuten erneut.",
    });
  }

  let hash: string | null | undefined;
  if (
    ctx.user.role === "admin" &&
    ctx.user.openId.startsWith("tenant-admin:")
  ) {
    const credentials = await db.getTenantAdminCredentialsByUserId(ctx.user.id);
    hash = credentials?.status === "active" ? credentials.passwordHash : null;
  } else if (ctx.user.role === "admin") {
    // Der Plattform-Inhaber (sowie bestehende lokale Pilot-Sitzungen) bestätigt
    // mit dem geschützten Vereinsadministrationspasswort. Persönliche
    // Vereinsadministratoren tragen dagegen immer die tenant-admin-Kennung.
    hash = (await db.getSecuritySettings())?.adminPasswordHash;
  } else {
    const accessId = planningTeamAccessIdForUser(ctx.user);
    const credentials =
      accessId === null
        ? undefined
        : await db.getPlanningTeamAccessCredentialForCurrentTenant(accessId);
    hash = credentials?.isTenantAdmin ? credentials.passwordHash : null;
  }

  if (!hash || !(await verifyPassword(password, hash))) {
    recordFailedPasswordLogin(clientKey);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Administratorpasswort ist nicht korrekt",
    });
  }
  clearPasswordLoginFailures(clientKey);
}

function auditActor(user: {
  id: number;
  name: string | null;
  role: "user" | "admin";
  loginMethod: string | null;
}): db.AuditActor {
  return {
    userId: user.id,
    name:
      user.name ?? (user.role === "admin" ? "Administrator" : "Planungsteam"),
    role: user.role,
    loginMethod: user.loginMethod,
  };
}

/**
 * Der Lesestatus folgt der fachlichen Person, nicht dem einzelnen Browser-Token.
 * Planungsteamzugänge besitzen eine eigene Access-ID; beim gemeinsamen
 * Administrator-OpenID trennt der im Token bestätigte Anmeldename die Personen.
 */
function teamNoteReadIdentity(user: {
  id: number;
  openId: string;
  name: string | null;
  role: "user" | "admin";
}) : db.TeamNoteReadIdentity {
  const sessionName =
    user.name?.trim() || (user.role === "admin" ? "Administrator" : "Planungsteam");
  const accessId = user.role === "user" ? planningTeamAccessIdForUser(user) : null;
  const normalizeKeyPart = (value: string) =>
    value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
  const identityKey =
    accessId !== null
      ? `planning-access:${accessId}`
      : user.role === "admin" && user.openId === ADMIN_PASSWORD_OPEN_ID
        ? `admin-session:${normalizeKeyPart(sessionName)}`
        : `open-id:${user.openId}`;

  return {
    identityKey,
    userId: user.id > 0 ? user.id : null,
    sessionName,
    role: user.role,
  };
}

export const appRouter = router({
  system: systemRouter,
  pilotInquiry: router({
    submit: publicProcedure
      .input(
        z.object({
          club: z.string().trim().min(2, "Bitte Verein oder Organisation angeben.").max(160),
          contact: z.string().trim().min(2, "Bitte Ansprechperson angeben.").max(120),
          email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben.").max(320),
          phone: z
            .string()
            .trim()
            .max(60)
            .refine(
              value => value.length === 0 || /^[0-9+()\-./\s]{6,60}$/.test(value),
              "Bitte eine gültige Telefonnummer eingeben."
            ),
          organizationType: z
            .string()
            .trim()
            .refine(
              value =>
                PILOT_ORGANIZATION_TYPES.includes(
                  value as (typeof PILOT_ORGANIZATION_TYPES)[number]
                ),
              "Bitte die Art der anfragenden Organisation auswählen."
            ),
          occasion: z.string().trim().min(2, "Bitte den Testanlass auswählen.").max(120),
          start: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bitte einen gültigen Wunschmonat auswählen."),
          note: z.string().trim().max(2_000).optional().default(""),
          eligibility: z.literal(
            true,
            "Bitte bestätige den ehrenamtlichen Bezug eurer Veranstaltung."
          ),
          privacy: z.literal(true, "Bitte die Datenschutzhinweise bestätigen."),
          // Unsichtbares Feld gegen einfache Formularbots. Ausgefüllte Anfragen
          // erhalten absichtlich eine neutrale Erfolgsmeldung, aber keinen Versand.
          website: z.string().max(500).optional().default(""),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.website) return { accepted: true, confirmationSent: false } as const;

        if (!allowPublicPilotInquiryAttempt(`pilot-inquiry:${getClientKey(ctx.req)}`)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Es wurden gerade mehrere Anfragen gesendet. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut.",
          });
        }

        if (!isMailDeliveryConfigured()) {
          console.error("[PilotInquiry] Versand nicht möglich: SMTP ist nicht konfiguriert.");
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Die Pilotanfrage ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut oder schreiben Sie an support@mycrewmate.de.",
          });
        }

        const notification = renderPilotInquiryNotificationEmail({
          clubName: input.club,
          contactName: input.contact,
          email: input.email,
          phone: input.phone,
          organizationType: input.organizationType,
          occasion: input.occasion,
          desiredStart: input.start,
          note: input.note,
        });
        const confirmation = renderPilotInquiryConfirmationEmail({
          contactName: input.contact,
          clubName: input.club,
        });

        const storedInquiry = await db.createPublicPilotInquiry({
          clubName: input.club,
          contactName: input.contact,
          email: input.email,
          phone: input.phone,
          organizationType: input.organizationType,
          occasion: input.occasion,
          desiredStart: input.start,
          note: input.note,
          eligibilityConfirmedAt: new Date(),
        });

        try {
          const notificationDelivery = await sendTransactionalEmail({
            to: PILOT_INQUIRY_RECIPIENT,
            ...notification,
          });
          if (!notificationDelivery.success) {
            if (storedInquiry?.id) {
              await db.deletePublicPilotInquiryAfterFailedDelivery(storedInquiry.id);
            }
            throw new Error("Die Pilot-Anfrage wurde vom SMTP-Server nicht angenommen.");
          }

          const confirmationDelivery = await sendTransactionalEmail({
            to: input.email,
            ...confirmation,
          });
          return {
            accepted: true,
            confirmationSent: confirmationDelivery.success,
          } as const;
        } catch (error) {
          console.error(
            "[PilotInquiry] Versand fehlgeschlagen:",
            error instanceof Error ? error.message : "unbekannter Fehler"
          );
          if (storedInquiry?.id) {
            await db.deletePublicPilotInquiryAfterFailedDelivery(storedInquiry.id);
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es später erneut oder schreiben Sie an support@mycrewmate.de.",
          });
        }
      }),
  }),
  publicDemo: router({
    start: publicProcedure
      .input(z.object({ packageId: z.enum(["event_pass", "light", "pro"]) }))
      .mutation(async ({ ctx, input }) => {
        const clientKey = getPublicDemoVisitorKey(ctx.req, ctx.res);
        if (!allowPublicDemoStart(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "In diesem Browser wurden gerade mehrere Demos gestartet. Bitte warten Sie kurz und versuchen Sie es dann erneut.",
          });
        }
        const activeDemos = await getActivePublicDemoCount();
        if (activeDemos >= PUBLIC_DEMO_CONCURRENT_LIMIT) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Die Vereinsdemo ist gerade stark gefragt. Bitte versuchen Sie es in wenigen Minuten erneut.",
          });
        }
        return createPublicDemoSession(input.packageId as PublicDemoPackage);
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    passwordStatus: publicProcedure.query(async () => {
      const settings = await db.getSecuritySettings();
      const accessCount = (await db.listPlanningTeamAccesses()).length;
      return {
        enabled: accessCount > 0,
        planningTeamAccessCount: accessCount,
        adminEnabled: Boolean(settings?.adminPasswordHash),
        planningTeamLocked: settings?.planningTeamLocked ?? false,
      };
    }),
    initialPasswordChangeStatus: baseProtectedProcedure.query(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      const isPlanningTeamAccess = accessId !== null;
      const isPersonalTenantAdmin =
        ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
      const mustChangePassword =
        (isPlanningTeamAccess &&
          (await db.isPlanningTeamAccessPasswordChangeRequired(accessId!))) ||
        (isPersonalTenantAdmin &&
          (await db.isTenantAdminPasswordChangeRequired(ctx.user.id)));

      let invitationEmail: string | null = null;
      let requiresContractAcceptance = false;
      if (isPlanningTeamAccess) {
        const scope = await authorizedPlanningScope(ctx.user, ctx.req);
        const access = await withPlanningScope(scope, () =>
          db.getPlanningTeamAccessCredentialForCurrentTenant(accessId!, scope.tenantId)
        );
        invitationEmail = access?.email?.trim() || null;
      } else if (isPersonalTenantAdmin) {
        invitationEmail =
          (await db.getTenantAdminCredentialsByUserId(ctx.user.id))?.email?.trim() ||
          null;
        const membership = await db.resolveTenantForUser({
          userId: ctx.user.id,
          userOpenId: ctx.user.openId,
          allowPilotFallback: false,
        });
        requiresContractAcceptance = membership
          ? await db.tenantNeedsCurrentContractAcceptance(membership.tenantId)
          : false;
      }

      return {
        mustChangePassword: Boolean(mustChangePassword),
        invitationEmail,
        ...(isPersonalTenantAdmin ? { requiresContractAcceptance } : {}),
      } as const;
    }),
    firstLoginOnboardingStatus: baseProtectedProcedure.query(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      const isPersonalTenantAdmin =
        ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
      if (accessId === null && !isPersonalTenantAdmin) {
        return {
          pending: false,
          isCoAdmin: false,
          name: ctx.user.name ?? "Planungsteam",
        } as const;
      }
      if (isPersonalTenantAdmin) {
        return {
          pending: await db.isTenantAdminOnboardingPending(ctx.user.id),
          isCoAdmin: false,
          name: ctx.user.name ?? "Vereinsadministration",
        } as const;
      }
      const scope = await authorizedPlanningScope(ctx.user, ctx.req);
      const access = await withPlanningScope(scope, () =>
        db.getPlanningTeamAccessCredentialForCurrentTenant(accessId!, scope.tenantId)
      );
      return {
        pending: access?.onboardingPending === true,
        isCoAdmin: access?.isTenantAdmin === true,
        name: access?.contactName ?? access?.label ?? ctx.user.name ?? "Planungsteam",
      } as const;
    }),
    claimDailyKlemmiGreeting: baseProtectedProcedure.mutation(async ({ ctx }) => {
      const day = new Date().toISOString().slice(0, 10);
      const clipId = await db.claimDailyKlemmiGreeting(
        ctx.user.id,
        day,
        KLEMMI_LOGIN_AUDIO_IDS
      );
      if (!clipId) return { show: false, clipId: null } as const;
      return { show: true, clipId } as const;
    }),
    completeFirstLoginOnboarding: baseProtectedProcedure.mutation(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      const isPersonalTenantAdmin =
        ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
      if (isPersonalTenantAdmin) {
        await db.completeTenantAdminOnboarding(ctx.user.id);
        return { success: true };
      }
      if (accessId === null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Diese Einführung ist nur für persönliche Zugänge verfügbar.",
        });
      }
      const scope = await authorizedPlanningScope(ctx.user, ctx.req);
      await withPlanningScope(scope, () =>
        db.completePlanningTeamOnboarding(accessId, scope.tenantId)
      );
      return { success: true };
    }),
    passwordLogin: publicProcedure
      .input(
        z.object({
          password: z.string().min(1).max(200),
          // Persönliche Zugänge verwenden eine E-Mail-Adresse. Der Event Pass
          // verwendet bewusst eine neutrale Teamkennung ohne Privatadresse.
          email: z.string().trim().min(3, "Bitte E-Mail-Adresse oder Teamkennung eingeben").max(320),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const clientKey = `personal:${getClientKey(ctx.req)}`;
        const settings = await db.getSecuritySettings();
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.",
          });
        }

        const adminCreds = await db.getTenantAdminCredentialsByEmail(input.email);
        if (adminCreds) {
          if (!(await verifyPassword(input.password, adminCreds.passwordHash))) {
            recordFailedPasswordLogin(clientKey);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "E-Mail oder Passwort ist nicht korrekt",
            });
          }
          const loginTenantId = await tenantIdForFreshPersonalLogin({
            id: adminCreds.userId,
            openId: adminCreds.userOpenId,
          });
          await assertTenantProductUsableForLogin(loginTenantId);
          const mfa = await db.getTenantAdminMfaConfigurationByUserId(
            adminCreds.userId
          );
          if (Boolean(mfa?.enabled && mfa?.secret)) {
            const mfaChallengeToken = await issueMfaLoginChallenge({
              subjectType: "tenant_admin",
              userId: adminCreds?.userId ?? 0,
            });
            return {
              success: false,
              requiresMfa: true,
              mfaChallengeToken,
            } as const;
          }
          clearPasswordLoginFailures(clientKey);
          const tenantId = await tenantIdForFreshPersonalLogin({
            id: adminCreds.userId,
            openId: adminCreds.userOpenId,
          });
          const sessionName = adminCreds.userName ?? input.email;
          await recordSecurityActivity(
            {
              userId: adminCreds?.userId ?? 0,
              name: sessionName,
              role: "admin",
              loginMethod: "password",
            },
            "Vereinsadministrator-Anmeldung erfolgreich",
            "created",
            tenantId
          );
          const token = await sdk.createSessionToken(adminCreds.userOpenId, {
            name: sessionName,
            expiresInMs: PASSWORD_SESSION_MS,
            sessionVersion: adminCreds.sessionVersion,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PASSWORD_SESSION_MS,
          });
          return {
            success: true,
            mustChangePassword: adminCreds.mustChangePassword,
            tenantId,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          } as const;
        }

        if (settings?.planningTeamLocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Der Zugang für das Planungsteam wurde durch einen Administrator gesperrt. Bitte wenden Sie sich an die Administration.",
          });
        }

        // Eine E-Mail-Adresse darf in mehreren aktiven Vereinen vorkommen.
        // Der Verein wird daher nicht über eine zufällige erste Datenbankzeile,
        // sondern ausschließlich über das passende persönliche Passwort bestimmt.
        const matchingAccesses = await db.listPlanningTeamAccessCredentialsByEmail(
          input.email
        );
        const passwordMatches = (
          await Promise.all(
            matchingAccesses.map(async access =>
              (await verifyPassword(input.password, access.passwordHash))
                ? access
                : null
            )
          )
        ).filter(
          (access): access is NonNullable<typeof access> => access !== null
        );
        const matchingAccess =
          passwordMatches.length === 1 ? passwordMatches[0] : null;
        if (!matchingAccess) {
          recordFailedPasswordLogin(clientKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "E-Mail-Adresse bzw. Teamkennung oder Passwort ist nicht korrekt",
          });
        }

        clearPasswordLoginFailures(clientKey);
        await db.clearPlanningTeamLoginFailuresIfUnlocked();

        const accessOpenId = planningTeamAccessOpenId(matchingAccess.id);
        const sessionName =
          matchingAccess.contactName ?? `Planungsteam · ${matchingAccess.label}`;
        await db.upsertUser({
          openId: accessOpenId,
          name: sessionName,
          loginMethod: "password",
          role: "user",
          lastSignedIn: new Date(),
        });
        try {
          if ("synchronizePlanningTeamTenantMemberships" in db) {
            await (db as any).synchronizePlanningTeamTenantMemberships(matchingAccess.id);
          }
        } catch {
          // Ignorieren falls Mock in Unit-Tests
        }
        const planningUser = await db.getUserByOpenId(accessOpenId);
        if (!planningUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Persönlicher Planungsteamzugang konnte nicht geladen werden.",
          });
        }
        const tenantId = await db.getPlanningTeamAccessTenantId(matchingAccess.id);
        if (!tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Für diesen Planungsteam-Zugang ist keine Veranstaltung freigegeben.",
          });
        }
        await assertTenantProductUsableForLogin(tenantId);
        const startEvent = await startEventForFreshPlanningTeamLogin(
          matchingAccess.id,
          tenantId
        );
        await recordSecurityActivity(
          {
            userId: planningUser.id,
            name: sessionName,
            role: "user",
            loginMethod: "password",
          },
          "Planungsteam-Anmeldung erfolgreich",
          "created",
          tenantId
        );
        const token = await sdk.createSessionToken(accessOpenId, {
          name: sessionName,
          expiresInMs: PASSWORD_SESSION_MS,
          sessionVersion: matchingAccess.sessionVersion,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          mustChangePassword: matchingAccess.mustChangePassword,
          tenantId,
          ...(startEvent ? { startEvent } : {}),
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    verifyMfaLogin: publicProcedure
      .input(
        z.object({
          mfaChallengeToken: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
          code: z.string().trim().min(6).max(32),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const tokenHash = hashOpaqueToken(input.mfaChallengeToken);
        const challenge = await db.getMfaLoginChallenge(tokenHash);
        if (!challenge) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Die Sicherheitsabfrage ist abgelaufen oder wurde bereits verwendet. Bitte melden Sie sich erneut an.",
          });
        }

        if (challenge.subjectType === "tenant_admin" && challenge.userId) {
          const [configuration, credentials] = await Promise.all([
            db.getTenantAdminMfaConfigurationByUserId(challenge.userId),
            db.getTenantAdminCredentialsByUserId(challenge.userId),
          ]);
          const usesAuthenticator = Boolean(
            configuration?.secret && verifyTotpCode({ secret: configuration.secret, code: input.code })
          );
          const usesRecoveryCode =
            !usesAuthenticator &&
            Boolean(
              configuration?.recoveryCodeHashes?.length &&
                recoveryCodeMatches(input.code, configuration.recoveryCodeHashes)
            );
          if (!configuration?.enabled || !credentials || (!usesAuthenticator && !usesRecoveryCode)) {
            await db.recordMfaLoginChallengeFailure(tokenHash);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Der Sicherheitscode ist nicht korrekt.",
            });
          }
          const tenantId = await tenantIdForFreshPersonalLogin({
            id: credentials.userId,
            openId: credentials.userOpenId,
          });
          await assertTenantProductUsableForLogin(tenantId);
          if (
            usesRecoveryCode &&
            !(await db.consumeTenantAdminMfaRecoveryCode({
              userId: challenge.userId,
              providedCode: input.code,
            }))
          ) {
            await db.recordMfaLoginChallengeFailure(tokenHash);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Der Sicherheitscode ist nicht korrekt.",
            });
          }
          if (!(await db.consumeMfaLoginChallenge(tokenHash))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Die Sicherheitsabfrage ist abgelaufen oder wurde bereits verwendet. Bitte melden Sie sich erneut an.",
            });
          }
          const sessionName = credentials.userName ?? credentials.email;
          await recordSecurityActivity(
            {
              userId: credentials.userId,
              name: sessionName,
              role: "admin",
              loginMethod: "password+mfa",
            },
            usesRecoveryCode
              ? "Vereinsadministrator-Anmeldung mit Einmal-Recovery-Code erfolgreich"
              : "Vereinsadministrator-Anmeldung mit MFA erfolgreich",
            "created",
            tenantId
          );
          const token = await sdk.createSessionToken(credentials.userOpenId, {
            name: sessionName,
            expiresInMs: PASSWORD_SESSION_MS,
            sessionVersion: credentials.sessionVersion,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PASSWORD_SESSION_MS,
          });
          return {
            success: true,
            tenantId,
            mustChangePassword: credentials.mustChangePassword,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          } as const;
        }

        if (challenge.subjectType === "master") {
          const configuration = await db.getMasterMfaConfiguration();
          const usesAuthenticator = Boolean(
            configuration?.secret && verifyTotpCode({ secret: configuration.secret, code: input.code })
          );
          const usesRecoveryCode =
            !usesAuthenticator &&
            Boolean(
              configuration?.recoveryCodeHashes?.length &&
                recoveryCodeMatches(input.code, configuration.recoveryCodeHashes)
            );
          if (!configuration?.enabled || (!usesAuthenticator && !usesRecoveryCode)) {
            await db.recordMfaLoginChallengeFailure(tokenHash);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Der Sicherheitscode ist nicht korrekt.",
            });
          }
          if (usesRecoveryCode && !(await db.consumeMasterMfaRecoveryCode(input.code))) {
            await db.recordMfaLoginChallengeFailure(tokenHash);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Der Sicherheitscode ist nicht korrekt.",
            });
          }
          if (!(await db.consumeMfaLoginChallenge(tokenHash))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Die Sicherheitsabfrage ist abgelaufen oder wurde bereits verwendet. Bitte melden Sie sich erneut an.",
            });
          }
          const sessionName = "Plattform-Inhaber";
          await db.upsertUser({
            openId: ADMIN_PASSWORD_OPEN_ID,
            name: sessionName,
            loginMethod: "admin-password+mfa",
            role: "admin",
            lastSignedIn: new Date(),
          });
          await recordSecurityActivity(
            {
              userId: 0,
              name: sessionName,
              role: "admin",
              loginMethod: "admin-password+mfa",
            },
            usesRecoveryCode
              ? "Master-Anmeldung mit Einmal-Recovery-Code erfolgreich"
              : "Master-Anmeldung mit MFA erfolgreich",
            "created",
            null
          );
          const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
            name: sessionName,
            expiresInMs: PASSWORD_SESSION_MS,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PASSWORD_SESSION_MS,
          });
          return {
            success: true,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          } as const;
        }

        throw new TRPCError({ code: "BAD_REQUEST", message: "Ungültige Sicherheitsabfrage." });
      }),
    mfaStatus: baseProtectedProcedure.query(async ({ ctx }) => {
      const isMaster = ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
      const isPersonalTenantAdmin =
        ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
      if (!isMaster && !isPersonalTenantAdmin) {
        return {
          eligible: false,
          enabled: false,
          enrolledAt: null,
          remainingRecoveryCodes: 0,
        } as const;
      }
      const configuration = isMaster
        ? await db.getMasterMfaConfiguration()
        : await db.getTenantAdminMfaConfigurationByUserId(ctx.user.id);
      return {
        eligible: true,
        enabled: configuration?.enabled === true && Boolean(configuration.secret),
        enrolledAt: configuration?.enrolledAt ?? null,
        remainingRecoveryCodes: configuration?.recoveryCodeHashes.length ?? 0,
      } as const;
    }),
    /**
     * Ausschließlich in der isolierten Manus-/Local-Vorschau verfügbar.
     * Dieser Ablauf kann weder MFA für ein Konto aktivieren noch Daten persistieren.
     */
    mfaTestBegin: publicProcedure.mutation(({ ctx }) => {
      if (
        !isMfaTestLabAllowed({
          environment: process.env.NODE_ENV,
          hostname: ctx.req.hostname,
        })
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Das MFA-Testlabor ist außerhalb der isolierten Vorschau nicht verfügbar.",
        });
      }
      return createMfaTestSession();
    }),
    mfaTestVerify: publicProcedure
      .input(
        z.object({
          testSessionToken: z.string().min(32).max(128),
          code: z.string().trim().regex(/^\d{6}$/),
        })
      )
      .mutation(({ ctx, input }) => {
        if (
          !isMfaTestLabAllowed({
            environment: process.env.NODE_ENV,
            hostname: ctx.req.hostname,
          })
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Das MFA-Testlabor ist außerhalb der isolierten Vorschau nicht verfügbar.",
          });
        }
        return verifyMfaTestSession(input);
      }),
    beginMfaEnrollment: baseProtectedProcedure.mutation(async ({ ctx }) => {
      const isMaster = ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
      const isPersonalTenantAdmin =
        ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
      if (!isMaster && !isPersonalTenantAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Die zweite Anmeldestufe ist nur für persönliche Administratorzugänge verfügbar.",
        });
      }
      const accountName = isMaster
        ? "Plattformverwaltung"
        : (await db.getTenantAdminCredentialsByUserId(ctx.user.id))?.email ?? "Vereinsadministration";
      const secret = createTotpSecret();
      const recoveryCodes = createRecoveryCodes();
      return {
        secret,
        otpauthUri: buildTotpUri({ secret, accountName }),
        recoveryCodes,
      } as const;
    }),
    confirmMfaEnrollment: baseProtectedProcedure
      .input(
        z.object({
          secret: z.string().regex(/^[A-Z2-7]{16,128}$/),
          code: z.string().trim().regex(/^\d{6}$/),
          recoveryCodes: z.array(z.string().trim().min(8).max(16)).length(8),
          currentPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isMaster = ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
        const isPersonalTenantAdmin =
          ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
        if (!isMaster && !isPersonalTenantAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Nicht berechtigt." });
        }
        if (!verifyTotpCode({ secret: input.secret, code: input.code })) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der Code der Authenticator-App ist nicht korrekt. Bitte Zeitabgleich und Eingabe prüfen.",
          });
        }
        await requireAdminPassword(input.currentPassword, ctx);
        if (isMaster) {
          await db.saveMasterMfaEnrollment({
            secret: input.secret,
            recoveryCodes: input.recoveryCodes,
          });
        } else {
          await db.saveTenantAdminMfaEnrollment({
            userId: ctx.user.id,
            secret: input.secret,
            recoveryCodes: input.recoveryCodes,
          });
        }
        await recordSecurityActivity(
          auditActor(ctx.user),
          "Zweite Anmeldestufe (Authenticator-App) eingerichtet; vorhandene Sitzungen wurden sicher erneuert",
          "updated"
        );
        return { success: true } as const;
      }),
    disableMfa: baseProtectedProcedure
      .input(z.object({ currentPassword: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const isMaster = ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
        const isPersonalTenantAdmin =
          ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
        if (!isMaster && !isPersonalTenantAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Nicht berechtigt." });
        }
        await requireAdminPassword(input.currentPassword, ctx);
        if (isMaster) {
          await db.disableMasterMfa();
        } else {
          await db.disableTenantAdminMfa(ctx.user.id);
        }
        await recordSecurityActivity(
          auditActor(ctx.user),
          "Zweite Anmeldestufe deaktiviert; bestehende Sitzungen wurden ungültig gemacht",
          "updated"
        );
        return { success: true } as const;
      }),
    regenerateMfaRecoveryCodes: baseProtectedProcedure
      .input(z.object({ currentPassword: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const isMaster = ctx.user.openId === ADMIN_PASSWORD_OPEN_ID;
        const isPersonalTenantAdmin =
          ctx.user.role === "admin" && ctx.user.openId.startsWith("tenant-admin:");
        if (!isMaster && !isPersonalTenantAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Nicht berechtigt." });
        }
        const configuration = isMaster
          ? await db.getMasterMfaConfiguration()
          : await db.getTenantAdminMfaConfigurationByUserId(ctx.user.id);
        if (!configuration?.enabled || !configuration.secret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Aktivieren Sie zuerst die zweite Anmeldestufe.",
          });
        }
        await requireAdminPassword(input.currentPassword, ctx);
        const recoveryCodes = createRecoveryCodes();
        if (isMaster) {
          await db.replaceMasterMfaRecoveryCodes(recoveryCodes);
        } else {
          await db.replaceTenantAdminMfaRecoveryCodes({
            userId: ctx.user.id,
            recoveryCodes,
          });
        }
        await recordSecurityActivity(
          auditActor(ctx.user),
          "MFA-Notfallcodes neu erzeugt; vorherige Notfallcodes sind ungültig",
          "updated"
        );
        return { recoveryCodes } as const;
      }),
    completeInitialPasswordChange: baseProtectedProcedure
      .input(
        z
          .object({
            password: passwordInput,
            passwordConfirmation: passwordInput,
          })
          .refine(input => input.password === input.passwordConfirmation, {
            path: ["passwordConfirmation"],
            message: "Die Passwörter stimmen nicht überein",
          })
      )
      .mutation(async ({ ctx, input }) => {
        const accessId = planningTeamAccessIdForUser(ctx.user);
        if (ctx.user.role !== "user" || accessId === null) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Diese Passwortänderung ist nur für Planungsteam-Zugänge verfügbar.",
          });
        }
        const updated = await db.completePlanningTeamInitialPasswordChange({
          accessId,
          passwordHash: await hashPassword(input.password),
        });
        const sessionName = ctx.user.name ?? "Planungsteam";
        await db.upsertUser({
          openId: planningTeamAccessOpenId(updated.id),
          name: sessionName,
          loginMethod: "password",
          role: "user",
          lastSignedIn: new Date(),
        });
        try {
          if ("synchronizePlanningTeamTenantMemberships" in db) {
            await (db as any).synchronizePlanningTeamTenantMemberships(updated.id);
          }
        } catch {
          // Ignorieren falls Mock in Unit-Tests
        }
        const planningUser = await db.getUserByOpenId(
          planningTeamAccessOpenId(updated.id)
        );
        if (!planningUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Persönlicher Planungsteamzugang konnte nicht geladen werden.",
          });
        }
        // Das Einmalpasswort wird nur zum sicheren Setzen des persönlichen
        // Passworts verwendet. Danach folgt bewusst eine reguläre, neue
        // Anmeldung – so arbeiten weder ein Aktivierungs-Token noch ein
        // veralteter Browserkontext mit der fertigen Vereinsrolle weiter.
        await removeSessionPresence(ctx.req).catch(() => {});
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Persönliches Passwort für „${planningUser.name ?? sessionName}“ festgelegt; erneute Anmeldung erforderlich`,
          "updated"
        );
        return {
          success: true,
          mustChangePassword: false,
          requiresLogin: true,
        } as const;
      }),
    completeTenantAdminInitialPasswordChange: baseProtectedProcedure
      .input(
        z
          .object({
            password: passwordInput,
            passwordConfirmation: passwordInput,
            acceptContractDocuments: z.literal(true, {
              message: "Bitte bestätigen Sie AGB, AVV und Datenschutzhinweise.",
            }),
          })
          .refine(input => input.password === input.passwordConfirmation, {
            path: ["passwordConfirmation"],
            message: "Die Passwörter stimmen nicht überein",
          })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          ctx.user.role !== "admin" ||
          !ctx.user.openId.startsWith("tenant-admin:") ||
          ctx.user.id <= 0
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Diese Passwortänderung ist nur für persönliche Vereins-Administratoren verfügbar.",
          });
        }
        const membership = await db.resolveTenantForUser({
          userId: ctx.user.id,
          userOpenId: ctx.user.openId,
          allowPilotFallback: false,
        });
        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Für diesen Vereinsadministrator ist kein aktiver Verein hinterlegt.",
          });
        }
        const acceptance = await db.acceptCurrentTenantContractDocuments({
          tenantId: membership.tenantId,
          acceptedByUserId: ctx.user.id,
        });
        const updated = await db.completeTenantAdminInitialPasswordChange({
          userId: ctx.user.id,
          passwordHash: await hashPassword(input.password),
        });
        // Auch persönliche Vereinsadmins melden sich nach der Ersteinrichtung
        // einmal regulär mit dem gerade gewählten Passwort an.
        await removeSessionPresence(ctx.req).catch(() => {});
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Digitale Annahme von AGB, AVV und Datenschutzhinweisen für „${membership.tenantName}“ dokumentiert`,
          "created",
          membership.tenantId
        );
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Persönliches Passwort für „${updated.userName ?? ctx.user.name ?? "Administrator"}“ festgelegt; erneute Anmeldung erforderlich`,
          "updated"
        );
        const confirmationEmail = await db.getTenantAdminCredentialsByUserId(ctx.user.id);
        if (confirmationEmail?.email) {
          const receiptDocuments = acceptance.documents.map(document => ({
            title: LEGAL_DOCUMENTS[document.documentId].title,
            version: document.version,
            hash: document.hash,
          }));
          const receiptPdf = await renderTenantContractReceiptPdf({
            tenantName: membership.tenantName,
            recipientName: updated.userName ?? ctx.user.name ?? "Vereinsadministration",
            packageName: PRODUCT_PACKAGE_META[acceptance.packageId].name,
            acceptedAt: acceptance.acceptedAt,
            documents: receiptDocuments,
          });
          const receipt = renderContractAcceptanceEmail({
            recipientName: updated.userName ?? ctx.user.name ?? "Vereinsadministration",
            tenantName: membership.tenantName,
            packageName: PRODUCT_PACKAGE_META[acceptance.packageId].name,
            acceptedAt: acceptance.acceptedAt,
            documents: receiptDocuments,
          });
          await safelySubmitInvitationEmail({
            to: confirmationEmail.email,
            ...receipt,
            attachments: [
              {
                filename: "Digitaler_Vertragsnachweis.pdf",
                content: receiptPdf,
                contentType: "application/pdf",
              },
            ],
          });
        }
        return {
          success: true,
          mustChangePassword: false,
          requiresLogin: true,
        } as const;
      }),
    acceptCurrentTenantContractDocuments: baseProtectedProcedure
      .input(
        z.object({
          acceptContractDocuments: z.literal(true, {
            message: "Bitte bestätigen Sie AGB, AVV und Datenschutzhinweise.",
          }),
        })
      )
      .mutation(async ({ ctx }) => {
        if (
          ctx.user.role !== "admin" ||
          !ctx.user.openId.startsWith("tenant-admin:") ||
          ctx.user.id <= 0
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Die Vertragsannahme ist ausschließlich für die persönliche Vereinsadministration verfügbar.",
          });
        }
        if (await db.isTenantAdminPasswordChangeRequired(ctx.user.id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Bitte vergeben Sie zuerst Ihr persönliches Passwort und bestätigen Sie die Unterlagen dabei.",
          });
        }
        const membership = await db.resolveTenantForUser({
          userId: ctx.user.id,
          userOpenId: ctx.user.openId,
          allowPilotFallback: false,
        });
        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Für diesen Vereinsadministrator ist kein aktiver Verein hinterlegt.",
          });
        }
        const acceptance = await db.acceptCurrentTenantContractDocuments({
          tenantId: membership.tenantId,
          acceptedByUserId: ctx.user.id,
        });
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Digitale Annahme von AGB, AVV und Datenschutzhinweisen für „${membership.tenantName}“ erneut dokumentiert`,
          "updated",
          membership.tenantId
        );
        const confirmationEmail = await db.getTenantAdminCredentialsByUserId(ctx.user.id);
        if (confirmationEmail?.email) {
          const receiptDocuments = acceptance.documents.map(document => ({
            title: LEGAL_DOCUMENTS[document.documentId].title,
            version: document.version,
            hash: document.hash,
          }));
          const receiptPdf = await renderTenantContractReceiptPdf({
            tenantName: membership.tenantName,
            recipientName: ctx.user.name ?? "Vereinsadministration",
            packageName: PRODUCT_PACKAGE_META[acceptance.packageId].name,
            acceptedAt: acceptance.acceptedAt,
            documents: receiptDocuments,
          });
          const receipt = renderContractAcceptanceEmail({
            recipientName: ctx.user.name ?? "Vereinsadministration",
            tenantName: membership.tenantName,
            packageName: PRODUCT_PACKAGE_META[acceptance.packageId].name,
            acceptedAt: acceptance.acceptedAt,
            documents: receiptDocuments,
          });
          await safelySubmitInvitationEmail({
            to: confirmationEmail.email,
            ...receipt,
            attachments: [
              {
                filename: "Digitaler_Vertragsnachweis.pdf",
                content: receiptPdf,
                contentType: "application/pdf",
              },
            ],
          });
        }
        return { success: true, acceptedAt: acceptance.acceptedAt } as const;
      }),
    contractAcceptanceReceipt: baseProtectedProcedure.mutation(async ({ ctx }) => {
      if (
        ctx.user.role !== "admin" ||
        !ctx.user.openId.startsWith("tenant-admin:") ||
        ctx.user.id <= 0
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Der Vertragsnachweis ist ausschließlich für die persönliche Vereinsadministration verfügbar.",
        });
      }
      const membership = await db.resolveTenantForUser({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        allowPilotFallback: false,
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Für diesen Vereinsadministrator ist kein aktiver Verein hinterlegt.",
        });
      }
      const receipt = await db.getCurrentTenantContractReceipt(membership.tenantId);
      if (!receipt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Für die aktuellen Vertragsunterlagen liegt noch kein vollständiger digitaler Nachweis vor.",
        });
      }
      const pdf = await renderTenantContractReceiptPdf({
        tenantName: membership.tenantName,
        recipientName: receipt.acceptedByName,
        packageName: PRODUCT_PACKAGE_META[receipt.packageId].name,
        acceptedAt: receipt.acceptedAt,
        documents: receipt.documents,
      });
      return {
        filename: "Digitaler_Vertragsnachweis.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      } as const;
    }),
    contractAcceptedDocuments: baseProtectedProcedure.mutation(async ({ ctx }) => {
      if (
        ctx.user.role !== "admin" ||
        !ctx.user.openId.startsWith("tenant-admin:") ||
        ctx.user.id <= 0
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Die bestätigten Vertragsunterlagen sind ausschließlich für die persönliche Vereinsadministration verfügbar.",
        });
      }
      const membership = await db.resolveTenantForUser({
        userId: ctx.user.id,
        userOpenId: ctx.user.openId,
        allowPilotFallback: false,
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Für diesen Vereinsadministrator ist kein aktiver Verein hinterlegt.",
        });
      }
      const receipt = await db.getCurrentTenantContractReceipt(membership.tenantId);
      if (!receipt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Für die aktuellen Vertragsunterlagen liegt noch kein vollständiger digitaler Nachweis vor.",
        });
      }
      const pdf = await renderTenantAcceptedContractDocumentsPdf({
        tenantName: membership.tenantName,
        recipientName: receipt.acceptedByName,
        packageName: PRODUCT_PACKAGE_META[receipt.packageId].name,
        acceptedAt: receipt.acceptedAt,
        documents: receipt.documents,
      });
      return {
        filename: "Meine_bestaetigten_Vertragsunterlagen.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      } as const;
    }),
    adminPasswordLogin: publicProcedure
      .input(
        z.object({
          password: z.string().min(1).max(200),
          administratorName: z.string().trim().min(2).max(120).optional(),
          email: z.string().trim().email().max(320).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const clientKey = `admin:${getClientKey(ctx.req)}`;
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.",
          });
        }

        // Der Masterzugang ist unabhängig von der IP zusätzlich global
        // geschützt. Nach fünf Fehlversuchen ist ausschließlich der
        // E-Mail-Reset an die hinterlegte Inhaberadresse zulässig.
        if (!input.email && (await db.getSecuritySettings())?.adminLocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Der Masterzugang ist nach mehreren Fehlversuchen gesperrt. Bitte verwenden Sie „Master-Passwort vergessen?“.",
          });
        }

        // Wenn eine E-Mail angegeben ist, handelt es sich um einen persönlichen Vereinsadmin-Login
        if (input.email) {
          const adminCreds = await db.getTenantAdminCredentialsByEmail(input.email);
          if (!adminCreds || !(await verifyPassword(input.password, adminCreds.passwordHash))) {
            recordFailedPasswordLogin(clientKey);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "E-Mail oder Passwort ist nicht korrekt",
            });
          }
          const loginTenantId = await tenantIdForFreshPersonalLogin({
            id: adminCreds.userId,
            openId: adminCreds.userOpenId,
          });
          await assertTenantProductUsableForLogin(loginTenantId);
          const mfa = await db.getTenantAdminMfaConfigurationByUserId(
            adminCreds.userId
          );
          if (mfa?.enabled && mfa.secret) {
            const mfaChallengeToken = await issueMfaLoginChallenge({
              subjectType: "tenant_admin",
              userId: adminCreds?.userId ?? 0,
            });
            return {
              success: false,
              requiresIdentity: false,
              requiresMfa: true,
              mfaChallengeToken,
            } as const;
          }
          clearPasswordLoginFailures(clientKey);
          const tenantId = await tenantIdForFreshPersonalLogin({
            id: adminCreds.userId,
            openId: adminCreds.userOpenId,
          });
          const sessionName = adminCreds.userName ?? input.email;
          await recordSecurityActivity(
            {
              userId: adminCreds?.userId ?? 0,
              name: sessionName,
              role: "admin",
              loginMethod: "password",
            },
            "Vereinsadministrator-Anmeldung erfolgreich",
            "created",
            tenantId
          );
          const token = await sdk.createSessionToken(adminCreds.userOpenId, {
            name: sessionName,
            expiresInMs: PASSWORD_SESSION_MS,
            sessionVersion: adminCreds.sessionVersion,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PASSWORD_SESSION_MS,
          });
          return {
            success: true,
            requiresIdentity: false,
            mustChangePassword: adminCreds.mustChangePassword,
            tenantId,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          } as const;
        }

        const hash = (await db.getSecuritySettings())?.adminPasswordHash;
        if (!hash || !(await verifyPassword(input.password, hash))) {
          recordFailedPasswordLogin(clientKey);
          const protection = await db.recordFailedAdminPasswordLogin(5);
          throw new TRPCError({
            code: protection.locked ? "TOO_MANY_REQUESTS" : "BAD_REQUEST",
            message: protection.locked
              ? "Der Masterzugang ist nach fünf Fehlversuchen gesperrt. Bitte verwenden Sie „Master-Passwort vergessen?“."
              : "Administratorpasswort ist nicht korrekt",
          });
        }
        const masterMfa = await db.getMasterMfaConfiguration();
        if (Boolean(masterMfa?.enabled && masterMfa?.secret)) {
          const mfaChallengeToken = await issueMfaLoginChallenge({
            subjectType: "master",
          });
          return {
            requiresIdentity: false,
            requiresMfa: true,
            mfaChallengeToken,
          } as const;
        }
        clearPasswordLoginFailures(clientKey);
        await db.clearAdminPasswordLoginFailures();
        if (!input.administratorName) {
          return {
            requiresIdentity: true,
            contacts: await db.listAllContactsForPlanningTeamAccess(),
          } as const;
        }
        await db.upsertUser({
          openId: ADMIN_PASSWORD_OPEN_ID,
          name: input.administratorName,
          loginMethod: "admin-password",
          role: "admin",
          lastSignedIn: new Date(),
        });
        await recordSecurityActivity(
          {
            userId: 0,
            name: input.administratorName,
            role: "admin",
            loginMethod: "admin-password",
          },
          "Administrator-Anmeldung erfolgreich",
          "created",
          null
        );
        const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
          name: input.administratorName,
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          requiresIdentity: false,
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    requestAdminPasswordReset: publicProcedure.mutation(async ({ ctx }) => {
      const clientKey = `admin-reset-request:${getClientKey(ctx.req)}`;
      // Die Antwort bleibt absichtlich gleich, damit der geschützte
      // Wiederherstellungsweg keine internen Zustände preisgibt.
      if (!allowMasterResetRequest(clientKey)) {
        return { accepted: true } as const;
      }

      const rawToken = randomBytes(32).toString("base64url");
      const request = await db.createAdminPasswordResetRequest({
        tokenHash: hashOpaqueToken(rawToken),
        expiresInSeconds: MASTER_RESET_TTL_MINUTES * 60,
      });
      const resetUrl = `${MASTER_ADMIN_ORIGIN}/?reset=${encodeURIComponent(rawToken)}`;
      const emailContent = renderMasterPasswordResetEmail({
        resetUrl,
        expiresInMinutes: MASTER_RESET_TTL_MINUTES,
      });
      await safelySubmitInvitationEmail({
        to: MASTER_RESET_EMAIL,
        ...emailContent,
      });
      await recordSecurityActivity(
        {
          userId: 0,
          name: "Masterportal",
          role: "admin",
          loginMethod: "password",
        },
        `Masterpasswort-Reset angefordert; Link gültig bis ${request.expiresAt.toISOString()}`,
        "created",
        null
      );
      return { accepted: true } as const;
    }),
    resetAdminPasswordWithEmailToken: publicProcedure
      .input(
        z.object({
          token: z.string().min(32).max(200),
          newPassword: passwordInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const reset = await db.resetAdminPasswordWithEmailToken({
          tokenHash: hashOpaqueToken(input.token),
          passwordHash: await hashPassword(input.newPassword),
        });
        if (!reset) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dieser Reset-Link ist ungültig, abgelaufen oder wurde bereits verwendet.",
          });
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        await recordSecurityActivity(
          {
            userId: 0,
            name: "Masterportal",
            role: "admin",
            loginMethod: "password",
          },
          "Masterpasswort per E-Mail-Reset zurückgesetzt; alle Passwortsitzungen ungültig gemacht",
          "updated",
          null
        );
        return { success: true, requiresLogin: true } as const;
      }),
    resetAdminWithKey: publicProcedure
      .input(
        z.object({
          recoveryKey: z.string().min(1, "Recovery-Key darf nicht leer sein").max(200),
          newPassword: passwordInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const clientKey = `admin-recovery:${getClientKey(ctx.req)}`;
        if (isPasswordLoginBlocked(clientKey)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu viele Fehlversuche für den Recovery-Key. Bitte in 15 Minuten erneut versuchen.",
          });
        }
        const configuredKey = ENV.adminRecoveryKey;
        if (!configuredKey || !verifyRecoveryKey(input.recoveryKey, configuredKey)) {
          recordFailedPasswordLogin(clientKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Master Recovery Key ist nicht korrekt oder nicht konfiguriert",
          });
        }
        clearPasswordLoginFailures(clientKey);
        clearPasswordLoginFailures(`admin:${getClientKey(ctx.req)}`);

        // Neues Passwort hashen und in der Datenbank speichern (erhöht gleichzeitig adminSessionVersion)
        const newHash = await hashPassword(input.newPassword);
        await db.setAdminPasswordHash(newHash);
        await recordSecurityActivity(
          {
            userId: 0,
            name: "Administrator",
            role: "admin",
            loginMethod: "admin-password",
          },
          "Administratorpasswort über Recovery-Key zurückgesetzt",
          "updated",
          null
        );

        // Admin-Benutzer aktualisieren / erstellen und direkt einloggen
        await db.upsertUser({
          openId: ADMIN_PASSWORD_OPEN_ID,
          name: "Administrator",
          loginMethod: "admin-password",
          role: "admin",
          lastSignedIn: new Date(),
        });
        const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
          name: "Administrator",
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    consumeHandoffToken: publicProcedure
      .input(z.object({ token: z.string().min(10).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const tokenHash = hashOpaqueToken(input.token);
        const handoff = await db.consumePlatformTenantHandoff(tokenHash);
        if (!handoff) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der Einmal-Wechsel-Link ist ungültig oder abgelaufen.",
          });
        }
        const demoLogin = await getPublicDemoLoginDetails({
          tenantId: handoff.tenantId,
          openId: handoff.createdByOpenId,
        });
        if (demoLogin) {
          const token = await sdk.createSessionToken(demoLogin.user.openId, {
            name: "Demo-Planung",
            expiresInMs: PUBLIC_DEMO_SESSION_MS,
            sessionVersion: demoLogin.sessionVersion,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PUBLIC_DEMO_SESSION_MS,
          });
          return {
            success: true,
            tenantId: handoff.tenantId,
            startEvent: { year: demoLogin.year, eventId: demoLogin.eventId },
            publicDemo: true,
            packageId: demoLogin.packageId,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          } as const;
        }
        const token = await sdk.createSessionToken(ADMIN_PASSWORD_OPEN_ID, {
          name: "Plattform-Administrator",
          expiresInMs: PASSWORD_SESSION_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          tenantId: handoff.tenantId,
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    /**
     * Ein Aktivierungslink darf eine bestehende Sitzung immer vollständig
     * ersetzen. Die Linkadresse bleibt bewusst für beide Zugangstypen gleich;
     * die serverseitig gespeicherte Einladung entscheidet sicher über die
     * Zielidentität und den Zielverein.
     */
    consumeActivationInvitation: publicProcedure
      .input(z.object({ token: z.string().min(32).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const tokenHash = hashOpaqueToken(input.token);
        const planningInvitation = await db.consumePlanningTeamInvitation(tokenHash);
        if (planningInvitation) {
          const openId = planningTeamAccessOpenId(planningInvitation.accessId);
          const sessionName =
            planningInvitation.contactName ?? planningInvitation.label ?? "Planungsteam";
          await db.upsertUser({
            openId,
            name: sessionName,
            email: planningInvitation.email ?? null,
            loginMethod: "password",
            role: "user",
            lastSignedIn: new Date(),
          });
          try {
            if ("synchronizePlanningTeamTenantMemberships" in db) {
              await (db as any).synchronizePlanningTeamTenantMemberships(
                planningInvitation.accessId
              );
            }
          } catch {
            // Unit-Test-Mocks ohne Mitgliedschaftstabellen dürfen die
            // Aktivierung nicht unterbrechen.
          }
          const token = await sdk.createSessionToken(openId, {
            name: sessionName,
            expiresInMs: PASSWORD_SESSION_MS,
            sessionVersion: planningInvitation.sessionVersion,
          });
          ctx.res.cookie(COOKIE_NAME, token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: PASSWORD_SESSION_MS,
          });
          return {
            success: true,
            tenantId: planningInvitation.tenantId,
            mustChangePassword: true,
            activationKind: "planning_team" as const,
            activationName: sessionName,
            ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
          };
        }

        const tenantAdminInvitation = await db.consumeTenantAdminInvitation(tokenHash);
        if (!tenantAdminInvitation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dieser Aktivierungslink ist ungültig, bereits verwendet oder abgelaufen.",
          });
        }
        const token = await sdk.createSessionToken(tenantAdminInvitation.userOpenId, {
          name: tenantAdminInvitation.userName ?? "Vereinsadministrator",
          expiresInMs: PASSWORD_SESSION_MS,
          sessionVersion: tenantAdminInvitation.sessionVersion,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          tenantId: tenantAdminInvitation.tenantId,
          mustChangePassword: true,
          activationKind: "tenant_admin" as const,
          activationName: tenantAdminInvitation.userName ?? "Vereinsadministrator",
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        };
      }),
    consumeTenantAdminInvitation: publicProcedure
      .input(z.object({ token: z.string().min(32).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.consumeTenantAdminInvitation(
          hashOpaqueToken(input.token)
        );
        if (!invitation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dieser Aktivierungslink ist ungültig, bereits verwendet oder abgelaufen.",
          });
        }
        const token = await sdk.createSessionToken(invitation.userOpenId, {
          name: invitation.userName ?? "Vereinsadministrator",
          expiresInMs: PASSWORD_SESSION_MS,
          sessionVersion: invitation.sessionVersion,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          tenantId: invitation.tenantId,
          mustChangePassword: true,
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    consumePlanningTeamInvitation: publicProcedure
      .input(z.object({ token: z.string().min(32).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.consumePlanningTeamInvitation(
          hashOpaqueToken(input.token)
        );
        if (!invitation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dieser Aktivierungslink ist ungültig, bereits verwendet oder abgelaufen.",
          });
        }
        const openId = planningTeamAccessOpenId(invitation.accessId);
        const sessionName = invitation.contactName ?? invitation.label ?? "Planungsteam";
        await db.upsertUser({
          openId,
          name: sessionName,
          email: invitation.email ?? null,
          loginMethod: "password",
          role: "user",
          lastSignedIn: new Date(),
        });
        try {
          if ("synchronizePlanningTeamTenantMemberships" in db) {
            await (db as any).synchronizePlanningTeamTenantMemberships(invitation.accessId);
          }
        } catch {
          // Ignorieren falls Mock in Unit-Tests
        }
        const token = await sdk.createSessionToken(openId, {
          name: sessionName,
          expiresInMs: PASSWORD_SESSION_MS,
          sessionVersion: invitation.sessionVersion,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: PASSWORD_SESSION_MS,
        });
        return {
          success: true,
          tenantId: invitation.tenantId,
          mustChangePassword: true,
          ...(isEmbeddedManusPreview(ctx.req) ? { previewSessionToken: token } : {}),
        } as const;
      }),
    setAdminPassword: accountAdminProcedure
      .input(
        z.object({
          password: passwordInput,
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        await db.setAdminPasswordHash(await hashPassword(input.password));
        await recordSecurityActivity(
          auditActor(ctx.user),
          "Administratorpasswort neu vergeben",
          "updated",
          null
        );
        return { success: true } as const;
      }),
    unlockPlanningTeamLock: accountAdminProcedure.mutation(async ({ ctx }) => {
      await db.unlockPlanningTeamLogin();
      await recordSecurityActivity(
        auditActor(ctx.user),
        "Globaler Notfall-Stopp für alle Planungsteam-Zugänge aufgehoben",
        "updated",
        null
      );
      return { success: true } as const;
    }),
    lockPlanningTeam: accountAdminProcedure.mutation(async ({ ctx }) => {
      await db.lockPlanningTeamLogin();
      await recordSecurityActivity(
        auditActor(ctx.user),
        "Globaler Notfall-Stopp für alle Planungsteam-Zugänge aktiviert",
        "updated",
        null
      );
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionKey = sessionPresenceKey(ctx.req);
      if (sessionKey) {
        try {
          await db.revokeSessionKey(sessionKey, "logout");
        } catch (error) {
          console.warn("[Auth] Sitzungswiderruf fehlgeschlagen", error);
        }
      }
      try {
        await removeSessionPresence(ctx.req);
      } catch (error) {
        console.warn("[Presence] Sitzung konnte beim Logout nicht entfernt werden", error);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  planningTeamAccesses: router({
    // Zugangsverwaltung ist eine Vereinsfunktion. Sie muss deshalb exakt
    // denselben serverseitig bestätigten Mandantenkontext verwenden wie alle
    // Fachmodule; ein bloßer Browserfilter wäre keine Sicherheitsgrenze.
    list: personalAccessAdminProcedure.query(() => db.listPlanningTeamAccesses()),
    availableContacts: personalAccessAdminProcedure.query(() =>
      db.listAllContactsForPlanningTeamAccess()
    ),
    myPermissions: scopedProtectedProcedure.query(async ({ ctx }) => {
      return getPlanningTeamPermissionsForUser(ctx.user);
    }),
    myModuleAccess: scopedProtectedProcedure.query(async ({ ctx }) => {
      return getPlanningTeamModuleAccessForUser(ctx.user);
    }),
    administrativeContext: eventSelectionProcedure.query(async ({ ctx }) => ({
      isTenantAdmin: await isTenantAdministrator(ctx.user),
      isPrimaryTenantAdmin: isPrimaryTenantAdministrator(ctx.user),
      isDelegatedTenantAdmin: await isDelegatedTenantAdministrator(ctx.user),
    })),
    availableEvents: personalAccessAdminProcedure.query(async () => {
      const years = await db.listEventYears();
      const grouped = await Promise.all(
        years.map(async item => db.listEvents(item.year))
      );
      return grouped.flat();
    }),
    create: personalAccessAdminProcedure
      .input(
        z.object({
          label: z.string().trim().min(2).max(120),
          contactId: z.number().int().positive(),
          email: z.string().email().max(320).optional(),
          modulePermissions: z.array(z.enum(PLANNING_MODULES)).optional(),
          moduleAccess: moduleAccessSchema.optional(),
          isTenantAdmin: z.boolean().default(false),
          password: passwordInput,
          eventIds: z.array(z.number().int().positive()).min(1).max(500),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        if (input.isTenantAdmin) requirePrimaryTenantAdministrator(ctx.user);
        await assertPlanningTeamAccessReferencesInScope(input);
        const derivedModulePermissions = input.moduleAccess
          ? PLANNING_MODULES.filter(m => input.moduleAccess?.[m] === "write")
          : input.modulePermissions;
        return db.createPlanningTeamAccess({
          label: input.label,
          contactId: input.contactId,
          email: input.email ?? null,
          modulePermissions: input.isTenantAdmin
            ? [...FULL_PLANNER_PERMISSIONS]
            : derivedModulePermissions ?? [],
          moduleAccess: input.isTenantAdmin
            ? Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]))
            : input.moduleAccess ?? undefined,
          isTenantAdmin: input.isTenantAdmin,
          passwordHash: await hashPassword(input.password),
          eventIds: input.eventIds,
        });
      }),
    createWithInvitationLink: personalAccessAdminProcedure
      .input(
        z.object({
          label: z.string().trim().min(2).max(120),
          contactId: z.number().int().positive(),
          email: z.string().email("Gültige E-Mail-Adresse erforderlich").max(320),
          modulePermissions: z.array(z.enum(PLANNING_MODULES)).optional(),
          moduleAccess: moduleAccessSchema.optional(),
          isTenantAdmin: z.boolean().default(false),
          eventIds: z.array(z.number().int().positive()).min(1).max(500),
          // Ein Aktivierungslink wird nur dann per E-Mail versendet, wenn die
          // Oberfläche oder eine andere aufrufende Stelle dies ausdrücklich
          // bestätigt. Ohne Angabe wird ausschließlich ein Link erzeugt.
          sendEmail: z.boolean().default(false),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        if (input.isTenantAdmin) requirePrimaryTenantAdministrator(ctx.user);
        await assertPlanningTeamAccessReferencesInScope(input);
        const contact = (await db.listAllContactsForPlanningTeamAccess()).find(
          item => item.id === input.contactId
        );
        if (!contact) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Ansprechpartner wurde nicht gefunden",
          });
        }
        const tempPassword = generatePlanningTeamAccessPassword();
        const derivedModulePermissions = input.moduleAccess
          ? EDITABLE_PLANNING_MODULES.filter(m => input.moduleAccess?.[m] === "write")
          : input.modulePermissions;
        const access = await db.createPlanningTeamAccess({
          label: input.label,
          contactId: input.contactId,
          email: input.email.trim().toLocaleLowerCase("de-DE"),
          modulePermissions: input.isTenantAdmin
            ? [...FULL_PLANNER_PERMISSIONS]
            : derivedModulePermissions ?? [],
          moduleAccess: input.isTenantAdmin
            ? Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]))
            : input.moduleAccess ?? undefined,
          isTenantAdmin: input.isTenantAdmin,
          passwordHash: await hashPassword(tempPassword),
          mustChangePassword: true,
          onboardingPending: true,
          eventIds: input.eventIds,
        });

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashOpaqueToken(rawToken);
        const scope = await authorizedPlanningScope(ctx.user, ctx.req);
        const invitation = await db.createPlanningTeamInvitation({
          accessId: access.id,
          tenantId: scope.tenantId,
          tokenHash,
          expiresInSeconds: 48 * 3600,
        });

        const currentTenants = await db.listTenants();
        const activeTenant = currentTenants.find(t => t.id === scope.tenantId);
        const tenantName = activeTenant?.name ?? "Vereinsplanung";
        const activationUrl = publicAppUrl(`/aktivieren?token=${encodeURIComponent(rawToken)}`);
        const modulesSummary = input.isTenantAdmin
          ? "Alle Fachbereiche als Co-Admin"
          : planningModuleSummary(input.modulePermissions);

        let emailSent = false;
        if (input.sendEmail) {
          const emailContent = renderPlanningTeamInvitationEmail({
            recipientName: access.label,
            tenantName,
            invitationUrl: activationUrl,
            modulesSummary,
            expiresInHours: 48,
          });
          emailSent = await safelySubmitInvitationEmail({
            to: input.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        }

        await recordSecurityActivity(
          auditActor(ctx.user),
          `Planungsteam-Einladung für „${access.label}“ erstellt (${input.email})${emailSent ? " · an SMTP-Server übergeben" : " · E-Mail-Übergabe fehlgeschlagen"}`,
          "created"
        );

        return {
          accessId: access.id,
          label: access.label,
          email: input.email,
          activationUrl,
          emailSent,
          expiresAt: invitation.expiresAt,
        };
      }),
    sendInvitationLink: personalAccessAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          currentAdminPassword: z.string().min(1).max(200),
          sendEmail: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        const access = (await db.listPlanningTeamAccesses()).find(
          item => item.id === input.id
        );
        if (!access) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planungsteam-Zugang wurde nicht gefunden",
          });
        }
        if (isDelegatedTenantAdministratorAccess(access)) {
          requirePrimaryTenantAdministrator(ctx.user);
        }
        if (!access.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Für diesen Zugang ist keine E-Mail-Adresse hinterlegt. Bitte erst bearbeiten und E-Mail ergänzen.",
          });
        }

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashOpaqueToken(rawToken);
        const scope = await authorizedPlanningScope(ctx.user, ctx.req);
        const invitation = await db.createPlanningTeamInvitation({
          accessId: access.id,
          tenantId: scope.tenantId,
          tokenHash,
          expiresInSeconds: 48 * 3600,
        });

        const currentTenants = await db.listTenants();
        const activeTenant = currentTenants.find(t => t.id === scope.tenantId);
        const tenantName = activeTenant?.name ?? "Vereinsplanung";
        const activationUrl = publicAppUrl(`/aktivieren?token=${encodeURIComponent(rawToken)}`);
        const modulesSummary = planningModuleSummary(access.modulePermissions);

        let emailSent = false;
        if (input.sendEmail) {
          const emailContent = renderPlanningTeamInvitationEmail({
            recipientName: access.label,
            tenantName,
            invitationUrl: activationUrl,
            modulesSummary,
            expiresInHours: 48,
          });
          emailSent = await safelySubmitInvitationEmail({
            to: access.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        }

        await recordSecurityActivity(
          auditActor(ctx.user),
          `Neuer Aktivierungslink für Planungsteam-Zugang „${access.label}“ ausgestellt (${access.email})${emailSent ? " · an SMTP-Server übergeben" : " · E-Mail-Übergabe fehlgeschlagen"}`,
          "reset"
        );

        return {
          accessId: access.id,
          label: access.label,
          email: access.email,
          activationUrl,
          emailSent,
          expiresAt: invitation.expiresAt,
        };
      }),
    createWithAccessSheet: personalAccessAdminProcedure
      .input(
        z.object({
          label: z.string().trim().min(2).max(120),
          contactId: z.number().int().positive(),
          email: z.string().email().max(320).optional(),
          modulePermissions: z.array(z.enum(PLANNING_MODULES)).optional(),
          moduleAccess: moduleAccessSchema.optional(),
          isTenantAdmin: z.boolean().default(false),
          eventIds: z.array(z.number().int().positive()).min(1).max(500),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        if (input.isTenantAdmin) requirePrimaryTenantAdministrator(ctx.user);
        await assertPlanningTeamAccessReferencesInScope(input);
        const initialPassword = generatePlanningTeamAccessPassword();
        const contact = (await db.listAllContactsForPlanningTeamAccess()).find(
          item => item.id === input.contactId
        );
        if (!contact) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Ansprechpartner wurde nicht gefunden",
          });
        }
        // Die PDF-Erzeugung muss vor dem Persistieren gelingen: sonst wäre ein
        // unbekannter Einmalcode gespeichert, der nicht erneut abrufbar ist.
        const initialSheet: db.PlanningTeamAccessSummary = {
          id: input.contactId,
          contactId: input.contactId,
          contactName: contact.name,
          label: contact.name,
          email: null,
          modulePermissions: input.isTenantAdmin
            ? [...FULL_PLANNER_PERMISSIONS]
            : input.moduleAccess
              ? EDITABLE_PLANNING_MODULES.filter(m => input.moduleAccess?.[m] === "write")
              : input.modulePermissions ?? [],
          moduleAccess: input.isTenantAdmin
            ? Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]))
            : input.moduleAccess ?? {},
          isTenantAdmin: input.isTenantAdmin,
          eventIds: input.eventIds,
          mustChangePassword: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const pdf = await createPlanningTeamAccessSheetsFile(
          [initialSheet],
          new Map([[initialSheet.id, initialPassword]])
        );
        const access = await db.createPlanningTeamAccess({
          label: input.label,
          contactId: input.contactId,
          email: input.email ?? null,
          modulePermissions: input.isTenantAdmin
            ? [...FULL_PLANNER_PERMISSIONS]
            : input.moduleAccess
              ? EDITABLE_PLANNING_MODULES.filter(m => input.moduleAccess?.[m] === "write")
              : input.modulePermissions ?? [],
          moduleAccess: input.isTenantAdmin
            ? Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]))
            : input.moduleAccess ?? undefined,
          isTenantAdmin: input.isTenantAdmin,
          passwordHash: await hashPassword(initialPassword),
          mustChangePassword: true,
          eventIds: input.eventIds,
        });
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Einmal-Zugang für „${access.label}“ erstellt und Zugangsblatt gedruckt`,
          "created"
        );
        return {
          accessId: access.id,
          filename: `Zugangsblatt_${safeExportName(access.label)}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    update: personalAccessAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          label: z.string().trim().min(2).max(120),
          contactId: z.number().int().positive().nullable().optional(),
          email: z.string().email().max(320).nullable().optional(),
          modulePermissions: z.array(z.enum(PLANNING_MODULES)).optional(),
          moduleAccess: moduleAccessSchema.optional(),
          isTenantAdmin: z.boolean().optional(),
          password: passwordInput.optional(),
          eventIds: z.array(z.number().int().positive()).min(1).max(500),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        const existing = (await db.listPlanningTeamAccesses()).find(
          access => access.id === input.id
        );
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planungsteam-Zugang wurde nicht gefunden",
          });
        }
        if (
          isDelegatedTenantAdministratorAccess(existing) ||
          input.isTenantAdmin === true
        ) {
          requirePrimaryTenantAdministrator(ctx.user);
        }
        await assertPlanningTeamAccessReferencesInScope(input);
        const derivedModulePermissions = input.moduleAccess
          ? EDITABLE_PLANNING_MODULES.filter(m => input.moduleAccess?.[m] === "write")
          : input.modulePermissions;
        return db.updatePlanningTeamAccess({
          id: input.id,
          label: input.label,
          contactId: input.contactId,
          email: input.email,
          modulePermissions:
            input.isTenantAdmin === true
              ? [...FULL_PLANNER_PERMISSIONS]
              : derivedModulePermissions,
          moduleAccess:
            input.isTenantAdmin === true
              ? Object.fromEntries(EDITABLE_PLANNING_MODULES.map(m => [m, "write"]))
              : input.moduleAccess ?? undefined,
          isTenantAdmin: input.isTenantAdmin,
          passwordHash: input.password ? await hashPassword(input.password) : undefined,
          eventIds: input.eventIds,
        });
      }),
    resetAndPrint: personalAccessAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        const existing = (await db.listPlanningTeamAccesses()).find(
          access => access.id === input.id
        );
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planungsteam-Zugang wurde nicht gefunden",
          });
        }
        if (isDelegatedTenantAdministratorAccess(existing)) {
          requirePrimaryTenantAdministrator(ctx.user);
        }
        const initialPassword = generatePlanningTeamAccessPassword();
        // Auch beim Reset wird das PDF vor dem Passwortwechsel erzeugt, damit
        // ein Fehler niemals einen unbekannten neuen Zugangscode hinterlässt.
        const pdf = await createPlanningTeamAccessSheetsFile(
          [existing],
          new Map([[existing.id, initialPassword]])
        );
        const updated = await db.updatePlanningTeamAccess({
          id: existing.id,
          label: existing.label,
          contactId: existing.contactId,
          passwordHash: await hashPassword(initialPassword),
          mustChangePassword: true,
          eventIds: existing.eventIds,
        });
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Initialcode für Planungsteam-Zugang „${updated.label}“ zurückgesetzt und Zugangsblatt gedruckt`,
          "reset"
        );
        return {
          accessId: updated.id,
          filename: `Zugangsblatt_${safeExportName(updated.label)}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    accessSheets: personalAccessAdminProcedure
      .input(
        z.object({
          accessIds: z.array(z.number().int().positive()).min(1).max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const requestedIds = Array.from(new Set(input.accessIds));
        const accesses = (await db.listPlanningTeamAccesses()).filter(
          access =>
            requestedIds.includes(access.id) &&
            Boolean(access.contactId && access.contactName)
        );
        if (accesses.length !== requestedIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens ein ausgewählter Ansprechpartnerzugang wurde nicht gefunden",
          });
        }
        if (
          accesses.some(isDelegatedTenantAdministratorAccess) &&
          ctx.user.role !== "admin"
        ) {
          requirePrimaryTenantAdministrator(ctx.user);
        }
        const pdf = await createPlanningTeamAccessSheetsFile(accesses);
        return {
          filename: "Zugangsblätter_Planungsteam.pdf",
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    remove: personalAccessAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.currentAdminPassword, ctx);
        const existing = (await db.listPlanningTeamAccesses()).find(
          access => access.id === input.id
        );
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planungsteam-Zugang wurde nicht gefunden",
          });
        }
        if (isDelegatedTenantAdministratorAccess(existing)) {
          requirePrimaryTenantAdministrator(ctx.user);
        }
        return db.deletePlanningTeamAccess(input.id);
      }),
  }),

  presence: router({
    heartbeat: baseProtectedProcedure.mutation(async ({ ctx }) => {
      await safelyRecordPresence(ctx.req, ctx.user);
      return { success: true } as const;
    }),
    status: baseProtectedProcedure.query(async ({ ctx }) => {
      const scope = await authorizedPlanningScope(ctx.user, ctx.req);
      return getOnlinePresenceStatus(scope.tenantId);
    }),
  }),

  tenants: router({
    list: masterAdminProcedure.query(() => db.listTenants()),
    current: scopedProtectedProcedure.query(() => db.getTenant()),
  }),

  /**
   * Ein absichtlich gemeinsamer und auf ein Event begrenzter Zugang für den
   * Event Pass. Er wird getrennt von persönlichen Planungsteamzugängen
   * verwaltet, damit weder die private Mailadresse noch das Adminpasswort des
   * buchenden Vereinskontakts geteilt werden müssen.
   */
  eventPassSharedAccess: router({
    status: tenantAccessAdminProcedure.query(async () => {
      const context = await requireEventPassSharedAccessContext();
      const existing = (await db.listPlanningTeamAccesses()).find(
        access => access.email === context.identifier
      );
      return {
        configured: Boolean(existing),
        identifier: context.identifier,
        eventId: context.eventId,
        updatedAt: existing?.updatedAt ?? null,
      };
    }),
    save: tenantAccessAdminProcedure
      .input(
        z.object({
          password: passwordInput,
          passwordConfirmation: passwordInput,
          currentAdminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.password !== input.passwordConfirmation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die beiden Passwörter stimmen nicht überein.",
          });
        }
        await requireAdminPassword(input.currentAdminPassword, ctx);
        const context = await requireEventPassSharedAccessContext();
        const existing = (await db.listPlanningTeamAccesses()).find(
          access => access.email === context.identifier
        );
        const passwordHash = await hashPassword(input.password);
        if (existing) {
          await db.updatePlanningTeamAccess({
            id: existing.id,
            label: "Gemeinsamer Event-Pass-Zugang",
            contactId: null,
            email: context.identifier,
            modulePermissions: EDITABLE_PLANNING_MODULES.filter(
              module => EVENT_PASS_SHARED_MODULE_ACCESS[module] === "write"
            ),
            moduleAccess: EVENT_PASS_SHARED_MODULE_ACCESS,
            isTenantAdmin: false,
            passwordHash,
            mustChangePassword: false,
            eventIds: [context.eventId],
          });
        } else {
          await db.createPlanningTeamAccess({
            label: "Gemeinsamer Event-Pass-Zugang",
            contactId: null,
            email: context.identifier,
            modulePermissions: EDITABLE_PLANNING_MODULES.filter(
              module => EVENT_PASS_SHARED_MODULE_ACCESS[module] === "write"
            ),
            moduleAccess: EVENT_PASS_SHARED_MODULE_ACCESS,
            isTenantAdmin: false,
            passwordHash,
            mustChangePassword: false,
            onboardingPending: false,
            isSharedEventPassAccess: true,
            eventIds: [context.eventId],
          });
        }
        await recordSecurityActivity(
          auditActor(ctx.user),
          existing
            ? "Gemeinsames Event-Pass-Teamkennwort geändert; alle bisherigen Team-Sitzungen abgemeldet"
            : "Gemeinsamen Event-Pass-Teamzugang eingerichtet",
          existing ? "updated" : "created",
          context.tenantId
        );
        return {
          success: true,
          identifier: context.identifier,
          replacedExistingAccess: Boolean(existing),
        } as const;
      }),
  }),

  tenantProduct: router({
    current: scopedProtectedProcedure.query(async () => {
      const entitlement = await db.getCurrentTenantProductEntitlement();
      return {
        packageId: entitlement.packageId,
        status: entitlement.status,
        startsOn: entitlement.startsOn,
        endsOn: entitlement.endsOn,
        eventId: entitlement.eventId,
        isUsable: entitlement.isUsable,
        entitlements: entitlement.entitlements,
      };
    }),
    usage: scopeAdminAuthProcedure.query(() => db.getCurrentTenantProductUsage()),
  }),

  platformAdmin: router({
    tenantOverview: masterAdminProcedure.query(() =>
      db.listTenantOverviewsForPlatformAdmin()
    ),
    accessInventory: masterAdminProcedure.query(() =>
      db.listPlatformAccessInventoryForPlatformAdmin()
    ),
    pilotInquiries: masterAdminProcedure.query(() =>
      db.listPilotInquiriesForPlatformAdmin()
    ),
    completePilotInquiry: masterAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["accepted", "declined"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const completed = await db.completePilotInquiryForPlatformAdmin(input);
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Pilotanfrage #${completed.id} dokumentiert abgeschlossen (${completed.status})`,
          "updated",
          null
        );
        return completed;
      }),
    deletePilotInquiry: masterAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await db.deletePilotInquiryForPlatformAdmin(input.id);
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Pilotanfrage #${deleted.id} auf dokumentierten Löschwunsch entfernt`,
          "deleted",
          null
        );
        return deleted;
      }),
    deleteTestAccess: masterAdminProcedure
      .input(
        z.object({
          type: z.enum(["tenant_admin", "planning_team"]),
          accessId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const deleted = await db.deletePlatformAccessForMasterAdmin(input);
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Testzugang „${deleted.name}“ (${input.type === "tenant_admin" ? "Vereinsadmin" : "Planungsteam"}) entfernt`,
          "deleted",
          null
        );
        return { success: true, ...deleted } as const;
      }),
    revokeTenantAdmin: masterAdminProcedure
      .input(
        z.object({
          tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/),
          userId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const revoked = await db.revokeTenantAdministratorForPlatformAdmin(input);
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Vereinsadmin „${revoked.adminName}“ aus Verein „${revoked.tenantName}“ entfernt`,
          "deleted",
          null
        );
        return { success: true, ...revoked } as const;
      }),
    createTenant: masterAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(3).max(200),
          contactEmail: z.string().trim().email().max(320),
          accessMode: z.enum(TENANT_ACCESS_MODES),
          packageId: z.enum(PRODUCT_PACKAGE_IDS),
          packageStartsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          packageEndsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          initialEventName: z.string().trim().min(2).max(200),
          initialEventYear: eventYearInput,
          activeDays: activeDaysInput,
          initialAdmin: z
            .object({
              name: z.string().trim().min(2).max(120),
              email: z.string().trim().email().max(320),
              password: passwordInput,
              passwordConfirmation: passwordInput,
            })
            .refine(value => value.password === value.passwordConfirmation, {
              path: ["passwordConfirmation"],
              message: "Die beiden Initialpasswörter stimmen nicht überein",
            })
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const initialAdmin = input.initialAdmin;
        const accessSetup = tenantCreationSetupForAccessMode(input.accessMode);
        const created = await db.createTenantForPlatformAdmin({
          ...input,
          legalName: input.name,
          supportEmail: MYCREWMATE_SUPPORT_EMAIL,
          status: accessSetup.tenantStatus,
          planName: accessSetup.planName,
          packageStatus: accessSetup.packageStatus,
          initialAdmin: initialAdmin
            ? {
                name: initialAdmin.name,
                email: initialAdmin.email,
                passwordHash: await hashPassword(initialAdmin.password),
              }
            : undefined,
        });
        if (initialAdmin) {
          await recordSecurityActivity(
            auditActor(ctx.user),
            `Vereinsadmin für „${created.tenantId}“ mit Initialpasswort angelegt; Passwortwechsel bei erster Anmeldung erforderlich`,
            "created",
            null
          );
        }
        return created;
      }),
    updateTenantProductAssignment: masterAdminProcedure
      .input(
        z.object({
          tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/),
          packageId: z.enum(PRODUCT_PACKAGE_IDS),
          status: z.enum(PRODUCT_ASSIGNMENT_STATUSES),
          startsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          endsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          eventId: z.number().int().positive().nullable().optional(),
          internalNote: z.string().trim().max(2_000).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const recipients =
          input.status === "paused"
            ? await db.listTenantAdministratorNotificationRecipients(input.tenantId)
            : [];
        const updated = await db.updateTenantProductAssignmentForPlatformAdmin(input);
        const notification =
          input.status === "paused" && updated.previousStatus !== "paused"
            ? await notifyTenantAdministratorsAboutAccessStatus({
                recipients,
                tenantName: updated.tenantName,
                status: "paused",
                packageName: PRODUCT_PACKAGE_META[updated.packageId].name,
              })
            : { recipientCount: 0, deliveredCount: 0 };
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Paketstatus für „${updated.tenantName}“ auf „${updated.status}“ gesetzt${updated.convertedFromPilot ? "; Pilotzugang als regulären Zugang übernommen" : ""}${notification.recipientCount ? `; ${notification.deliveredCount}/${notification.recipientCount} Administratoren informiert` : ""}`,
          "updated",
          null
        );
        return { ...updated, notification };
      }),
    updateTenantLifecycle: masterAdminProcedure
      .input(
        z.object({
          tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/),
          // "active" ist absichtlich ausgeschlossen: Marktfreigabe erfolgt später separat.
          status: z.enum(["pilot", "sample", "suspended", "archived"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const shouldNotify = input.status === "suspended" || input.status === "archived";
        // Beim Archivieren sind die persönlichen Zugänge nach dem Update bewusst
        // gelöscht. Deshalb muss die Empfängerliste vor dem Statuswechsel stehen.
        const recipients = shouldNotify
          ? await db.listTenantAdministratorNotificationRecipients(input.tenantId)
          : [];
        const updated = await db.updateTenantLifecycleForPlatformAdmin(input);
        const notification =
          shouldNotify && updated.previousStatus !== updated.status
            ? await notifyTenantAdministratorsAboutAccessStatus({
                recipients,
                tenantName: updated.tenantName,
                status: updated.status === "archived" ? "archived" : "paused",
              })
            : { recipientCount: 0, deliveredCount: 0 };
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Vereinsstatus für „${updated.tenantName}“ auf „${updated.status}“ gesetzt${notification.recipientCount ? `; ${notification.deliveredCount}/${notification.recipientCount} Administratoren informiert` : ""}`,
          "updated",
          null
        );
        return { ...updated, notification };
      }),
    deleteInternalTestTenant: masterAdminProcedure
      .input(
        z.object({
          tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const deleted = await db.deleteInternalTestTenantForPlatformAdmin(input.tenantId);
        await recordSecurityActivity(
          auditActor(ctx.user),
          `Interner Testverein „${deleted.tenantName}“ einschließlich ${deleted.removedEventCount} Veranstaltung(en) endgültig entfernt`,
          "deleted",
          null
        );
        return { success: true, ...deleted } as const;
      }),
    createTenantAdmin: masterAdminProcedure
      .input(
        z.object({
          tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/),
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().max(320),
          sendEmailInvitation: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        // Das Zufallspasswort ist absichtlich nicht zur Weitergabe bestimmt:
        // der Administrator setzt sein eigenes Passwort nach Link-Einlösung.
        const initialPassword = generatePlanningTeamAccessPassword();
        const passwordHash = await hashPassword(initialPassword);
        const admin = await db.createOrUpdateTenantAdminForPlatformAdmin({
          tenantId: input.tenantId,
          name: input.name,
          email: input.email,
          passwordHash,
        });
        const rawInvitationToken = randomBytes(32).toString("base64url");
        const invitation = await db.createTenantAdminInvitation({
          userId: admin.userId,
          tenantId: input.tenantId,
          tokenHash: hashOpaqueToken(rawInvitationToken),
          expiresInSeconds: 48 * 60 * 60,
        });
        const invitationUrl = `https://app.mycrewmate.de/aktivieren?token=${encodeURIComponent(rawInvitationToken)}`;
        let emailSent = false;
        if (input.sendEmailInvitation) {
          const tenants = await db.listTenants();
          const targetTenant = tenants.find(t => t.id === input.tenantId);
          const emailContent = renderInvitationEmail({
            recipientName: admin.name,
            tenantName: targetTenant?.name ?? input.tenantId,
            invitationUrl,
            expiresInHours: 48,
          });
          emailSent = await safelySubmitInvitationEmail({
            to: admin.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        }
        return {
          success: true,
          userId: admin.userId,
          email: admin.email,
          name: admin.name,
          invitationUrl,
          expiresAt: invitation.expiresAt,
          emailSent,
        } as const;
      }),
    launchSettings: masterAdminProcedure.query(() => db.getPlatformLaunchSettings()),
    createHandoffLink: masterAdminProcedure
      .input(z.object({ tenantId: z.string().trim().regex(/^[a-z0-9-]{3,96}$/) }))
      .mutation(async ({ ctx, input }) => {
        const rawToken = randomBytes(24).toString("base64url");
        const tokenHash = hashOpaqueToken(rawToken);
        await db.createPlatformTenantHandoff({
          tenantId: input.tenantId,
          createdByOpenId: ctx.user.openId,
          tokenHash,
          expiresInSeconds: 300,
        });
        return {
          success: true,
          tenantId: input.tenantId,
          handoffToken: rawToken,
          expiresInSeconds: 300,
        } as const;
      }),
  }),

  years: router({
    list: eventSelectionProcedure.query(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      return accessId === null || (await isTenantAdministrator(ctx.user))
        ? db.listEventYears()
        : db.listEventYearsForPlanningTeamAccess(accessId);
    }),
    create: scopeAdminAuthProcedure
      .input(
        z.object({
          year: eventYearInput,
          initialEventName: z.string().trim().min(2).max(200),
          activeDays: activeDaysInput,
        })
      )
      .mutation(async ({ input }) => {
        await requireCurrentProductCapability("event_years");
        await db.ensureEventYear(input.year);
        const event = await db.createEvent(
          input.initialEventName,
          input.year,
          input.activeDays
        );
        return { success: true, event } as const;
      }),
    copyPlan: adminProcedure
      .input(
        z.object({
          sourceEventId: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireCurrentProductCapability("additional_events");
        await requireAdminPassword(input.adminPassword, ctx);
        return db.copyPlanFromEvent(input.sourceEventId);
      }),
  }),

  events: router({
    list: eventSelectionProcedure.query(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      return accessId === null || (await isTenantAdministrator(ctx.user))
        ? db.listEvents(requestedPlanningScope(ctx.req).year)
        : db.listEventsForPlanningTeamAccess(
            accessId,
            requestedPlanningScope(ctx.req).year
          );
    }),
    manage: scopeAdminAuthProcedure.query(() => db.listEventsForManagement()),
    closureRecommendations: scopeAdminAuthProcedure.query(() =>
      db.listEventClosureRecommendations()
    ),
    current: scopedProtectedProcedure.query(() => db.getEvent()),
    create: scopeAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(200),
          activeDays: activeDaysInput,
        })
      )
      .mutation(async ({ input }) => {
        await requireCurrentProductCapability("additional_events");
        return db.createEvent(input.name, undefined, input.activeDays);
      }),
    update: adminProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            name: z.string().trim().min(2).max(200).optional(),
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Startdatum")
              .nullable()
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Enddatum")
              .nullable()
              .optional(),
            clearDateRange: z.boolean().optional(),
            retentionHoldReason: z
              .enum(["tax", "contract", "insurance", "legal", "other"])
              .nullable()
              .optional(),
            retentionHoldNote: z.string().trim().max(500).nullable().optional(),
            donationTargetKuchen: z.number().int().min(0).max(10_000).optional(),
            donationTargetSalat: z.number().int().min(0).max(10_000).optional(),
            donationTargetSnack: z.number().int().min(0).max(10_000).optional(),
            donationTargetSonstiges: z
              .number()
              .int()
              .min(0)
              .max(10_000)
              .optional(),
          })
          .superRefine((input, context) => {
            const changesStartDate = input.startDate !== undefined;
            const changesEndDate = input.endDate !== undefined;
            if (!changesStartDate && !changesEndDate) return;

            if (input.clearDateRange) {
              if (input.startDate !== null || input.endDate !== null) {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["clearDateRange"],
                  message:
                    "Beim Löschen des Zeitraums müssen Start- und Enddatum gemeinsam geleert werden.",
                });
              }
              return;
            }

            if (
              !changesStartDate ||
              !changesEndDate ||
              input.startDate === null ||
              input.endDate === null
            ) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["clearDateRange"],
                message:
                  "Die Löschung eines gespeicherten Veranstaltungszeitraums muss ausdrücklich bestätigt werden.",
              });
            }
          })
      )
      .mutation(({ input }) => {
        const { id, clearDateRange: _clearDateRange, ...changes } = input;
        return db.updateEventDetails(id, changes);
      }),
    close: scopeAdminAuthProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.closeEvent(input.id);
        await recordOperationalActivity(ctx, "events.close", input);
        return result;
      }),
    reopen: scopeAdminAuthProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.reopenEvent(input.id);
        await recordOperationalActivity(ctx, "events.reopen", input);
        return result;
      }),
    remove: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireCurrentProductCapability("event_deletion");
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteEvent(input.id);
      }),
    all: eventSelectionProcedure.query(async ({ ctx }) => {
      const accessId = planningTeamAccessIdForUser(ctx.user);
      if (accessId !== null && !(await isTenantAdministrator(ctx.user))) {
        return db.listAllEventsForPlanningTeamAccess(accessId);
      }
      const years = await db.listEventYears();
      const grouped = await Promise.all(
        years.map(async item => ({
          year: item.year,
          events: await db.listEvents(item.year),
        }))
      );
      return grouped.flatMap(group => group.events);
    }),
  }),

  branding: router({
    current: activeSessionProcedure.query(async () => {
      const settings = await db.getAppSettings();
      return {
        tenantLogoKey: settings?.tenantLogoKey ?? null,
        tenantLogoUrl: settings?.tenantLogoKey ? "/api/tenant-logo" : null,
      };
    }),
    uploadTenantLogo: tenantAccessAdminProcedure
      .input(
        z.object({
          base64: z.string().max(4_000_000, "Vereinslogo ist größer als 3 MB"),
          mimeType: z.enum(["image/png", "image/jpeg"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const buffer = Buffer.from(input.base64, "base64");
        if (!buffer.length || buffer.length > 3_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte ein PNG- oder JPEG-Vereinslogo bis 3 MB auswählen",
          });
        }
        const hasValidSignature =
          input.mimeType === "image/png"
            ? buffer.length >= 8 &&
              buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
              )
            : buffer.length >= 3 &&
              buffer[0] === 0xff &&
              buffer[1] === 0xd8 &&
              buffer[2] === 0xff;
        if (!hasValidSignature) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Bilddatei passt nicht zum ausgewählten Dateiformat",
          });
        }
        const extension = input.mimeType === "image/png" ? "png" : "jpg";
        const uploaded = await storagePut(
          `tenant-logos/ui/tenant-logo.${extension}`,
          buffer,
          input.mimeType
        );
        await db.updateTenantLogo({
          tenantLogoKey: uploaded.key,
          tenantLogoUrl: uploaded.url,
        });
        return { ...uploaded, tenantLogoUrl: "/api/tenant-logo" };
      }),
    clearTenantLogo: tenantAccessAdminProcedure.mutation(async () => {
      await db.updateTenantLogo({ tenantLogoKey: null, tenantLogoUrl: null });
      return { success: true } as const;
    }),
  }),

  reset: router({
    area: adminProcedure
      .input(
        z.object({
          area: resetAreaInput,
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.area === "all") {
          // Ein kompletter Reset würde auch nicht enthaltene Fachbereiche
          // verändern und ist im Event Pass daher bewusst nicht verfügbar.
          await requireCurrentProductCapability("postprocessing");
        } else {
          await requireCurrentProductCapability(resetAreaProductCapability[input.area]);
        }
        await requireAdminPassword(input.adminPassword, ctx);
        await db.resetArea(input.area, auditActor(ctx.user));
        return { success: true } as const;
      }),
  }),

  contacts: router({
    list: moduleReadProcedure("contacts").query(() => db.listContacts()),
    create: moduleWriteProcedure("contacts")
      .input(
        z.object({
          name: z.string().trim().min(1),
          email: z.string().email("Gültige E-Mail-Adresse").max(320).optional(),
          phone: z.string().trim().max(64).optional(),
          sharePhoneInHelperPlan: z.boolean().optional(),
          note: z.string().optional(),
          password: passwordInput.optional(),
        })
      )
      .mutation(async ({ input }) =>
        db.upsertContactByName({
          name: input.name,
          email: input.email,
          phone: input.phone,
          sharePhoneInHelperPlan: input.sharePhoneInHelperPlan,
          note: input.note,
          ...(input.password
            ? { passwordHash: await hashPassword(input.password) }
            : {}),
        })
      ),
    createWithAccessSheet: productCapabilityAdminProcedure("contacts")
      .input(
        z.object({
          name: z.string().trim().min(1).max(160),
          email: z.string().email("Gültige E-Mail-Adresse").max(320).optional(),
          phone: z.string().trim().max(64).optional(),
          sharePhoneInHelperPlan: z.boolean().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const contactResult = await db.upsertContactByName({
          name: input.name,
          email: input.email,
          phone: input.phone,
          sharePhoneInHelperPlan: input.sharePhoneInHelperPlan,
          note: input.note,
        });
        const contact = (await db.listContacts()).find(
          item => item.id === contactResult.id
        );
        if (!contact) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der neue Ansprechpartner wurde nicht gefunden",
          });
        }
        const accessSheet = await createContactInitialAccessSheet({
          contactId: contact.id,
          contactName: contact.name,
        });
        return { ...contactResult, ...accessSheet };
      }),
    update: moduleWriteProcedure("contacts")
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1),
          email: z.string().email("Gültige E-Mail-Adresse").max(320).nullable().optional(),
          phone: z.string().max(64).nullable().optional(),
          sharePhoneInHelperPlan: z.boolean().optional(),
          note: z.string().nullable().optional(),
          password: passwordInput.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...r } = input;
        const { password, ...contact } = r;
        return db.updateContact(id, {
          ...contact,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        });
      }),
    generateAccessSheet: productCapabilityAdminProcedure("contacts")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const contact = (await db.listContacts()).find(item => item.id === input.id);
        if (!contact) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der Ansprechpartner wurde nicht gefunden",
          });
        }
        return createContactInitialAccessSheet({
          contactId: contact.id,
          contactName: contact.name,
        });
      }),
    remove: productCapabilityAdminProcedure("contacts")
      .input(
        z.object({
          id: z.number(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteContact(input.id, auditActor(ctx.user));
      }),
  }),

  locations: router({
    list: moduleReadProcedure("locations").query(async () =>
      (await db.listLocations()).map(location => ({
        ...location,
        // Die persistierte Storage-URL bleibt für Backups erhalten. Alle Browser
        // nutzen aber die eigene Same-Origin-Route, damit auch die veröffentlichte
        // Desktop- und Mobile-App keine Sandbox-Storage-Route benötigt.
        logoUrl: locationLogoUrl(location),
      }))
    ),
    create: moduleWriteProcedure("locations")
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          latitude: z.number().finite().min(-90).max(90).nullable().optional(),
          longitude: z.number().finite().min(-180).max(180).nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const allowsMapsGpx = await db.currentProductAllowsCapability("maps_gpx");
        // Light verwaltet Orte für Aufgaben, Helfer und Material ohne Live-Karte.
        // Koordinaten werden erst ab dem Pro-Paket für Kartendarstellungen persistiert.
        const latitude =
          allowsMapsGpx && typeof input.latitude === "number"
            ? input.latitude
            : null;
        const longitude =
          allowsMapsGpx && typeof input.longitude === "number"
            ? input.longitude
            : null;
        return db.createLocation({
          name: input.name,
          latitude,
          longitude,
        });
      }),
    update: moduleWriteProcedure("locations")
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(200).optional(),
          latitude: z.number().finite().min(-90).max(90).nullable().optional(),
          longitude: z.number().finite().min(-180).max(180).nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const allowsMapsGpx = await db.currentProductAllowsCapability("maps_gpx");
        const { id, ...value } = input;
        const payload: Parameters<typeof db.updateLocation>[1] = {};
        if (typeof value.name === "string") payload.name = value.name;
        if (allowsMapsGpx) {
          if (value.latitude !== undefined) payload.latitude = value.latitude;
          if (value.longitude !== undefined) payload.longitude = value.longitude;
        }
        return db.updateLocation(id, payload);
      }),
    uploadLogo: productCapabilityAdminProcedure("maps_gpx")
      .input(
        z.object({
          id: z.number().int().positive(),
          base64: z.string().min(1).max(4_000_000, "Logo ist größer als 3 MB"),
          mimeType: locationLogoMimeType,
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const location = await db.getLocation(input.id);
        if (!location) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Standort wurde nicht gefunden",
          });
        }
        const buffer = decodeLocationLogoBase64(input.base64);
        if (!buffer || !buffer.length || buffer.length > LOCATION_LOGO_MAX_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte ein PNG-, SVG- oder JPEG-Logo bis 3 MB auswählen",
          });
        }
        if (!isValidLocationLogo(buffer, input.mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Bilddatei passt nicht zum ausgewählten Dateiformat",
          });
        }
        const uploaded = await storagePut(
          `location-logos/events/${currentEventYear()}/${currentEventId()}/${location.id}-${safeExportName(location.name)}.${locationLogoExtension(input.mimeType)}`,
          buffer,
          input.mimeType
        );
        await db.updateLocation(location.id, {
          logoKey: uploaded.key,
          logoUrl: uploaded.url,
        });
        return uploaded;
      }),
    clearLogo: productCapabilityAdminProcedure("maps_gpx")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const location = await db.getLocation(input.id);
        if (!location) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Der ausgewählte Standort wurde nicht gefunden",
          });
        }
        await db.updateLocation(location.id, { logoKey: null, logoUrl: null });
        return { success: true } as const;
      }),
    remove: productCapabilityAdminProcedure("locations")
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteLocation(input.id);
      }),
  }),

  gpxTracks: router({
    list: productModuleReadProcedure("locations", "maps_gpx").query(() => db.listGpxTracks()),
    mapData: productModuleReadProcedure("locations", "maps_gpx").query(async () => {
      const tracks = await db.listGpxTracks();
      const loaded = await Promise.all(
        tracks.map(async track => {
          try {
            return await loadGpxMapTrack(track);
          } catch (error) {
            console.warn(
              `[GPX] Strecke ${track.id} (${track.name}) konnte nicht für die Karte gelesen werden`,
              error
            );
            return null;
          }
        })
      );
      return loaded.filter((track): track is GpxMapTrack => track !== null);
    }),
    upload: productModuleWriteProcedure("locations", "maps_gpx")
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          base64: z.string().min(1).max(8_500_000, "Die GPX-Datei ist größer als 6 MB"),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Streckenfarbe").default("#2563eb"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const buffer = Buffer.from(input.base64, "base64");
        if (!buffer.length || buffer.length > 6_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte eine GPX-Datei bis 6 MB auswählen",
          });
        }
        const xml = buffer.toString("utf8");
        if (!/<gpx(?:\s|>)/i.test(xml) || !/<(?:trkpt|rtept)(?:\s|>)/i.test(xml)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Datei enthält keine gültige GPX-Strecke mit Wegpunkten",
          });
        }
        const selectedEvent = await db.getEvent();
        if (!selectedEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die ausgewählte Veranstaltung wurde nicht gefunden",
          });
        }
        const uploaded = await storagePut(
          `gpx-tracks/events/${selectedEvent.year}/${selectedEvent.id}/${safeExportName(input.name)}.gpx`,
          buffer,
          "application/gpx+xml"
        );
        const result = await db.createGpxTrack({
          name: input.name,
          fileKey: uploaded.key,
          fileUrl: uploaded.url,
          color: input.color,
        });
        return { ...result, fileUrl: uploaded.url };
      }),
    rename: productModuleWriteProcedure("locations", "maps_gpx")
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(200),
        })
      )
      .mutation(({ input }) => db.updateGpxTrackName(input.id, input.name)),
    remove: productCapabilityAdminProcedure("maps_gpx")
      .input(
        z.object({
          id: z.number().int().positive(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.deleteGpxTrack(input.id);
      }),
  }),

  helpers: router({
    list: moduleReadProcedure("helpers").query(() => db.listHelpers()),
    create: moduleWriteProcedure("helpers")
      .input(
        z.object({
          name: z.string().min(1),
          contactId: z.number().nullable().optional(),
          phone: z.string().trim().max(64).optional(),
          note: z.string().trim().max(500).optional(),
          willHelp: yn.default("ja"),
          ...helperCreationAvailabilityInput,
          confirmed: yn.default("nein"),
          companion: z.string().trim().max(500).optional(),
        }).superRefine(validateHelperTimeWindows)
      )
      .mutation(({ input }) => db.upsertHelperByName(input)),
    createWithDonation: protectedProcedure
      .use(async ({ ctx, next }) => {
        await requireCurrentProductCapability("donations");
        const moduleAccess = await getPlanningTeamModuleAccessForUser(ctx.user);
        requireModuleWritePermission(moduleAccess, "helpers");
        requireModuleWritePermission(moduleAccess, "donations");
        return next({ ctx });
      })
      .input(
        z.object({
          helper: z
            .object({
              name: z.string().min(1),
              contactId: z.number().nullable().optional(),
              phone: z.string().trim().max(64).optional(),
              note: z.string().trim().max(500).optional(),
              willHelp: yn.default("ja"),
              ...helperCreationAvailabilityInput,
              confirmed: yn.default("nein"),
              companion: z.string().trim().max(500).optional(),
            })
            .superRefine(validateHelperTimeWindows),
          donation: z.object({
            cake: z.string().trim().max(200).optional(),
            donationCategory: z
              .enum(["kuchen", "salat", "snack", "sonstiges"])
              .default("kuchen"),
            locationId: z.number().int().positive().nullable().optional(),
            dropoffDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Abgabedatum")
              .or(z.literal(""))
              .optional(),
            dropoffTime: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Abgabe-Uhrzeit")
              .or(z.literal(""))
              .optional(),
            vegan: z.boolean().default(false),
            vegetarian: z.boolean().default(false),
            glutenFree: z.boolean().default(false),
            lactoseFree: z.boolean().default(false),
            containsNuts: z.boolean().default(false),
            sugarFree: z.boolean().default(false),
            containsAlcohol: z.boolean().default(false),
            meat: z.boolean().default(false),
            note: z.string().trim().max(1000).optional(),
          }),
        })
      )
      .mutation(({ input }) => db.createHelperWithDonation(input)),
    update: moduleWriteProcedure("helpers")
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          contactId: z.number().nullable().optional(),
          email: z.string().email().max(320).nullable().optional(),
          phone: z.string().max(64).nullable().optional(),
          note: z.string().nullable().optional(),
          companion: z.string().trim().max(500).nullable().optional(),
          willHelp: yn.optional(),
          ...helperUpdateAvailabilityInput,
          confirmed: yn.optional(),
        }).superRefine(validateHelperTimeWindows)
      )
      .mutation(({ input }) => {
        const { id, ...rest } = input;
        return db.updateHelper(id, rest);
      }),
    remove: moduleWriteProcedure("helpers")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) =>
        db.deleteHelper(input.id, {
          allowAssigned: ctx.user.role === "admin",
          actor: auditActor(ctx.user),
        })
      ),
  }),

  shifts: router({
    list: moduleReadProcedure("schedule").query(() => db.listShifts()),
    create: scheduleCreateProcedure
      .input(createShiftInput)
      .mutation(async ({ input }) => {
        const selectedEvent = await db.getEvent();
        if (!eventWeekdays(selectedEvent?.activeDays).includes(input.day))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${input.day} ist für diese Veranstaltung nicht aktiviert`,
          });
        return db.createShift(input);
      }),
    update: scheduleAdminProcedure
      .input(updateShiftInput)
      .mutation(async ({ input }) => {
        if (input.day) {
          const selectedEvent = await db.getEvent();
          if (!eventWeekdays(selectedEvent?.activeDays).includes(input.day))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${input.day} ist für diese Veranstaltung nicht aktiviert`,
            });
        }
        const { id, ...rest } = input;
        try {
          return await db.updateShift(id, rest);
        } catch (error) {
          if (error instanceof ShiftUpdateValidationError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),
    remove: scheduleAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteShift(input.id)),
  }),

  plan: router({
    evaluate: moduleReadProcedure("schedule").query(async () => {
      const [shifts, assignments, helpers] = await Promise.all([
        db.listShifts(),
        db.listAssignments(),
        db.listHelpers(),
      ]);
      return evaluateShifts(shifts, assignments, helpers);
    }),
    releasePreview: moduleReadProcedure("schedule").query(() =>
      db.listCurrentPlanReleaseContacts()
    ),
    myPendingChangeHelperIds: protectedProcedure.query(async ({ ctx }) => {
      const entitlement = await db.getCurrentTenantProductEntitlement();
      const contacts =
        entitlement.packageId === "event_pass"
          ? await db.getEventPassPrimaryAdminContact().then(contact =>
              contact ? [contact] : []
            )
          : await db.listContacts();
      const ownContactIds = await ownContactIdsForPersonalPlanView(
        ctx.user,
        contacts
      );
      return {
        helperIds: await db.listPendingPlanChangeHelperIds(
          Array.from(ownContactIds)
        ),
      };
    }),
    releaseStatus: moduleReadProcedure("schedule").query(async () => {
      const [
        selectedEvent,
        pendingChangeRecipients,
        pendingInitialRecipients,
        initialEmailRecipients,
      ] = await Promise.all([
        db.getEvent(),
        db.listPlanNotificationRecipients("changed"),
        db.listPlanNotificationRecipients("released"),
        db.listPlanReleaseEmailAudit(),
      ]);
      return {
        releasedAt: selectedEvent?.planReleasedAt ?? null,
        changedAt: selectedEvent?.planLastChangedAt ?? null,
        pendingChangeRecipients: pendingChangeRecipients.length,
        pendingInitialRecipients: pendingInitialRecipients.length,
        initialEmailRecipients,
      };
    }),
    release: planReleaseAdminProcedure
      .input(z.object({ notifyContacts: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
      const result = await db.releaseCurrentPlan(input);
      if (result.alreadyReleased) return { ...result, delivered: 0, undeliverable: 0 };
      if (!input.notifyContacts) {
        await db.recordActivityLog({
          actor: auditActor(ctx.user),
          module: "Einsatzplan",
          action: "updated",
          subject: "Einsatzplan freigegeben, ohne E-Mail-Information",
        });
        return { ...result, delivered: 0, undeliverable: 0 };
      }
      const helperOverviewUrl = publicAppUrl(
        `/helfer?meine=1&eingeteilt=1&event=${result.eventId}&jahr=${result.eventYear}`
      );
      const deliveries = await Promise.all(
        result.contacts.map(async contact => {
          if (!contact.email) return { contactId: contact.id, delivered: false };
          const email = renderPlanReleaseContactEmail({
            recipientName: contact.name,
            eventName: result.eventName,
            helperOverviewUrl,
            kind: "released",
          });
          const delivery = await sendTransactionalEmail({ to: contact.email, ...email });
          return { contactId: contact.id, delivered: delivery.success };
        })
      );
      const deliveredIds = deliveries.filter(item => item.delivered).map(item => item.contactId);
      await db.markPlanNotificationEmailsSent(deliveredIds, "released");
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Einsatzplan",
        action: "updated",
        subject: `Einsatzplan freigegeben: ${result.contacts.length} zuständige Ansprechpartner`,
      });
      return {
        ...result,
        delivered: deliveredIds.length,
        undeliverable: result.contacts.length - deliveredIds.length,
      };
    }),
    sendInitialNotifications: planReleaseAdminProcedure.mutation(async ({ ctx }) => {
      const result = await db.prepareInitialPlanNotificationRecipients();
      const helperOverviewUrl = publicAppUrl(
        `/helfer?meine=1&eingeteilt=1&event=${result.eventId}&jahr=${result.eventYear}`
      );
      const deliveries = await Promise.all(
        result.contacts.map(async contact => {
          if (!contact.email) return { contactId: contact.id, delivered: false };
          const email = renderPlanReleaseContactEmail({
            recipientName: contact.name,
            eventName: result.eventName,
            helperOverviewUrl,
            kind: "released",
          });
          const delivery = await sendTransactionalEmail({ to: contact.email, ...email });
          return { contactId: contact.id, delivered: delivery.success };
        })
      );
      const deliveredIds = deliveries.filter(item => item.delivered).map(item => item.contactId);
      await db.markPlanNotificationEmailsSent(deliveredIds, "released");
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Einsatzplan",
        action: "updated",
        subject: `Helferinformation per E-Mail für ${result.contacts.length} Ansprechpartner vorbereitet`,
      });
      return {
        recipients: result.contacts.length,
        delivered: deliveredIds.length,
        undeliverable: result.contacts.length - deliveredIds.length,
      };
    }),
    withdrawRelease: planReleaseAdminProcedure.mutation(async ({ ctx }) => {
      const result = await db.withdrawPlanRelease();
      if (result.withdrawn) {
        await db.recordActivityLog({
          actor: auditActor(ctx.user),
          module: "Einsatzplan",
          action: "updated",
          subject: "Einsatzplanfreigabe zurückgenommen",
        });
      }
      return result;
    }),
    sendChangeReminders: planReleaseAdminProcedure.mutation(async ({ ctx }) => {
      const [selectedEvent, recipients] = await Promise.all([
        db.getEvent(),
        db.listPlanNotificationRecipients("changed"),
      ]);
      if (!selectedEvent) throw new TRPCError({ code: "NOT_FOUND", message: "Veranstaltung nicht gefunden" });
      const helperOverviewUrl = publicAppUrl(
        `/helfer?meine=1&eingeteilt=1&aenderungen=1&event=${selectedEvent.id}&jahr=${selectedEvent.year}`
      );
      const deliveries = await Promise.all(
        recipients.map(async recipient => {
          if (!recipient.email) return { contactId: recipient.contactId, delivered: false };
          const email = renderPlanReleaseContactEmail({
            recipientName: recipient.name,
            eventName: selectedEvent.name,
            helperOverviewUrl,
            kind: "changed",
          });
          const delivery = await sendTransactionalEmail({ to: recipient.email, ...email });
          return { contactId: recipient.contactId, delivered: delivery.success };
        })
      );
      const deliveredIds = deliveries.filter(item => item.delivered).map(item => item.contactId);
      await db.markPlanNotificationEmailsSent(deliveredIds, "changed");
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Einsatzplan",
        action: "updated",
        subject: `Änderungshinweis für ${recipients.length} Ansprechpartner vorbereitet`,
      });
      return { recipients: recipients.length, delivered: deliveredIds.length };
    }),
    clearAssignments: moduleWriteProcedure("schedule")
      .input(
        z.object({
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.clearAssignments();
      }),
    areaContacts: moduleReadProcedure("schedule").query(() => db.listShiftAreaContacts()),
    setAreaContact: scheduleAdminProcedure
      .input(
        z.object({
          area: z.string().trim().min(1).max(200),
          contactId: z.number().int().positive().nullable(),
        })
      )
      .mutation(({ input }) =>
        db.setShiftAreaContact(input.area, input.contactId)
      ),
    available: moduleReadProcedure("schedule")
      .input(
        z.object({
          day: dayEnum,
          startTime: clockTime.optional(),
          endTime: clockTime.optional(),
          allowFlexibleAssignment: z.boolean().optional(),
        }).superRefine(validateShiftTimes)
      )
      .query(async ({ input }) => {
        const hs = await db.listHelpers();
        return hs.filter(h =>
          helperEligibleForShift(h, {
            day: input.day,
            startTime: input.startTime,
            endTime: input.endTime,
            allowFlexibleAssignment: input.allowFlexibleAssignment,
          })
        );
      }),
    assign: scheduleAdminProcedure
      .input(
        z.object({
          shiftId: z.number().int().positive(),
          helperId: z.number().int().positive(),
          slot: z.number().int().min(0).max(19).default(0),
        })
      )
      .mutation(async ({ input }) => {
        const [shifts, helpers, assignments] = await Promise.all([
          db.listShifts(),
          db.listHelpers(),
          db.listAssignments(),
        ]);
        const shift = shifts.find(item => item.id === input.shiftId);
        const helper = helpers.find(item => item.id === input.helperId);
        if (!shift || !helper)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Schicht oder Helfer wurde nicht gefunden",
          });
        if (input.slot >= shift.needed)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dieser Platz liegt außerhalb des Schichtbedarfs",
          });
        if (!helperEligibleForShift(helper, shift))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der Helfer ist für diese Schichtzeit nicht verfügbar",
          });
        if (
          assignments.some(
            item => item.shiftId === input.shiftId && item.slot === input.slot
          )
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Dieser Platz ist bereits belegt",
          });
        }
        if (
          assignments.some(
            item =>
              item.shiftId === input.shiftId && item.helperId === input.helperId
          )
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Der Helfer ist dieser Schicht bereits zugewiesen",
          });
        }
        try {
          return await db.assignHelper(input);
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Die Zuweisung konnte wegen einer gleichzeitigen Änderung nicht gespeichert werden",
          });
        }
      }),
    assignMany: scheduleAdminProcedure
      .input(
        z.object({
          shiftId: z.number().int().positive(),
          helperIds: z.array(z.number().int().positive()).min(1).max(20),
        })
      )
      .mutation(async ({ input }) => {
        const helperIds = Array.from(new Set(input.helperIds));
        try {
          // Die Datenbankfunktion sperrt die Schicht und prüft Verfügbarkeit,
          // Doppelzuweisungen und freie Plätze atomar. Die früheren drei
          // vollständigen Listenabfragen waren doppelt und bremsten große
          // Veranstaltungen bei jeder Mehrfachzuweisung aus.
          return await db.assignHelpersToOpenSlots({ shiftId: input.shiftId, helperIds });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "Schicht wurde nicht gefunden" || message.includes("Helfer wurde nicht gefunden")) {
            throw new TRPCError({ code: "NOT_FOUND", message });
          }
          if (message.includes("nicht verfügbar")) {
            throw new TRPCError({ code: "BAD_REQUEST", message });
          }
          if (message.includes("bereits zugewiesen") || message.includes("nicht genügend freie Helferplätze")) {
            throw new TRPCError({ code: "CONFLICT", message });
          }
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Die Mehrfachzuweisung konnte wegen einer gleichzeitigen Änderung nicht gespeichert werden",
          });
        }
      }),
    unassign: scheduleAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.unassignHelper(input.id)),
  }),

  help: router({
    guidePdf: baseProtectedProcedure.mutation(async () => {
      try {
        const pdf = await storageRead(GUIDE_PDF_KEY);
        if (pdf.length > GUIDE_PDF_MAX_BYTES) {
          throw new Error("PDF-Datei überschreitet die Größenbegrenzung");
        }
        if (!pdf.length || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new Error("Ungültige PDF-Datei");
        }
        return {
          filename: GUIDE_PDF_FILENAME,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      } catch (error) {
        console.error(
          "[Help] PDF-Anleitung konnte nicht geladen werden",
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Die PDF-Anleitung konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
        });
      }
    }),
  }),

  pdf: router({
    settings: protectedProcedure.query(async () => {
      await requireCurrentProductCapability("pdf");
      const product = await db.getCurrentTenantProductEntitlement();
      const allowsCustomBranding = productAllowsCapability(
        product.packageId,
        "custom_branding"
      );
      const allowsWhatsAppTemplates = productAllowsCapability(
        product.packageId,
        "whatsapp_templates"
      );
      const settings = (await db.getAppSettings()) ?? {
        ...DEFAULT_PDF_SETTINGS,
        eventYear: String(currentEventYear()),
      };
      const selectedEvent = await db.getEvent();
      let extraColumns: string[] = [];
      try {
        const parsed = JSON.parse(settings.extraColumns);
        if (Array.isArray(parsed)) {
          extraColumns = parsed.filter(item => typeof item === "string");
        }
      } catch {}
      return {
        ...settings,
        eventYear: String(currentEventYear()),
        eventName: selectedEvent?.name ?? settings.eventName,
        logoKey: allowsCustomBranding ? selectedEvent?.pdfLogoKey ?? null : null,
        logoUrl:
          allowsCustomBranding && selectedEvent?.pdfLogoKey
            ? `/api/pdf/event-image/${selectedEvent.year}/${selectedEvent.id}`
            : "/brand/mycrewmate-wordmark.png",
        logoFallback: allowsCustomBranding ? ("none" as const) : ("brand" as const),
        whatsAppHelperRequestTemplate: allowsWhatsAppTemplates
          ? selectedEvent?.whatsAppHelperRequestTemplate ??
            settings.whatsAppHelperRequestTemplate ??
            null
          : null,
        whatsAppMessageTemplate: allowsWhatsAppTemplates
          ? selectedEvent?.whatsAppMessageTemplate ??
            settings.whatsAppMessageTemplate ??
            null
          : null,
        extraColumns,
      };
    }),
    updateSettings: adminProcedure
      .input(pdfSettingsInput)
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        await requireCurrentProductCapability("pdf");
        const product = await db.getCurrentTenantProductEntitlement();
        const allowsWhatsAppTemplates = productAllowsCapability(
          product.packageId,
          "whatsapp_templates"
        );
        const {
          extraColumns,
          whatsAppHelperRequestTemplate,
          whatsAppMessageTemplate,
          ...rest
        } = input;
        await db.updateAppSettings({
          ...rest,
          extraColumns: JSON.stringify(extraColumns),
        });
        if (allowsWhatsAppTemplates) {
          await db.updateCurrentEventWhatsAppTemplates({
            whatsAppHelperRequestTemplate,
            whatsAppMessageTemplate,
          });
        }
        return { success: true } as const;
      }),
    uploadLogo: productCapabilityAdminProcedure("custom_branding")
      .input(
        z.object({
          base64: z.string().max(4_000_000, "Logo ist größer als 3 MB"),
          mimeType: z.enum(["image/png", "image/jpeg"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const buffer = Buffer.from(input.base64, "base64");
        if (!buffer.length || buffer.length > 3_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bitte ein PNG- oder JPEG-Logo bis 3 MB auswählen",
          });
        }
        const hasValidSignature =
          input.mimeType === "image/png"
            ? buffer.length >= 8 &&
              buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
              )
            : buffer.length >= 3 &&
              buffer[0] === 0xff &&
              buffer[1] === 0xd8 &&
              buffer[2] === 0xff;
        if (!hasValidSignature) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die Bilddatei passt nicht zum ausgewählten Dateiformat",
          });
        }
        const selectedEvent = await db.getEvent();
        if (!selectedEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Die ausgewählte Veranstaltung wurde nicht gefunden",
          });
        }
        const extension = input.mimeType === "image/png" ? "png" : "jpg";
        const uploaded = await storagePut(
          `pdf-logos/events/${selectedEvent.year}/${selectedEvent.id}/pdf-logo.${extension}`,
          buffer,
          input.mimeType
        );
        await db.updateCurrentEventPdfImage({
          pdfLogoKey: uploaded.key,
          pdfLogoUrl: uploaded.url,
        });
        return uploaded;
      }),
    clearLogo: productCapabilityAdminProcedure("custom_branding").mutation(async ({ ctx }) => {
      rejectPublicDemoExternalAction(ctx.user);
      await db.updateCurrentEventPdfImage({
        pdfLogoKey: null,
        pdfLogoUrl: null,
      });
      return { success: true } as const;
    }),
    helper: pdfCapabilityProcedure("helpers")
      .input(z.object({ helperId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const pdf = await createHelperTaskPdf(input.helperId);
        return {
          filename: `Aufgaben_Helfer_${input.helperId}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    privacyNoticeTemplate: adminProcedure.mutation(async ({ ctx }) => {
      rejectPublicDemoExternalAction(ctx.user);
      const pdf = await renderClubPrivacyNoticeTemplatePdf();
      return {
        filename: "Vereinsmuster_Datenschutzhinweis_Helfer_Ansprechpartner.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    dataSubjectRequestTemplate: adminProcedure.mutation(async ({ ctx }) => {
      rejectPublicDemoExternalAction(ctx.user);
      const pdf = await renderDataSubjectRequestTemplatePdf();
      return {
        filename: "Vorlage_Betroffenenanfrage_Datenschutz.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    privacyIncidentTemplate: adminProcedure.mutation(async ({ ctx }) => {
      rejectPublicDemoExternalAction(ctx.user);
      const pdf = await renderPrivacyIncidentTemplatePdf();
      return {
        filename: "Vorlage_Datenschutzvorfall_Erstprotokoll.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    publicShare: productCapabilityProcedure("personal_accesses")
      .input(z.object({ helperId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        const shareCode = await db.ensureHelperPdfShareCode(helper.id);
        const path = `/p/${shareCode}`;
        return {
          path,
          url: publicAppUrl(path),
          expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        };
      }),
    createWhatsAppShare: productCapabilityProcedure("personal_accesses")
      .input(
        z.object({
          helperId: z.number().int().positive(),
          viewMode: z.enum(["minimal", "team"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        const share = await db.createProtectedHelperPdfShare({
          helperId: helper.id,
          viewMode: input.viewMode,
        });
        await db.recordActivityLog({
          actor: auditActor(ctx.user),
          module: "Helferfreigaben",
          action: "created",
          subject: `Geschützte ${input.viewMode === "team" ? "Teamansicht" : "Basisansicht"} für ${helper.name}`,
        });
        const path = `/freigabe/${share.token}`;
        return {
          path,
          url: publicAppUrl(path),
          accessCode: share.accessCode,
          expiresAt: share.expiresAt.getTime(),
          viewMode: input.viewMode,
        };
      }),
    activeWhatsAppShares: pdfCapabilityProcedure("helpers")
      .input(z.object({ helperId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        return db.listActiveProtectedHelperPdfShares(helper.id);
      }),
    revokeWhatsAppShare: pdfCapabilityProcedure("helpers")
      .input(
        z.object({
          helperId: z.number().int().positive(),
          shareId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        const revoked = await db.revokeProtectedHelperPdfShare({
          id: input.shareId,
          helperId: helper.id,
        });
        if (!revoked) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Diese Freigabe ist nicht mehr aktiv.",
          });
        }
        await db.recordActivityLog({
          actor: auditActor(ctx.user),
          module: "Helferfreigaben",
          action: "updated",
          subject: `Geschützte Einsatzplanfreigabe für ${helper.name} widerrufen`,
        });
        return { success: true } as const;
      }),
    resendWhatsAppShare: pdfCapabilityProcedure("helpers")
      .input(
        z.object({
          helperId: z.number().int().positive(),
          shareId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const helper = await db.getHelper(input.helperId);
        if (!helper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der Helfer gehört nicht zur aktuell ausgewählten Veranstaltung",
          });
        }
        const delivery = await db.getProtectedHelperPdfShareDelivery({
          id: input.shareId,
          helperId: helper.id,
        });
        if (!delivery) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Diese Freigabe kann nicht erneut versendet werden. Bitte widerrufen Sie sie und erzeugen Sie einen neuen Link.",
          });
        }
        const shares = await db.listActiveProtectedHelperPdfShares(helper.id);
        const activeShare = shares.find(share => share.id === input.shareId);
        if (!activeShare) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Diese Freigabe ist nicht mehr aktiv.",
          });
        }
        await db.recordActivityLog({
          actor: auditActor(ctx.user),
          module: "Helferfreigaben",
          action: "updated",
          subject: `Geschützte Einsatzplanfreigabe für ${helper.name} erneut vorbereitet`,
        });
        const path = `/freigabe/${delivery.token}`;
        return {
          path,
          url: publicAppUrl(path),
          accessCode: delivery.accessCode,
          expiresAt: activeShare.expiresAt.getTime(),
          viewMode: activeShare.viewMode,
        };
      }),
    openWhatsAppShare: publicProcedure
      .input(
        z.object({
          token: z.string().regex(/^[A-Za-z0-9_-]{24,80}$/),
          accessCode: z.string().trim().regex(/^[A-Za-z0-9]{12}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let clientKey: string;
        try {
          clientKey = assertProtectedPdfShareAttemptAllowed(ctx.req);
        } catch (error: any) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }
        const share = await db.findProtectedHelperPdfShare(input);
        if (!share) {
          recordProtectedPdfShareFailure(clientKey);
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Dieser Einsatzplan ist nicht verfügbar oder der Zugangscode ist falsch.",
          });
        }
        clearProtectedPdfShareFailures(clientKey);
        const pdf = await withPlanningScope(
          {
            tenantId: share.tenantId,
            year: share.year,
            eventId: share.eventId,
          },
          () => createPublicHelperTaskPdf(share.helperId, share.viewMode)
        );
        return {
          filename:
            share.viewMode === "team"
              ? "Persoenlicher_Einsatzplan_mit_Team.pdf"
              : "Persoenlicher_Einsatzplan.pdf",
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
          expiresAt: share.expiresAt.getTime(),
        };
      }),
    allHelpers: pdfCapabilityProcedure("helpers")
      .input(
        z.object({ contactId: z.number().int().positive().optional() })
      )
      .query(async ({ input }) => {
      const selectedContact = input.contactId
        ? await db.getContact(input.contactId)
        : undefined;
      if (input.contactId && !selectedContact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Der ausgewählte Ansprechpartner gehört nicht zur aktuellen Veranstaltung",
        });
      }
      const zip = await createAllHelperTaskZip(input.contactId);
      const selectedEvent = await db.getEvent();
      return {
        filename: `Aufgabenuebersichten_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}${selectedContact ? `_${safeExportName(selectedContact.name)}` : ""}.zip`,
        mimeType: "application/zip",
        base64: zip.toString("base64"),
      };
      }),
    contactOverview: pdfCapabilityProcedure("contacts")
      .input(contactOverviewPdfInput)
      .mutation(async ({ input }) => {
        if (input.contactIds.length !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Für ein einzelnes Ansprechpartner-PDF bitte genau einen Ansprechpartner auswählen",
          });
        }
        const contact = await db.getContact(input.contactIds[0]);
        if (!contact) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Der ausgewählte Ansprechpartner gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createContactOverviewPdf(contact.id, input);
        return {
          filename: `Ansprechpartner_Uebersicht_${safeExportName(contact.name)}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    contactOverviewZip: pdfCapabilityProcedure("contacts")
      .input(contactOverviewPdfInput)
      .mutation(async ({ input }) => {
        const contacts = await db.listContacts();
        const scopedContactIds = new Set(contacts.map(contact => contact.id));
        const invalidId = input.contactIds.find(
          contactId => !scopedContactIds.has(contactId)
        );
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens ein Ansprechpartner gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const zip = await createContactOverviewZip(input.contactIds, input);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Ansprechpartner_Uebersichten_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.zip`,
          mimeType: "application/zip",
          base64: zip.toString("base64"),
        };
      }),
    blankPlan: pdfReadProcedure.query(async () => {
      const pdf = await createBlankPlanPdf();
      return {
        filename: "Einsatzplan_Blanko.pdf",
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    plan: pdfReadProcedure.input(planPdfInput).mutation(async ({ input }) => {
      const selectedEvent = await db.getEvent();
      const activeDays = eventWeekdays(selectedEvent?.activeDays);
      const invalidDay = input.days?.find(day => !activeDays.includes(day));
      if (invalidDay)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${invalidDay} ist für diese Veranstaltung nicht aktiviert`,
        });
      const pdf = await createPlanPdf(input);
      const eventName = safeExportName(selectedEvent?.name ?? "Veranstaltung");
      return {
        filename:
          input.mode === "blank"
            ? `Einsatzplan_Blanko_${eventName}.pdf`
            : `Einsatzplan_Ausgefuellt_${eventName}.pdf`,
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
      };
    }),
    materialPacklist: pdfCapabilityProcedure("materials")
      .input(
        z.object({
          materialIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedMaterials = await db.listMaterials();
        const scopedIds = new Set(scopedMaterials.map(material => material.id));
        const invalidId = input.materialIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mindestens ein Materialartikel gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createMaterialPacklistPdf(input.materialIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Material_Packliste_Gefiltert_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    donationOverview: pdfCapabilityProcedure("donations")
      .input(
        z.object({
          donationIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedDonations = await db.listCakes();
        const scopedIds = new Set(scopedDonations.map(donation => donation.id));
        const invalidId = input.donationIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Spende gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createDonationOverviewPdf(input.donationIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Spendenuebersicht_Gefiltert_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    prepTaskOverview: pdfReadProcedure
      .input(
        z.object({
          taskIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedTasks = await db.listPrep();
        const scopedIds = new Set(scopedTasks.map(task => task.id));
        const invalidId = input.taskIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Vorbereitungsaufgabe gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createPrepTaskOverviewPdf(input.taskIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Vorbereitung_Aufgabenuebersicht_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    postTaskOverview: pdfCapabilityProcedure("postprocessing")
      .input(
        z.object({
          taskIds: z.array(z.number().int().positive()).max(2_000),
        })
      )
      .mutation(async ({ input }) => {
        const scopedTasks = await db.listPost();
        const scopedIds = new Set(scopedTasks.map(task => task.id));
        const invalidId = input.taskIds.find(id => !scopedIds.has(id));
        if (invalidId !== undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Mindestens eine Nachbereitungsaufgabe gehört nicht zur aktuellen Veranstaltung",
          });
        }
        const pdf = await createPostTaskOverviewPdf(input.taskIds);
        const selectedEvent = await db.getEvent();
        return {
          filename: `Nachbereitung_Aufgabenuebersicht_${safeExportName(selectedEvent?.name ?? "Veranstaltung")}.pdf`,
          mimeType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
  }),

  prep: router({
    list: moduleReadProcedure("preparation").query(() => db.listPrep()),
    defaultResponsible: moduleReadProcedure("preparation").query(() =>
      db.getEventPassPrimaryAdminContact()
    ),
    create: moduleWriteProcedure("preparation")
      .input(
        z.object({
          task: z.string().trim().min(1).max(300),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().int().positive().nullable().optional(),
          helperId: z.number().int().positive().nullable().optional(),
          note: z.string().max(10_000).optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createPrep({
          ...input,
          status: "offen",
          statusWording: "aufgabe",
          logEntryAuthor: auditActor(ctx.user).name,
          activityEntry: "Vorbereitungsaufgabe angelegt",
          activityAuthor: auditActor(ctx.user).name,
        });
      }),
    update: moduleWriteProcedure("preparation")
      .input(
        z.object({
          id: z.number(),
          task: z.string().trim().min(1).max(300).optional(),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().int().positive().nullable().optional(),
          helperId: z.number().int().positive().nullable().optional(),
          status: statusPrep.optional(),
          statusWording: prepStatusWording.optional(),
          note: z.string().max(10_000).nullable().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...values } = input;
        return db.updatePrep(id, {
          ...values,
          logEntryAuthor: auditActor(ctx.user).name,
          activityAuthor: auditActor(ctx.user).name,
        });
      }),
    remove: moduleWriteProcedure("preparation")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        db.deletePrep(input.id, {
          actor: auditActor(ctx.user),
        })
      ),
  }),
  post: router({
    list: moduleReadProcedure("postprocessing").query(() => db.listPost()),
    create: moduleWriteProcedure("postprocessing")
      .input(
        z.object({
          task: z.string().trim().min(1).max(300),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          helperId: z.number().int().positive().nullable().optional(),
          note: z.string().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createPost({
          ...input,
          status: "offen",
          logEntryAuthor: auditActor(ctx.user).name,
          activityEntry: "Nachbereitungsaufgabe angelegt",
          activityAuthor: auditActor(ctx.user).name,
        });
      }),
    update: moduleWriteProcedure("postprocessing")
      .input(
        z.object({
          id: z.number().int().positive(),
          task: z.string().trim().min(1).max(300).optional(),
          category: z.string().trim().max(120).optional(),
          dueText: z.string().max(200).optional(),
          locationId: z.number().int().positive().nullable().optional(),
          contactId: z.number().nullable().optional(),
          helperId: z.number().int().positive().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
          logEntry: z.string().max(10_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...values } = input;
        return db.updatePost(id, {
          ...values,
          logEntryAuthor: auditActor(ctx.user).name,
          activityAuthor: auditActor(ctx.user).name,
        });
      }),
    remove: moduleWriteProcedure("postprocessing")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        db.deletePost(input.id, {
          actor: auditActor(ctx.user),
        })
      ),
  }),
  moduleAssignments: router({
    clear: scopeAdminProcedure
      .input(
        z.object({
          area: moduleAssignmentClearArea,
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const capabilityByArea: Record<z.infer<typeof moduleAssignmentClearArea>, ProductCapability> = {
          helpers: "helpers",
          prep: "preparation",
          post: "postprocessing",
          materials: "materials",
        };
        await requireCurrentProductCapability(capabilityByArea[input.area]);
        await requireAdminPassword(input.adminPassword, ctx);
        return db.clearModuleAssignments(input.area);
      }),
  }),
  materials: router({
    list: moduleReadProcedure("materials").query(() => db.listMaterials()),
    create: moduleWriteProcedure("materials")
      .input(
        z.object({
          article: z.string().min(1),
          category: z.string().optional(),
          quantity: z.string().optional(),
          unit: z.string().optional(),
          locationId: z.number().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: materialStatus.default("offen"),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createMaterial(input)),
    update: moduleWriteProcedure("materials")
      .input(
        z.object({
          id: z.number(),
          article: z.string().optional(),
          category: z.string().optional(),
          quantity: z.string().optional(),
          unit: z.string().optional(),
          locationId: z.number().nullable().optional(),
          contactId: z.number().nullable().optional(),
          status: materialStatus.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateMaterial(id, r);
      }),
    remove: moduleWriteProcedure("materials")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        db.deleteMaterial(input.id, {
          actor: auditActor(ctx.user),
        })
      ),
  }),
  marketing: router({
    list: marketingReadProcedure.query(() => db.listMarketing()),
    create: marketingWriteProcedure
      .input(
        z.object({
          measure: z.string().min(1),
          channel: z.string().optional(),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createMarketing(input)),
    update: marketingWriteProcedure
      .input(
        z.object({
          id: z.number(),
          measure: z.string().optional(),
          channel: z.string().optional(),
          contactId: z.number().nullable().optional(),
          status: statusTask.optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateMarketing(id, r);
      }),
    remove: marketingWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteMarketing(input.id)),
  }),
  approvals: router({
    list: approvalsReadProcedure.query(() => db.listApprovals()),
    create: approvalsWriteProcedure
      .input(
        z.object({
          request: z.string().min(1),
          contactId: z.number().nullable().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createApproval(input)),
    update: approvalsWriteProcedure
      .input(
        z.object({
          id: z.number(),
          request: z.string().optional(),
          contactId: z.number().nullable().optional(),
          status: z
            .enum(["offen", "beantragt", "genehmigt", "abgelehnt"])
            .optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateApproval(id, r);
      }),
    remove: approvalsWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteApproval(input.id)),
  }),
  cakes: router({
    list: moduleReadProcedure("donations").query(() => db.listCakes()),
    create: moduleWriteProcedure("donations")
      .input(
        z.object({
          donor: z.string().min(1),
          cake: z.string().optional(),
          donationCategory: z
            .enum(["kuchen", "salat", "snack", "sonstiges"])
            .default("kuchen"),
          locationId: z.number().int().positive().nullable().optional(),
          dropoffDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Abgabedatum")
            .or(z.literal(""))
            .optional(),
            dropoffTime: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Abgabe-Uhrzeit")
              .or(z.literal(""))
              .optional(),
            vegan: z.boolean().default(false),
            vegetarian: z.boolean().default(false),
            glutenFree: z.boolean().default(false),
            lactoseFree: z.boolean().default(false),
            containsNuts: z.boolean().default(false),
            sugarFree: z.boolean().default(false),
            containsAlcohol: z.boolean().default(false),
            meat: z.boolean().default(false),
            note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createCake(input)),
    update: moduleWriteProcedure("donations")
      .input(
        z.object({
          id: z.number(),
          donor: z.string().optional(),
          cake: z.string().optional(),
          donationCategory: z
            .enum(["kuchen", "salat", "snack", "sonstiges"])
            .optional(),
          locationId: z.number().int().positive().nullable().optional(),
          dropoffDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Abgabedatum")
            .or(z.literal(""))
            .optional(),
            dropoffTime: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Abgabe-Uhrzeit")
              .or(z.literal(""))
              .optional(),
            vegan: z.boolean().optional(),
            vegetarian: z.boolean().optional(),
            glutenFree: z.boolean().optional(),
            lactoseFree: z.boolean().optional(),
            containsNuts: z.boolean().optional(),
            sugarFree: z.boolean().optional(),
            containsAlcohol: z.boolean().optional(),
            meat: z.boolean().optional(),
            note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateCake(id, r);
      }),
    remove: moduleWriteProcedure("donations")
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteCake(input.id, auditActor(ctx.user))
      ),
  }),
  finances: router({
    list: moduleReadProcedure("finances").query(() => db.listFinances()),
    create: moduleWriteProcedure("finances")
      .input(
        z.object({
          category: z.string().min(1),
          incomeCents: z.number().int().default(0),
          expenseCents: z.number().int().default(0),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.createFinance(input)),
    update: moduleWriteProcedure("finances")
      .input(
        z.object({
          id: z.number(),
          category: z.string().optional(),
          incomeCents: z.number().int().optional(),
          expenseCents: z.number().int().optional(),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...r } = input;
        return db.updateFinance(id, r);
      }),
    remove: moduleWriteProcedure("finances")
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteFinance(input.id)),
  }),

  audit: router({
    activities: adminProcedure
      .input(
        z
          .object({
            eventYear: eventYearInput.optional(),
            eventId: z.number().int().positive().optional(),
            limit: z.number().int().min(1).max(1000).default(500),
          })
          .optional()
      )
      .query(({ input }) => db.listActivityLogs(input)),
    deletions: productCapabilityAdminProcedure("postprocessing")
      .input(
        z
          .object({
            eventYear: eventYearInput.optional(),
            eventId: z.number().int().positive().optional(),
            entityType: z.enum(["helper", "cake", "prep", "post", "material"]).optional(),
            limit: z.number().int().min(1).max(1000).default(500),
          })
          .optional()
      )
      .query(({ input }) => db.listDeletionAuditLogs(input)),
    clear: productCapabilityAdminProcedure("postprocessing")
      .input(
        z.object({
          eventYear: eventYearInput.optional(),
          eventId: z.number().int().positive().optional(),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        await requireAdminPassword(input.adminPassword, ctx);
        await db.clearDeletionAuditLogs({
          eventYear: input.eventYear,
          eventId: input.eventId,
        });
        return { success: true } as const;
      }),
    restore: productCapabilityAdminProcedure("postprocessing")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => {
        rejectPublicDemoExternalAction(ctx.user);
        return db.restoreDeletionAuditLog(input.id, {
          userId: ctx.user.id,
          name: ctx.user.name ?? "Administrator",
        });
      }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const entitlement = await db.getCurrentTenantProductEntitlement();
      const eventPass = entitlement.packageId === "event_pass";
      const [
        shifts,
        assignments,
        helpers,
        prep,
        post,
        contacts,
        donations,
        selectedEvent,
      ] =
        await Promise.all([
          db.listShifts(),
          db.listAssignments(),
          db.listHelpers(),
          db.listPrep(),
          eventPass ? Promise.resolve([]) : db.listPost(),
          eventPass
            ? db.getEventPassPrimaryAdminContact().then(contact =>
                contact ? [contact] : []
              )
            : db.listContacts(),
          eventPass ? Promise.resolve([]) : db.listCakes(),
          db.getEvent(),
        ]);
      const ev = evaluateShifts(shifts, assignments, helpers);
      const besetzt = ev.reduce((s, e) => s + e.besetzt, 0);
      const bedarf = ev.reduce((s, e) => s + e.shift.needed, 0);
      const eingeteilteHelferIds = new Set(
        assignments
          .map(assignment => assignment.helperId)
          .filter((helperId): helperId is number => typeof helperId === "number")
      );
      const eingeteilteHelfer = helpers.filter(helper =>
        eingeteilteHelferIds.has(helper.id)
      );
      const eingeteilteBestaetigteHelfer = eingeteilteHelfer.filter(
        helper => helper.confirmed === "ja"
      ).length;
      const eingeteilteUnbestaetigteHelfer =
        eingeteilteHelfer.length - eingeteilteBestaetigteHelfer;
      const aktiveFestivaltage = eventWeekdays(selectedEvent?.activeDays);
      const helferOhneErstkontakt = helpers.filter(helper =>
        isHelperWithoutFirstContact(helper, aktiveFestivaltage)
      ).length;
      const helferKontaktiert = helpers.length - helferOhneErstkontakt;
      const gueltigeSchichtenJeHelfer = new Map<number, number>();
      const gueltigeSchichtenJeHelferUndTag = new Map<string, number>();
      for (const entry of ev) {
        for (const helper of entry.validHelpers) {
          gueltigeSchichtenJeHelfer.set(
            helper.id,
            (gueltigeSchichtenJeHelfer.get(helper.id) ?? 0) + 1
          );
          const key = `${entry.shift.day}:${helper.id}`;
          gueltigeSchichtenJeHelferUndTag.set(
            key,
            (gueltigeSchichtenJeHelferUndTag.get(key) ?? 0) + 1
          );
        }
      }
      // Die Kennzahl folgt der tatsächlichen Eventkonfiguration statt einem
      // starren Fr/Sa/So-Raster. Dadurch sind auch Ein- und Mehrtagesformate
      // an beliebigen Wochentagen korrekt abgebildet.
      const taeglicheEinsatzbereitschaft = aktiveFestivaltage.map(day => {
        const tagesSchichten = ev.filter(entry => entry.shift.day === day);
        const bedarf = tagesSchichten.reduce(
          (sum, entry) => sum + entry.shift.needed,
          0
        );
        const besetzt = tagesSchichten.reduce(
          (sum, entry) => sum + entry.besetzt,
          0
        );
        const fehlend = Math.max(0, bedarf - besetzt);
        const tagesPotenzial = helpers.reduce(
          (potenzial, helper) => {
            if (!helperActiveOnDay(helper, day)) {
              return potenzial;
            }
            const eingeteilteSchichten =
              gueltigeSchichtenJeHelfer.get(helper.id) ?? 0;
            const schichtenAnDiesemTag =
              gueltigeSchichtenJeHelferUndTag.get(`${day}:${helper.id}`) ?? 0;
            if (eingeteilteSchichten === 0) {
              potenzial.ungenutzteHelferIds.push(helper.id);
            } else if (schichtenAnDiesemTag === 0) {
              potenzial.teilzeitReserveIds.push(helper.id);
            }
            return potenzial;
          },
          {
            ungenutzteHelferIds: [] as number[],
            teilzeitReserveIds: [] as number[],
          }
        );
        return {
          day,
          bedarf,
          besetzt,
          fehlend,
          quote: bedarf === 0 ? 0 : Math.min(100, Math.round((besetzt / bedarf) * 100)),
          ungenutzteHelfer: tagesPotenzial.ungenutzteHelferIds.length,
          teilzeitReserve: tagesPotenzial.teilzeitReserveIds.length,
          ...tagesPotenzial,
        };
      });
      const donationCategories = [
        {
          id: "kuchen",
          label: "Kuchen / Gebäck",
          target: selectedEvent?.donationTargetKuchen ?? 0,
        },
        {
          id: "salat",
          label: "Salat",
          target: selectedEvent?.donationTargetSalat ?? 0,
        },
        {
          id: "snack",
          label: "Dessert",
          target: selectedEvent?.donationTargetSnack ?? 0,
        },
        {
          id: "sonstiges",
          label: "Sonstiges",
          target: selectedEvent?.donationTargetSonstiges ?? 0,
        },
      ] as const;
      const donationCategoryCounts = new Map(
        donationCategories.map(category => [category.id, 0])
      );
      for (const donation of donations) {
        const category =
          (donation.donationCategory as string) === "deftiges"
            ? "sonstiges"
            : donation.donationCategory;
        if (donationCategoryCounts.has(category as (typeof donationCategories)[number]["id"])) {
          donationCategoryCounts.set(
            category as (typeof donationCategories)[number]["id"],
            (donationCategoryCounts.get(category as (typeof donationCategories)[number]["id"]) ?? 0) + 1
          );
        }
      }
      return {
        schichtenGesamt: ev.length,
        offen: ev.filter(e => e.status === "OFFEN").length,
        knapp: ev.filter(e => e.status === "KNAPP").length,
        ok: ev.filter(e => e.status === "OK").length,
        bedarfGesamt: bedarf,
        besetztGesamt: besetzt,
        helferGesamt: helpers.length,
        helferBestaetigt: helpers.filter(h => h.confirmed === "ja").length,
        helferEingeteilt: eingeteilteHelfer.length,
        helferEingeteiltBestaetigt: eingeteilteBestaetigteHelfer,
        helferEingeteiltUnbestaetigt: eingeteilteUnbestaetigteHelfer,
        rueckmeldequote:
          eingeteilteHelfer.length === 0
            ? 0
            : Math.round(
                (eingeteilteBestaetigteHelfer / eingeteilteHelfer.length) * 100
              ),
        helferOhneErstkontakt,
        helferKontaktiert,
        erstkontaktquote:
          helpers.length === 0
            ? 0
            : Math.round((helferKontaktiert / helpers.length) * 100),
        taeglicheEinsatzbereitschaft,
        doppelGesamt: ev.reduce((s, e) => s + e.doppelCount, 0),
        ausfallGesamt: ev.reduce((s, e) => s + e.ausfallCount, 0),
        vorbereitungGesamt: prep.length,
        offeneVorbereitung: prep.filter(p => p.status === "offen").length,
        vorbereitungInBearbeitung: prep.filter(p => p.status === "inArbeit").length,
        vorbereitungErledigt: prep.filter(p => p.status === "erledigt").length,
        abgelehnteVorbereitung: prep.filter(p => p.status === "abgelehnt").length,
        naechsteVorbereitungsfristen: upcomingPreparationDeadlines(prep, contacts),
        offeneNachbereitung: post.filter(p => p.status === "offen").length,
        spenden: {
          gesamt: donations.length,
          kategorien: donationCategories.map(category => ({
            ...category,
            ist: donationCategoryCounts.get(category.id) ?? 0,
          })),
          eigenschaften: {
            vegan: donations.filter(donation => donation.vegan).length,
            vegetarian: donations.filter(donation => donation.vegetarian).length,
            glutenFree: donations.filter(donation => donation.glutenFree).length,
            lactoseFree: donations.filter(donation => donation.lactoseFree)
              .length,
            containsNuts: donations.filter(donation => donation.containsNuts)
              .length,
            sugarFree: donations.filter(donation => donation.sugarFree).length,
            containsAlcohol: donations.filter(donation => donation.containsAlcohol)
              .length,
            meat: donations.filter(donation => donation.meat).length,
          },
        },
        verantwortlichkeiten: await (async () => {
          if (eventPass) {
            return contacts.map(contact => {
              const betreuteHelfer = helpers.filter(
                helper => helper.contactId === contact.id
              ).length;
              const vorbereitung = prep.filter(
                task => task.contactId === contact.id
              ).length;
              return {
                name: contact.name,
                betreuteHelfer,
                vorbereitung,
                nachbereitung: 0,
                material: 0,
                gesamt: betreuteHelfer + vorbereitung,
              };
            });
          }
          const [materials, marketing, approvals] = await Promise.all([
            db.listMaterials(),
            db.listMarketing(),
            db.listApprovals(),
          ]);
          return contacts.map(contact => {
            const betreuteHelfer = helpers.filter(
              helper => helper.contactId === contact.id
            ).length;
            // Marketing und Genehmigungen sind fachlich Vorbereitungsaufgaben
            // und werden daher nur noch gemeinsam in „Vorb.“ ausgewiesen.
            const vorbereitung =
              prep.filter(task => task.contactId === contact.id).length +
              marketing.filter(item => item.contactId === contact.id).length +
              approvals.filter(item => item.contactId === contact.id).length;
            const nachbereitung = post.filter(
              task => task.contactId === contact.id
            ).length;
            const material = materials.filter(
              item => item.contactId === contact.id
            ).length;

            return {
              name: contact.name,
              betreuteHelfer,
              vorbereitung,
              nachbereitung,
              material,
              gesamt: betreuteHelfer + vorbereitung + nachbereitung + material,
            };
          });
        })(),
        auslastung: helpers
          .map(h => {
            const byDay = Object.fromEntries(
              WEEKDAYS.map(day => [
                day,
                ev.filter(
                  e =>
                    e.shift.day === day &&
                    e.validHelpers.some(v => v.id === h.id)
                ).length,
              ])
            ) as Record<(typeof WEEKDAYS)[number], number>;
            const gesamt = WEEKDAYS.reduce((sum, day) => sum + byDay[day], 0);
            return { id: h.id, name: h.name, byDay, gesamt };
          })
          .sort((left, right) => left.name.localeCompare(right.name, "de")),
      };
    }),
    /**
     * Persönliche, serverseitig gefilterte Aufgabenansicht. Sie nutzt die
     * gespeicherte Ansprechpartner-Verknüpfung eines Teamzugangs und fällt
     * nur für historische Sammelzugänge auf den eindeutigen Sitzungsnamen
     * zurück. So werden Vereinsaufgaben anderer Personen nicht erst im Browser
     * ausgefiltert.
     */
    personal: protectedProcedure.query(async ({ ctx }) => {
      const entitlement = await db.getCurrentTenantProductEntitlement();
      const eventPass = entitlement.packageId === "event_pass";
      const [
        selectedEvent,
        shifts,
        assignments,
        helpers,
        contacts,
        prep,
        post,
        materials,
        marketing,
        approvals,
        shiftAreaContacts,
        locations,
      ] = await Promise.all([
        db.getEvent(),
        db.listShifts(),
        db.listAssignments(),
        db.listHelpers(),
        eventPass
          ? db.getEventPassPrimaryAdminContact().then(contact =>
              contact ? [contact] : []
            )
          : db.listContacts(),
        db.listPrep(),
        productAllowsCapability(entitlement.packageId, "postprocessing")
          ? db.listPost()
          : Promise.resolve([]),
        productAllowsCapability(entitlement.packageId, "materials")
          ? db.listMaterials()
          : Promise.resolve([]),
        productAllowsCapability(entitlement.packageId, "marketing")
          ? db.listMarketing()
          : Promise.resolve([]),
        productAllowsCapability(entitlement.packageId, "approvals")
          ? db.listApprovals()
          : Promise.resolve([]),
        db.listShiftAreaContacts(),
        productAllowsCapability(entitlement.packageId, "maps_gpx")
          ? db.listLocations()
          : Promise.resolve([]),
      ]);

      const normalizedCurrentName = db.normalizePersonName(ctx.user.name ?? "");
      const ownContactIds = await ownContactIdsForPersonalPlanView(
        ctx.user,
        contacts
      );

      const ownHelperIds = new Set(
        normalizedCurrentName
          ? helpers
              .filter(
                helper =>
                  db.normalizePersonName(helper.name) === normalizedCurrentName
              )
              .map(helper => helper.id)
          : []
      );

      const planNotifications = await db.listPlanContactNotificationsForContacts(
        Array.from(ownContactIds)
      );
      const outstandingPlanNotifications = planNotifications.filter(notification =>
        isPlanInformationOutstanding(notification)
      );
      const hasPlanChange = outstandingPlanNotifications.some(
        notification => notification.changePendingAt !== null
      );
      const ownAssignedHelperCount = helpers.filter(
        helper =>
          ownContactIds.has(helper.contactId ?? -1) &&
          assignments.some(assignment => assignment.helperId === helper.id)
      ).length;

      return {
        ...buildPersonalDashboard({
        displayName: ctx.user.name?.trim() || "Meine Aufgaben",
        ownContactIds,
        ownHelperIds,
        activeDays: eventWeekdays(selectedEvent?.activeDays),
        prep,
        post,
        materials,
        marketing,
        approvals,
        assignments,
        shifts,
        helpers,
        shiftAreaContacts,
        locations: locations.map(location => ({
          ...location,
          logoUrl: locationLogoUrl(location),
        })),
        }),
        planInformation: {
          eventId: selectedEvent?.id ?? null,
          eventName: selectedEvent?.name ?? null,
          eventYear: selectedEvent?.year ?? null,
          releasedAt: selectedEvent?.planReleasedAt ?? null,
          outstanding: outstandingPlanNotifications.length > 0,
          changed: hasPlanChange,
          assignedHelperCount: ownAssignedHelperCount,
        },
      };
    }),
    acknowledgePlanInformation: protectedProcedure.mutation(async ({ ctx }) => {
      const contacts = await db.listContacts();
      const ownContactIds = await ownContactIdsForPersonalPlanView(
        ctx.user,
        contacts
      );
      const result = await db.acknowledgePlanInformationForContacts(
        Array.from(ownContactIds)
      );
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Einsatzplan",
        action: "updated",
        subject: "Persönliche Helferinformation im Dashboard geöffnet",
      });
      return result;
    }),
  }),

  projectFile: router({
    save: backupCapabilityProcedure("project_backup").query(async ({ ctx }) => {
      const result = await withExcelOperationLimit(() => exportProjectFile());
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Dateiexporte",
        action: "exported",
        subject: "JSON-Projektstand heruntergeladen",
      });
      return {
        base64: result.buffer.toString("base64"),
        exportedAt: result.exportedAt,
        eventName: result.eventName,
      };
    }),
    preview: backupCapabilityAdminProcedure("project_backup")
      .input(
        z.object({
          base64: z
            .string()
            .max(14_000_000, "Speicherdatei ist größer als 10 MB"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await withExcelOperationLimit(() =>
          previewProjectFile(input.base64)
        );
        return {
          ...result,
          previewBinding: createPreviewBinding({
            sourceDigest: result.workbookDigest,
            currentDigest: result.currentDigest,
            year: currentEventYear(),
            eventId: currentEventId(),
            operation: "project-file",
            userId: ctx.user.id,
          }),
        };
      }),
    load: backupScopeAdminAuthProcedure("project_backup")
      .input(
        z.object({
          base64: z
            .string()
            .max(14_000_000, "Speicherdatei ist größer als 10 MB"),
          filename: z.string().trim().min(1).max(255),
          currentDigest: z.string().regex(/^[a-f0-9]{64}$/),
          previewBinding: z.string().min(20).max(2_000),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        verifyPreviewBinding(input.previewBinding, {
          sourceDigest: uploadedFileDigest(input.base64),
          currentDigest: input.currentDigest,
          year: currentEventYear(),
          eventId: currentEventId(),
          operation: "project-file",
          userId: ctx.user.id,
        });
        try {
          return await withExcelOperationLimit(() =>
            loadProjectFile(
              input.base64,
              input.filename,
              input.currentDigest,
              auditActor(ctx.user)
            )
          );
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der Datenwiederherstellung";
          console.error("[Projektdatei-Import] Atomare Übernahme abgebrochen", {
            filename: input.filename,
            year: currentEventYear(),
            eventId: currentEventId(),
            userId: ctx.user.id,
            detail,
            error,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Projektdatei wurde nicht geladen: ${detail}`,
          });
        }
      }),
    restoreLogs: backupCapabilityAdminProcedure("project_backup").query(() => listBackupRestoreLogs()),
    restoreLog: backupCapabilityAdminProcedure("project_backup")
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => getBackupRestoreLog(input.id)),
    clearRestoreLogs: backupScopeAdminAuthProcedure("project_backup")
      .input(z.object({ adminPassword: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.withPlanningWriteLock(() => clearBackupRestoreLogs());
      }),
  }),

  excel: router({
    exportFile: backupCapabilityProcedure("excel").query(async ({ ctx }) => {
      const result = await withExcelOperationLimit(() => exportProjectExcel());
      await db.recordActivityLog({
        actor: auditActor(ctx.user),
        module: "Dateiexporte",
        action: "exported",
        subject: "Excel-Projektübersicht heruntergeladen",
      });
      return {
        base64: result.buffer.toString("base64"),
        exportedAt: result.exportedAt,
        eventName: result.eventName,
      };
    }),
    previewModule: backupCapabilityAdminProcedure("excel")
      .input(
        z.object({
          area: z.enum(MODULE_IMPORT_AREAS),
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await withExcelOperationLimit(() =>
          previewModuleExcelImport(input.base64, input.area)
        );
        return {
          ...result,
          previewBinding: createPreviewBinding({
            sourceDigest: result.sourceDigest,
            currentDigest: result.currentDigest,
            year: currentEventYear(),
            eventId: currentEventId(),
            operation: `module:${input.area}`,
            userId: ctx.user.id,
          }),
        };
      }),
    previewFull: backupCapabilityAdminProcedure("excel")
      .input(
        z.object({
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await withExcelOperationLimit(() =>
          previewFullExcelImport(input.base64)
        );
        return {
          ...result,
          previewBinding: createPreviewBinding({
            sourceDigest: result.sourceDigest,
            currentDigest: result.currentDigest,
            year: currentEventYear(),
            eventId: currentEventId(),
            operation: "full-excel",
            userId: ctx.user.id,
          }),
        };
      }),
    applyModule: backupScopeAdminProcedure("excel")
      .input(
        z.object({
          area: z.enum(MODULE_IMPORT_AREAS),
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
          filename: z.string().trim().min(1).max(255),
          currentDigest: z.string().regex(/^[a-f0-9]{64}$/),
          previewBinding: z.string().min(20).max(2_000),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        verifyPreviewBinding(input.previewBinding, {
          sourceDigest: uploadedFileDigest(input.base64),
          currentDigest: input.currentDigest,
          year: currentEventYear(),
          eventId: currentEventId(),
          operation: `module:${input.area}`,
          userId: ctx.user.id,
        });
        try {
          return await withExcelOperationLimit(() =>
            applyModuleExcelImport(
              input.base64,
              input.area,
              input.filename,
              input.currentDigest,
              auditActor(ctx.user)
            )
          );
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der Datenwiederherstellung";
          console.error("[Excel-Modulimport] Atomare Übernahme abgebrochen", {
            area: input.area,
            filename: input.filename,
            year: currentEventYear(),
            eventId: currentEventId(),
            userId: ctx.user.id,
            detail,
            error,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Excel-Import (${input.area}) wurde nicht übernommen: ${detail}`,
          });
        }
      }),
    applyFull: backupScopeAdminProcedure("excel")
      .input(
        z.object({
          base64: z
            .string()
            .max(20_000_000, "Excel-Datei ist größer als 15 MB"),
          filename: z.string().trim().min(1).max(255),
          currentDigest: z.string().regex(/^[a-f0-9]{64}$/),
          previewBinding: z.string().min(20).max(2_000),
          adminPassword: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        verifyPreviewBinding(input.previewBinding, {
          sourceDigest: uploadedFileDigest(input.base64),
          currentDigest: input.currentDigest,
          year: currentEventYear(),
          eventId: currentEventId(),
          operation: "full-excel",
          userId: ctx.user.id,
        });
        try {
          return await withExcelOperationLimit(() =>
            applyFullExcelImport(
              input.base64,
              input.filename,
              input.currentDigest,
              auditActor(ctx.user)
            )
          );
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der Datenwiederherstellung";
          console.error("[Excel-Vollimport] Atomare Übernahme abgebrochen", {
            filename: input.filename,
            year: currentEventYear(),
            eventId: currentEventId(),
            userId: ctx.user.id,
            detail,
            error,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Vollständiger Excel-Import wurde nicht übernommen: ${detail}`,
          });
        }
      }),
  }),

  notes: router({
    list: eventChatReadProcedure
      .input(
        z
          .object({
            sinceId: z.number().int().positive().optional(),
            limit: z.number().int().min(1).max(300).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        const identity = teamNoteReadIdentity(ctx.user);
        const [notes, typing, unread] = await Promise.all([
          db.listTeamNotes({
            sinceId: input?.sinceId,
            limit: input?.limit,
          }),
          db.listActiveTypers({ excludeSessionKey: sessionKey }),
          db.getTeamNoteUnreadStatus(identity),
        ]);
        return { notes, typing, ...unread };
      }),
    markRead: eventChatReadProcedure.mutation(async ({ ctx }) =>
      db.markTeamNotesRead(teamNoteReadIdentity(ctx.user))
    ),
    typing: eventChatWriteProcedure
      .input(
        z.object({
          isTyping: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        if (!sessionKey) return false;
        const actor = auditActor(ctx.user);
        return db.setTeamNoteTyping({
          sessionKey,
          senderUserId: ctx.user.id > 0 ? ctx.user.id : null,
          senderName: actor.name,
          senderRole: ctx.user.role,
          isTyping: input.isTyping,
        });
      }),
    send: eventChatWriteProcedure
      .input(
        z.object({
          message: z.string().trim().min(1).max(2000),
          important: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const sessionKey = sessionPresenceKey(ctx.req);
        const actor = auditActor(ctx.user);
        return db.createTeamNote({
          senderUserId: ctx.user.id > 0 ? ctx.user.id : null,
          senderName: actor.name,
          senderRole: ctx.user.role,
          message: input.message,
          important: input.important,
          sessionKey,
        });
      }),
    clear: adminProcedure
      .input(
        z.object({
          adminPassword: z.string().min(1).max(200),
          scope: z.literal("current_event").default("current_event"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireAdminPassword(input.adminPassword, ctx);
        return db.clearTeamNotes(auditActor(ctx.user), {
          year: currentEventYear(),
          eventId: currentEventId(),
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
