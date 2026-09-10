export type PermissionRow = {
  area: string;
  planningTeam: string;
  administrator: string;
  note: string;
};

export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  {
    area: "Dashboard & Jahresauswahl",
    planningTeam: "Ansehen und Jahr auswählen",
    administrator: "Vollzugriff",
    note: "Neue Jahre und die Vorjahresübernahme sind administrativ geschützt.",
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
    administrator: "Ansehen und zurücksetzen",
    note: "Das Protokoll zeigt Helfer- und Kuchenlöschungen einschließlich des ausgewählten Ansprechpartners. Zurücksetzen erfordert das Administratorpasswort.",
  },
];
