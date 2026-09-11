import type { LucideIcon } from "lucide-react";
import {
  Cake,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileDown,
  FileSpreadsheet,
  CircleHelp,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
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
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/genehmigungen", label: "Genehmigungen", icon: FileCheck },
  { href: "/kuchen", label: "Kuchen", icon: Cake },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/pdf-export", label: "PDF-Ausgabe", icon: FileDown },
  { href: "/excel", label: "Excel Import/Export", icon: FileSpreadsheet },
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
