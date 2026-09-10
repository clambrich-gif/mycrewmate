import {
  LayoutDashboard, Users, UserCheck, CalendarRange, ClipboardList,
  ClipboardCheck, Package, Megaphone, FileCheck, Cake, Wallet, FileSpreadsheet,
} from "lucide-react";

export const NAV = [
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
  { href: "/excel", label: "Excel Import/Export", icon: FileSpreadsheet },
] as const;
