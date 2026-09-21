import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Gift,
  CircleHelp,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Package,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  planningTeamHidden?: boolean;
};

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/ansprechpartner",
    label: "Ansprechpartner",
    icon: UserCheck,
    planningTeamHidden: true,
  },
  { href: "/helfer", label: "Helfer", icon: Users },
  { href: "/einsatzplan", label: "Einsatzplan", icon: CalendarRange },
  { href: "/vorbereitung", label: "Vorbereitung", icon: ClipboardList },
  { href: "/nachbereitung", label: "Nachbereitung", icon: ClipboardCheck },
  { href: "/material", label: "Material", icon: Package },
  { href: "/spenden", label: "Spenden", icon: Gift },
  {
    href: "/finanzen",
    label: "Finanzen",
    icon: Wallet,
    planningTeamHidden: true,
  },
  { href: "/pdf-export", label: "PDF-Ausgabe", icon: FileDown },
  {
    href: "/excel",
    label: "Excel-Projektübersicht",
    icon: FileSpreadsheet,
    planningTeamHidden: true,
  },
  {
    href: "/orte",
    label: "Orte & Standorte",
    icon: MapPin,
    planningTeamHidden: true,
  },
  {
    href: "/berechtigungen",
    label: "Rollen & Protokoll",
    icon: ShieldCheck,
  },
  {
    href: "/sicherheit",
    label: "Zugangsschutz",
    icon: LockKeyhole,
    adminOnly: true,
  },
  { href: "/hilfe", label: "Hilfe", icon: CircleHelp },
];

export const PLANNING_TEAM_HIDDEN_PATHS = [
  "/ansprechpartner",
  "/finanzen",
  "/excel",
  "/orte",
] as const;

export const PLANNING_TEAM_EDITING_PATHS = [
  "/helfer",
  "/vorbereitung",
  "/nachbereitung",
  "/material",
  "/spenden",
  "/pdf-export",
] as const;

export const PLANNING_TEAM_OVERVIEW_PATHS = [
  "/",
  "/einsatzplan",
  "/berechtigungen",
  "/hilfe",
] as const;

type PlanningTeamNavigationSection = {
  id: "editing" | "overview";
  label: "BEARBEITUNG" | "ÜBERSICHT & INFO";
  items: NavItem[];
};

/** Das Planungsteam wird im Datenmodell als Rolle `user` geführt. */
export function visibleNavigationItems(
  role: "user" | "admin" | null | undefined
) {
  return NAV.filter(item => {
    if (item.adminOnly && role !== "admin") return false;
    if (item.planningTeamHidden && role === "user") return false;
    return true;
  });
}

/**
 * Das Planungsteam erhält eine bewusst aufgabenorientierte Navigation.
 * Die Admin-Navigation bleibt in der historisch gewohnten Reihenfolge.
 */
export function visibleNavigationSections(
  role: "user" | "admin" | null | undefined
): Array<PlanningTeamNavigationSection | { id: "default"; label: null; items: NavItem[] }> {
  const visibleItems = visibleNavigationItems(role);
  if (role !== "user") {
    return [{ id: "default", label: null, items: visibleItems }];
  }

  const itemByPath = new Map(visibleItems.map(item => [item.href, item]));
  const getItems = (paths: readonly string[]) =>
    paths.flatMap(path => {
      const item = itemByPath.get(path);
      return item ? [item] : [];
    });

  return [
    {
      id: "editing",
      label: "BEARBEITUNG",
      items: getItems(PLANNING_TEAM_EDITING_PATHS),
    },
    {
      id: "overview",
      label: "ÜBERSICHT & INFO",
      items: getItems(PLANNING_TEAM_OVERVIEW_PATHS),
    },
  ];
}

export function navigationItemClasses(
  role: "user" | "admin" | null | undefined,
  href: string,
  active: boolean
) {
  return active
    ? "bg-primary font-semibold text-primary-foreground"
    : role === "user" && PLANNING_TEAM_OVERVIEW_PATHS.includes(
          href as (typeof PLANNING_TEAM_OVERVIEW_PATHS)[number]
        )
      ? "font-normal text-slate-500 hover:bg-accent hover:text-slate-800"
      : role === "user"
        ? "font-medium text-slate-900 hover:bg-accent"
    : "font-semibold text-slate-800 hover:bg-accent";
}
