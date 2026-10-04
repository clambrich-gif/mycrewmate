import type { KlemmiSurfaceStep } from "@/components/KlemmiSurfaceGuide";
import type { ProductPackageId } from "@shared/product-packages";

export const CONTACTS_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="contacts-new"]',
    eyebrow: "Klemmi zeigt's",
    title: "Ansprechpartner von Anfang an pflegen",
    text: "Ansprechpartner sind deine verlässlichen Kontaktpersonen für Teams, Helfer und PDFs. Ich führe dich kurz durch die Stammdatenanlage.",
    action: "Anlage zeigen",
  },
  {
    key: "name",
    selector: '[data-klemmi-target="contacts-name"]',
    eyebrow: "Schritt 1 von 3",
    title: "Name eindeutig eintragen",
    text: "Trage zuerst den Namen ein. Diese Angabe ist erforderlich und erscheint später bei Zuordnungen, in Listen und in persönlichen Unterlagen.",
    action: "Kontaktdaten zeigen",
  },
  {
    key: "details",
    selector: '[data-klemmi-target="contacts-details"]',
    eyebrow: "Schritt 2 von 4",
    title: "E-Mail und Rufnummer ergänzen",
    text: "E-Mail-Adresse und Rufnummer sind optional, aber für Rückfragen besonders hilfreich. Ein persönlicher Zugang wird bewusst getrennt unter Schutz und Protokoll eingerichtet.",
    action: "Rufnummernfreigabe zeigen",
  },
  {
    key: "phone-share",
    selector: '[data-klemmi-target="contacts-phone-share"]',
    eyebrow: "Schritt 3 von 4",
    title: "Rufnummer bewusst für Helferpläne freigeben",
    text: "Die Rufnummer bleibt grundsätzlich intern. Setze das Häkchen nur, wenn sie in persönlichen Einsatzplänen der Helfer erscheinen darf, die diesem Ansprechpartner zugeordnet sind. Ohne Häkchen bleibt sie im Organisationsteam.",
    action: "Speichern zeigen",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="contacts-save"]',
    eyebrow: "Schritt 4 von 4",
    title: "Ansprechpartner hinzufügen",
    text: "Klicke auf den markierten Button. Danach steht die Person direkt für Helfer, Aufgaben und Zuständigkeiten zur Auswahl bereit.",
    waitsForSuccess: true,
  },
];

