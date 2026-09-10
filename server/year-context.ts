import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export const DEFAULT_EVENT_YEAR = 2026;
export const MIN_EVENT_YEAR = 2020;
export const MAX_EVENT_YEAR = 2100;

const yearStorage = new AsyncLocalStorage<number>();

export function normalizeEventYear(value: unknown) {
  const year = Number(value);
  if (
    !Number.isInteger(year) ||
    year < MIN_EVENT_YEAR ||
    year > MAX_EVENT_YEAR
  ) {
    return DEFAULT_EVENT_YEAR;
  }
  return year;
}

export function requestedEventYear(req: Request) {
  return normalizeEventYear(req.headers["x-event-year"]);
}

export function currentEventYear() {
  return yearStorage.getStore() ?? DEFAULT_EVENT_YEAR;
}

export function withEventYear<T>(year: number, callback: () => T) {
  return yearStorage.run(normalizeEventYear(year), callback);
}
