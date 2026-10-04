import type { KlemmiSurfaceStep } from "@/components/KlemmiSurfaceGuide";
import type { DashboardDetailsLayout } from "@/hooks/useDashboardDetailsLayout";
import type { ProductPackageId } from "@shared/product-packages";

export type DashboardKlemmiTourState = {
  hasEventPeriod: boolean;
  hasPriorityActions: boolean;
  hasDeadlines: boolean;
  hasHelpers: boolean;
  hasAssignments: boolean;
  hasContacts: boolean;
  hasMappableLocations: boolean;
  /** Live-Standortkarte und GPS-Strecken sind ausschließlich ab Pro verfügbar. */
  canUseMapsGpx: boolean;
  /** Der gemeinsame Live-Chat steht ausschließlich ab Pro zur Verfügung. */
  canUseChat: boolean;
  canUseDonations: boolean;
  currentPackageId: ProductPackageId;
  detailsLayout: DashboardDetailsLayout;
};

/**
 * Erklärt ausschließlich echte, auf dem aktuellen Dashboard sichtbare Bereiche.
 * Leere Zustände werden dabei als klare Anleitung formuliert: Sie zeigen, welche
 * Eingaben nötig sind, damit die jeweilige Übersicht später mit Daten erscheint.
 */
export function createDashboardKlemmiSteps(
  state: DashboardKlemmiTourState
): KlemmiSurfaceStep[] {
  const detailsAreStacked = state.detailsLayout === "stacked";
  const showsDonations = state.canUseDonations;
  const steps: KlemmiSurfaceStep[] = [
    {
      key: "intro",
      selector: '[data-klemmi-trigger="dashboard"]',
      eyebrow: "Klemmi zeigt’s",
      title: "Dein Dashboard auf einen Blick",
      text: "Hier laufen die Informationen aus deiner Planung zusammen. Ich zeige dir jetzt nur die Bereiche, die auf diesem Dashboard wirklich sichtbar sind.",
      action: "Dashboard entdecken",
    },
    {
      key: state.hasEventPeriod ? "countdown-dated" : "countdown-empty",
      selector: '[data-slot="event-countdown"]',
      eyebrow: "1 · Veranstaltung",
      title: state.hasEventPeriod ? "Countdown bis zum Event" : "Zeitraum für den Countdown festlegen",
      text: state.hasEventPeriod
        ? "Hier siehst du den Zeitraum der aktuellen Veranstaltung und den Countdown. Das Datum kommt direkt aus den Eventdaten und aktualisiert sich automatisch."
        : "Hier erscheint der Countdown, sobald du in den Eventdaten einen Start- und bei mehrtägigen Veranstaltungen auch einen Endtermin speicherst.",
      action: "Weiter zu den Prioritäten",
    },
    {
      key: state.hasPriorityActions ? "priorities-attention" : "priorities-clear",
      selector: '[data-dashboard-section="Heute priorisieren"]',
      eyebrow: "2 · Handlungsbedarf",
      title: state.hasPriorityActions ? "Was jetzt Aufmerksamkeit braucht" : "Keine dringenden Punkte",
      text: state.hasPriorityActions
        ? "Diese Karten zeigen nur konkrete Warnungen oder offene Punkte, zum Beispiel unbesetzte Schichten, Ausfälle oder offene Vorbereitungen. Ein Klick führt direkt in den passenden Bereich."
        : "Hier werden später nur Punkte eingeblendet, die unmittelbar Aufmerksamkeit brauchen. Sobald es offene Schichten, Konflikte oder Aufgaben gibt, erscheinen sie automatisch an dieser Stelle.",
      action: "Weiter zu den Fristen",
    },
  ];

  if (state.hasDeadlines) {
    steps.push({
      key: "deadlines",
      selector: '[data-dashboard-level="Fristen"]',
      eyebrow: "3 · Nächste Fristen",
      title: "Datierte Vorbereitungsaufgaben",
      text: "Diese Übersicht erscheint, wenn Vorbereitungsaufgaben ein Fälligkeitsdatum haben. Du siehst die nächsten Termine zuerst und öffnest per Klick direkt die zugehörige Aufgabe.",
      action: "Weiter zu Helferstatus und Spenden",
    });
  }

  steps.push(
    {
      key: state.hasHelpers || state.hasAssignments ? "helpers-active" : "helpers-empty",
      selector: '[data-dashboard-section="Helfer-Kennzahlen"]',
      eyebrow: showsDonations ? "4 · Helfer, Besetzung und Spenden" : "4 · Helfer und Besetzung",
      title: state.hasHelpers || state.hasAssignments ? "Helferstatus je Festivaltag" : "Helferstatus entsteht mit deiner Planung",
      text: state.hasHelpers || state.hasAssignments
        ? showsDonations
          ? "Hier erkennst du pro Veranstaltungstag Besetzung und Bedarf, Rückmeldungen, Erstkontakte und Verpflegungsspenden. Klickbare Werte führen in die bereits passend gefilterte Helfer- oder Einsatzplanansicht."
          : "Hier erkennst du pro Veranstaltungstag Besetzung und Bedarf, Rückmeldungen und Erstkontakte. Klickbare Werte führen in die bereits passend gefilterte Helfer- oder Einsatzplanansicht."
        : showsDonations
          ? "Sobald du Helfer anlegst und Schichten mit Bedarf planst, erscheinen hier Besetzung, Rückmeldungen und Erstkontakte. Erfasste Kuchen- und Salatspenden werden daneben automatisch zusammengefasst."
          : "Sobald du Helfer anlegst und Schichten mit Bedarf planst, erscheinen hier Besetzung, Rückmeldungen und Erstkontakte. So siehst du frühzeitig, wo noch Rückmeldungen oder Helfer fehlen.",
      audioKey: showsDonations
        ? undefined
        : state.hasHelpers || state.hasAssignments
          ? "helpers-active-no-donations"
          : "helpers-empty-no-donations",
      action: "Weiter zu den Details",
    },
    {
      key: state.hasContacts || state.hasAssignments ? "details-active" : "details-empty",
      selector: '[data-dashboard-level="Tabellendetails"]',
      eyebrow: "5 · Zuständigkeiten und Auslastung",
      title: state.hasContacts || state.hasAssignments ? "Wer macht was – und wer ist frei?" : "Details wachsen mit den Einträgen",
      audioKey: state.hasContacts || state.hasAssignments
        ? detailsAreStacked
          ? "details-active-stacked"
          : "details-active"
        : detailsAreStacked
          ? "details-empty-stacked"
          : "details-empty",
      text: state.hasContacts || state.hasAssignments
        ? detailsAreStacked
          ? "Oben siehst du Verantwortlichkeiten nach Ansprechpartnern. Darunter zeigt die Helferauslastung alle eingeteilten Schichten je Tag. Ein Klick auf einen Namen oder Wert öffnet die passende gefilterte Einsatzplanung."
          : "Links siehst du Verantwortlichkeiten nach Ansprechpartnern. Rechts zeigt die Helferauslastung alle eingeteilten Schichten je Tag. Ein Klick auf einen Namen oder Wert öffnet die passende gefilterte Einsatzplanung."
        : detailsAreStacked
          ? "Hier entstehen zwei Übersichten, sobald Ansprechpartner, Helfer und Schichten gepflegt sind: Zuerst die Zuständigkeiten nach Ansprechpartnern und direkt darunter die tägliche Helferauslastung."
          : "Hier entstehen zwei Übersichten, sobald Ansprechpartner, Helfer und Schichten gepflegt sind: Zuständigkeiten auf der linken Seite und die tägliche Helferauslastung auf der rechten Seite.",
      action: "Weiter zur Standortkarte",
    },
    !state.canUseMapsGpx
      ? {
          key: "map-locked",
          selector: '[data-dashboard-level="Live-Standortkarte"]',
          eyebrow: "6 · Orte und Standorte",
          title: "Live-Standortkarte ab Pro",
          text:
            state.currentPackageId === "light"
              ? "Im Light-Paket kannst du Orte und Standorte bereits für Schichten, Vorbereitung und Material nutzen. Die interaktive Karte mit GPS-Punkten, Strecken und Statusmarkern ergänzt Pro. Deshalb wird auf diesem Dashboard noch keine Karte eingeblendet."
              : "Die Live-Standortkarte mit GPS-Orten, Strecken und Statusmarkern steht ab Pro bereit. Im Event Pass konzentrierst du dich auf Helfer, Einsatzplan, Vorbereitung und die Standard-PDFs. Deshalb wird hier keine Karte eingeblendet.",
          audioKey:
            state.currentPackageId === "light" ? "map-locked-light" : "map-locked",
          action: state.canUseChat
            ? "Weiter zum Live-Chat"
            : "Dashboard-Tour abschließen",
          // Im Event Pass gibt es bewusst keine Kartenfläche. Die Tour darf
          // trotzdem sprechen und erklärt genau diesen Paketunterschied.
          allowMissingTarget: true,
        }
      : {
          key: state.hasMappableLocations ? "map-active" : "map-empty",
          selector: '[data-dashboard-level="Live-Standortkarte"]',
          eyebrow: "6 · Orte und Standorte",
          title: state.hasMappableLocations ? "Live-Standortkarte nutzen" : "Standortkarte später aktivieren",
          text: state.hasMappableLocations
            ? "Diese Karte verbindet Orte mit Vorbereitung, Schichten und Material. Die Farben zeigen den jeweiligen Stand, und ein Klick auf einen Marker filtert den passenden Planungsbereich."
            : "Sobald du unter Orte und Standorte mindestens einen Standort mit Koordinaten anlegst, wird hier unten automatisch die Live-Standortkarte mit den zugehörigen Planungsinformationen eingeblendet.",
          action: state.canUseChat
            ? "Weiter zum Live-Chat"
            : "Dashboard-Tour abschließen",
      }
  );

  if (state.canUseChat) {
    steps.push({
      key: "chat",
      selector: '[data-klemmi-target="dashboard-live-chat"]',
      eyebrow: "7 · Live-Chat und Team-Notizen",
      title: "Wichtige Nachrichten klar an das Team senden",
      text: "Über die blaue Sprechblase öffnest du die Team-Notizen der aktuell gewählten Veranstaltung. Markiere eine Nachricht als wichtig, wenn sie das Team sofort sehen soll: Sie wird im Chat deutlich hervorgehoben und bei ungelesenen Nachrichten rot markiert. Ein Warnton erfolgt nur, wenn die einzelne Person ihn bewusst eingeschaltet hat. Der Chat versendet keine automatische E-Mail oder WhatsApp-Nachricht.",
      audioKey: "chat",
      action: "Dashboard-Tour abschließen",
    });
  }

  return steps;
}