export const DONATIONS_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="donations-create"]',
    eyebrow: "Klemmi zeigt's",
    title: "Spenden übersichtlich erfassen",
    text: "Kuchen, Salate und andere Verpflegungsspenden werden hier sauber mit Spender, Eigenschaften und Abgabe organisiert. Ich zeige dir alles – du musst dafür nichts eintragen oder speichern.",
    action: "Spendenformular öffnen",
  },
  {
    key: "donor",
    selector: '[data-klemmi-target="donation-donor"]',
    eyebrow: "Schritt 1 von 7",
    title: "Spender zuordnen",
    text: "Wähle einen bestehenden Helfer aus oder trage einen Namen frei ein. So bleibt nachvollziehbar, von wem die Spende kommt.",
    action: "Spende beschreiben",
  },
  {
    key: "item",
    selector: '[data-klemmi-target="donation-item"]',
    eyebrow: "Schritt 2 von 7",
    title: "Spende und Kategorie festlegen",
    text: "Beschreibe kurz, was mitgebracht wird, und wähle die passende Kategorie. So bleibt der Überblick über Kuchen, Salate, Desserts und Sonstiges erhalten.",
    action: "Hinweise zeigen",
  },
  {
    key: "traits",
    selector: '[data-klemmi-target="donation-traits"]',
    eyebrow: "Schritt 3 von 7",
    title: "Eigenschaften, Abgabe und Hinweise",
    text: "Kennzeichne bei Bedarf vegan, vegetarisch, glutenfrei, laktosefrei, enthält Nüsse, zuckerfrei, enthält Alkohol oder fleischhaltig. Abgabeort, Zeitpunkt und ein freier Hinweis helfen der Verpflegung am Veranstaltungstag.",
    action: "Speichern zeigen",
  },
  {
    key: "save",
    selector: '[data-klemmi-target="donation-save"]',
    eyebrow: "Schritt 4 von 7",
    title: "Spende speichern",
    text: "Mit dem markierten Speichern-Button wird die Spende in die Übersicht übernommen und zählt automatisch für die aktuelle Veranstaltung. Für diese Erklärung klickst du nicht auf Speichern.",
    action: "Übersicht zeigen",
  },
  {
    key: "overview",
    selector: '[data-klemmi-target="donations-overview"]',
    eyebrow: "Schritt 5 von 7",
    title: "Spendenübersicht lesen",
    text: "Nach dem Speichern erscheint jede Spende mit Spender, Kategorie, Eigenschaften, Abgabeort und Zeitpunkt. So sieht das Verpflegungsteam sofort, was zugesagt wurde und welche Hinweise wichtig sind.",
    action: "Filter zeigen",
  },
  {
    key: "filters",
    selector: '[data-klemmi-target="donations-filters"]',
    eyebrow: "Schritt 6 von 7",
    title: "Gezielt nach Spenden suchen",
    text: "Mit Kategorie, Eigenschaften, Abgabetag, Standort und Suche filterst du die Liste. Das ist besonders hilfreich, wenn kurz vor dem Event nur vegane Kuchen, eine bestimmte Abgabezeit oder ein Standort geprüft werden soll.",
    action: "Ausgabe zeigen",
  },
  {
    key: "outputs",
    selector: '[data-klemmi-target="donations-pdf"]',
    eyebrow: "Schritt 7 von 7",
    title: "Liste und Faltkärtchen drucken",
    text: "Der PDF-Druck erstellt die Übersicht der aktuell sichtbaren Spenden und zusätzlich vier ausschneidbare Faltkärtchen pro Seite. Jedes Kärtchen zeigt Produktname, alle gewählten Eigenschaften, Hinweise und – falls hinterlegt – das Vereinslogo. Mit Liste und Kacheln wählst du die passende Bildschirmansicht. In dieser Tour wird nichts gedruckt oder verändert.",
    action: "Fertig",
  },
];

export const FINANCES_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="finances-category"]',
    eyebrow: "Klemmi zeigt's",
    title: "Finanzen einfach im Blick behalten",
    text: "Hier werden Einnahmen und Ausgaben nach Kategorien getrennt geführt. Der Saldo wird für dich automatisch berechnet.",
    action: "Kategorie zeigen",
  },
  {
    key: "category",
    selector: '[data-klemmi-target="finances-category"]',
    eyebrow: "Schritt 1 von 3",
    title: "Kostenart anlegen",
    text: "Trage eine klare Kategorie ein, zum Beispiel Startgelder, Catering, Technik oder Sponsoring. Mit dem Button daneben wird die neue Zeile angelegt.",
    action: "Werte zeigen",
  },
  {
    key: "values",
    selector: '[data-klemmi-target="finances-values"]',
    eyebrow: "Schritt 2 von 3",
    title: "Einnahmen und Ausgaben eintragen",
    text: "In jeder Kategorie gibst du Einnahmen und Ausgaben ein. Die Werte werden beim Verlassen des Feldes gespeichert; die Differenz zeigt sofort den aktuellen Stand.",
    action: "Saldo zeigen",
  },
  {
    key: "balance",
    selector: '[data-klemmi-target="finances-balance"]',
    eyebrow: "Schritt 3 von 3",
    title: "Saldo gemeinsam prüfen",
    text: "Ganz unten fasst der Saldo alle Kategorien zusammen. So erkennst du schnell, ob deine Veranstaltung finanziell im Plan liegt.",
    action: "Fertig",
  },
];

