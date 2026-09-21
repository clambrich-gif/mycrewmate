import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  Gift,
  CircleHelp,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Package,
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
    href: "/orte",
    label: "Orte & Standorte",
    icon: MapPin,
    planningTeamHidden: true,
  },
  {
    href: "/sicherheit",
    label: "Schutz & Protokoll",
    icon: LockKeyhole,
    adminOnly: true,
  },
  { href: "/hilfe", label: "Hilfe", icon: CircleHelp },
];

export const PLANNING_TEAM_HIDDEN_PATHS = [
  "/ansprechpartner",
  "/finanzen",
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
  "/hilfe",
] as const;

type NavigationSection = {
  id: "default";
  label: null;
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

/** Alle Rollen behalten die gewohnte Reihenfolge der sichtbaren Menüpunkte. */
export function visibleNavigationSections(
  role: "user" | "admin" | null | undefined
): NavigationSection[] {
  return [{ id: "default", label: null, items: visibleNavigationItems(role) }];
}

export function navigationItemClasses(
  role: "user" | "admin" | null | undefined,
  href: string,
  active: boolean
) {
  return active
    ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
    : href === "/sicherheit"
      ? "font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    : role === "user" && PLANNING_TEAM_OVERVIEW_PATHS.includes(
          href as (typeof PLANNING_TEAM_OVERVIEW_PATHS)[number]
        )
      ? "font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      : role === "user"
        ? "font-semibold text-slate-900 hover:bg-slate-100 hover:text-slate-900"
    : "font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-900";
}
