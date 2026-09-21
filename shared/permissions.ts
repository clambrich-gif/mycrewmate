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
    note: "Neue Jahre, das Anlegen von Veranstaltungen mit aktiven Wochentagen, Umbenennen, passwortgeschütztes Löschen sowie die Planübernahme sind administrativ geschützt.",
  },
  {
    area: "Ansprechpartner",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Die Einzellöschung erfordert eine Administratorsitzung und das Administratorpasswort. Der eigene gleichnamige Helfereintrag wird automatisch ohne weitere Personenauswahl mitgelöscht.",
  },
  {
    area: "Helfer",
    planningTeam: "Anlegen, bearbeiten und eingeschränkt löschen",
    administrator: "Vollzugriff",
    note: "Eingeteilte Helfer kann nur ein Administrator löschen. Eigene Helfereinträge von Ansprechpartnern werden automatisch über die Ansprechpartnerlöschung entfernt.",
  },
  {
    area: "Einsatzplan",
    planningTeam: "Nur ansehen und filtern",
    administrator: "Vollzugriff",
    note: "Schichten, Besetzungen, Kopien und Planimporte können ausschließlich Administratoren ändern.",
  },
  {
    area: "Vorbereitung",
    planningTeam: "Vollzugriff mit Löschprotokoll",
    administrator: "Vollzugriff",
    note: "Das Planungsteam kann Aufgaben anlegen, bearbeiten und löschen. Die reale angemeldete Sitzungsidentität wird automatisch im Löschprotokoll gespeichert. Nur Administratoren können gelöschte Vorbereitungen wiederherstellen oder Resets ausführen.",
  },
  {
    area: "Nachbereitung",
    planningTeam: "Vollzugriff mit Löschprotokoll",
    administrator: "Vollzugriff",
    note: "Das Planungsteam kann Aufgaben anlegen, bearbeiten und löschen. Die reale angemeldete Sitzungsidentität wird automatisch im Löschprotokoll gespeichert. Nur Administratoren können gelöschte Nachbereitungen wiederherstellen oder Resets ausführen.",
  },
  {
    area: "Material, Marketing & Genehmigungen",
    planningTeam: "Anlegen und bearbeiten",
    administrator: "Vollzugriff",
    note: "Einzellöschungen und Resets sind administrativ geschützt.",
  },
  {
    area: "Kuchen / Spenden",
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
    area: "Projektdatei: Speichern & Laden",
    planningTeam: "Speichern",
    administrator: "Speichern, prüfen und laden",
    note: "Die kompakte JSON-Projektdatei enthält den vollständigen Stand der gewählten Veranstaltung. Das Laden ist passwortgeschützt, atomar und vollständig protokolliert.",
  },
  {
    area: "Excel-Projektübersicht & Modulimporte",
    planningTeam: "Projektübersicht exportieren",
    administrator: "Export und modulare Importe",
    note: "Excel dient der Übersicht. Im jeweiligen Bereich können Administratoren nur dessen Tabellenblatt prüfen und vollständig importieren; Neu-, Änderungs- und Löschfilter erleichtern die Vorschau.",
  },
  {
    area: "Zugangsschutz, Einmal-Zugänge & Resets",
    planningTeam: "Kein Zugriff",
    administrator: "Vollzugriff",
    note: "Administratoren erstellen und drucken Einmal-Zugänge, setzen Passwörter gezielt zurück und aktivieren bei Bedarf den globalen Notfall-Stopp für das gesamte Planungsteam. Passwortänderungen sowie Bereichs- oder Jahresresets bleiben administrativ geschützt.",
  },
  {
    area: "Protokoll & Wiederherstellung",
    planningTeam: "Kein Zugriff",
    administrator: "Ansehen, filtern, wiederherstellen und zurücksetzen",
    note: "Der Menüpunkt Protokoll ist für das Planungsteam ausgeblendet und nicht aufrufbar. Administratoren können Einzellöschungen von Helfern, Spenden sowie Vor- und Nachbereitungen gezielt wiederherstellen; das Zurücksetzen erfordert das Administratorpasswort.",
  },
];