export const PDF_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="pdf-helper-overviews"]',
    eyebrow: "Klemmi zeigt's",
    title: "Passende PDFs gezielt erstellen",
    text: "In der PDF-Ausgabe erzeugst du persönliche Helferunterlagen, Ansprechpartnerübersichten und gefilterte Einsatzpläne aus den realen Planungsdaten.",
    action: "Helfer-PDFs zeigen",
  },
  {
    key: "helpers",
    selector: '[data-klemmi-target="pdf-helper-overviews"]',
    eyebrow: "Schritt 1 von 3",
    title: "Helfer-PDFs bündeln",
    text: "Wähle bei Bedarf einen Ansprechpartner aus. Anschließend erzeugst du entweder alle Helfer-PDFs als ZIP oder nur die passenden Unterlagen für diese Person.",
    action: "Einsatzplan zeigen",
  },
  {
    key: "plan",
    selector: '[data-klemmi-target="pdf-plan"]',
    eyebrow: "Schritt 2 von 3",
    title: "Einsatzplan filtern und drucken",
    text: "Für den Einsatzplan wählst du Tag, Bereiche, Status und bei Bedarf Ansprechpartner. Das PDF enthält nur die Auswahl, die du wirklich brauchst.",
    action: "Vorlage zeigen",
  },
  {
    key: "config",
    selector: '[data-klemmi-target="pdf-config"]',
    eyebrow: "Schritt 3 von 3",
    title: "Vorlage pro Veranstaltung pflegen",
    text: "Administratoren können hier Logo, Titel, Zusatzspalten, Fußzeilen und WhatsApp-Vorlagen für die aktuell gewählte Veranstaltung konfigurieren. Andere sehen die fertigen PDFs weiterhin unverändert.",
    action: "Fertig",
  },
];

export const PDF_KLEMMI_STEPS_READONLY = PDF_KLEMMI_STEPS.slice(0, 3);

