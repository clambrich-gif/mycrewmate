import type { ComponentType } from "react";

export type RouteModule = {
  default: ComponentType<any>;
};

type RouteLoader = () => Promise<RouteModule>;

const preparationLoader: RouteLoader = () => import("@/pages/Preparation");
const postProcessingLoader: RouteLoader = () => import("@/pages/PostProcessing");
const donationsLoader: RouteLoader = () => import("@/pages/Cakes");

export const routeLoaders = {
  "/": () => import("@/pages/Dashboard"),
  "/ansprechpartner": () => import("@/pages/Contacts"),
  "/helfer": () => import("@/pages/Helpers"),
  "/einsatzplan": () => import("@/pages/Plan"),
  "/vorbereitung": preparationLoader,
  "/nachbereitung": postProcessingLoader,
  "/material": () => import("@/pages/Materials"),
  "/spenden": donationsLoader,
  "/kuchen": donationsLoader,
  "/finanzen": () => import("@/pages/Finances"),
  "/pdf-export": () => import("@/pages/PdfExport"),
  "/excel": () => import("@/pages/Excel"),
  "/orte": () => import("@/pages/Locations"),
  "/sicherheit": () => import("@/pages/Security"),
  "/hilfe": () => import("@/pages/Help"),
} satisfies Record<string, RouteLoader>;

export type LazyRoutePath = keyof typeof routeLoaders;

export function preloadRoute(path: string) {
  const loader = routeLoaders[path as LazyRoutePath];
  if (loader) void loader().catch(() => undefined);
}
