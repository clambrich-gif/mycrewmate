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

type NavItem = {
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

export function navigationItemClasses(
  role: "user" | "admin" | null | undefined,
  href: string,
  active: boolean
) {
  void role;
  void href;
  return active
    ? "bg-primary font-semibold text-primary-foreground"
    : "font-semibold text-slate-800 hover:bg-accent";
}
