export type GameScenarioId = "schuetzenfest" | "kirmes" | "radsport";

export type Difficulty = "Einstieg" | "Mittel" | "Profi";

export interface GameScenario {
  id: GameScenarioId;
  title: string;
  subtitle: string;
  tagline: string;
  difficulty: Difficulty;
  days: number;
  expectedHelpers: number;
  targetSatisfaction: number;
  initialBudget: number;
  initialStress: number;
  iconName: string;
  badge: string;
  storyIntro: string[];
  klemmiWelcome: string;
  colorTheme: {
    primary: string;
    accent: string;
    border: string;
    bgGradients: string;
  };
  featuresHighlight: string[];
}

export interface HelperCard {
  id: string;
  name: string;
  role: string;
  avatarIcon: string;
  availableFrom: string;
  availableTo: string;
  skills: string[];
  bringsCompanion?: boolean;
  bringsVehicle?: boolean;
  notes?: string;
  assignedShiftId?: string | null;
  assignedSlot?: number;
}

export interface ShiftSlot {
  id: string;
  area: string;
  title: string;
  timeWindow: string;
  requiredHelpers: number;
  assignedHelperIds: string[];
  requiredSkill?: string;
  isCritical?: boolean;
  difficultyRating: number;
}

export interface EventCrisis {
  id: string;
  title: string;
  description: string;
  klemmiWarning: string;
  options: {
    label: string;
    actionDescription: string;
    impactStress: number;
    impactBudget: number;
    impactSatisfaction: number;
    klemmiFeedback: string;
  }[];
}

export const GAME_SCENARIOS: Record<GameScenarioId, GameScenario> = {
  schuetzenfest: {
    id: "schuetzenfest",
    title: "Schützenfest im Grünen",
    subtitle: "1 Tag · 25 Helfer · Festzelt, Bierwagen & Kuchentheke",
    tagline: "Der charmante Klassiker – rette das Dorffest vor dem Durst!",
    difficulty: "Einstieg",
    days: 1,
    expectedHelpers: 25,
    targetSatisfaction: 85,
    initialBudget: 2500,
    initialStress: 20,
    iconName: "Beer",
    badge: "Level 1: Einstieg",
    storyIntro: [
      "Der alte Festleiter hat vor zwei Wochen das Handtuch geworfen.",
      "In 4 Stunden öffnet das Festzelt – die Kuchentheke ist leer, am Bierwagen fehlt eine Schicht, und der Zapfer steckt im Stau!",
      "Gemeinsam mit Klemmi musst du den Einsatzplan aufstellen, bevor der Bürgermeister die Glocke läutet."
    ],
    klemmiWelcome: "Servus! Keine Panik – genau dafür bin ich da. Lass uns Schichten sortieren, Zeitfenster prüfen und das Fest retten!",
    colorTheme: {
      primary: "emerald",
      accent: "#059669",
      border: "border-emerald-500",
      bgGradients: "from-emerald-950/40 to-slate-900/60"
    },
    featuresHighlight: [
      "Einsatzplan-Puzzle mit 4 Schichten",
      "Kuchenspenden & Küchenhelfer",
      "Spontane Bierwagen-Krise meistern"
    ]
  },
  kirmes: {
    id: "kirmes",
    title: "Die 3-Tage-Marktplatzkirmes",
    subtitle: "3 Tage · 60 Helfer · Marktplatz, Karussell, Live-Bühne",
    tagline: "Drei Vereine, ein Fest – wer macht wann den Schichtwechsel?",
    difficulty: "Mittel",
    days: 3,
    expectedHelpers: 60,
    targetSatisfaction: 90,
    initialBudget: 7500,
    initialStress: 35,
    iconName: "Tent",
    badge: "Level 2: Fortgeschritten",
    storyIntro: [
      "Großes Kirmestreiben mitten im Ort!",
      "Feuerwehr, Musikverein und Sportclub teilen sich die Schichten.",
      "Einlasskontrollen, Pfandmarken und eine herannahende Gewitterfront am Samstagabend verlangen kluge Koordination."
    ],
    klemmiWelcome: "Hallo! Drei Vereine unter einen Hut bringen? Da klemmt es gerne mal bei der Schichtübergabe. Ich hab den Überblick!",
    colorTheme: {
      primary: "amber",
      accent: "#d97706",
      border: "border-amber-500",
      bgGradients: "from-amber-950/40 to-slate-900/60"
    },
    featuresHighlight: [
      "3-Tage-Schichtrad mit Jugend-Zeitfenstern",
      "Materialübergabe zwischen 3 Vereinen",
      "Wetteralarm & Festzelt-Evakuierungsplan"
    ]
  },
  radsport: {
    id: "radsport",
    title: "Eifel-Radsportfestival & Marathon",
    subtitle: "3 Tage · 120 Helfer · 110 km GPX-Strecke & Zeitnahme",
    tagline: "Die Königsklasse: Streckenposten, Besenwagen und Sanitätsdienst!",
    difficulty: "Profi",
    days: 3,
    expectedHelpers: 120,
    targetSatisfaction: 95,
    initialBudget: 15000,
    initialStress: 45,
    iconName: "Bike",
    badge: "Level 3: Pro-Festival",
    storyIntro: [
      "1.500 Teilnehmer auf 110 km Landstraße und Schotterwegen.",
      "Streckenposten müssen auf die Minute genau stehen, Begleitfahrzeuge funken, und Verpflegungspunkt 2 meldet Wasserengpass.",
      "Hier zeigt sich, wer Vorbereitung, GPX-Daten und Helfer sicher synchronisiert!"
    ],
    klemmiWelcome: "Sport frei! Ein Radsportfestival ist wie ein Orchester: Wehe, ein Streckenposten fehlt an Kilometer 42! Lass uns das rocken!",
    colorTheme: {
      primary: "sky",
      accent: "#0284c7",
      border: "border-sky-500",
      bgGradients: "from-sky-950/40 to-slate-900/60"
    },
    featuresHighlight: [
      "GPX-Streckenposten mit Zeitfenster-Matching",
      "Behördliche Auflagen & Sanitätsdienst",
      "Live-Funk-Szenarien und Besenwagen-Einsatz"
    ]
  }
};
