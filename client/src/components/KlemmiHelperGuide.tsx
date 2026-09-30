import { Button } from "@/components/ui/button";
import { KlemmiGuideCard } from "@/components/KlemmiGuideCard";
import { KlemmiMascot, KlemmiTriggerMascot } from "@/components/KlemmiMascot";
import { KlemmiVoiceControl } from "@/components/KlemmiVoiceControl";
import { useKlemmiVoice } from "@/hooks/useKlemmiVoice";
import { isKlemmiAudioId } from "@/lib/klemmiAudio";
import { getKlemmiFeatureContext } from "@/lib/klemmi-feature-context";
import { cn } from "@/lib/utils";
import type { ProductPackageId } from "@shared/product-packages";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileDown,
  Gift,
  MessageCircle,
  PartyPopper,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GuideStepKey =
  | "overview"
  | "person"
  | "contact"
  | "details"
  | "availability-entry"
  | "donation"
  | "save"
  | "availability"
  | "plan-fill"
  | "action-whatsapp"
  | "feedback"
  | "action-donation"
  | "action-pdf"
  | "action-edit"
  | "action-delete";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

type KlemmiHelperGuideProps = {
  helperDialogOpen: boolean;
  guideHelperId: number | null;
  viewMode: "liste" | "kacheln";
  currentPackageId: ProductPackageId;
  onOpenHelperDialog: () => void;
  onCloseHelperDialog: () => void;
  onGuideOpenChange: (open: boolean) => void;
  onViewModeChange: (mode: "liste" | "kacheln") => void;
};

type GuideStep = {
  key: GuideStepKey;
  selector?: string;
  helperScoped?: boolean;
  showHelperCard?: boolean;
  eyebrow: string;
  title: string;
  text: string;
  action: string;
  audioKey?: string;
};