export const SECURITY_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="security-password"]',
    eyebrow: "Klemmi zeigt's",
    title: "Schutz und Protokoll für Administratoren",
    text: "Hier regelst du die sichersten Einstellungen deines Vereins: Administratorpasswort, persönliche Planungsteam-Zugänge, Notfall-Stopp und nachvollziehbare Protokolle. Die Führung öffnet nur Ansichten – sie ändert nichts.",
    action: "Passwortbereich zeigen",
    allowMissingTarget: true,
  },
  {
    key: "password",
    selector: '[data-klemmi-target="security-password"]',
    eyebrow: "Schritt 1 von 14",
    title: "Administratorpasswort sicher neu vergeben",
    text: "Dieser Bereich ist nur für den Hauptadministrator sichtbar. Zur Neuvergabe bestätigst du zuerst das aktuelle Administratorpasswort, wählst anschließend mindestens zehn Zeichen und wiederholst die Eingabe. So kann niemand mit einer offenen Sitzung das zentrale Passwort heimlich ändern.",
    action: "Zugangsübersicht zeigen",
    allowMissingTarget: true,
  },
  {
    key: "accesses-overview",
    selector: '[data-klemmi-target="security-accesses"]',
    eyebrow: "Schritt 2 von 14",
    title: "Planungsteam-Zugänge gezielt verwalten",
    text: "Jede Person erhält einen eigenen Zugang. Dadurch lassen sich Rechte, freigegebene Veranstaltungen und Änderungen sauber der richtigen Person zuordnen. Gemeinsame Passwörter solltest du vermeiden – sie machen Verantwortlichkeiten und spätere Anpassungen unnötig schwer.",
    action: "Filter und Übersicht zeigen",
  },
  {
    key: "accesses-filter",
    selector: '[data-klemmi-target="security-accesses-filter"]',
    eyebrow: "Schritt 3 von 14",
    title: "Vorhandene Zugänge mit Filtern prüfen",
    text: "Hier begrenzt du die Übersicht auf ein Jahr oder eine Veranstaltung. Das ist hilfreich, wenn dein Verein mehrere Events plant: Du erkennst sofort, welche Personen für die gewählte Veranstaltung zugelassen sind, und musst nicht durch alle Zugänge suchen.",
    action: "Zugangskarten lesen",
  },
  {
    key: "accesses-list",
    selector: '[data-klemmi-target="security-accesses-list"]',
    eyebrow: "Schritt 4 von 14",
    title: "Status und Freigaben einer Person lesen",
    text: "Jede Zugangskarte zeigt Name, E-Mail, Passwortstatus, Rolle, sichtbare Fachbereiche und freigegebene Veranstaltungen. Grün bedeutet: Passwort eingerichtet. Gelb bedeutet: Der Initialcode ist noch offen. Rot markiert einen Co-Admin. Mit Bearbeiten passt du eine vorhandene Freigabe später sicher an.",
    action: "Neuen Zugang zeigen",
  },
  {
    key: "accesses-create",
    selector: '[data-klemmi-target="security-accesses-create"]',
    eyebrow: "Schritt 5 von 14",
    title: "Neuen Zugang bewusst anlegen",
    text: "Hier legst du einen persönlichen Zugang für eine bereits angelegte Kontaktperson an. Du entscheidest zwischen sicherem Aktivierungslink per E-Mail und einem einmaligen Zugangsblatt für den Offline-Weg. Zugangsdaten werden nicht dauerhaft offen angezeigt – das schützt das Planungsteam.",
    action: "Person und E-Mail zeigen",
  },
  {
    key: "accesses-identity",
    selector: '[data-klemmi-target="security-accesses-identity"]',
    eyebrow: "Schritt 6 von 14",
    title: "Person eindeutig zuordnen",
    text: "Wähle zuerst den passenden Ansprechpartner. Die persönliche E-Mail-Adresse dient – falls gepflegt – dem individuellen Login und Aktivierungslink. Eine eindeutige Zuordnung verhindert, dass sich mehrere Personen versehentlich einen Zugang teilen oder Änderungen nicht mehr nachvollziehbar sind.",
    action: "Rechte-Schalter erklären",
  },
  {
    key: "accesses-rights",
    selector: '[data-klemmi-target="security-accesses-rights"]',
    eyebrow: "Schritt 7 von 14",
    title: "Die drei Rechte-Schalter richtig vergeben",
    text: "Die drei Schalter heißen Aus, Lesen und Schreiben. Aus bedeutet: Der Bereich ist vollständig ausgeblendet. Lesen zeigt Inhalte ohne Änderungen. Schreiben erlaubt das Anlegen und Pflegen von Daten in diesem Bereich. Gib nur Rechte, die für die konkrete Aufgabe wirklich nötig sind – so bleiben Planung, Finanzen und sensible Informationen geschützt.",
    action: "Co-Admin zeigen",
  },
  {
    key: "accesses-coadmin",
    selector: '[data-klemmi-target="security-accesses-coadmin"]',
    eyebrow: "Schritt 8 von 14",
    title: "Co-Admin nur gezielt vergeben",
    text: "Ein Co-Admin kann im eigenen Verein nahezu alle Planungsdaten und normalen Zugänge verwalten. Er erhält aber keine Plattform- oder Masterrechte und kann keine anderen Co-Admins verwalten. Vergib diese Rolle nur an sehr vertrauenswürdige Personen, die dauerhaft die Gesamtorganisation mittragen.",
    action: "Veranstaltungen zeigen",
    allowMissingTarget: true,
  },
  {
    key: "accesses-events",
    selector: '[data-klemmi-target="security-accesses-events"]',
    eyebrow: "Schritt 9 von 14",
    title: "Veranstaltungen bewusst freigeben",
    text: "Normale Planungsteam-Zugänge sehen nur die hier angehakten Veranstaltungen. So kann eine Kontaktperson etwa beim Sommerfest helfen, ohne die Planung einer anderen Veranstaltung zu sehen. Co-Admins erhalten automatisch alle aktuellen und künftigen Veranstaltungen des Vereins.",
    action: "Notfall-Stopp zeigen",
  },
  {
    key: "emergency",
    selector: '[data-klemmi-target="security-emergency"]',
    eyebrow: "Schritt 10 von 14",
    title: "Globalen Notfall-Stopp kennen",
    text: "Bei einem echten Sicherheitsvorfall sperrt dieser Schalter sofort alle Planungsteam-Logins und bereits offenen Planungsteam-Sitzungen. Persönliche Vereinsadministratoren bleiben handlungsfähig. Nutze den Stopp nicht für normale Planänderungen, sondern nur bei Verdacht auf unbefugten Zugriff oder einer akuten Sicherheitslage.",
    action: "Login-Protokoll zeigen",
  },
  {
    key: "audit-logins",
    selector: '[data-klemmi-target="security-audit-logins"]',
    eyebrow: "Schritt 11 von 14",
    title: "Sicherheit und Logins nachvollziehen",
    text: "Dieser Tab protokolliert erfolgreiche Administrator-Anmeldungen, Passwortwechsel, Einmalcode-Resets und globale Notfall-Sperren. Prüfe ihn, wenn du nachvollziehen möchtest, wann eine besonders geschützte Aktion stattgefunden hat oder ob ein Vorfall bereits bearbeitet wurde.",
    action: "Aktivitätsverlauf zeigen",
  },
  {
    key: "audit-activity",
    selector: '[data-klemmi-target="security-audit-activity"]',
    eyebrow: "Schritt 12 von 14",
    title: "Änderungen und Löschungen prüfen",
    text: "Im Aktivitätsverlauf siehst du, wer wann in welchem Bereich etwas erstellt, geändert oder gelöscht hat. Der neue Filter ‚Nur Freigaben & Zugänge‘ zeigt dir zusätzlich getrennt, wann Teamzugänge sowie WhatsApp- oder PDF-Freigaben angelegt oder geändert wurden. Die Löschansicht trennt gelöschte Einträge von normalen Aktivitäten; Jahr, Veranstaltung und Datentyp helfen beim Eingrenzen.",
    action: "Import-Historie zeigen",
  },
  {
    key: "audit-files",
    selector: '[data-klemmi-target="security-audit-files"]',
    eyebrow: "Schritt 13 von 14",
    title: "Datei- und Import-Historie verstehen",
    text: "Hier stehen erfolgreich übernommene JSON-Projektstände und – ab Pro – Excel-Module mit Zeitpunkt, Person sowie Anzahl neuer, geänderter und gelöschter Datensätze. Ein Klick auf einen Eintrag zeigt die konkreten Einzeländerungen. So prüfst du vor allem nach einem Import, was tatsächlich in die Planung übernommen wurde.",
    action: "Gefahrenbereich einordnen",
  },
  {
    key: "danger",
    selector: '[data-klemmi-target="security-danger"]',
    eyebrow: "Schritt 14 von 14",
    title: "Gefahrenbereich nur als letzte Option",
    text: "Dieser Bereich löscht sämtliche Planungsdaten des aktuell gewählten Jahres unwiderruflich. Andere Jahre und Passwörter bleiben erhalten. Er ist für einen vollständigen Neustart gedacht, nicht für einzelne Korrekturen. Prüfe vorher Protokolle, Filter und mögliche Wiederherstellungen.",
    action: "Fertig",
  },
];

