import type { EventCrisis, HelperCard, PlanningTask, ShiftSlot } from "./gameData";

export const RADSPORT_PLANNING_TASKS: PlanningTask[] = [
  {
    id: "route",
    area: "Strecke & Behörden",
    title: "110-km-Strecke genehmigen",
    deadline: "Noch 168 Tage",
    duration: "4–6 Wochen Abstimmung",
    icon: "route",
    detail: "Straßenverkehrsbehörde, Gemeinden, Polizei und Rettungsdienst brauchen eine abgestimmte Route mit Zeitfenstern.",
    result: "Genehmigungsmappe angelegt"
  },
  {
    id: "shelter",
    area: "Orte & Stationen",
    title: "Schutzhütte am VP 2 sichern",
    deadline: "Noch 142 Tage",
    duration: "Reservierung & Schlüssel",
    icon: "home",
    detail: "Die Hütte schützt die Verpflegung bei Wetterwechsel und braucht eine feste Ansprechpartnerin vor Ort.",
    result: "Station VP 2 reserviert"
  },
  {
    id: "material",
    area: "Material & Verpflegung",
    title: "Verpflegung kalkulieren",
    deadline: "Noch 84 Tage",
    duration: "Mengen & Lieferanten",
    icon: "package",
    detail: "Bananen, Wasser, Riegel, Elektrolyte, Becher und Beschilderung werden aus Teilnehmerzahl und Streckenprofil abgeleitet.",
    result: "Materialliste freigegeben"
  },
  {
    id: "helpers",
    area: "Helfer & Ansprechpartner",
    title: "Helferabfrage starten",
    deadline: "Noch 63 Tage",
    duration: "Rückmeldungen bündeln",
    icon: "users",
    detail: "Ansprechpartner fragen zuerst Verfügbarkeiten ab und machen aus vielen einzelnen Antworten einen belastbaren Helferpool.",
    result: "Helferpool aktiv"
  }
];

export const RADSPORT_HELPERS: HelperCard[] = [
  { id: "h1", name: "Maria Engel", initials: "ME", role: "Ansprechpartnerin West", availableFrom: "06:00", availableTo: "14:00", skills: ["Verpflegung", "Material"], notes: "Fährt den Transporter zum VP 1." },
  { id: "h2", name: "Jonas Berg", initials: "JB", role: "RTF-Team", availableFrom: "07:00", availableTo: "16:00", skills: ["Strecke", "Funk"], notes: "Kennt die Nordschleife und hat Streckenposten-Erfahrung." },
  { id: "h3", name: "Lea Roth", initials: "LR", role: "Jugendteam", availableFrom: "08:00", availableTo: "15:00", skills: ["Anmeldung", "Einlass"], notes: "Koordiniert die Startunterlagen." },
  { id: "h4", name: "David Neumann", initials: "DN", role: "Sanitätskontakt", availableFrom: "06:00", availableTo: "18:00", skills: ["Sicherheit", "Funk"], notes: "Ist Schnittstelle zum Sanitätsdienst." },
  { id: "h5", name: "Nora Klein", initials: "NK", role: "Verpflegungsteam", availableFrom: "06:00", availableTo: "13:00", skills: ["Verpflegung", "Material"], notes: "Bringt Kühlboxen und Obstkisten mit." },
  { id: "h6", name: "Tobias Jung", initials: "TJ", role: "Streckenposten", availableFrom: "07:00", availableTo: "17:00", skills: ["Strecke", "Sicherheit"], notes: "Motorrad und Warnweste vorhanden." },
  { id: "h7", name: "Sabine Vogt", initials: "SV", role: "Vereinsbüro", availableFrom: "07:00", availableTo: "14:00", skills: ["Anmeldung", "Verpflegung"], notes: "Übernimmt die Helferkommunikation." }
];

export const RADSPORT_SHIFTS: ShiftSlot[] = [
  { id: "s1", area: "Start & Anmeldung", title: "Startunterlagen und Check-in", timeWindow: "06:30 – 09:30", requiredHelpers: 2, assignedHelperIds: [], requiredSkill: "Anmeldung", isCritical: true },
  { id: "s2", area: "Verpflegungspunkt 1", title: "Bananen, Wasser und Riegel", timeWindow: "08:00 – 14:00", requiredHelpers: 2, assignedHelperIds: [], requiredSkill: "Verpflegung", isCritical: true },
  { id: "s3", area: "Streckenposten Nord", title: "Abzweig und Sicherung", timeWindow: "07:30 – 15:30", requiredHelpers: 2, assignedHelperIds: [], requiredSkill: "Strecke", isCritical: true },
  { id: "s4", area: "Sicherheit & Funk", title: "Einsatzleitung und Sanitätskontakt", timeWindow: "06:30 – 16:30", requiredHelpers: 1, assignedHelperIds: [], requiredSkill: "Sicherheit", isCritical: true }
];

export const RADSPORT_CRISES: EventCrisis[] = [
  {
    id: "c1",
    title: "Wetterzelle am Verpflegungspunkt",
    description: "Am Vormittag kündigt sich Starkregen an. Die reservierte Schutzhütte kann jetzt ihre Stärke ausspielen.",
    options: [
      { label: "VP 2 in die reservierte Schutzhütte verlegen", actionDescription: "Ansprechpartnerin öffnet die Hütte, Materialteam zieht die Ausgabe um.", impactStress: -6, impactBudget: 0, impactSatisfaction: 8, klemmiFeedback: "Gute Vorbereitung zahlt sich aus: Die Hütte war reserviert, das Team hat einen trockenen Plan B." },
      { label: "Mit Pavillons am Straßenrand bleiben", actionDescription: "Pavillons sichern und auf besseres Wetter hoffen.", impactStress: 18, impactBudget: -120, impactSatisfaction: -5, klemmiFeedback: "Das funktioniert nur mit viel Hektik. Für das nächste Jahr: Wetterreserven gehören schon in die Stationsplanung." }
    ]
  },
  {
    id: "c2",
    title: "Elektrolyte reichen nicht bis zur letzten Gruppe",
    description: "Die Teilnehmerzahl liegt über der Prognose. An VP 1 werden zusätzliche Getränke benötigt.",
    options: [
      { label: "Materialreserve vom Basislager nachliefern", actionDescription: "Der Logistikfahrer nutzt die vorbereitete Reserve und fährt direkt zur Station.", impactStress: 3, impactBudget: 0, impactSatisfaction: 8, klemmiFeedback: "Sauber gelöst. Die Materialliste hatte eine Reserve vorgesehen – genau dafür." },
      { label: "Ausgabe sofort rationieren", actionDescription: "Nur noch kleine Portionen ausgeben und Nachlieferung abwarten.", impactStress: 14, impactBudget: 0, impactSatisfaction: -10, klemmiFeedback: "Nicht ideal, aber transparent kommuniziert. Die Nachbereitung sollte die Mengenplanung jetzt konkret verbessern." }
    ]
  }
];
