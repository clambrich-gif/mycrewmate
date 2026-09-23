import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export const DEFAULT_EVENT_YEAR = 2026;
export const DEFAULT_EVENT_ID = 1;
export const DEFAULT_TENANT_ID = "rsc-eifelland-mayen";

export type PlanningScope = {
  tenantId: string;
  year: number;
  eventId: number;
};

const planningScopeStorage = new AsyncLocalStorage<PlanningScope>();

export function normalizeEventYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100
    ? year
    : DEFAULT_EVENT_YEAR;
}

export function normalizeEventId(value: unknown) {
  const eventId = Number(value);
  return Number.isInteger(eventId) && eventId > 0 ? eventId : DEFAULT_EVENT_ID;
}

export function normalizeTenantId(value: unknown) {
  const tenantId = String(value ?? "").trim();
  return /^[a-z0-9-]{3,96}$/.test(tenantId)
    ? tenantId
    : DEFAULT_TENANT_ID;
}

export function requestedPlanningScope(req: Request): PlanningScope {
  return {
    tenantId: normalizeTenantId(req.headers["x-tenant-id"]),
    year: normalizeEventYear(req.headers["x-event-year"]),
    eventId: normalizeEventId(req.headers["x-event-id"]),
  };
}

export function requestedEventYear(req: Request) {
  return requestedPlanningScope(req).year;
}

export function requestedEventId(req: Request) {
  return requestedPlanningScope(req).eventId;
}

export function withPlanningScope<T>(scope: PlanningScope, callback: () => T) {
  return planningScopeStorage.run(scope, callback);
}

export function withEventYear<T>(year: number, callback: () => T) {
  return withPlanningScope(
    {
      tenantId: DEFAULT_TENANT_ID,
      year: normalizeEventYear(year),
      eventId: DEFAULT_EVENT_ID,
    },
    callback
  );
}

export function withEventScope<T>(
  year: number,
  eventId: number,
  callback: () => T
) {
  return withPlanningScope(
    {
      tenantId: DEFAULT_TENANT_ID,
      year: normalizeEventYear(year),
      eventId: normalizeEventId(eventId),
    },
    callback
  );
}

export function currentEventYear() {
  return planningScopeStorage.getStore()?.year ?? DEFAULT_EVENT_YEAR;
}

export function currentTenantId() {
  return planningScopeStorage.getStore()?.tenantId ?? DEFAULT_TENANT_ID;
}

export function currentEventId() {
  return planningScopeStorage.getStore()?.eventId ?? DEFAULT_EVENT_ID;
}