export const HELP_KLEMMI_STEPS: KlemmiSurfaceStep[] = [
  {
    key: "intro",
    selector: '[data-klemmi-target="help-search"]',
    eyebrow: "Klemmi zeigt's",
    title: "Im Hilfe-Center schnell zurechtfinden",
    text: "Hier findest du kurze Anleitungen für die gesamte Planung – von der ersten Orientierung bis zu PDFs, Rechten und Sicherungen.",
    action: "Suche zeigen",
  },
  {
    key: "search",
    selector: '[data-klemmi-target="help-search"]',
    eyebrow: "Schritt 1 von 4",
    title: "Direkt nach einem Begriff suchen",
    text: "Tippe einfach ein Stichwort wie Helfer, Einsatzplan, Material, PDF oder Passwort ein. Die sichtbaren Kapitel passen sich sofort an.",
    action: "Rollenfilter zeigen",
  },
  {
    key: "filters",
    selector: '[data-klemmi-target="help-filters"]',
    eyebrow: "Schritt 2 von 4",
    title: "Hilfe nach Rolle filtern",
    text: "Mit den Rollenfiltern blendest du Inhalte für alle, für das Planungsteam oder für Administratoren ein. So bleibt die Anleitung passend zu deinen Rechten.",
    action: "Kapitel zeigen",
  },
  {
    key: "chapters",
    selector: '[data-klemmi-target="help-chapters"]',
    eyebrow: "Schritt 3 von 4",
    title: "Kapitel öffnen und direkt weiterarbeiten",
    text: "Öffne das passende Kapitel, lies die kompakten Schritte und nutze die Links direkt zum jeweiligen Arbeitsbereich. Klemmi bleibt auch dort wieder für dich erreichbar.",
    action: "WBT zeigen",
  },
  {
    key: "wbt",
    selector: '[data-klemmi-target="help-wbt"]',
    eyebrow: "Schritt 4 von 4",
    title: "Mit dem WBT in Ruhe üben",
    text: "Im Kapitel Web-Based-Training startest du die datenfreie Lernwerkstatt direkt mit dem passenden Trainingspfad: Helferkoordination oder Planungsteam und Administration. Dort übst du die Abläufe ohne etwas in deiner echten Vereinsplanung zu verändern.",
    action: "Fertig",
  },
];

