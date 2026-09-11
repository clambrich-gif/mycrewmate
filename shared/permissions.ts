export type PermissionRow = {
  area: string;
  planningTeam: string;
  administrator: string;
  note: string;
};

export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  {
    area: "Dashboard, Jahre & Veranstaltungen",
    planningTeam: "Ansehen und auswählen",
    administrator: "Vollzugriff",
    note: "Neue Jahre, Anlegen, Umbenennen und passwortgeschütztes Löschen von Veranstaltungen sowie die Planübernahme sind administrativ geschützt.",
  },
  {
    area: "Ansprechpartner",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Die Einzellöschung erfordert eine Administratorsitzung; der Bereichsreset zusätzlich das Administratorpasswort.",
  },
  {
    area: "Helfer",
    planningTeam: "Anlegen, bearbeiten und eingeschränkt löschen",
    administrator: "Vollzugriff",
    note: "Eingeteilte Helfer kann nur ein Administrator löschen. Eigene Helfereinträge von Ansprechpartnern werden über den Ansprechpartner verwaltet.",
  },
  {
    area: "Einsatzplan",
    planningTeam: "Nur ansehen und filtern",
    administrator: "Vollzugriff",
    note: "Schichten, Besetzungen, Kopien und Planimporte können ausschließlich Administratoren ändern.",
  },
  {
    area: "Vor- und Nachbereitung",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Einzellöschungen und Resets sind administrativ geschützt.",
  },
  {
    area: "Material, Marketing & Genehmigungen",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Einzellöschungen und Resets sind administrativ geschützt.",
  },
  {
    area: "Kuchen",
    planningTeam: "Vollzugriff",
    administrator: "Vollzugriff",
    note: "Einzellöschungen erfordern für beide Rollen eine ausdrückliche Ja/Nein-Bestätigung und werden protokolliert.",
  },
  {
    area: "Finanzen",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Einzellöschungen und Resets sind administrativ geschützt.",
  },
  {
    area: "PDF-Ausgabe",
    planningTeam: "Vollzugriff",
    administrator: "Vollzugriff",
    note: "Beide Rollen können Einzel-, Sammel- sowie gefilterte Blanko- und ausgefüllte Einsatzpläne erzeugen.",
  },
  {
    area: "Excel",
    planningTeam: "Nur Export",
    administrator: "Import und Export",
    note: "Die geprüfte Übernahme von Schichten, Helfern und Zuordnungen ist Administratoren vorbehalten.",
  },
  {
    area: "Zugangsschutz & Resets",
    planningTeam: "Kein Zugriff",
    administrator: "Vollzugriff",
    note: "Passwortänderungen und Bereichs- oder Jahresresets bleiben ausschließlich administrativ geschützt.",
  },
  {
    area: "Löschprotokoll",
    planningTeam: "Kein Zugriff",
    administrator: "Ansehen, wiederherstellen und zurücksetzen",
    note: "Einzellöschungen können gezielt rückgängig gemacht werden. Das vollständige Zurücksetzen des Protokolls erfordert das Administratorpasswort.",
  },
];
