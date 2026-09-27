import { Button } from "@/components/ui/button";
import { FirstLoginKlemmiIntro } from "@/components/FirstLoginKlemmiIntro";
import { KlemmiTriggerMascot } from "@/components/KlemmiMascot";
import { klemmiAudioUrl } from "@/lib/klemmiAudio";
import { CalendarDays, CheckCircle2, ClipboardList, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Ausschließlich lokale Staging-Vorschau. Die Seite enthält keine Konten,
 * Planungsdaten oder Mutationen und wird im Produktivrouter nicht registriert.
 */
export default function KlemmiFirstLoginPreview() {
  const [introOpen, setIntroOpen] = useState(true);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewSpeaking, setPreviewSpeaking] = useState(false);
  const [isCoAdmin, setIsCoAdmin] = useState(
    () => new URLSearchParams(window.location.search).get("coAdmin") === "1"
  );

  const restartPreview = (nextIsCoAdmin = isCoAdmin) => {
    const clipId = nextIsCoAdmin ? "first-login-co-admin" : "first-login-intro";
    previewAudioRef.current?.pause();
    setPreviewSpeaking(false);
    const audio = new Audio(klemmiAudioUrl(clipId));
    audio.preload = "auto";
    audio.volume = 0.9;
    previewAudioRef.current = audio;
    const release = () => {
      if (previewAudioRef.current !== audio) return;
      previewAudioRef.current = null;
      setPreviewSpeaking(false);
    };
    audio.onplay = () => setPreviewSpeaking(true);
    audio.onended = release;
    audio.onerror = release;
    // Direkter Klick startet die Vorschau zuverlässig mit Ton; die reguläre
    // Produktansicht versucht ihren Clip weiterhin nach dem Willkommensfenster.
    void audio.play().catch(release);
    setIsCoAdmin(nextIsCoAdmin);
    setIntroOpen(false);
    window.requestAnimationFrame(() => setIntroOpen(true));
  };

  useEffect(() => () => previewAudioRef.current?.pause(), []);

  return (
    <main className="min-h-dvh bg-slate-50 p-4 text-slate-950 sm:p-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">Staging-Prototyp · keine Echtdaten</p>
            <h1 className="mt-0.5 text-xl font-bold">Klemmi nach dem Erst-Login</h1>
            <p className="mt-1 text-sm text-slate-600">Die Vorschau startet nach dem 15-Sekunden-Willkommensfenster.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
              onClick={() => restartPreview(false)}
            >
              Standardansicht mit Ton starten
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-blue-200 bg-blue-50 text-blue-950 hover:bg-blue-100"
              onClick={() => restartPreview(true)}
            >
              Co-Admin-Hinweis mit Ton starten
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-wide text-blue-700 uppercase">MyCrewMate</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Dashboard</h2>
              <p className="mt-1 text-sm text-slate-600">Die wichtigsten nächsten Schritte stehen zuerst.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              data-klemmi-trigger="staging-preview"
              className="min-h-11 gap-2 border-blue-200 bg-blue-50 px-3 text-blue-950 shadow-sm"
            >
              <KlemmiTriggerMascot />
              <span className="font-semibold">Klemmi zeigt&apos;s</span>
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [UsersRound, "Helfer", "18 Rückmeldungen"],
              [ClipboardList, "Einsatzplan", "4 offene Schichten"],
              [CalendarDays, "Vorbereitung", "2 nächste Fristen"],
            ].map(([Icon, title, detail]) => {
              const CardIcon = Icon as typeof UsersRound;
              return (
                <div key={String(title)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <CardIcon className="size-5 text-blue-700" aria-hidden="true" />
                  <p className="mt-3 font-bold">{String(title)}</p>
                  <p className="mt-1 text-sm text-slate-600">{String(detail)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            Die eigentliche Anwendung bleibt während Klemmis Hinweis sichtbar.
          </div>
        </div>
      </section>

      <FirstLoginKlemmiIntro
        open={introOpen}
        isCoAdmin={isCoAdmin}
        autoSpeak={false}
        externalSpeaking={previewSpeaking}
        onComplete={() => setIntroOpen(false)}
      />
    </main>
  );
}