/** Liefert nur dort Paket-Hinweise, wo im aktuellen Produktumfang tatsächlich eine Grenze liegt. */
export function getPdfKlemmiSteps({
  currentPackageId,
  canManage,
}: {
  currentPackageId: ProductPackageId;
  canManage: boolean;
}): KlemmiSurfaceStep[] {
  const steps = (canManage ? PDF_KLEMMI_STEPS : PDF_KLEMMI_STEPS_READONLY).map(
    step => ({ ...step })
  );

  if (currentPackageId === "event_pass") {
    const intro = steps.find(step => step.key === "intro");
    if (intro) {
      intro.title = "Passende PDFs im Event Pass erstellen";
      intro.text = "Im Event Pass erzeugst du persönliche Helferunterlagen und gefilterte Einsatzpläne aus den realen Planungsdaten. Ansprechpartner-Arbeitsmappen erkläre ich dir gleich als Light-Erweiterung.";
      intro.audioKey = "intro-event-pass";
    }
    const plan = steps.find(step => step.key === "plan");
    if (plan) {
      plan.text = "Für den Einsatzplan wählst du Tag, Bereiche und Status. Das PDF enthält nur die Auswahl, die du wirklich brauchst. Eine Ansprechpartnerauswahl steht ab Light bereit.";
      plan.audioKey = "plan-event-pass";
      plan.action = "Ansprechpartner-Übersichten erklären";
    }
    steps.splice(3, 0, {
      key: "contacts-locked",
      selector: '[data-klemmi-target="pdf-contact-overviews"]',
      eyebrow: "",
      title: "Ansprechpartner-Übersichten ab Light",
      text: "Mit Ansprechpartner-Übersichten erstellst du gegliederte Arbeitsmappen mit Bereichsverantwortung, Schichten und Checklisten. Im Event Pass ist dieser Teil gesperrt. Helfer-PDFs und gefilterte Einsatzpläne bleiben weiter nutzbar.",
      audioKey: "contacts-locked",
      action: canManage ? "Vorlage zeigen" : "Fertig",
    });
  }

  const config = steps.find(step => step.key === "config");
  if (config && currentPackageId === "event_pass") {
    config.key = "config-locked";
    config.title = "PDF-Vorlage mit klaren Paketgrenzen";
    config.text = "Titel, Zusatzspalten und Hinweise kannst du hier für die aktuelle Veranstaltung pflegen. Ein eigenes Eventlogo und automatische WhatsApp-Vorlagen stehen ab Pro bereit. Bis dahin bleibt das MyCrewMate-Logo aktiv. WhatsApp öffnet weiter einen leeren Chat für freie Nachrichten.";
    config.audioKey = "config-locked";
  }
  if (config && currentPackageId === "light") {
    config.key = "config-light";
    config.title = "PDF-Vorlage im Light-Paket pflegen";
    config.text = "Titel, Zusatzspalten, Hinweise und Fußzeilen kannst du hier für die aktuelle Veranstaltung konfigurieren. Ein eigenes Eventlogo und automatische WhatsApp-Vorlagen ergänzen das Pro-Paket. Bis dahin bleibt das MyCrewMate-Logo aktiv und WhatsApp öffnet einen leeren Chat für freie Nachrichten.";
    config.audioKey = "config-light";
  }

  const numbered = steps.filter(step => step.key !== "intro");
  return steps.map(step => {
    const index = numbered.findIndex(candidate => candidate.key === step.key);
    return index < 0
      ? step
      : { ...step, eyebrow: `Schritt ${index + 1} von ${numbered.length}` };
  });
}

