import { cn } from "@/lib/utils";
import {
  CalendarRange,
  Check,
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
  UserCheck,
  UserRound,
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

  switch (kind) {
    case "dashboard":
      return (
        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
          <LayoutDashboard className={`${baseClassName} text-blue-700`} />
          <span className="absolute right-0 top-0 size-2 rounded-full bg-orange-500 ring-2 ring-white" />
        </span>
      );
    case "contacts":
      return (
        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
          <UserCheck className={`${baseClassName} text-blue-600`} />
          <Check className="absolute bottom-0 right-0 size-3.5 rounded-full bg-white text-orange-500" />
        </span>
      );
    case "helpers":
      return (
        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
          <Users className={`${baseClassName} text-blue-900`} />
          <UserRound className="absolute bottom-0 right-0 size-3.5 rounded-full bg-white text-orange-500" />
        </span>
      );
    case "plan":
      return <CalendarRange className={`${baseClassName} text-blue-600`} aria-hidden="true" />;
    case "preparation":
      return <ClipboardList className={`${baseClassName} text-orange-500`} aria-hidden="true" />;
    case "postprocessing":
      return <ClipboardCheck className={`${baseClassName} text-orange-500`} aria-hidden="true" />;
    case "materials":
      return <Package className={`${baseClassName} text-blue-600`} aria-hidden="true" />;
    case "donations":
      return <Gift className={`${baseClassName} text-orange-500`} aria-hidden="true" />;
    case "finances":
      return <Wallet className={`${baseClassName} text-blue-600`} aria-hidden="true" />;
    case "pdf":
      return <FileDown className={`${baseClassName} text-red-600`} aria-hidden="true" />;
    case "excel":
      return <FileSpreadsheet className={`${baseClassName} text-emerald-600`} aria-hidden="true" />;
    case "locations":
      return <MapPin className={`${baseClassName} text-blue-600`} aria-hidden="true" />;
    case "permissions":
      return (
        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
          <ShieldCheck className={`${baseClassName} text-blue-600`} />
          <Check className="absolute bottom-0 right-0 size-3.5 rounded-full bg-white text-orange-500" />
        </span>
      );
    case "security":
      return <LockKeyhole className={`${baseClassName} text-red-600`} aria-hidden="true" />;
    case "help":
      return (
        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
          <CircleHelp className={`${baseClassName} text-blue-600`} />
          <span className="absolute inset-0 flex items-center justify-center pb-px text-[11px] font-black leading-none text-orange-500">
            ?
          </span>
        </span>
      );
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
