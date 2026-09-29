export type GameScenarioId = "radsport" | "schuetzenfest" | "kirmes";

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
  featuresHighlight: string[];
}

export interface HelperCard {
  id: string;
  name: string;
  initials: string;
  role: string;
  availableFrom: string;
  availableTo: string;
  skills: string[];
  notes?: string;
  assignedShiftId?: string | null;
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
}

export interface PlanningTask {
  id: string;
  area: string;
  title: string;
  deadline: string;
  duration: string;
  icon: "route" | "home" | "package" | "users";
  detail: string;
  result: string;
}

export interface EventCrisis {
  id: string;
  title: string;
  description: string;
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
  radsport: {
    id: "radsport",
    title: "Radsportfestival · 3 Tage",
    subtitle: "3 Tage · 120 Helfer · Marathon, RTF & Nachwuchsrennen",
    tagline: "Plane Strecke, Stationen, Material und Menschen – Monate vor dem Startschuss.",
    difficulty: "Profi",
    days: 3,
    expectedHelpers: 120,
    targetSatisfaction: 95,
    initialBudget: 18000,
    initialStress: 18,
    iconName: "Bike",
    badge: "Planungs-Simulator · Level 1",
    storyIntro: [
      "Noch sechs Monate bis zum Radsportfestival: Die Streckenidee steht, aber Genehmigungen, Stationen und Material fehlen.",
      "Jetzt entsteht der Plan, mit dem Ansprechpartner im Verein hunderte Helfer anfragen und der Einsatzplan später zuverlässig gefüllt werden kann.",
      "Klemmi führt dich durch die richtigen Entscheidungen – erst planen, dann besetzen, am Ende souverän reagieren."
    ],
    klemmiWelcome: "Hier wird nicht einfach ein Tag gerettet. Wir bauen jetzt den Plan, der dein ganzes Festival trägt.",
    featuresHighlight: [
      "Strecken- & Genehmigungsplanung",
      "Stationen, Hütten und Verpflegung koordinieren",
      "Helferabfrage, Verfügbarkeit & Einsatzplan"
    ]
  },
  schuetzenfest: {
    id: "schuetzenfest",
    title: "Schützenfest im Grünen",
    subtitle: "1 Tag · 25 Helfer · Festzelt, Ausschank & Kuchen",
    tagline: "Der kompakte Klassiker für einen späteren Einstieg.",
    difficulty: "Einstieg",
    days: 1,
    expectedHelpers: 25,
    targetSatisfaction: 85,
    initialBudget: 2500,
    initialStress: 20,
    iconName: "Beer",
    badge: "Nächste Spielwelt",
    storyIntro: [],
    klemmiWelcome: "",
    featuresHighlight: ["Schichtplanung", "Spenden & Material", "Eventtag"]
  },
  kirmes: {
    id: "kirmes",
    title: "3-Tage-Marktplatzkirmes",
    subtitle: "3 Tage · 60 Helfer · Bühne, Karussell & Vereine",
    tagline: "Mehrere Teams, viele Übergaben und ein gemeinsamer Zeitplan.",
    difficulty: "Mittel",
    days: 3,
    expectedHelpers: 60,
    targetSatisfaction: 90,
    initialBudget: 7500,
    initialStress: 35,
    iconName: "Tent",
    badge: "Nächste Spielwelt",
    storyIntro: [],
    klemmiWelcome: "",
    featuresHighlight: ["Drei Vereine", "Mehrtageseinsatz", "Materialübergaben"]
  }
};