/**
 * Die persönliche Ansicht hat bewusst eine eigene, kurze Führung: Sie erklärt
 * ausschließlich die dem angemeldeten Zugang zugeordneten Aufgaben, Helfer und
 * Orte. Vereinskennzahlen und fremde Planungsbereiche bleiben dabei außen vor.
 */
export function createPersonalDashboardKlemmiSteps(): KlemmiSurfaceStep[] {
  return [
    {
      key: "intro",
      selector: '[data-klemmi-target="personal-dashboard-progress"]',
      eyebrow: "Klemmi zeigt’s",
      title: "Deine persönliche Ansicht",
      text: "Hier siehst du ausschließlich Aufgaben, Einsätze, betreute Helfer und Standorte, die dir persönlich zugeordnet sind. Über den Umschalter oben kannst du jederzeit wieder zur Vereinssicht wechseln.",
      action: "Fortschritt zeigen",
    },
    {
      key: "progress",
      selector: '[data-klemmi-target="personal-dashboard-progress"]',
      eyebrow: "Schritt 1 von 4",
      title: "Mein Fortschritt",
      text: "Diese Kachel zählt nur deine persönlichen Aufgaben. Sie wird grün, wenn alle deine zugeordneten Aufgaben erledigt sind. Offene, laufende oder klärungsbedürftige Punkte siehst du darunter getrennt.",
      action: "Aufgaben und Einsätze zeigen",
    },
    {
      key: "work",
      selector: '[data-klemmi-target="personal-dashboard-work"]',
      eyebrow: "Schritt 2 von 4",
      title: "Eigene Aufgaben und Einsätze öffnen",
      text: "Hier stehen nur deine nächsten Aufgaben und direkt zugewiesenen Einsätze. Ein Klick öffnet den passenden Planungsbereich bereits mit persönlichem Filter – ohne die übrige Vereinsplanung durchsuchen zu müssen.",
      action: "Betreute Helfer zeigen",
    },
    {
      key: "helpers",
      selector: '[data-klemmi-target="personal-dashboard-helpers"]',
      eyebrow: "Schritt 3 von 4",
      title: "Betreute Helfer im Blick",
      text: "Diese Übersicht umfasst nur Helfer, für die du als Ansprechpartner zuständig bist. Du siehst je Person die zugeordneten Einsätze sowie offene Erstkontakte und Rückmeldungen. Mit einem Klick prüfst du den jeweiligen Helfer direkt.",
      action: "Eigene Standorte zeigen",
    },
    {
      key: "locations",
      selector: '[data-klemmi-target="personal-dashboard-locations"]',
      eyebrow: "Schritt 4 von 4",
      title: "Standorte deiner Zuständigkeiten",
      text: "Auf der Karte erscheinen nur Orte, an denen du eigene Aufgaben oder Einsätze hast. Ein grüner Marker bedeutet: Alle dort zugeordneten Aufgaben sind erledigt oder die zugehörigen Schichten sind besetzt. Andere Farben zeigen, wo noch etwas offen ist.",
      action: "Fertig",
    },
  ];
}
