import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

type MyTasksDefaultPinProps = {
  pressed: boolean;
  disabled?: boolean;
  label?: string;
  onPressedChange: (pressed: boolean) => void;
};

/** Kleine, direkt neben dem Schnellfilter platzierte Steuerung für dessen Standardansicht. */
export function MyTasksDefaultPin({
  pressed,
  disabled = false,
  label = "Meine Aufgaben",
  onPressedChange,
}: MyTasksDefaultPinProps) {
  const nextStateLabel = pressed
    ? `${label} nicht mehr als Standard-Ansicht merken`
    : `${label} als Standard-Ansicht merken`;

  return (
    <button
      type="button"
      data-slot="my-tasks-default-pin"
      aria-label={nextStateLabel}
      aria-pressed={pressed}
      title={nextStateLabel}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        pressed
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
      )}
    >
      <Pin
        className={cn("h-3.5 w-3.5", pressed && "fill-current")}
        aria-hidden="true"
      />
    </button>
  );
}
