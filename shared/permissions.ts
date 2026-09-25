export type PermissionRow = {
  area: string;
  primaryAdmin: string;
  coAdmin: string;
  planner: string;
  readOnly: string;
  note: string;
};

/**
 * Die Rollenmatrix erklärt die effektiven Vereinsrechte in verständlicher Form.
 * Die serverseitige Prüfung bleibt immer maßgeblich; sie verhindert Änderungen
 * auch dann, wenn eine Seite noch geöffnet war, bevor Rechte geändert wurden.
 */
export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  {
    area: "Veranstaltungen & Planungsansichten",
    primaryAdmin: "Alle Vereinsveranstaltungen verwalten",
    coAdmin: "Alle Vereinsveranstaltungen verwalten",
    planner: "Nur freigegebene Veranstaltungen ansehen",
    readOnly: "Freigegebene Veranstaltung ansehen",
    note: "Die Eventfreigabe begrenzt persönliche Planungsteam- und Lesezugänge immer auf die ausgewählten Veranstaltungen.",
  },
  {
    area: "Fachbereiche & Planungsdaten",
    primaryAdmin: "Vollzugriff",
    coAdmin: "Vollzugriff im eigenen Verein",
    planner: "Nur ausgewählte Fachbereiche bearbeiten",
    readOnly: "Ansehen – keine Änderungen",
    note: "Beim Planer werden die Fachbereiche einzeln vergeben. Ohne Auswahl bleibt der vollständige Plan lesbar, aber sämtliche Änderungen sind gesperrt.",
  },
  {
    area: "Team-Chat & Live-Notizen",
    primaryAdmin: "Lesen, schreiben und Verlauf leeren",
    coAdmin: "Lesen, schreiben und Verlauf leeren",
    planner: "Lesen und schreiben",
    readOnly: "Lesen und schreiben",
    note: "Der Team-Chat gehört zur freigegebenen Veranstaltung und funktioniert bewusst unabhängig von einzelnen Fachbereichsrechten. Nur Hauptadmin und Co-Admin dürfen den Verlauf leeren.",
  },
  {
    area: "Ansprechpartner & persönliche Zugänge",
    primaryAdmin: "Vollzugriff einschließlich Co-Admins",
    coAdmin: "Planungsteamzugänge verwalten",
    planner: "Kein Zugriff",
    readOnly: "Kein Zugriff",
    note: "Nur der Hauptadmin kann Co-Admins ernennen, ändern oder entfernen. Co-Admins verwalten ausschließlich normale Planungsteamzugänge.",
  },
  {
    area: "Jahre, Veranstaltungen, Importe & Projektstände",
    primaryAdmin: "Vollzugriff",
    coAdmin: "Vollzugriff im eigenen Verein",
    planner: "Nur freigegebene Ausgaben",
    readOnly: "Planungsstand ansehen",
    note: "Neue Veranstaltungsjahre, Veranstaltungen, Importe, Übernahmen und Wiederherstellungen sind administrativ geschützt.",
  },
  {
    area: "Löschen, Schutz & Protokoll",
    primaryAdmin: "Vollzugriff mit Passwortschutz",
    coAdmin: "Vollzugriff im eigenen Verein",
    planner: "Nur soweit Fachbereich freigegeben",
    readOnly: "Kein Löschen oder Zurücksetzen",
    note: "Kritische Aktionen verlangen zusätzlich die bestätigte Administratorsitzung und werden im Protokoll nachvollziehbar festgehalten.",
  },
  {
    area: "Masterportal & globale Plattformrechte",
    primaryAdmin: "Keine Plattformrechte automatisch",
    coAdmin: "Kein Zugriff",
    planner: "Kein Zugriff",
    readOnly: "Kein Zugriff",
    note: "Das Masterportal und globale Schutzfunktionen bleiben ausschließlich dem Plattform-Inhaber vorbehalten und sind keine Vereinsrolle.",
  },
];