/**
 * Im Event Pass existieren keine persönlichen Planungsteam-Zugänge. Alle
 * Unterpunkte der Zugangsverwaltung zeigen deshalb auf denselben sichtbaren,
 * ruhigen Upgrade-Hinweis – statt auf Formulare, die absichtlich nicht gerendert
 * werden. So bleiben Highlight und Klemmi-Audio zuverlässig synchron.
 */
const EVENT_PASS_ACCESS_STEP_COPY: Partial<
  Record<string, Pick<KlemmiSurfaceStep, "title" | "text" | "audioKey">>
> = {
  "accesses-overview": {
    title: "Planungsteam-Zugänge ab Light",
    text: "Persönliche Planungsteam-Zugänge verwalten Fachrechte und Veranstaltungsfreigaben für einzelne Personen. Im Event Pass bleibt die Planung sicher beim Hauptadministrator. Mit Light kommen bis zu fünf persönliche Zugänge hinzu. Die übrigen Sicherheits- und Protokollbereiche bleiben weiter verfügbar.",
    audioKey: "accesses-locked",
  },
  "accesses-filter": {
    title: "Zugangsfilter ab Light",
    text: "Dieser Filter gehört zu persönlichen Planungsteam-Zugängen und steht deshalb ab Light bereit. Dort findest du Teammitglieder gezielt nach Jahr oder Veranstaltung. Im Event Pass gibt es nur den Hauptadministrator für die eine Veranstaltung, daher ist keine Zugangsliste zu filtern.",
    audioKey: "accesses-filter-locked",
  },
  "accesses-list": {
    title: "Zugangskarten ab Light",
    text: "Statuskarten für weitere Teammitglieder gibt es ab Light. Dort erkennst du eingerichtete Passwörter, Rollen und Freigaben pro Person. Im Event Pass bleibt die Verwaltung bewusst schlank: Der Hauptadministrator verantwortet die einzige Veranstaltung direkt.",
    audioKey: "accesses-list-locked",
  },
  "accesses-create": {
    title: "Neue Teamzugänge ab Light",
    text: "Eigene Anmeldungen für weitere Personen, Aktivierungslinks und Zugangsblätter stehen ab Light bereit. Das ist sinnvoll, wenn Ansprechpartner oder Einsatzplaner mit eigenen Rechten arbeiten sollen. Im Event Pass bleibt die Planung beim Hauptadministrator.",
    audioKey: "accesses-create-locked",
  },
  "accesses-identity": {
    title: "Persönliche Anmeldung ab Light",
    text: "Die Zuordnung eines eigenen Logins zu einem Ansprechpartner ist Teil der persönlichen Teamzugänge ab Light. Sie sorgt dafür, dass Änderungen einer Person zugeordnet bleiben. Im Event Pass ist kein weiterer Login vorgesehen; der Hauptadministrator bleibt die feste Ansprechperson.",
    audioKey: "accesses-identity-locked",
  },
  "accesses-rights": {
    title: "Fachbereichsrechte ab Light",
    text: "Die Schalter Aus, Lesen und Schreiben verteilen Rechte an weitere Teammitglieder und stehen ab Light bereit. Im Event Pass gibt es keine zusätzlichen Planungsteam-Zugänge, deshalb müssen dort keine Fachbereichsrechte vergeben werden.",
    audioKey: "accesses-rights-locked",
  },
  "accesses-coadmin": {
    title: "Co-Admins ab Light",
    text: "Einen weiteren Co-Admin oder Planungszugang kannst du ab Light einrichten. Light enthält bis zu fünf persönliche Teamzugänge, Pro bis zu vierzehn. Im Event Pass bleibt die Gesamtverantwortung beim Hauptadministrator.",
    audioKey: "accesses-coadmin-locked",
  },
  "accesses-events": {
    title: "Eventfreigaben ab Light",
    text: "Veranstaltungen für einzelne Teammitglieder freizugeben, ist Teil der persönlichen Zugänge ab Light. Im Event Pass ist genau eine Veranstaltung enthalten und sie wird vom Hauptadministrator vollständig betreut. Deshalb gibt es hier keine separate Auswahl.",
    audioKey: "accesses-events-locked",
  },
};

