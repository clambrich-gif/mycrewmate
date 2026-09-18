import type { LucideIcon } from "lucide-react";
import {
  Cake,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
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
};

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ansprechpartner", label: "Ansprechpartner", icon: UserCheck },
  { href: "/helfer", label: "Helfer", icon: Users },
  { href: "/einsatzplan", label: "Einsatzplan", icon: CalendarRange },
  { href: "/vorbereitung", label: "Vorbereitung", icon: ClipboardList },
  { href: "/nachbereitung", label: "Nachbereitung", icon: ClipboardCheck },
  { href: "/material", label: "Material", icon: Package },
  { href: "/kuchen", label: "Kuchen", icon: Cake },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/pdf-export", label: "PDF-Ausgabe", icon: FileDown },
  { href: "/excel", label: "Excel-Projektübersicht", icon: FileSpreadsheet },
  {
    href: "/orte",
    label: "Orte & Standorte",
    icon: MapPin,
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

export const PLANNING_TEAM_FOCUS_PATHS = [
  "/helfer",
  "/kuchen",
  "/pdf-export",
  "/hilfe",
] as const;

export function navigationItemClasses(
  role: "user" | "admin" | null | undefined,
  href: string,
  active: boolean
) {
  if (role !== "user")
    return active
      ? "bg-primary font-medium text-primary-foreground"
      : "font-medium hover:bg-accent";

  const isFocusPath = PLANNING_TEAM_FOCUS_PATHS.includes(
    href as (typeof PLANNING_TEAM_FOCUS_PATHS)[number]
  );
  return [
    isFocusPath
      ? "font-bold text-black opacity-100"
      : "font-normal text-gray-500",
    active
      ? "bg-slate-100 ring-1 ring-inset ring-slate-200"
      : "hover:bg-slate-100",
  ].join(" ");
}
