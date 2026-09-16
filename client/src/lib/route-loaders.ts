import type { ComponentType } from "react";

export type RouteModule = {
  default: ComponentType<any>;
};

type RouteLoader = () => Promise<RouteModule>;

const taskListLoader: RouteLoader = () => import("@/pages/TaskList");
const preparationLoader: RouteLoader = () => import("@/pages/Preparation");

export const routeLoaders = {
  "/": () => import("@/pages/Dashboard"),
  "/ansprechpartner": () => import("@/pages/Contacts"),
  "/helfer": () => import("@/pages/Helpers"),
  "/einsatzplan": () => import("@/pages/Plan"),
  "/vorbereitung": preparationLoader,
  "/nachbereitung": taskListLoader,
  "/material": () => import("@/pages/Materials"),
  "/kuchen": () => import("@/pages/Cakes"),
  "/finanzen": () => import("@/pages/Finances"),
  "/pdf-export": () => import("@/pages/PdfExport"),
  "/excel": () => import("@/pages/Excel"),
  "/berechtigungen": () => import("@/pages/Permissions"),
  "/sicherheit": () => import("@/pages/Security"),
  "/hilfe": () => import("@/pages/Help"),
} satisfies Record<string, RouteLoader>;

export type LazyRoutePath = keyof typeof routeLoaders;

export function preloadRoute(path: string) {
  const loader = routeLoaders[path as LazyRoutePath];
  if (loader) void loader().catch(() => undefined);
}
