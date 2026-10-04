export interface SimulatedHelper {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: "angelegt" | "kontaktiert" | "verfuegbar" | "zugewiesen" | "plan_gesendet" | "bestaetigt";
  availability: string;
  donation?: string;
  station?: string;
  timeWindow?: string;
}

export const INITIAL_SIMULATED_HELPERS: SimulatedHelper[] = [
  {
    id: "h1",
    name: "Sabine Muster (Übungs-Helferin)",
    phone: "+49 170 1234567",
    email: "sabine.muster@beispiel-verein.de",
    status: "angelegt",
    availability: "Noch nicht erfragt",
    donation: "Noch keine",
  },
  {
    id: "h2",
    name: "Michael Radler",
    phone: "+49 171 9876543",
    email: "michael@radsportler.de",
    status: "verfuegbar",
    availability: "Samstag ganztags (08:00–18:00)",
    donation: "Kuchen (Käsekuchen)",
    station: "Streckenposten Süd",
    timeWindow: "08:30–13:30",
  },
  {
    id: "h3",
    name: "Tanja Streckenfan",
    phone: "+49 172 4567890",
    email: "tanja.s@eifel-sport.de",
    status: "bestaetigt",
    availability: "Sonntag Vormittag",
    donation: "Obstkorb",
    station: "Verpflegungsstation 1 (Kupferkanne)",
    timeWindow: "09:00–14:00",
  }
];

export interface SimulatedShift {
  id: string;
  name: string;
  day: string;
  timeWindow: string;
  requiredHelpers: number;
  assignedHelpers: string[];
  flexibleBookingAllowed: boolean;
}

export const INITIAL_SIMULATED_SHIFTS: SimulatedShift[] = [
  {
    id: "s1",
    name: "Startnummernausgabe Samstag",
    day: "Samstag",
    timeWindow: "07:30–11:00",
    requiredHelpers: 3,
    assignedHelpers: ["Markus Schnell", "Andrea Berg"],
    flexibleBookingAllowed: true,
  },
  {
    id: "s2",
    name: "Streckenposten Nord (Gefahrenkurve K44)",
    day: "Samstag",
    timeWindow: "08:30–13:30",
    requiredHelpers: 2,
    assignedHelpers: [],
    flexibleBookingAllowed: false,
  },
  {
    id: "s3",
    name: "Verpflegungsstation 1 (Kupferkanne)",
    day: "Sonntag",
    timeWindow: "09:00–14:00",
    requiredHelpers: 4,
    assignedHelpers: ["Tanja Streckenfan", "Bernd Kuchenfreund"],
    flexibleBookingAllowed: true,
  }
];

export interface SimulatedDonation {
  id: string;
  donor: string;
  category: "Kuchen" | "Salat" | "Fingerfood" | "Obst";
  description: string;
  traits: string[];
  day: string;
  dropoffLocation: string;
}

export const INITIAL_SIMULATED_DONATIONS: SimulatedDonation[] = [
  {
    id: "d1",
    donor: "Michael Radler",
    category: "Kuchen",
    description: "Klassischer Käsekuchen",
    traits: ["vegetarisch"],
    day: "Samstag",
    dropoffLocation: "Vereinsheim Buffet",
  },
  {
    id: "d2",
    donor: "Petra Vorbild",
    category: "Kuchen",
    description: "Kirsch-Streuselkuchen",
    traits: ["vegan", "nussfrei"],
    day: "Samstag",
    dropoffLocation: "Vereinsheim Buffet",
  },
  {
    id: "d3",
    donor: "Tanja Streckenfan",
    category: "Obst",
    description: "Bananen & Äpfel (2 Kisten)",
    traits: ["vegan", "glutenfrei"],
    day: "Sonntag",
    dropoffLocation: "Verpflegungsstation 1",
  }
];
