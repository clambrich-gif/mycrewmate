import { LayoutDashboard, List } from "lucide-react";

export type DashboardView = "overview" | "details";

export function DashboardViewToggle({
  view,
  onChange,
  className = "",
}: {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs ${className}`}
      aria-label="Dashboard-Ansicht wählen"
    >
      <button
        type="button"
        onClick={() => onChange("overview")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          view === "overview"
            ? "bg-blue-600 text-white shadow-xs"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={view === "overview"}
        title="Reduzierte Übersicht mit den wichtigsten nächsten Schritten"
      >
        <LayoutDashboard className="size-3.5" />
        Übersicht
      </button>
      <button
        type="button"
        onClick={() => onChange("details")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          view === "details"
            ? "bg-blue-600 text-white shadow-xs"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={view === "details"}
        title="Vollständige Dashboard-Ansicht mit allen Detaildaten"
      >
        <List className="size-3.5" />
        Details
      </button>
    </div>
  );
}
