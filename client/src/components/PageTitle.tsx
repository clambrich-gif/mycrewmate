import { cn } from "@/lib/utils";
import {
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Gift,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Package,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

export type PageTitleIconKind =
  | "dashboard"
  | "contacts"
  | "helpers"
  | "plan"
  | "preparation"
  | "postprocessing"
  | "materials"
  | "donations"
  | "finances"
  | "pdf"
  | "excel"
  | "locations"
  | "permissions"
  | "security"
  | "help";

function PageTitleIcon({ kind }: { kind: PageTitleIconKind }) {
  const baseClassName = "size-7 shrink-0";
  const blueClassName = `${baseClassName} text-blue-900`;

  switch (kind) {
    case "dashboard":
      return <LayoutDashboard className={blueClassName} aria-hidden="true" />;
    case "contacts":
      return <User className={blueClassName} aria-hidden="true" />;
    case "helpers":
      return <Users className={blueClassName} aria-hidden="true" />;
    case "plan":
      return <CalendarRange className={blueClassName} aria-hidden="true" />;
    case "preparation":
      return <ClipboardList className={blueClassName} aria-hidden="true" />;
    case "postprocessing":
      return <ClipboardCheck className={blueClassName} aria-hidden="true" />;
    case "materials":
      return <Package className={blueClassName} aria-hidden="true" />;
    case "donations":
      return <Gift className={blueClassName} aria-hidden="true" />;
    case "finances":
      return <Wallet className={blueClassName} aria-hidden="true" />;
    case "pdf":
      return <FileDown className={`${baseClassName} text-red-600`} aria-hidden="true" />;
    case "excel":
      return <FileSpreadsheet className={`${baseClassName} text-emerald-600`} aria-hidden="true" />;
    case "locations":
      return <MapPin className={blueClassName} aria-hidden="true" />;
    case "permissions":
      return <ShieldCheck className={blueClassName} aria-hidden="true" />;
    case "security":
      return <LockKeyhole className={`${baseClassName} text-red-600`} aria-hidden="true" />;
    case "help":
      return <CircleHelp className={blueClassName} aria-hidden="true" />;
  }
}

export function PageTitle({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon: PageTitleIconKind;
  className?: string;
}) {
  return (
    <h1 className={cn("flex items-center gap-3 text-2xl font-bold", className)}>
      <PageTitleIcon kind={icon} />
      <span>{children}</span>
    </h1>
  );
}