const guideSteps: GuideStep[] = [
  {
    key: "overview",
    selector: '[data-klemmi-target="new-helper"]',
    eyebrow: "1 · Helferübersicht",
    title: "Hier beginnt ein neuer Helfer",
    text: "Du startest immer in der Helferübersicht. Über den markierten Button „Neuer Helfer“ öffnest du die Anlage für eine neue Person. Ich zeige dir jetzt zuerst den Weg dorthin und öffne anschließend nur eine leere Eingabe – gespeichert wird dabei nichts.",
    action: "Anlage öffnen",
  },
  {
    key: "person",
    selector: '[data-klemmi-target="new-helper-name"]',
    eyebrow: "2 · Helfer anlegen",
    title: "Mit einem eindeutigen Namen beginnen",
    text: "Hier startet jeder Helfer. Der Name ist die einzige Pflichtangabe und sorgt dafür, dass das Planungsteam die Person in Helferliste, Einsatzplan und persönlicher PDF eindeutig wiederfindet. Diese Führung öffnet nur die leere Anlage – sie speichert nichts.",
    action: "Kontaktdaten zeigen",
  },
  {
    key: "contact",
    selector: '[data-klemmi-target="new-helper-contact"]',
    eyebrow: "3 · Helfer anlegen",
    title: "Kontaktwege für Rückfragen ergänzen",
    text: "Ansprechpartner und Telefonnummer sind optional, aber sehr hilfreich: Das Team weiß, wer zuständig ist und kann den Helfer bei einer Rückfrage oder kurzfristigen Änderung direkt erreichen.",
    action: "Hinweise zeigen",
  },
  {
    key: "details",
    selector: '[data-klemmi-target="new-helper-details"]',
    eyebrow: "4 · Helfer anlegen",
    title: "Hinweise und Begleitung festhalten",
    text: "Besondere Hinweise erscheinen später in der persönlichen Helfer-PDF. Eine Begleitung wird im Einsatzplan sichtbar, damit das Team bei der Schichtplanung genau weiß, wer zusätzlich mitkommt.",
    action: "Spende zeigen",
  },
  {
    key: "availability-entry",
    selector: '[data-klemmi-target="new-helper-availability"]',
    eyebrow: "5 · Verfügbarkeit direkt erfassen",
    title: "Pro Tag schon beim Anlegen klar planen",
    text: "Dieser Abschnitt ist optional. „Ja“ bedeutet: an diesem Tag ganztägig planbar. „Ja mit Uhr“ öffnet ein Zeitfenster von bis. „Nein“ schützt vor einer falschen Einteilung. „Unklar“ bedeutet: Die Rückmeldung fehlt noch, also bitte noch nicht verbindlich einplanen. Ohne Auswahl bleibt jeder aktive Tag zunächst auf Unklar.",
    action: "Spende zeigen",
  },
  {
    key: "donation",
    selector: '[data-klemmi-target="new-helper-donation"]',
    eyebrow: "6 · Helfer anlegen",
    title: "Spende direkt mit erfassen",
    text: "Wenn jemand Kuchen, Salat, Snacks oder eine andere Spende zusagt, öffnet dieses Feld die vollständige Spendenerfassung. So bleiben Verpflegung, Eigenschaften und Absprachen von Anfang an beim richtigen Helfer nachvollziehbar.",
    action: "Speichern erklären",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="new-helper-submit"]',
    eyebrow: "7 · Helfer vollständig speichern",
    title: "Erst speichern – dann kann das Team planen",
    text: "Mit „Helfer anlegen“ oder „Helfer & Spende anlegen“ wird die Person vollständig übernommen. Erst danach steht sie dem Planungsteam im Einsatzplan zur Auswahl. Für diese Erklärung musst du den Button nicht drücken.",
    action: "Verfügbarkeit zeigen",
  },
  {
    key: "availability",
    selector: '[data-klemmi-target="helper-availability"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "8 · Verfügbarkeit später nachpflegen",
    title: "Tage und Zeitfenster realistisch festlegen",
    text: "Nach dem Speichern bleiben dieselben Tagesverfügbarkeiten direkt an der Helferkarte bearbeitbar. „Ja“ bedeutet ganztägig planbar; die Uhr zeigt ein begrenztes Zeitfenster. „Nein“ schützt vor einer falschen Einteilung, „Unklar“ wartet auf Rückmeldung. So kann das Team Angaben jederzeit sauber nachpflegen.",
    action: "Planungsablauf zeigen",
  },
  {
    key: "plan-fill",
    selector: '[data-klemmi-target="helper-plan-context"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "9 · Einsatzplan füllen",
    title: "Das Team füllt danach die passenden Schichten",
    text: "Sobald Helfer gespeichert und Verfügbarkeiten gepflegt sind, teilt das Planungsteam sie im Einsatzplan den offenen Schichten zu. Die Tageszeichen, Zeitfenster, Begleitungen und bereits belegten Einsätze helfen dabei, Überlappungen zu vermeiden und jede Schicht passend zu füllen.",
    action: "WhatsApp erklären",
  },
  {
    key: "action-whatsapp",
    selector: '[data-klemmi-target="helper-action-whatsapp"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "10 · Helferplan senden",
    title: "Nach vollständiger Planung per WhatsApp anfragen",
    text: "Ist der Einsatzplan für diesen Helfer fertig, öffnet das grüne Symbol die passende WhatsApp-Vorlage. Die Nachricht kann den persönlichen Helferplan mit PDF-Link enthalten und bittet verbindlich um Rückmeldung. In dieser Tour wird nichts versendet.",
    action: "Rückmeldung erklären",
  },
  {
    key: "feedback",
    selector: '[data-klemmi-target="helper-feedback"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "11 · Rückmeldung übernehmen",
    title: "Erst die Antwort macht die Besetzung verbindlich",
    text: "Antwortet der Helfer, trägt das Team „Helfen: Ja“ oder „Nein“ ein und setzt die Bestätigung passend zur Rückmeldung. Das ist wichtig: Nur bestätigte Zusagen machen sichtbar, welche Schichten wirklich sicher sind und wo noch Ersatz gebraucht wird.",
    action: "Spendenzeichen zeigen",
  },
  {
    key: "action-donation",
    selector: '[data-klemmi-target="helper-action-donation"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "Weitere Zeichen am Helfer",
    title: "Geschenk: Spenden dieses Helfers",
    text: "Das Geschenk ganz links öffnet die Spendenübersicht genau für diese Person. Dort lassen sich Kuchen, Salate oder Snacks mit Eigenschaften und Hinweisen erfassen und später wiederfinden.",
    action: "PDF zeigen",
  },
  {
    key: "action-pdf",
    selector: '[data-klemmi-target="helper-action-pdf"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "Weitere Zeichen am Helfer",
    title: "Persönlichen Helferplan als PDF bereitstellen",
    text: "Das blaue Symbol erzeugt die persönliche Aufgaben-PDF mit Einsätzen, Hinweisen und Verfügbarkeiten. Sie kann nach der Planung heruntergeladen oder über die WhatsApp-Vorlage verlinkt werden. In dieser Erklärung wird nichts heruntergeladen.",
    action: "Bearbeiten zeigen",
  },
  {
    key: "action-edit",
    selector: '[data-klemmi-target="helper-action-edit"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "Weitere Zeichen am Helfer",
    title: "Daten später sauber nachpflegen",
    text: "Der Stift öffnet die Bearbeitung. Telefonnummer, Ansprechpartner, Hinweis, Begleitung und Verfügbarkeiten können hier später ergänzt oder geändert werden, ohne den bisherigen Einsatzplan zu verlieren.",
    action: "Löschen erklären",
  },
  {
    key: "action-delete",
    selector: '[data-klemmi-target="helper-action-delete"]',
    helperScoped: true,
    showHelperCard: true,
    eyebrow: "Weitere Zeichen am Helfer",
    title: "Löschen nur, wenn es wirklich erlaubt ist",
    text: "Der Papierkorb ist nur rot und anklickbar, wenn dieser Helfer gelöscht werden darf. Bei geschützten oder bereits eingeteilten Personen bleibt er grau. So gehen keine wichtigen Planungsdaten versehentlich verloren.",
    action: "Tour abschließen",
  },

];

