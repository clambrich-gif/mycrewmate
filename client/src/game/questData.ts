import { HelperCard, ShiftSlot, EventCrisis } from "./gameData";

export const SCHUETZENFEST_HELPERS: HelperCard[] = [
  {
    id: "h1",
    name: "Jupp Schmitz",
    role: "Vereinsurgestein",
    avatarIcon: "👴",
    availableFrom: "10:00",
    availableTo: "18:00",
    skills: ["Zapfer", "Orga"],
    bringsVehicle: true,
    notes: "Hat eigenen Anhänger für Biertische."
  },
  {
    id: "h2",
    name: "Lisa Berg",
    role: "Jugendleiterin",
    avatarIcon: "👩",
    availableFrom: "12:00",
    availableTo: "16:00",
    skills: ["Kuchen", "Einlass"],
    bringsCompanion: true,
    notes: "Bringt Tochter Mia (11) mit, spendet Erdbeertorte."
  },
  {
    id: "h3",
    name: "Markus 'Bier-Markus'",
    role: "Schützenbruder",
    avatarIcon: "🍺",
    availableFrom: "14:00",
    availableTo: "22:00",
    skills: ["Zapfer"],
    notes: "Kann zapfen wie kein Zweiter, aber erst ab 14:00 da!"
  },
  {
    id: "h4",
    name: "Dr. Anna Weber",
    role: "Vereinsärztin",
    avatarIcon: "🩺",
    availableFrom: "10:00",
    availableTo: "20:00",
    skills: ["Sanitäter", "Einlass"],
    notes: "Erste-Hilfe-Ausrüstung im Kofferraum."
  },
  {
    id: "h5",
    name: "Kevin Müller",
    role: "Neumitglied",
    avatarIcon: "🧢",
    availableFrom: "08:00",
    availableTo: "14:00",
    skills: ["Aufbau", "Kuchen"],
    notes: "Voll motiviert, braucht klare Einweisung."
  },
  {
    id: "h6",
    name: "Gabi Krämer",
    role: "Kuchen-Queen",
    avatarIcon: "🥧",
    availableFrom: "11:00",
    availableTo: "17:00",
    skills: ["Kuchen", "Kasse"],
    notes: "Bringt 3 Kuchenspenden mit."
  },
  {
    id: "h7",
    name: "Theo Wagner",
    role: "Aufbau-Profi",
    avatarIcon: "🛠️",
    availableFrom: "07:00",
    availableTo: "13:00",
    skills: ["Aufbau", "Material"],
    bringsVehicle: true,
    notes: "Hat Werkzeug, Kabeltrommel und einen Transporter dabei."
  }
];

export const SCHUETZENFEST_SHIFTS: ShiftSlot[] = [
  {
    id: "s1",
    area: "Logistik & Start",
    title: "Festzelt & Tische aufbauen",
    timeWindow: "08:00 – 11:00",
    requiredHelpers: 2,
    assignedHelperIds: [],
    requiredSkill: "Aufbau",
    isCritical: true,
    difficultyRating: 1
  },
  {
    id: "s2",
    area: "Kuchentheke",
    title: "Kuchenausgabe & Kaffeebar",
    timeWindow: "12:00 – 16:00",
    requiredHelpers: 2,
    assignedHelperIds: [],
    requiredSkill: "Kuchen",
    isCritical: false,
    difficultyRating: 2
  },
  {
    id: "s3",
    area: "Bierwagen",
    title: "Getränkeausschank Primetime",
    timeWindow: "14:00 – 18:00",
    requiredHelpers: 2,
    assignedHelperIds: [],
    requiredSkill: "Zapfer",
    isCritical: true,
    difficultyRating: 3
  },
  {
    id: "s4",
    area: "Sicherheit & Einlass",
    title: "Einlass & Sanitätswache",
    timeWindow: "13:00 – 17:00",
    requiredHelpers: 1,
    assignedHelperIds: [],
    requiredSkill: "Sanitäter",
    isCritical: true,
    difficultyRating: 2
  }
];

export const SCHUETZENFEST_CRISES: EventCrisis[] = [
  {
    id: "c1",
    title: "Alarm am Bierwagen: Fass-Druckabfall!",
    description: "Um 15:30 Uhr bildet sich eine 20-Meter-Schlange. Die Kohlensäureflasche ist leer!",
    klemmiWarning: "Oje! Jetzt klemmt der Zapfhahn gewaltig! Wenn die Schützenbrüder 10 Minuten kein Bier kriegen, sinkt die Stimmung ins Bodenlose!",
    options: [
      {
        label: "Reserveflasche aus dem Sportlerheim holen",
        actionDescription: "Jupp fährt mit seinem Auto und holt die Notreserve.",
        impactStress: 10,
        impactBudget: 0,
        impactSatisfaction: 5,
        klemmiFeedback: "Klasse gelöst! Jupps Anhängerkupplung und Einsatzbereitschaft haben die Durstkrise abgewendet."
      },
      {
        label: "Schnellkauf an der Tankstelle",
        actionDescription: "Kurzerhand zwei Kisten Flaschenbier für 40 € holen.",
        impactStress: 25,
        impactBudget: -40,
        impactSatisfaction: -5,
        klemmiFeedback: "Teuer und nicht optimal, aber die Kehlen blieben feucht!"
      },
      {
        label: "Ausschank pausieren & Geduld erbitten",
        actionDescription: "Lautsprecherdurchsage: 'Gleich geht es weiter.'",
        impactStress: 40,
        impactBudget: 0,
        impactSatisfaction: -25,
        klemmiFeedback: "Aua! Die Laune der Gäste ist im Keller. Das gibt Punktabzug im Festbericht."
      }
    ]
  },
  {
    id: "c2",
    title: "Spontane Unwetterböe zieht auf!",
    description: "Windstärke 6 rüttelt an den Sonnenschirmen der Kuchentheke. Gabi ruft um Hilfe!",
    klemmiWarning: "Windalarm! Wenn die Kuchentheke nass wird, sind 14 Kuchen futsch! Wer packt jetzt an?",
    options: [
      {
        label: "Schirme zügig schließen & Kuchen ins Zelt tragen",
        actionDescription: "Kevin und Lisa packen blitzschnell mit an.",
        impactStress: 15,
        impactBudget: 0,
        impactSatisfaction: 10,
        klemmiFeedback: "Perfekte Teamarbeit! Nicht ein Krümel nass geworden – die Helfer halten zusammen."
      },
      {
        label: "Plane drüberwerfen und abwarten",
        actionDescription: "Notdürftige Abdeckung mit Bauplane.",
        impactStress: 20,
        impactBudget: 0,
        impactSatisfaction: -10,
        klemmiFeedback: "Zwei Torten sind zerquetscht, aber der Rest hat überlebt."
      }
    ]
  }
];
