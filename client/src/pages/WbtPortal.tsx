import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  WBT_TRACKS,
  type WbtTrackId,
  type WbtChapter,
  type WbtStep
} from "@/wbt/wbtData";
import {
  INITIAL_SIMULATED_HELPERS,
  INITIAL_SIMULATED_SHIFTS,
  INITIAL_SIMULATED_DONATIONS,
  type SimulatedHelper,
  type SimulatedShift,
  type SimulatedDonation
} from "@/wbt/wbtSimData";
import { KlemmiMascot } from "@/components/KlemmiMascot";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Gift,
  GraduationCap,
  Info,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  MapPinned,
  MessageSquare,
  Package,
  Phone,
  Play,
  RotateCcw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WbtPortal() {
  const [, setLocation] = useLocation();

  // URL-Parameter für direkten Pfadstart (z.B. ?track=helper oder ?track=admin)
  const initialTrackId = useMemo<WbtTrackId | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("track");
    if (t === "helper" || t === "admin") return t;
    return null;
  }, []);

  const [activeTrackId, setActiveTrackId] = useState<WbtTrackId | null>(initialTrackId);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [showingSummary, setShowingSummary] = useState<boolean>(false);
  const [isSimulationCompleted, setIsSimulationCompleted] = useState<boolean>(false);

  // Simulierte Zustände für Interaktion
  const [simHelpers, setSimHelpers] = useState<SimulatedHelper[]>(INITIAL_SIMULATED_HELPERS);
  const [simShifts, setSimShifts] = useState<SimulatedShift[]>(INITIAL_SIMULATED_SHIFTS);
  const [simDonations, setSimDonations] = useState<SimulatedDonation[]>(INITIAL_SIMULATED_DONATIONS);

  // Simulation State: Formulare
  const [newHelperName, setNewHelperName] = useState("");
  const [newHelperPhone, setNewHelperPhone] = useState("");
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppMode, setWhatsAppMode] = useState<"muster1" | "muster2">("muster1");
  const [editAvailabilityOpen, setEditAvailabilityOpen] = useState(false);
  const [availText, setAvailText] = useState("Samstag 08:00–14:00 Uhr");
  const [cakeText, setCakeText] = useState("Apfelkuchen (nussfrei)");

  const currentTrack = activeTrackId ? WBT_TRACKS[activeTrackId] : null;
  const currentChapter = currentTrack ? currentTrack.chapters[currentChapterIndex] : null;
  const currentStep = currentChapter ? currentChapter.steps[currentStepIndex] : null;

  // Fortschritt in Prozent
  const progressPercent = useMemo(() => {
    if (!currentTrack) return 0;
    const totalChapters = currentTrack.chapters.length;
    return Math.round((completedChapters.length / totalChapters) * 100);
  }, [currentTrack, completedChapters]);

  // Wechsel des Trainingspfads
  const selectTrack = (trackId: WbtTrackId) => {
    setActiveTrackId(trackId);
    setCurrentChapterIndex(0);
    setCurrentStepIndex(0);
    setCompletedChapters([]);
    setShowingSummary(false);
    setIsSimulationCompleted(false);
    // Reset Sim Data
    setSimHelpers(INITIAL_SIMULATED_HELPERS);
  };

  const handleNextStep = () => {
    if (!currentChapter) return;
    if (currentStepIndex < currentChapter.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Kapitel abgeschlossen -> Klemmi-Zusammenfassung zeigen
      setShowingSummary(true);
      if (!completedChapters.includes(currentChapter.id)) {
        setCompletedChapters(prev => [...prev, currentChapter.id]);
      }
    }
  };

  const handleNextChapter = () => {
    if (!currentTrack) return;
    setShowingSummary(false);
    if (currentChapterIndex < currentTrack.chapters.length - 1) {
      setCurrentChapterIndex(prev => prev + 1);
      setCurrentStepIndex(0);
    } else {
      // Gesamtes Training abgeschlossen!
      setIsSimulationCompleted(true);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    } else if (currentChapterIndex > 0) {
      setCurrentChapterIndex(prev => prev - 1);
      const prevChapter = currentTrack?.chapters[currentChapterIndex - 1];
      setCurrentStepIndex(prevChapter ? prevChapter.steps.length - 1 : 0);
      setShowingSummary(false);
    }
  };

  // Interaktions-Simulationen im 6-Schritte-Helfer-Modul
  const handleSimAddHelper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHelperName.trim()) return;
    const newHelper: SimulatedHelper = {
      id: "h" + (simHelpers.length + 1),
      name: newHelperName.trim(),
      phone: newHelperPhone.trim() || "+49 170 0000000",
      email: "helfer@muster.de",
      status: "angelegt",
      availability: "Noch nicht erfragt",
      donation: "Noch keine"
    };
    setSimHelpers([newHelper, ...simHelpers]);
    setNewHelperName("");
    setNewHelperPhone("");
    setHelperModalOpen(false);
    handleNextStep();
  };

  const handleSimContactHelper = () => {
    setSimHelpers(simHelpers.map(h => h.id === "h1" ? { ...h, status: "kontaktiert" } : h));
    setWhatsAppModalOpen(false);
    handleNextStep();
  };

  const handleSimSaveAvailability = () => {
    setSimHelpers(simHelpers.map(h => h.id === "h1" ? {
      ...h,
      status: "verfuegbar",
      availability: availText,
      donation: cakeText
    } : h));
    setEditAvailabilityOpen(false);
    handleNextStep();
  };

  const handleSimWaitForPlanning = () => {
    setSimHelpers(simHelpers.map(h => h.id === "h1" ? {
      ...h,
      status: "zugewiesen",
      station: "Streckenposten Nord (Gefahrenkurve K44)",
      timeWindow: "08:30–13:30"
    } : h));
    handleNextStep();
  };

  const handleSimSendPlan = () => {
    setSimHelpers(simHelpers.map(h => h.id === "h1" ? { ...h, status: "plan_gesendet" } : h));
    setWhatsAppModalOpen(false);
    handleNextStep();
  };

  const handleSimConfirmHelper = () => {
    setSimHelpers(simHelpers.map(h => h.id === "h1" ? { ...h, status: "bestaetigt" } : h));
    handleNextStep();
  };

  // -------------------------------------------------------------
  // VIEW 1: STARTSEITE / TRACK-AUSWAHL
  // -------------------------------------------------------------
  if (!activeTrackId) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Header */}
        <header className="border-b bg-white shadow-xs">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight sm:text-xl">MyCrewMate Lernwerkstatt</h1>
                <p className="text-xs text-slate-500">Eigenständiges, interaktives Web-Based-Training (WBT)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                <span className="mr-1.5 size-2 rounded-full bg-emerald-500 animate-pulse" />
                Schulungsmodus · 100% datenfrei
              </Badge>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="border-b bg-gradient-to-b from-blue-50/70 via-white to-slate-50 px-4 py-10 sm:py-14">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-4 border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-100">
              Interaktive Online-Schulung
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Gemeinsam planen. Entspannt schulen.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Wähle deinen Trainingspfad. Du lernst alle Handgriffe in einer interaktiven Simulation mit Klemmi –
              vollständig getrennt von der echten Vereinsdatenbank. Perfekt für neue Helferkoordinatoren,
              Vorstände und das Planungsteam!
            </p>
          </div>
        </div>

        {/* Track Selection Cards */}
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* WBT 1: Helferkoordination */}
            <Card className="relative flex flex-col justify-between overflow-hidden border-2 border-blue-200 bg-white shadow-md transition-all hover:border-blue-400 hover:shadow-lg">
              <div className="absolute right-0 top-0 h-2 w-full bg-gradient-to-r from-blue-600 to-cyan-500" />
              <CardHeader className="pt-6">
                <div className="flex items-center justify-between">
                  <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-100">
                    WBT 1 · Helferkoordination
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">7 Module · ca. 20 Min.</span>
                </div>
                <CardTitle className="mt-3 text-xl font-bold text-slate-950">
                  {WBT_TRACKS.helper.title}
                </CardTitle>
                <CardDescription className="text-sm font-medium text-slate-600">
                  {WBT_TRACKS.helper.targetGroup}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                  {WBT_TRACKS.helper.description}
                </p>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
                  <strong className="block font-semibold text-blue-950">Enthaltene Module:</strong>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-blue-900">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Dashboard</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Helfer (6 Schritte)</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Vorbereitung</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Nachbereitung</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Material & Logistik</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-blue-600" /> Spenden (Kuchen)</span>
                    <span className="flex items-center gap-1.5 col-span-2"><CheckCircle2 className="size-3.5 text-blue-600" /> Hilfe & Klemmi</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => selectTrack("helper")}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  >
                    <Play className="mr-2 size-4" />
                    WBT Helferkoordination starten
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* WBT 2: Planungsteam & Administration */}
            <Card className="relative flex flex-col justify-between overflow-hidden border-2 border-orange-200 bg-white shadow-md transition-all hover:border-orange-400 hover:shadow-lg">
              <div className="absolute right-0 top-0 h-2 w-full bg-gradient-to-r from-orange-600 to-amber-500" />
              <CardHeader className="pt-6">
                <div className="flex items-center justify-between">
                  <Badge className="bg-orange-100 text-orange-950 hover:bg-orange-100">
                    WBT 2 · Planungsteam & Admin
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">11 Module · ca. 40 Min.</span>
                </div>
                <CardTitle className="mt-3 text-xl font-bold text-slate-950">
                  {WBT_TRACKS.admin.title}
                </CardTitle>
                <CardDescription className="text-sm font-medium text-slate-600">
                  {WBT_TRACKS.admin.targetGroup}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                  {WBT_TRACKS.admin.description}
                </p>

                <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-xs">
                  <strong className="block font-semibold text-orange-950">Kompletter Umfang plus Admin-Module:</strong>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-orange-950">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-orange-600" /> Alle Helfer-Module</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-orange-600" /> Einsatzplan & Schichten</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-orange-600" /> Finanzen & Saldo</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-orange-600" /> Orte & GPX-Karten</span>
                    <span className="flex items-center gap-1.5 col-span-2 font-bold text-orange-900">
                      <ShieldCheck className="size-3.5 text-orange-600" />
                      Schwerpunkt: Schutz & Protokolle (MFA, Rechte, Audit)
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => selectTrack("admin")}
                    className="w-full bg-orange-600 text-white hover:bg-orange-700 shadow-sm"
                  >
                    <Play className="mr-2 size-4" />
                    WBT Planungsteam & Admin starten
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hinweis zur späteren externen E-Mail-Nutzung */}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Share2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Spätere externe Schulungslinks vorbereiten</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Nach der Freigabe erhält dieses WBT eine eigene, loginfreie Schulungsadresse. Diese aktuelle
                    Fassung bleibt bewusst nur als isolierte Vorschau und ist noch nicht in MyCrewMate verlinkt.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-slate-300"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Schulungs-Link in die Zwischenablage kopiert!");
                  }
                }}
              >
                Vorschau-Link kopieren
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: GESAMT-ABSCHLUSS DES WBT
  // -------------------------------------------------------------
  if (isSimulationCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-12">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 shadow-md">
            <Award className="size-10" />
          </div>

          <Badge className="mt-6 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
            Training erfolgreich absolviert!
          </Badge>

          <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
            Herzlichen Glückwunsch!
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Du hast das <strong>{currentTrack?.title}</strong> vollständig durchlaufen.
            Du kennst nun alle zentralen Abläufe und weißt, wie MyCrewMate dein Event entspannt und sicher macht.
          </p>

          {/* Klemmi Abschluss-Box */}
          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/70 p-6 text-left">
            <div className="flex items-start gap-4">
              <div className="size-16 shrink-0">
                <KlemmiMascot className="size-16" isSpeaking={false} decorative />
              </div>
              <div>
                <h3 className="font-bold text-blue-950">Klemmis Fazit:</h3>
                <p className="mt-1 text-sm leading-relaxed text-blue-900">
                  „Super gemacht! Du hast bewiesen, dass Planung im Ehrenamt richtig Spaß machen kann, wenn die
                  Schritte klar sind. Egal ob Helferkontakt, Schichten oder Berechtigungen: Du bist bestens vorbereitet.
                  Falls du im echten Event mal eine Frage hast: Klick mich einfach an!“
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setActiveTrackId(null)}
              className="border-slate-300"
            >
              <RotateCcw className="mr-2 size-4" />
              Zurück zur WBT-Übersicht
            </Button>
            <Button
              onClick={() => setActiveTrackId(null)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Anderen Trainingspfad wählen
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: KAPITEL-ZUSAMMENFASSUNG DURCH CLEMMIE
  // -------------------------------------------------------------
  if (showingSummary && currentChapter) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
          <div className="flex items-center justify-between border-b pb-4">
            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-900">
              Kapitel abgeschlossen: {currentChapter.title}
            </Badge>
            <span className="text-xs font-semibold text-slate-500">
              Kapitel {currentChapterIndex + 1} von {currentTrack?.chapters.length}
            </span>
          </div>

          {/* Klemmi Illustration & Sprechblase */}
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="relative mb-4 size-24 sm:size-28">
              <KlemmiMascot className="size-24 sm:size-28" isSpeaking={true} decorative />
            </div>

            <h3 className="text-xl font-black text-slate-950 sm:text-2xl">
              {currentChapter.klemmiSummary.heading}
            </h3>

            <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50/80 p-5 text-left shadow-sm">
              <p className="text-base leading-relaxed text-blue-950 sm:text-lg">
                „{currentChapter.klemmiSummary.text}“
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-blue-200 pt-3 text-xs font-bold text-blue-900">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Kern-Erkenntnis: {currentChapter.klemmiSummary.takeaway}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t pt-6">
            <Button
              variant="ghost"
              onClick={() => setShowingSummary(false)}
              className="text-slate-600"
            >
              <ArrowLeft className="mr-2 size-4" />
              Schritte nochmals ansehen
            </Button>
            <Button
              onClick={handleNextChapter}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              {currentChapterIndex < (currentTrack?.chapters.length ?? 0) - 1
                ? "Nächstes Kapitel starten"
                : "Training abschließen"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 4: INTERAKTIVER SCHULUNGSBILDSCHIRM (SIMULATION)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Top Banner: Schulungs-Modus Bar */}
      <div className="bg-slate-950 px-4 py-2.5 text-xs font-medium text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTrackId(null)}
              className="h-7 px-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              WBT-Übersicht
            </Button>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="font-semibold text-white">{currentTrack?.title}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-slate-400">Fortschritt:</span>
              <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-bold text-blue-400">{progressPercent}%</span>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Simulationsmodus · Keine echten Daten
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 mx-auto w-full max-w-7xl p-3 sm:p-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">

        {/* Linke Leiste: Kapitel & Module Navigation */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="border-b pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Trainingsmodule ({currentTrack?.chapters.length})
              </span>
              <h3 className="mt-1 font-bold text-slate-900">{currentChapter?.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{currentChapter?.subtitle}</p>
            </div>

            <nav className="mt-4 space-y-1.5">
              {currentTrack?.chapters.map((chap: WbtChapter, idx: number) => {
                const isActive = idx === currentChapterIndex;
                const isDone = completedChapters.includes(chap.id);
                return (
                  <button
                    key={chap.id}
                    onClick={() => {
                      setCurrentChapterIndex(idx);
                      setCurrentStepIndex(0);
                      setShowingSummary(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : isDone
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate pr-2">{chap.title}</span>
                    {isDone ? (
                      <CheckCircle2 className={`size-4 shrink-0 ${isActive ? "text-white" : "text-emerald-600"}`} />
                    ) : (
                      <span className={`text-[10px] font-normal ${isActive ? "text-blue-200" : "text-slate-400"}`}>
                        {chap.steps.length} {chap.steps.length === 1 ? "Schritt" : "Schritte"}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold block text-slate-800">Tipp zum Ablauf:</span>
            Klicke rechts auf die hervorgehobenen Schaltflächen, um die Simulation Schritt für Schritt durchzugehen.
          </div>
        </aside>

        {/* Rechter Hauptbereich: Interaktive Simulation & Klemmi-Erklärung */}
        <main className="flex flex-col gap-5">
          {/* Klemmi Anleitungskarte (Oben) */}
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="size-16 shrink-0">
                <KlemmiMascot className="size-16" isSpeaking={true} decorative />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900 text-xs">
                    Schritt {currentStep?.stepNumber} von {currentStep?.totalSteps}: {currentStep?.subtitle}
                  </Badge>
                  <span className="text-xs font-bold text-slate-400">
                    Kapitel {currentChapterIndex + 1}/{currentTrack?.chapters.length}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                  {currentStep?.title}
                </h2>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                  {currentStep?.explanation}
                </p>

                {/* Klemmi Praxis-Tipp */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-200 p-2.5 text-xs text-orange-950">
                  <Sparkles className="size-4 shrink-0 text-orange-600 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Klemmi sagt:</strong> {currentStep?.klemmiTip}
                  </div>
                </div>
              </div>
            </div>

            {/* Aktionsleiste unter der Anleitung */}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevStep}
                disabled={currentChapterIndex === 0 && currentStepIndex === 0}
                className="text-xs"
              >
                <ArrowLeft className="mr-1.5 size-3.5" />
                Zurück
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Aktion: {currentStep?.actionPrompt}
                </span>
                <Button
                  size="sm"
                  onClick={handleNextStep}
                  className="bg-blue-600 text-white hover:bg-blue-700 text-xs shadow-xs"
                >
                  Weiter
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Simulierte MyCrewMate-Oberfläche */}
          <div className="rounded-2xl border border-slate-300 bg-white shadow-md overflow-hidden">
            {/* Simulierte MyCrewMate Titelleiste */}
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <span className="font-black text-sm tracking-wide text-blue-400">MyCrewMate</span>
                <span className="text-slate-500">|</span>
                <span className="text-xs font-semibold text-slate-300">
                  Radsportverein Musterstadt e.V. · Radsportfestival 2027
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                  Simulierte Ansicht: {currentChapter?.title}
                </Badge>
              </div>
            </div>

            {/* Inhalt der Simulation basierend auf dem aktiven Kapitel */}
            <div className="p-4 sm:p-6 bg-slate-50/50 min-h-[380px]">

              {/* 1. SIMULATION: DASHBOARD */}
              {currentChapter?.id === "dashboard" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={`rounded-xl border p-4 bg-white shadow-xs transition-all ${
                      currentStep?.id === "dash-event-select" ? "border-2 border-blue-600 ring-4 ring-blue-100" : "border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Aktives Event</span>
                        <CalendarDays className="size-4 text-blue-600" />
                      </div>
                      <div className="mt-2 font-bold text-slate-900 text-base">Radsportfestival 2027</div>
                      <p className="text-xs text-slate-500 mt-1">11.–13. Juni 2027</p>
                    </div>

                    <div className={`rounded-xl border p-4 bg-white shadow-xs transition-all ${
                      currentStep?.id === "dash-priorities" ? "border-2 border-blue-600 ring-4 ring-blue-100" : "border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Prioritäten & Fristen</span>
                        <ShieldAlert className="size-4 text-red-500" />
                      </div>
                      <div className="mt-2 font-bold text-red-600 text-base">2 Fristen fällig</div>
                      <p className="text-xs text-slate-500 mt-1">Genehmigung & Funkgeräte</p>
                    </div>

                    <div className={`rounded-xl border p-4 bg-white shadow-xs transition-all ${
                      currentStep?.id === "dash-helper-readiness" ? "border-2 border-blue-600 ring-4 ring-blue-100" : "border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Helferstand</span>
                        <UsersRound className="size-4 text-emerald-600" />
                      </div>
                      <div className="mt-2 font-bold text-slate-900 text-base">24 von 38 besetzt</div>
                      <p className="text-xs text-amber-600 font-medium mt-1">14 Helfer noch offen</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Schnellzugriff</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={handleNextStep}>
                        <UsersRound className="mr-1.5 size-3.5 text-blue-600" />
                        Zur Helferliste wechseln
                      </Button>
                      <Button size="sm" variant="outline">
                        <CalendarDays className="mr-1.5 size-3.5 text-slate-600" />
                        Einsatzplan sichten
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SIMULATION: HELFER (DER 6-SCHRITTE-ABLAUF) */}
              {currentChapter?.id === "helpers" && (
                <div className="space-y-4">
                  {/* Aktionsleiste */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">Helferliste (Simuliert)</h3>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 text-xs">
                        {simHelpers.length} Helfer
                      </Badge>
                    </div>

                    {/* Button Schritt 1 */}
                    <div className={currentStep?.id === "step-1-create" ? "ring-4 ring-blue-300 rounded-lg" : ""}>
                      <Button
                        size="sm"
                        onClick={() => setHelperModalOpen(true)}
                        className="bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                      >
                        <UsersRound className="mr-1.5 size-4" />
                        + Neuer Helfer anlegen
                      </Button>
                    </div>
                  </div>

                  {/* Helfertabelle */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b">
                        <tr>
                          <th className="p-3">Name</th>
                          <th className="p-3">Verfügbarkeit</th>
                          <th className="p-3">Spende</th>
                          <th className="p-3">Station / Schicht</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {simHelpers.map(helper => {
                          const isTarget = helper.id === "h1";
                          return (
                            <tr
                              key={helper.id}
                              className={`transition-colors ${
                                isTarget ? "bg-blue-50/50 font-medium" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{helper.name}</div>
                                <div className="text-[11px] text-slate-500">{helper.phone}</div>
                              </td>
                              <td className="p-3">
                                <span className="text-slate-700">{helper.availability}</span>
                              </td>
                              <td className="p-3">
                                <span className="text-slate-700">{helper.donation || "—"}</span>
                              </td>
                              <td className="p-3">
                                {helper.station ? (
                                  <div>
                                    <span className="font-semibold text-slate-900">{helper.station}</span>
                                    <div className="text-[10px] text-slate-500">{helper.timeWindow}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Noch nicht zugeteilt</span>
                                )}
                              </td>
                              <td className="p-3">
                                {helper.status === "angelegt" && (
                                  <Badge variant="outline" className="border-slate-300 text-slate-600">Angelegt</Badge>
                                )}
                                {helper.status === "kontaktiert" && (
                                  <Badge className="bg-amber-100 text-amber-950 border-amber-200">Kontaktiert</Badge>
                                )}
                                {helper.status === "verfuegbar" && (
                                  <Badge className="bg-blue-100 text-blue-950 border-blue-200">Verfügbar</Badge>
                                )}
                                {helper.status === "zugewiesen" && (
                                  <Badge className="bg-purple-100 text-purple-950 border-purple-200">Zugewiesen</Badge>
                                )}
                                {helper.status === "plan_gesendet" && (
                                  <Badge className="bg-cyan-100 text-cyan-950 border-cyan-200">Plan versendet</Badge>
                                )}
                                {helper.status === "bestaetigt" && (
                                  <Badge className="bg-emerald-100 text-emerald-950 border-emerald-200">
                                    <CheckCircle2 className="mr-1 size-3 text-emerald-600" /> Bestätigt
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Schritt 2: WhatsApp Erstkontakt */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setWhatsAppMode("muster1");
                                      setWhatsAppModalOpen(true);
                                    }}
                                    className={`h-7 px-2 text-xs ${
                                      currentStep?.id === "step-2-contact-first" && isTarget
                                        ? "ring-2 ring-blue-600 bg-blue-50 text-blue-700"
                                        : ""
                                    }`}
                                    title="WhatsApp Erstkontakt"
                                  >
                                    <MessageSquare className="size-3.5 text-emerald-600 mr-1" />
                                    Muster 1
                                  </Button>

                                  {/* Schritt 3: Bearbeiten / Zeiten eintragen */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditAvailabilityOpen(true)}
                                    className={`h-7 px-2 text-xs ${
                                      currentStep?.id === "step-3-discuss-availability" && isTarget
                                        ? "ring-2 ring-blue-600 bg-blue-50 text-blue-700"
                                        : ""
                                    }`}
                                    title="Zeiten & Spenden bearbeiten"
                                  >
                                    Zeiten
                                  </Button>

                                  {/* Schritt 5: Helferplan versenden */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setWhatsAppMode("muster2");
                                      setWhatsAppModalOpen(true);
                                    }}
                                    className={`h-7 px-2 text-xs ${
                                      currentStep?.id === "step-5-send-plan" && isTarget
                                        ? "ring-2 ring-blue-600 bg-blue-50 text-blue-700"
                                        : ""
                                    }`}
                                    title="Helferplan versenden"
                                  >
                                    <Share2 className="size-3.5 text-blue-600 mr-1" />
                                    Muster 2
                                  </Button>

                                  {/* Schritt 6: Bestätigen */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSimConfirmHelper}
                                    className={`h-7 px-2 text-xs ${
                                      currentStep?.id === "step-6-confirm-helper" && isTarget
                                        ? "ring-2 ring-emerald-600 bg-emerald-50 text-emerald-800"
                                        : ""
                                    }`}
                                    title="Helfer bestätigen"
                                  >
                                    <CheckCircle2 className="size-3.5 text-emerald-600 mr-1" />
                                    Bestätigen
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Hilfetext zu Schritt 4 */}
                  {currentStep?.id === "step-4-wait-for-team" && (
                    <div className="rounded-xl border-2 border-purple-300 bg-purple-50 p-4 text-xs text-purple-950 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="size-6 text-purple-600 shrink-0" />
                        <div>
                          <strong>Schritt 4 aktiv: Das Planungsteam teilt Sabine ein.</strong>
                          <p className="mt-0.5 text-purple-900">
                            Klicke auf den Button rechts, um die Schichteinteilung durch das Planungsteam zu simulieren.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSimWaitForPlanning}
                        className="bg-purple-600 text-white hover:bg-purple-700 shrink-0"
                      >
                        Schichtzuteilung ausführen
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. SIMULATION: VORBEREITUNG */}
              {currentChapter?.id === "preparation" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Vorbereitungsaufgaben</h3>
                    <Button size="sm" variant="outline">+ Neue Vorbereitungsaufgabe</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-red-100 text-red-800">Hohe Priorität</Badge>
                        <span className="text-xs text-slate-500">Frist: 05. Juni</span>
                      </div>
                      <h4 className="mt-2 font-bold text-slate-900">Startbeutel packen</h4>
                      <p className="text-xs text-slate-600 mt-1">Startnummern, Riegel und Infoblätter eintüten.</p>
                      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
                        <span className="text-slate-500">Zuständig: Sabine Muster</span>
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300">In Arbeit</Badge>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-blue-100 text-blue-800">Mittlere Priorität</Badge>
                        <span className="text-xs text-slate-500">Frist: 10. Juni</span>
                      </div>
                      <h4 className="mt-2 font-bold text-slate-900">Banner & Sponsoren aufhängen</h4>
                      <p className="text-xs text-slate-600 mt-1">Start- und Zielbogen mit Werbebannern bestücken.</p>
                      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
                        <span className="text-slate-500">Zuständig: Streckenteam</span>
                        <Badge variant="outline" className="text-slate-600">Offen</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SIMULATION: NACHBEREITUNG */}
              {currentChapter?.id === "postprocessing" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Nachbereitung & Abbau</h3>
                    <Button size="sm" variant="outline">+ Nachbereitungsaufgabe</Button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs">Funkgeräte & Kautionen an Verleiher</div>
                        <div className="text-[11px] text-slate-500">Frist: Montag nach Event · Zuständig: Andreas Orga</div>
                      </div>
                      <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">Rückgabe offen</Badge>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs">Dankes-Mail & Helfer-Danksagung versenden</div>
                        <div className="text-[11px] text-slate-500">Frist: Dienstag nach Event · Alle 38 Helfer</div>
                      </div>
                      <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50">Geplant</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SIMULATION: MATERIAL */}
              {currentChapter?.id === "material" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Material & Logistik</h3>
                    <Button size="sm" variant="outline">+ Material erfassen</Button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                        <tr>
                          <th className="p-3">Gegenstand</th>
                          <th className="p-3">Menge</th>
                          <th className="p-3">Standort</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Absperrband 500m</td>
                          <td className="p-3">4 Rollen</td>
                          <td className="p-3 text-slate-600">Zielbereich Mayen</td>
                          <td className="p-3"><Badge className="bg-emerald-100 text-emerald-900">Vor Ort bereitgestellt</Badge></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Verbandskasten DIN 13157</td>
                          <td className="p-3">2 Stück</td>
                          <td className="p-3 text-slate-600">DRK-Posten Kupferkanne</td>
                          <td className="p-3"><Badge variant="outline" className="text-amber-800 border-amber-300">Wird angeliefert</Badge></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Festzeltgarnituren</td>
                          <td className="p-3">15 Sets</td>
                          <td className="p-3 text-slate-600">Vereinsheim Buffet</td>
                          <td className="p-3"><Badge className="bg-emerald-100 text-emerald-900">Vor Ort bereitgestellt</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. SIMULATION: SPENDEN */}
              {currentChapter?.id === "donations" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Kuchen- & Verpflegungsspenden</h3>
                    <Button size="sm" variant="outline">+ Spende eintragen</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {simDonations.map(don => (
                      <div key={don.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <Badge className="bg-blue-100 text-blue-900">{don.category}</Badge>
                          <span className="text-slate-500">{don.day}</span>
                        </div>
                        <h4 className="mt-2 font-bold text-slate-900 text-sm">{don.description}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">Spender: {don.donor}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {don.traits.map((t: string) => (
                            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. SIMULATION: HILFE */}
              {currentChapter?.id === "help" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                    <BookOpen className="mx-auto size-10 text-blue-600" />
                    <h3 className="mt-3 font-bold text-slate-900 text-base">Hilfe-Center & Klemmi Support</h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                      Hier findest du alle Kapitel, Checklisten und Erklärungen mit integrierter Suchfunktion.
                    </p>
                    <div className="mt-4 max-w-md mx-auto flex gap-2">
                      <Input placeholder="Stichwort eingeben (z.B. WhatsApp, Kuchen, MFA)..." className="text-xs" />
                      <Button size="sm" className="bg-blue-600 text-white">Suchen</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 8. SIMULATION (NUR ADMIN): EINSATZPLAN */}
              {currentChapter?.id === "plan" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Einsatzplan & Schichten</h3>
                    <Button size="sm" className="bg-blue-600 text-white">+ Neue Schicht anlegen</Button>
                  </div>
                  <div className="space-y-3">
                    {simShifts.map(shift => (
                      <div key={shift.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{shift.name}</span>
                            <Badge variant="outline" className="text-xs">{shift.day}</Badge>
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{shift.timeWindow}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            Bedarf: {shift.assignedHelpers.length} von {shift.requiredHelpers} Helfern eingeteilt
                          </span>
                          {shift.flexibleBookingAllowed && (
                            <Badge className="bg-cyan-50 text-cyan-900 border-cyan-200 text-[10px]">
                              Flexible Belegung aktiv
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. SIMULATION (NUR ADMIN): FINANZEN */}
              {currentChapter?.id === "finances" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Finanzübersicht & Saldo</h3>
                    <Button size="sm" variant="outline">+ Kategorie</Button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                        <tr>
                          <th className="p-3">Kategorie</th>
                          <th className="p-3">Einnahmen</th>
                          <th className="p-3">Ausgaben</th>
                          <th className="p-3">Differenz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Startgelder Jedermannrennen</td>
                          <td className="p-3 text-emerald-700 font-medium">8.450,00 €</td>
                          <td className="p-3 text-slate-500">—</td>
                          <td className="p-3 text-emerald-700 font-bold">+8.450,00 €</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Rettungsdienst & Sanitäter</td>
                          <td className="p-3 text-slate-500">—</td>
                          <td className="p-3 text-red-700 font-medium">1.200,00 €</td>
                          <td className="p-3 text-red-700 font-bold">-1.200,00 €</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-900">Verpflegung & Catering-Einkauf</td>
                          <td className="p-3 text-emerald-700 font-medium">2.300,00 €</td>
                          <td className="p-3 text-red-700 font-medium">950,00 €</td>
                          <td className="p-3 text-emerald-700 font-bold">+1.350,00 €</td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50 border-t font-bold text-xs">
                        <tr>
                          <td className="p-3">Gesamtsaldo</td>
                          <td className="p-3 text-emerald-700">10.750,00 €</td>
                          <td className="p-3 text-red-700">2.150,00 €</td>
                          <td className="p-3 text-emerald-700 text-sm font-black">+8.600,00 €</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 10. SIMULATION (NUR ADMIN): ORTE & GPX */}
              {currentChapter?.id === "locations" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-slate-900">Orte & Standorte</h3>
                    <Button size="sm" variant="outline">+ Neuer Ort</Button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPinned className="size-5 text-blue-600" />
                        <div>
                          <div className="font-bold text-slate-900 text-sm">Viehmarktplatz Mayen (Start & Ziel)</div>
                          <div className="text-xs text-slate-500">56727 Mayen · GPS: 50.3281, 7.2214</div>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-900">Zentraler Ort</Badge>
                    </div>
                  </div>
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                    <MapPinned className="mx-auto size-8 text-slate-400 mb-2" />
                    Interaktive OpenStreetMap mit geladener GPX-Strecke (Simuliert)
                  </div>
                </div>
              )}

              {/* 11. SIMULATION (NUR ADMIN): SCHUTZ & PROTOKOLLE */}
              {currentChapter?.id === "security" && (
                <div className="space-y-4">
                  <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="size-6 text-emerald-600" />
                        <div>
                          <div className="font-bold text-emerald-950 text-sm">Zwei-Faktor-Authentifizierung (MFA) aktiv</div>
                          <div className="text-xs text-emerald-900">Geschützt per Authenticator-App (QR-Code)</div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-600 text-white">Sehr sicher</Badge>
                    </div>
                  </div>

                  {/* Rechte-Schalter Matrix */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400 mb-3">
                      Rechte-Schalter Matrix: Klaus Streckenchef
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b">
                        <span className="font-medium text-slate-700">Helferverwaltung</span>
                        <div className="flex gap-1">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Aus</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Lesen</span>
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold">Schreiben</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b">
                        <span className="font-medium text-slate-700">Einsatzplan</span>
                        <div className="flex gap-1">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Aus</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Lesen</span>
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold">Schreiben</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b">
                        <span className="font-medium text-slate-700">Finanzen & Kasse</span>
                        <div className="flex gap-1">
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">Aus</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Lesen</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">Schreiben</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notfall-Schalter */}
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-red-950 text-xs">Notfall-Sitzungssperre</div>
                      <div className="text-[11px] text-red-800">Sperrt alle Planungsteam-Zugänge sofort bei Vorfällen</div>
                    </div>
                    <Button size="sm" variant="destructive" className="h-7 text-xs">
                      Notfall-Stopp
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* MODAL 1: HELFER ANLEGEN (SCHRITT 1) */}
      {helperModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Schritt 1: Helfer erfassen</h3>
              <Button variant="ghost" size="icon" onClick={() => setHelperModalOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <form onSubmit={handleSimAddHelper} className="mt-4 space-y-4">
              <div>
                <Label className="text-xs font-semibold">Name des Helfers (Pflicht)</Label>
                <Input
                  autoFocus
                  placeholder="z.B. Sabine Muster"
                  value={newHelperName}
                  onChange={e => setNewHelperName(e.target.value)}
                  className="mt-1 text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Mobilnummer für WhatsApp (optional)</Label>
                <Input
                  placeholder="+49 170 1234567"
                  value={newHelperPhone}
                  onChange={e => setNewHelperPhone(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
                <strong>Klemmi-Tipp:</strong> Trage 'Sabine Muster' ein und klicke auf Speichern, um Schritt 1 abzuschließen.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setHelperModalOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-600 text-white">
                  Helfer speichern
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: WHATSAPP MUSTER (SCHRITT 2 & 5) */}
      {whatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {whatsAppMode === "muster1" ? "Schritt 2: Erstkontakt (Muster 1)" : "Schritt 5: Helferplan versenden (Muster 2)"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setWhatsAppModalOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 font-sans leading-relaxed">
                {whatsAppMode === "muster1" ? (
                  <>
                    <p className="font-bold text-emerald-900 mb-2">Vorlage Muster 1: Erstkontakt</p>
                    <p>„Hallo Sabine! Wir planen aktuell das Radsportfestival 2027 vom 11.–13. Juni. Hättest du Zeit und Lust, uns als Helfer zu unterstützen? Melde dich kurz mit deinen Wunschzeiten. Liebe Grüße, dein Orga-Team Musterstadt!“</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-emerald-900 mb-2">Vorlage Muster 2: Persönlicher Helferplan</p>
                    <p>„Hallo Sabine! Dein Einsatzplan für das Radsportfestival steht fest. Hier ist dein persönlicher 7-Tage-Link mit Schichtzeiten, Station und Treffpunkt: https://app.mycrewmate.de/freigabe/xyz Bitte gib uns kurz Rückmeldung, ob alles klappt!“</p>
                  </>
                )}
              </div>
              <p className="text-slate-600">
                In MyCrewMate öffnet ein Klick direkt WhatsApp Web oder die Smartphone-App mit dem fertig vorausgefüllten Text.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setWhatsAppModalOpen(false)}>
                  Schließen
                </Button>
                <Button
                  onClick={whatsAppMode === "muster1" ? handleSimContactHelper : handleSimSendPlan}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {whatsAppMode === "muster1" ? "Erstkontakt simulieren" : "Plan-Versand simulieren"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ZEITEN & SPENDEN BEARBEITEN (SCHRITT 3) */}
      {editAvailabilityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Schritt 3: Verfügbarkeit & Spende erfassen</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditAvailabilityOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs font-semibold">Verfügbarkeits-Zeitfenster</Label>
                <Input
                  value={availText}
                  onChange={e => setAvailText(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Verpflegungs- oder Kuchenspende</Label>
                <Input
                  value={cakeText}
                  onChange={e => setCakeText(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
                <strong>Klemmi-Tipp:</strong> Trage ein, wann der Helfer kann, und notiere Allergene beim Kuchen direkt mit.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditAvailabilityOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSimSaveAvailability} className="bg-blue-600 text-white">
                  Verfügbarkeit speichern
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
