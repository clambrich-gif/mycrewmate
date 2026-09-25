import { Grid2X2, LayoutList } from "lucide-react";

export type ViewMode = "liste" | "kacheln";

export function ViewModeToggle({
  mode,
  onChange,
  className = "",
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`hidden items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs md:inline-flex ${className}`}
      aria-label="Ansicht wählen"
    >
      <button
        type="button"
        onClick={() => onChange("liste")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          mode === "liste"
            ? "bg-blue-600 text-white shadow-xs"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <LayoutList className="size-3.5" />
        Liste
      </button>
      <button
        type="button"
        onClick={() => onChange("kacheln")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          mode === "kacheln"
            ? "bg-blue-600 text-white shadow-xs"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Grid2X2 className="size-3.5" />
        Kacheln
      </button>
    </div>
  );
}
