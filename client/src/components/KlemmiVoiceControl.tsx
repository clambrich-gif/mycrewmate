import { Volume2, VolumeX } from "lucide-react";

const DEFAULT_KLEMMI_VOICE_LABELS = {
  on: "Klemmi-Stimme stummschalten",
  off: "Klemmi-Stimme einschalten",
} as const;

type KlemmiVoiceControlProps = {
  muted: boolean;
  onToggle: () => void;
  /** Optional für Schulungen mit neutralem Sprecher und Klemmi. */
  labelPrefix?: string;
};

export function KlemmiVoiceControl({
  muted,
  onToggle,
  labelPrefix = "Klemmi-Stimme",
}: KlemmiVoiceControlProps) {
  const label =
    labelPrefix === "Klemmi-Stimme"
      ? muted
        ? DEFAULT_KLEMMI_VOICE_LABELS.off
        : DEFAULT_KLEMMI_VOICE_LABELS.on
      : muted
        ? `${labelPrefix} einschalten`
        : `${labelPrefix} stummschalten`;

  return (
    <button
      type="button"
      data-klemmi-voice-control
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:size-9"
      aria-label={label}
      title={label}
      aria-pressed={muted}
      onClick={onToggle}
    >
      {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
    </button>
  );
}