/** Paketbewusste Führung: gesperrte Helferfunktionen werden als Pro-Vorteil erklärt. */
export function getHelperGuideSteps(currentPackageId: ProductPackageId): GuideStep[] {
  const donationContext = getKlemmiFeatureContext("donations", currentPackageId);
  const whatsappContext = getKlemmiFeatureContext("whatsapp_templates", currentPackageId);
  const isEventPass = currentPackageId === "event_pass";
  if (!donationContext.isLocked && !whatsappContext.isLocked && !isEventPass) return guideSteps;

  return guideSteps.map(step => {
    if (step.key === "contact" && isEventPass) {
      return {
        ...step,
        title: "Fest dem Hauptadministrator zugeordnet",
        text: "Im Event Pass wird jeder Helfer automatisch dem Hauptadministrator als fester Ansprechperson zugeordnet. Weitere Ansprechpartner und die freie Zuordnung ergänzen das Light-Paket. Die Telefonnummer bleibt weiterhin optional und kann direkt hier gepflegt werden.",
        audioKey: "contact-event-pass",
      };
    }
    if (step.key === "donation") {
      return {
        ...step,
        title: "Spenden ab Pro verwalten",
        text: `Hier kannst du Sach- und Kuchenspenden erfassen. Hinweis: Die Spendenverwaltung ist ab dem Paket ${donationContext.targetPackageName} verfügbar.`,
        audioKey: "donation-locked",
      };
    }
    if (step.key === "save" && donationContext.isLocked) {
      return {
        ...step,
        title: "Helfer speichern – dann kann das Team planen",
        text: "Mit Helfer anlegen wird die Person vollständig übernommen. Erst danach steht sie dem Planungsteam im Einsatzplan zur Auswahl. Die gemeinsame Anlage einer Spende ergänzt das Pro-Paket. Für diese Erklärung musst du den Button nicht drücken.",
        audioKey: "save-locked",
      };
    }
    if (step.key === "action-whatsapp") {
      return {
        ...step,
        title: "Direkt schreiben – Vorlagen ab Pro",
        text: `Über den WhatsApp-Button kannst du Helfern direkt schreiben. Hinweis: Automatische Textvorlagen stehen ab dem Paket ${whatsappContext.targetPackageName} bereit – in deiner aktuellen Version tippst du die Nachricht einfach selbst ein.`,
        audioKey: "action-whatsapp-locked",
      };
    }
    if (step.key === "action-donation") {
      return {
        ...step,
        title: "Geschenk: Spenden ab Pro",
        text: `Das Geschenke-Symbol steht für Spenden, zum Beispiel Kuchen oder Snacks. Das Schloss zeigt: Die Spendenverwaltung wird ab dem Paket ${donationContext.targetPackageName} freigeschaltet. Helfer, Verfügbarkeiten und Einsatzplan bleiben vollständig nutzbar.`,
        audioKey: "action-donation-locked",
      };
    }
    return step;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stepIcon(key: GuideStepKey) {
  if (key === "save") return Save;
  if (key === "availability-entry" || key === "availability") return Clock3;
  if (key === "donation" || key === "action-donation") return Gift;
  if (key === "action-whatsapp") return MessageCircle;
  if (key === "action-pdf") return FileDown;
  if (key === "action-edit") return Pencil;
  if (key === "action-delete") return Trash2;
  return Sparkles;
}

/**
 * Rein erklärende, nicht-modale Tour über die echte Helferoberfläche.
 * Klemmi öffnet höchstens eine leere Helferanlage, löst aber nie Speichern,
 * Versand, Download, Bearbeiten oder Löschen aus.
 */
export function KlemmiHelperGuide({
  helperDialogOpen,
  guideHelperId,
  viewMode,
  currentPackageId,
  onOpenHelperDialog,
  onCloseHelperDialog,
  onGuideOpenChange,
  onViewModeChange,
}: KlemmiHelperGuideProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [openingPending, setOpeningPending] = useState(false);
  const [openingHelperForm, setOpeningHelperForm] = useState(false);
  const [narrationComplete, setNarrationComplete] = useState(false);
  const dialogOpenedByGuideRef = useRef(false);
  const returnViewModeRef = useRef<"liste" | "kacheln" | null>(null);
  const { muted, isSpeaking, speak, playOpening, toggleMuted, cancel } = useKlemmiVoice();
  const steps = useMemo(() => getHelperGuideSteps(currentPackageId), [currentPackageId]);
  const step = steps[stepIndex];
  const Icon = stepIcon(step.key);
  const selector = useMemo(() => {
    if (!step.selector) return null;
    if (!step.helperScoped) return step.selector;
    if (guideHelperId === null) return null;
    return `${step.selector}[data-klemmi-helper-id="${guideHelperId}"]`;
  }, [guideHelperId, step.helperScoped, step.selector]);
  const audioCandidate = celebrating ? "helpers-complete" : `helpers-${step.audioKey ?? step.key}`;
  const audioClipId = isKlemmiAudioId(audioCandidate) ? audioCandidate : undefined;
  const hasReferenceHelper = guideHelperId !== null;

  const closeGuide = () => {
    cancel();
    if (dialogOpenedByGuideRef.current && helperDialogOpen) onCloseHelperDialog();
    dialogOpenedByGuideRef.current = false;
    setOpen(false);
    setCelebrating(false);
    setNarrationComplete(false);
    setOpeningHelperForm(false);
    setHighlightRect(null);
    if (returnViewModeRef.current && returnViewModeRef.current !== viewMode) {
      onViewModeChange(returnViewModeRef.current);
    }
    returnViewModeRef.current = null;
    onGuideOpenChange(false);
  };

  useEffect(() => {
    if (!open || !step.showHelperCard) return;
    if (dialogOpenedByGuideRef.current && helperDialogOpen) onCloseHelperDialog();
    if (returnViewModeRef.current === null) returnViewModeRef.current = viewMode;
    if (viewMode !== "kacheln") onViewModeChange("kacheln");
  }, [helperDialogOpen, onCloseHelperDialog, onViewModeChange, open, step.showHelperCard, viewMode]);

  useEffect(() => {
    if (!open || !openingHelperForm || !helperDialogOpen) return;
    setOpeningHelperForm(false);
    setStepIndex(current => (current === 0 ? 1 : current));
  }, [helperDialogOpen, open, openingHelperForm]);

  useEffect(() => {
    if (!open || openingPending) return;
    let active = true;
    setNarrationComplete(false);
    const fallbackText = step.showHelperCard && !hasReferenceHelper
      ? `${step.title}. In dieser Helferliste ist noch keine vorhandene Helferkarte sichtbar. Sobald ein Helfer gespeichert ist, zeigt Klemmi hier genau diese Funktion direkt an der echten Karte.`
      : `${step.title}. ${step.text}`;
    const timeout = window.setTimeout(() => {
      void speak(fallbackText, audioClipId).finally(() => {
        if (active) setNarrationComplete(true);
      });
    }, 160);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      cancel();
    };
  }, [audioClipId, cancel, hasReferenceHelper, open, openingPending, speak, step.showHelperCard, step.text, step.title]);

  useLayoutEffect(() => {
    if (!open || celebrating || !selector || typeof window === "undefined") {
      setHighlightRect(null);
      return;
    }

    let frame = 0;
    const resolveVisibleTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? null;
    const syncPosition = () => {
      const element = resolveVisibleTarget();
      if (!element) {
        setHighlightRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const left = clamp(rect.left - 8, 8, Math.max(8, window.innerWidth - 20));
      const top = clamp(rect.top - 8, 8, Math.max(8, window.innerHeight - 20));
      setHighlightRect({
        top,
        left,
        width: Math.max(0, Math.min(rect.width + 16, window.innerWidth - left - 8)),
        height: Math.max(0, Math.min(rect.height + 16, window.innerHeight - top - 8)),
      });
    };
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncPosition);
    };

    window.setTimeout(() => {
      resolveVisibleTarget()?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      scheduleSync();
    }, 90);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, true);
    const mutationObserver = new MutationObserver(scheduleSync);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-state"],
    });
    scheduleSync();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync, true);
      mutationObserver.disconnect();
    };
  }, [celebrating, open, selector, stepIndex, viewMode]);

  const showPrevious = () => {
    if (stepIndex === 0) return;
    setStepIndex(current => Math.max(0, current - 1));
  };

  const showNext = () => {
    if (step.key === "overview") {
      dialogOpenedByGuideRef.current = true;
      setOpeningHelperForm(true);
      onOpenHelperDialog();
      return;
    }
    if (stepIndex === steps.length - 1) {
      setCelebrating(true);
      return;
    }
    setStepIndex(current => Math.min(current + 1, steps.length - 1));
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-klemmi-trigger
        className="min-h-11 min-w-0 gap-2 border-blue-200 bg-blue-50 px-3 text-blue-950 shadow-sm hover:border-blue-300 hover:bg-blue-100 max-sm:gap-1 max-sm:px-1.5 max-sm:text-xs max-sm:[&_.klemmi-trigger-mascot]:size-5 max-sm:[&_.klemmi-trigger-mascot_img]:size-5 max-sm:[&>svg]:size-3"
        onClick={() => {
          if (helperDialogOpen) onCloseHelperDialog();
          dialogOpenedByGuideRef.current = false;
          setStepIndex(0);
          setCelebrating(false);
          setOpeningHelperForm(false);
          setOpeningPending(true);
          setOpen(true);
          onGuideOpenChange(true);
          void playOpening().finally(() => setOpeningPending(false));
        }}
      >
        <KlemmiTriggerMascot />
        <span className="font-semibold">Klemmi zeigt&apos;s</span>
        <CircleHelp className="size-4" aria-hidden="true" />
      </Button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div data-klemmi-guide data-klemmi-tour-mode="informational" className="pointer-events-none fixed inset-0 z-[70]">
            {highlightRect && !celebrating && (
              <div
                aria-hidden="true"
                data-klemmi-highlight
                className="klemmi-guide-highlight absolute rounded-xl border-[3px] border-[#ff7a2f] bg-[#ff7a2f]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_0_6px_rgba(255,122,47,0.18)] transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
                style={highlightRect}
              />
            )}
            <KlemmiGuideCard>
              {celebrating ? (
                <div className="klemmi-celebration text-center" data-klemmi-success data-klemmi-narration-complete={narrationComplete ? "true" : "false"}>
                  <KlemmiMascot isSpeaking={isSpeaking} decorative className="klemmi-guide-mascot" />
                  <div className="klemmi-celebration-icon mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <PartyPopper className="size-8" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">Klemmi fasst zusammen</p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-950">Der Ablauf ist klar</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Helfer speichern, Verfügbarkeiten pflegen, Schichten passend füllen, den persönlichen Plan senden und die Antwort verbindlich eintragen – so bleibt der Einsatzplan zuverlässig.
                  </p>
                  <p data-klemmi-mobile-caption>Helferablauf erklärt.</p>
                  <Button
                    type="button"
                    data-klemmi-finish-control
                    className="mt-4 min-h-10 bg-[#ff7a2f] text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                    onClick={closeGuide}
                  >
                    <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
                    Fertig
                  </Button>
                </div>
              ) : (
                <>
                  <KlemmiMascot isSpeaking={isSpeaking} decorative className="klemmi-guide-mascot" />
                  <div className="flex items-start gap-3" data-klemmi-narration>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold tracking-wide text-[#e86117] uppercase">{step.eyebrow}</p>
                      <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-950 sm:text-lg">{step.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {step.showHelperCard && !hasReferenceHelper
                          ? "Sobald ein Helfer gespeichert ist, erklärt Klemmi diese Funktion direkt an der echten Helferkarte. Die Reihenfolge und der Zweck bleiben hier schon vollständig erklärt."
                          : step.text}
                      </p>
                      <p data-klemmi-mobile-caption>{step.title}</p>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                      <KlemmiVoiceControl muted={muted} onToggle={toggleMuted} />
                      <button
                        type="button"
                        data-klemmi-close-control
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:size-9"
                        aria-label="Klemmi-Anleitung schließen"
                        title="Anleitung schließen"
                        onClick={closeGuide}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3" data-klemmi-navigation>
                    <div className="flex items-center gap-1" aria-label={`Schritt ${stepIndex + 1} von ${steps.length}`}>
                      {steps.map(item => (
                        <span
                          key={item.key}
                          className={cn(
                            "h-1.5 w-4 rounded-full transition-colors sm:w-5",
                            item.key === step.key ? "bg-[#ff7a2f]" : "bg-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-2">
                      {stepIndex > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-klemmi-back-control
                          className="min-h-10 shrink-0 px-2 text-slate-700"
                          onClick={showPrevious}
                        >
                          <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                          Zurück
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        data-klemmi-next-control
                        data-klemmi-narration-complete={narrationComplete ? "true" : "false"}
                        className="min-h-10 min-w-0 max-w-full whitespace-normal bg-[#ff7a2f] px-3 text-right text-white hover:bg-[#e86117] focus-visible:ring-[#ff7a2f]"
                        onClick={showNext}
                      >
                        <Icon className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{step.action}</span>
                        <ChevronRight className="ml-1 size-4 shrink-0" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </KlemmiGuideCard>
          </div>,
          document.body
        )}
    </>
  );
}