const EVENT_PASS_SECURITY_INTRO: Pick<
  KlemmiSurfaceStep,
  "title" | "text" | "audioKey"
> = {
  title: "Schutz und Protokoll im Event Pass",
  text: "Hier regelst du das Administratorpasswort, prüfst Sicherheits- und Aktivitätsprotokolle und nutzt den Gefahrenbereich nur bewusst. Persönliche Planungsteam-Zugänge und deren Notfall-Stopp ergänzen das Light-Paket. Die Führung öffnet nur Ansichten und ändert nichts.",
  audioKey: "intro-event-pass",
};

/** Der Event Pass enthält eine begrenzte JSON-Sicherung seiner Einzelveranstaltung. */
const EVENT_PASS_BACKUP_AUDIT_COPY: Pick<
  KlemmiSurfaceStep,
  "title" | "text" | "audioKey"
> = {
  title: "JSON-Sicherung im Event Pass verstehen",
  text: "Hier siehst du erfolgreiche JSON-Sicherungen dieser Veranstaltung mit Zeitpunkt, Person sowie Anzahl neuer, geänderter und gelöschter Datensätze. Im Event Pass stehen Sicherung und Wiederherstellung ausschließlich als JSON zur Verfügung. Excel-Import und -Export beginnen ab Pro. Ein Klick auf einen Eintrag zeigt die konkreten Einzeländerungen.",
  audioKey: "audit-files-event-pass",
};

/** Light enthält keine Dateiübernahme; die sichere Kernplanung bleibt davon unberührt. */
const LIGHT_BACKUP_AUDIT_COPY: Pick<
  KlemmiSurfaceStep,
  "title" | "text" | "audioKey"
> = {
  title: "Datei- und Import-Historie ab Pro",
  text: "Im Light-Paket sind die Kernplanung, Ansprechpartner, Orte, Material und persönliche Teamzugänge verfügbar. Eine vollständige Datei-Sicherung, Excel-Import und die zugehörige Historie ergänzen das Pro-Paket. Sicherheits- und Aktivitätsprotokolle bleiben hier weiterhin nutzbar.",
  audioKey: "audit-files-light",
};

/** Ergänzt die Sicherheitstour mit den für das jeweilige Paket passenden Alternativen. */
export function getSecurityKlemmiSteps(
  currentPackageId: ProductPackageId
): KlemmiSurfaceStep[] {
  if (currentPackageId === "pro" || currentPackageId === "enterprise") {
    return SECURITY_KLEMMI_STEPS;
  }

  return SECURITY_KLEMMI_STEPS.map(step => {
    if (currentPackageId === "event_pass" && step.key === "intro") {
      return { ...step, ...EVENT_PASS_SECURITY_INTRO };
    }
    if (currentPackageId === "event_pass" && step.key === "audit-files") {
      return { ...step, ...EVENT_PASS_BACKUP_AUDIT_COPY };
    }
    if (currentPackageId === "light" && step.key === "audit-files") {
      return { ...step, ...LIGHT_BACKUP_AUDIT_COPY };
    }

    const lockedCopy =
      currentPackageId === "event_pass"
        ? EVENT_PASS_ACCESS_STEP_COPY[step.key]
        : undefined;
    return lockedCopy
      ? {
          ...step,
          ...lockedCopy,
          selector: '[data-klemmi-target="security-accesses-locked"]',
          allowMissingTarget: true,
        }
      : step;
  });
}
