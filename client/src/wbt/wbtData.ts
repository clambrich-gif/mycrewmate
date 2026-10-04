export type WbtTrackId = "helper" | "admin";

export interface WbtStep {
  id: string;
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  explanation: string;
  targetFocus: string;
  klemmiTip: string;
  actionPrompt: string;
}

export interface WbtChapter {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  estimatedMinutes: number;
  description: string;
  steps: WbtStep[];
  klemmiSummary: {
    heading: string;
    text: string;
    takeaway: string;
  };
}

export interface WbtTrackConfig {
  id: WbtTrackId;
  title: string;
  badge: string;
  targetGroup: string;
  description: string;
  estimatedDuration: string;
  colorScheme: {
    primary: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  };
  chapters: WbtChapter[];
}

export const WBT_HELPER_CHAPTERS: WbtChapter[] = [
  {
    id: "dashboard",
    title: "1. Dashboard",
    subtitle: "Zentrale Übersicht & Orientierung",
    iconName: "LayoutDashboard",
    estimatedMinutes: 3,
    description: "Verschaffe dir einen schnellen Überblick über Event, Fristen und Gesamtstand – ohne die frühe Ansprache potenzieller Helfer davon abhängig zu machen.",
    steps: [
      {
        id: "dash-event-select",
        stepNumber: 1,
        totalSteps: 3,
        title: "Aktives Event prüfen",
        subtitle: "Veranstaltungsraum festlegen",
        explanation: "Alle Zahlen, Listen und Fristen im Dashboard beziehen sich immer auf das aktuell gewählte Event (z. B. 'Radsportfestival 2027'). Kontrolliere oben links zuerst, ob du im richtigen Event arbeitest.",
        targetFocus: "Eventauswahl",
        klemmiTip: "Egal wie viele Events dein Verein hat: In MyCrewMate planst du immer in einem sauberen, abgeschlossenen Eventraum!",
        actionPrompt: "Prüfe die Event-Kachel oben links."
      },
      {
        id: "dash-priorities",
        stepNumber: 2,
        totalSteps: 3,
        title: "Prioritäten & Fristen",
        subtitle: "Dringende Aufgaben zuerst",
        explanation: "Im oberen Bereich siehst du fällige Aufgaben und Fristen. Wenn dort Aufgaben rot markiert sind, solltest du diese vor der Helferarbeit kurz sichten.",
        targetFocus: "Fristen-Kachel",
        klemmiTip: "Ein Blick auf die Fristen verhindert, dass wichtige behördliche Fristen oder Bestellungen im Helfertrubel untergehen.",
        actionPrompt: "Sichte die Kachel 'Fristen & Dringendes'."
      },
      {
        id: "dash-helper-readiness",
        stepNumber: 3,
        totalSteps: 3,
        title: "Helferstand & Status",
        subtitle: "Wie viele Helfer fehlen noch?",
        explanation: "Die Kennzahlen zeigen dir auf einen Blick, wie viele Rückmeldungen und Zusagen bereits vorliegen. Sie dienen dem Planungsteam als Orientierung für die spätere Einteilung – die frühe, breite Helferansprache läuft davon unabhängig.",
        targetFocus: "Helferstatus-Kachel",
        klemmiTip: "Kontaktiere potenzielle Helfer frühzeitig und unabhängig vom späteren Einsatzplan. Erst wenn die Rückmeldungen da sind, ordnet das Planungsteam die verfügbaren Menschen den passenden Aufgaben und Schichten zu.",
        actionPrompt: "Klicke auf den Helfer-Zähler, um in den Helferbereich zu wechseln."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Orientierung im Dashboard",
      text: "Das Dashboard ist deine Orientierungstafel, aber kein Grund, mit Helferanfragen zu warten. Sprich potenzielle Helfer früh und breit an, sammle ihre Rückmeldungen und Verfügbarkeiten. Erst danach plant das Einsatzteam, wer am besten zu welcher Aufgabe oder Schicht passt.",
      takeaway: "Frühzeitig und breit anfragen – das Planungsteam ordnet später passend zu."
    }
  },
  {
    id: "helpers",
    title: "2. Helfer (Der 6-Schritte-Ablauf)",
    subtitle: "Herzstück der Helferkoordination",
    iconName: "UsersRound",
    estimatedMinutes: 8,
    description: "Hier lernst du den praxisbewährten 6-Schritte-Ablauf: von der ersten Erfassung bis zur finalen Zuweisungsbestätigung.",
    steps: [
      {
        id: "step-1-create",
        stepNumber: 1,
        totalSteps: 6,
        title: "Schritt 1: Helfer anlegen",
        subtitle: "Stammdaten erfassen",
        explanation: "Über den Button 'Neuer Helfer' nimmst du eine helfende Person auf. Pflicht ist der Name. Telefonnummer und E-Mail sind für die spätere Kommunikation extrem wertvoll.",
        targetFocus: "Button 'Neuer Helfer'",
        klemmiTip: "Lege Helfer lieber frühzeitig mit Namen an, auch wenn du die genauen Zeiten noch nicht weißt. So geht niemand verloren!",
        actionPrompt: "Klicke auf 'Neuer Helfer' und trage 'Sabine Muster' ein."
      },
      {
        id: "step-2-contact-first",
        stepNumber: 2,
        totalSteps: 6,
        title: "Schritt 2: Helfer erstmalig kontaktieren",
        subtitle: "Anfrage zur Mithilfe senden",
        explanation: "Kontaktiere den Helfer direkt aus der Liste. Ab dem Pro-Paket klickst du auf das WhatsApp-Symbol und wählst 'Muster 1 (Erstkontakt)'. Bei kleineren Paketen oder per Telefon rufst du direkt an.",
        targetFocus: "WhatsApp-Symbol (Muster 1)",
        klemmiTip: "Mit WhatsApp-Muster 1 fragst du freundlich an, ob die Person an diesem Wochenende Zeit hat, ohne direkt feste Schichten aufzudrängen.",
        actionPrompt: "Wähle bei Sabine Muster das WhatsApp-Symbol und betrachte die Vorlage 'Muster 1'."
      },
      {
        id: "step-3-discuss-availability",
        stepNumber: 3,
        totalSteps: 6,
        title: "Schritt 3: Zeiten & Spenden besprechen",
        subtitle: "Verfügbarkeit und Kuchen eintragen",
        explanation: "Sobald sich der Helfer meldet, klickst du auf den Bearbeiten-Stift: Trage ein, ob er ganztags, nur vormittags (z. B. 08:00–13:00) oder nachmittags kann. Erfasse bei einer zugesagten Spende auch Produkt, Abgabe und passende Eigenschaften wie vegan, vegetarisch, glutenfrei, laktosefrei, enthält Nüsse, zuckerfrei, enthält Alkohol oder fleischhaltig.",
        targetFocus: "Verfügbarkeits-Fenster & Spendenfeld",
        klemmiTip: "Klare Eigenschaften und Hinweise sind Gold wert: Das Buffet-Team kann die Spende später direkt richtig beschildern – auch auf dem Faltkärtchen.",
        actionPrompt: "Setze Sabines Verfügbarkeit auf 'Samstag 08:00–14:00 Uhr' und Kuchenspende 'Apfelkuchen'."
      },
      {
        id: "step-4-wait-for-team",
        stepNumber: 4,
        totalSteps: 6,
        title: "Schritt 4: Warten auf das Planungsteam",
        subtitle: "Schichtzuteilung im Einsatzplan abwarten",
        explanation: "Nun ist das Planungsteam am Zug. Es teilt im Modul 'Einsatzplan' die verfügbaren Helfer den konkreten Schichten (z. B. Streckenposten 3, Verpflegungsstation) zu. In dieser Phase musst du nichts tun.",
        targetFocus: "Statusanzeige 'In Planung'",
        klemmiTip: "Geduld zahlt sich aus: Erst wenn das Planungsteam den Einsatzplan fertig hat, macht der Versand des Helferplans Sinn!",
        actionPrompt: "Beobachte, wie das Planungsteam Sabine der Station 'Streckenposten Nord' zuweist."
      },
      {
        id: "step-5-send-plan",
        stepNumber: 5,
        totalSteps: 6,
        title: "Schritt 5: Helferplan versenden & Rückmeldung erbitten",
        subtitle: "Persönlichen 7-Tage-Link verschicken",
        explanation: "Nach Freigabe durch das Planungsteam klickst du erneut auf das WhatsApp-Symbol und wählst 'Muster 2 (Persönlicher Helferplan)'. Der Helfer erhält einen geschützten, datensparsamen Link mit seinen persönlichen Einsatzzeiten, Treffpunkt und Ansprechpartner.",
        targetFocus: "WhatsApp-Muster 2 mit PDF-Link",
        klemmiTip: "Der Helfer-Link ist datensparsam und passwortgeschützt – vorbildlicher DSGVO-Schutz ohne Mehraufwand!",
        actionPrompt: "Klicke auf WhatsApp Muster 2 und sende den persönlichen Plan an Sabine."
      },
      {
        id: "step-6-confirm-helper",
        stepNumber: 6,
        totalSteps: 6,
        title: "Schritt 6: Helfer bestätigen",
        subtitle: "Verbindliche Zusage im System festhalten",
        explanation: "Sobald der Helfer per WhatsApp oder Anruf rückmeldet ('Alles klar, ich bin am Samstag pünktlich um 08:00 Uhr da!'), setzt du in der Helferzeile das Häkchen im Feld 'Bestätigt'.",
        targetFocus: "Bestätigungs-Checkbox / Status 'Bestätigt'",
        klemmiTip: "Ein grünes Bestätigungshäkchen gibt dem gesamten Planungsteam die Sicherheit: Diese Station steht felsenfest!",
        actionPrompt: "Klicke auf das Bestätigungsfeld von Sabine, um den Status auf 'Bestätigt' zu setzen."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis 6-Schritte-Regel für Helfer",
      text: "Helferkoordination ist wie eine gut geölte Kette: Erst erfassen, dann freundlich anfragen, Zeiten notieren, Planungsfreigabe abwarten, individuellen Plan zusenden und nach der Rückmeldung das grüne Häkchen setzen. Wer sich an diese sechs Schritte hält, hat am Veranstaltungstag null Stress!",
      takeaway: "Anlegen → Erstkontakt → Verfügbarkeit & Spende → Plan abwarten → Plan senden → Bestätigen."
    }
  },
  {
    id: "preparation",
    title: "3. Vorbereitung",
    subtitle: "Aufgaben im Vorfeld organisieren",
    iconName: "ClipboardCheck",
    estimatedMinutes: 4,
    description: "Hier siehst du, wie Vorbereitungsaufgaben strukturiert, mit Fristen versehen und an verantwortliche Helfer verteilt werden.",
    steps: [
      {
        id: "prep-structure",
        stepNumber: 1,
        totalSteps: 2,
        title: "Vorbereitungsaufgaben einsehen",
        subtitle: "Was muss vorher erledigt sein?",
        explanation: "Aufgaben wie 'Startnummern packen', 'Banner aufhängen' oder 'Strecke markieren' sind Vorbereitungsaufgaben. Jede Aufgabe hat einen Termin, eine Priorität und einen Zuständigen.",
        targetFocus: "Aufgabenliste Vorbereitung",
        klemmiTip: "Vorbereitung ist alles: Wenn vor dem Wochenende alles abgehakt ist, könnt ihr das Festival selbst entspannt genießen!",
        actionPrompt: "Sichte die Aufgabenkarten in der Vorbereitung."
      },
      {
        id: "prep-assign-helper",
        stepNumber: 2,
        totalSteps: 2,
        title: "Helfer für Vorbereitung einteilen",
        subtitle: "Wer packt vor dem Event mit an?",
        explanation: "Du kannst Helfer nicht nur Schichten am Eventtag zuweisen, sondern auch für Vorbereitungsaufgaben benennen. Das entlastet die Hauptorganisatoren.",
        targetFocus: "Feld 'Zuständiger Helfer'",
        klemmiTip: "Nutze für Helfer, die am Eventtag selbst keine Zeit haben, gezielt Vorbereitungsaufgaben wie 'Einkauf' oder 'Schilder malen'.",
        actionPrompt: "Weise Sabine Muster der Aufgabe 'Startbeutel packen' zu."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Tipp zur Vorbereitung",
      text: "Vorbereitung ist die halbe Miete! Nutze Helfer, die am Haupttag verhindert sind, bereits in der Woche davor für ruhige Aufbauarbeiten oder das Einkaufen.",
      takeaway: "Vorbereitungsaufgaben frühzeitig verteilen, um den Eventtag zu entlasten."
    }
  },
  {
    id: "postprocessing",
    title: "4. Nachbereitung",
    subtitle: "Abbau, Rückgaben & Feedback",
    iconName: "RotateCcw",
    estimatedMinutes: 3,
    description: "Ein Festival endet nicht mit dem Zielsprint. Hier lernst du die Organisation von Abbau, Kautionen und Helfer-Danksagungen.",
    steps: [
      {
        id: "post-tasks",
        stepNumber: 1,
        totalSteps: 2,
        title: "Abbau & Rückgaben erfassen",
        subtitle: "Nichts geht verloren",
        explanation: "Leihmaterial (z. B. Absperrgitter, Funkgeräte, Zelte) muss zurückgebracht, Müll entsorgt und Kautionen abgewickelt werden. Das Modul Nachbereitung stellt sicher, dass nichts vergessen wird.",
        targetFocus: "Nachbereitungs-Tabelle",
        klemmiTip: "Dokumentiere Schäden oder fehlende Teile direkt am Sonntagabend, solange die Erinnerung frisch ist!",
        actionPrompt: "Prüfe die Nachbereitungsaufgabe 'Funkgeräte an Verleih zurückbringen'."
      },
      {
        id: "post-thanks",
        stepNumber: 2,
        totalSteps: 2,
        title: "Helfer-Danksagung organisieren",
        subtitle: "Wertschätzung fürs Ehrenamt",
        explanation: "Nach dem Event gehört ein herzliches 'Danke!' an alle Helfer dazu. In der Nachbereitung siehst du alle beteiligten Personen und kannst z. B. eine gemeinsame Dankes-Mail oder Helferfete planen.",
        targetFocus: "Helferabgleich Nachbereitung",
        klemmiTip: "Das beste Mittel gegen Helfermangel im nächsten Jahr ist ein ehrliches, begeistertes Dankeschön in diesem Jahr!",
        actionPrompt: "Markiere die Danksagung als geplant."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Merksatz zur Nachbereitung",
      text: "Nach dem Event ist vor dem Event! Wer zügig abbaut, geliehenes Material vollständig zurückbringt und den Helfern dankt, startet im Folgejahr mit maximalem Rückhalt.",
      takeaway: "Abbau, Rückgaben und Wertschätzung sichern das nächste Festival."
    }
  },
  {
    id: "material",
    title: "5. Material & Logistik",
    subtitle: "Ausrüstung, Mengen & Standorte",
    iconName: "Package",
    estimatedMinutes: 3,
    description: "Behalte Zelte, Tische, Absperrband und Verbandsmaterial im Blick: Welches Material liegt an welchem Standort?",
    steps: [
      {
        id: "mat-list",
        stepNumber: 1,
        totalSteps: 2,
        title: "Materialbestand & Bedarfe prüfen",
        subtitle: "Was wird gebraucht?",
        explanation: "Jedes Material wird mit benötigter Stückzahl, aktuellem Status (vorhanden, geliehen, zu kaufen), Standort und zuständiger Person gelistet. So weiß die Helferkoordination, was vor Ort bereitsteht und wer sich darum kümmert.",
        targetFocus: "Materialliste",
        klemmiTip: "Ordne jedes Zelt und jeden Verbandskasten einem festen Ort und direkt einer zuständigen Person zu – dann sucht am Sonntagmorgen niemand verzweifelt danach!",
        actionPrompt: "Sichte den Eintrag 'Absperrband 500m (Zielbereich)'."
      },
      {
        id: "mat-checkin",
        stepNumber: 2,
        totalSteps: 2,
        title: "Bereitstellung kontrollieren",
        subtitle: "Ist alles am rechten Platz?",
        explanation: "Wenn Helfer an ihre Stationen gehen, müssen die Materialien dort sein. Durch das Statusfeld 'Bereitgestellt' siehst du sofort, ob die Station arbeitsfähig ist.",
        targetFocus: "Statusspalte Material",
        klemmiTip: "Grünes Häkchen bei Material = Helfer können sofort loslegen!",
        actionPrompt: "Setze den Status von 'Verbandskasten' auf 'Vor Ort bereitgestellt'."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Fazit zu Material & Logistik",
      text: "Ohne Material kein Posten! Ein Streckenposten ohne Weste und Fahne oder ein Verpflegungsstand ohne Becher kann nicht arbeiten. Die Materialliste verbindet Gegenstand, Menge und Ort.",
      takeaway: "Material immer an den konkreten Standort binden und Bereitstellung prüfen."
    }
  },
  {
    id: "donations",
    title: "6. Spenden (Kuchen & Verpflegung)",
    subtitle: "Buffet & Verpflegungsspenden steuern",
    iconName: "Gift",
    estimatedMinutes: 3,
    description: "Kuchen-, Salat- und Verpflegungsspenden übersichtlich sammeln, acht Eigenschaften kennzeichnen, Abgabezeiten planen und Buffet-Kärtchen drucken.",
    steps: [
      {
        id: "don-overview",
        stepNumber: 1,
        totalSteps: 2,
        title: "Spendenübersicht & Kategorien",
        subtitle: "Kuchen, Salate, Fingerfood",
        explanation: "Im Spendenmodul siehst du alle zugesagten Spenden, sortiert nach Kategorien und Abgabetag. So erkennst du sofort, ob am Samstag noch Kuchen fehlen.",
        targetFocus: "Spendenkategorien",
        klemmiTip: "In MyCrewMate siehst du auf einen Blick: Haben wir genug für Samstag und Sonntag oder müssen wir noch nachfragen?",
        actionPrompt: "Filtere die Spendenliste nach 'Kuchen Samstag'."
      },
      {
        id: "don-allergens",
        stepNumber: 2,
        totalSteps: 2,
        title: "Allergene & Eigenschaften",
        subtitle: "Acht Kennzeichnungen und Buffet-Kärtchen",
        explanation: "Durch die Eigenschaften-Badges vegan, vegetarisch, glutenfrei, laktosefrei, enthält Nüsse, zuckerfrei, enthält Alkohol und fleischhaltig kann das Buffet-Team jede Spende korrekt beschildern. Der PDF-Druck liefert zusätzlich passende, faltbare Buffet-Kärtchen.",
        targetFocus: "Allergen-Badges",
        klemmiTip: "Klare Kennzeichnung am Buffet spart Rückfragen. Druck die Faltkärtchen direkt mit aus, dann steht alles gut lesbar an der richtigen Spende!",
        actionPrompt: "Prüfe den Eintrag 'Kirsch-Streuselkuchen (vegan, nussfrei)'."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Spenden-Tipp",
      text: "Kuchenspenden finanzieren oft die gesamte Vereinskasse des Wochenendes! Eine saubere Erfassung mit Tag, allen Eigenschaften und den passenden Faltkärtchen macht das Buffet-Team glücklich und die Kasse voll.",
      takeaway: "Spenden mit Abgabetag, Eigenschaften und Buffet-Kärtchen erfassen."
    }
  },
  {
    id: "help",
    title: "7. Hilfe-Center & Klemmi",
    subtitle: "Antworten, Klemmi & Selbsthilfe",
    iconName: "BookOpen",
    estimatedMinutes: 2,
    description: "Hier findest du jederzeit Anleitungen, Klemmi-Tipps und Vorlagen, falls du während der Planung einmal eine Frage hast.",
    steps: [
      {
        id: "help-search",
        stepNumber: 1,
        totalSteps: 2,
        title: "Stichwortsuche & Kapitel",
        subtitle: "Schnell zur passenden Lösung",
        explanation: "Im Hilfe-Center kannst du nach jedem Begriff suchen (z. B. 'WhatsApp', 'Spende', 'Einsatzplan'). Alle Kapitel sind praxisnah und mit Beispielen erklärt.",
        targetFocus: "Hilfe-Suchfeld",
        klemmiTip: "Wenn du mich mal nicht direkt auf der Seite anklicken willst: Im Hilfe-Center steht alles Schwarz auf Weiß!",
        actionPrompt: "Tippe 'WhatsApp' in das Suchfeld des Hilfe-Centers ein."
      },
      {
        id: "help-klemmi-bubble",
        stepNumber: 2,
        totalSteps: 2,
        title: "Klemmi jederzeit rufen",
        subtitle: "Die Klemmi-Hilfe oben rechts",
        explanation: "Auf jeder Seite in MyCrewMate findest du oben rechts das Klemmi-Symbol. Ein Klick startet die interaktive Tour für genau diese Seite.",
        targetFocus: "Klemmi-Symbol Menüleiste",
        klemmiTip: "Ich bin dein digitaler Kollege: Wenn es klemmt, klick mich einfach an!",
        actionPrompt: "Klicke auf das Klemmi-Symbol."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Abschlusswort für Helferkoordinatoren",
      text: "Herzlichen Glückwunsch! Du hast das WBT Helferkoordination abgeschlossen. Du weißt jetzt, wie du Helfer anlegst, über den 6-Schritte-Weg begleitest und mit Vorbereitung, Material und Spenden verzahnst. Du bist startklar für dein Event!",
      takeaway: "Nutze das Hilfe-Center und Klemmi jederzeit als Nachschlagewerk."
    }
  }
];

export const WBT_ADMIN_CHAPTERS: WbtChapter[] = [
  ...WBT_HELPER_CHAPTERS,
  {
    id: "plan",
    title: "8. Einsatzplan",
    subtitle: "Schichten, Stationen & Zeitfenster",
    iconName: "CalendarDays",
    estimatedMinutes: 6,
    description: "Als Planungsteam oder Administrator baust du hier die Schichten: Stationen benennen, Zeiten festlegen und Helfer zuteilen.",
    steps: [
      {
        id: "plan-create-shift",
        stepNumber: 1,
        totalSteps: 3,
        title: "Schicht anlegen",
        subtitle: "Station, Zeitfenster & Helferbedarf",
        explanation: "Eine Schicht definiert: Welche Station (z. B. 'Zielverpflegung'), an welchem Tag, in welchem Zeitfenster (z. B. 09:00–13:00) und wie viele Helfer werden mindestens benötigt (z. B. 3 Personen).",
        targetFocus: "Button 'Neue Schicht'",
        klemmiTip: "Formuliere Schichttitel so, dass jeder Helfer sofort versteht, was zu tun ist!",
        actionPrompt: "Erstelle die Schicht 'Startnummernausgabe Samstag 07:30–11:00'."
      },
      {
        id: "plan-flexible-booking",
        stepNumber: 2,
        totalSteps: 3,
        title: "Flexible Belegung nutzen",
        subtitle: "Teilzeithelfer ohne Lücken planen",
        explanation: "Ist das Häkchen 'Flexible Belegung erlauben' aktiv, kannst du auch Helfer zuweisen, die nur einen Teil der Schichtzeit da sein können. Das System warnt bei Zeitlücken mit 'knapp besetzt'.",
        targetFocus: "Option 'Flexible Belegung'",
        klemmiTip: "Flexible Belegung ist die Superkraft gegen Helfermangel: Zwei Teilzeithelfer ergeben zusammen eine volle Schicht!",
        actionPrompt: "Aktiviere 'Flexible Belegung erlauben' für die Schicht."
      },
      {
        id: "plan-assign-and-balance",
        stepNumber: 3,
        totalSteps: 3,
        title: "Helfer zuweisen & Lücken schließen",
        subtitle: "Doppelbelegungen automatisch verhindern",
        explanation: "Weise verfügbare Helfer per Dropdown zu. MyCrewMate warnt sofort, falls ein Helfer zeitgleich auf einer anderen Station eingeteilt ist oder am Vortag eine späte Schicht hatte.",
        targetFocus: "Helferauswahl & Konfliktwarnung",
        klemmiTip: "Keine Doppelbelegungen mehr auf Zuruf – das System passt für dich auf!",
        actionPrompt: "Weise Sabine Muster der Schicht zu."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Merksatz zum Einsatzplan",
      text: "Der Einsatzplan ist das Herz eures Festival-Wochenendes. Wenn Schichten realistische Zeitfenster haben und die 'Flexible Belegung' clever genutzt wird, bleibt keine Station unbesetzt!",
      takeaway: "Schichten klar definieren, Flexible Belegung nutzen, Konfliktwarnungen beachten."
    }
  },
  {
    id: "finances",
    title: "9. Finanzen",
    subtitle: "Kategorien, Einnahmen, Ausgaben & Saldo",
    iconName: "WalletCards",
    estimatedMinutes: 4,
    description: "Finanztransparenz für den Vorstand: Startgelder, Sponsoring, Genehmigungsgebühren und Catering-Erlöse im Griff behalten.",
    steps: [
      {
        id: "fin-categories",
        stepNumber: 1,
        totalSteps: 2,
        title: "Kostenarten anlegen",
        subtitle: "Startgelder, Sponsoring, Catering, Technik",
        explanation: "Lege saubere Kategorien an, um Einnahmen und Ausgaben zu trennen. Jede Kategorie zeigt sofort die Summen und die Differenz.",
        targetFocus: "Kategorie-Eingabe",
        klemmiTip: "Trennt feste Gebühren (z. B. Behörden, DRK) von variablen Erlösen (Catering) – so seht ihr euer Festbudget auf den Cent genau!",
        actionPrompt: "Lege die Kategorie 'Startgelder Jedermann' an."
      },
      {
        id: "fin-balance",
        stepNumber: 2,
        totalSteps: 2,
        title: "Live-Saldo & Deckungsbeitrag",
        subtitle: "Steht das Festival im Plus?",
        explanation: "Ganz unten fasst der Saldo alle Kategorien live zusammen. Bei jedem Kassenabschluss sieht der Vorstand sofort, ob die Veranstaltung im Budget liegt.",
        targetFocus: "Saldo-Kachel unten",
        klemmiTip: "Finanzielle Transparenz schafft Vertrauen im gesamten Verein und gegenüber Förderern!",
        actionPrompt: "Prüfe den Gesamtsaldo der Veranstaltung."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Fazit zu den Finanzen",
      text: "Gute Vereinsarbeit braucht solide Zahlen! Tragt Einnahmen und Ausgaben fortlaufend ein. Der Gesamtsaldo zeigt euch jederzeit, ob die Kasse für die nächste Vereinsanschaffung klingelt.",
      takeaway: "Fortlaufend buchen, Kategorien trennen, Gesamtsaldo im Blick behalten."
    }
  },
  {
    id: "locations",
    title: "10. Orte & Standorte",
    subtitle: "Zentrale Orte & GPX-Streckenkarten",
    iconName: "MapPinned",
    estimatedMinutes: 4,
    description: "Start/Ziel, Parkflächen, Materiallager und Streckenposten mit Adressen, GPS-Koordinaten und Live-Karten verknüpfen.",
    steps: [
      {
        id: "loc-central",
        stepNumber: 1,
        totalSteps: 2,
        title: "Zentrale Standorte definieren",
        subtitle: "Start/Ziel, DRK-Punkt, Verpflegung 1",
        explanation: "Jeder relevante Ort wird nur einmal zentral angelegt. Danach steht er überall zur Auswahl: in Schichten, Vorbereitungsaufgaben, Materiallisten und Helfer-PDFs.",
        targetFocus: "Button 'Neuer Ort'",
        klemmiTip: "Einmal sauber mit Adresse oder GPS hinterlegt – und schon hat jeder Helfer in seinem PDF den direkten Klick zur Karten-Navigation!",
        actionPrompt: "Erstelle den Ort 'Viehmarktplatz (Start & Ziel)'."
      },
      {
        id: "loc-gpx",
        stepNumber: 2,
        totalSteps: 2,
        title: "GPX-Strecke & Overlays",
        subtitle: "Radsportstrecke auf der Karte visualisieren",
        explanation: "Lade eine GPX-Datei eurer Radstrecke hoch. Auf der interaktiven Karte seht ihr sofort, wo Streckenposten, Gefahrenpunkte und Verpflegungsstationen entlang der Route liegen.",
        targetFocus: "GPX-Kartenansicht",
        klemmiTip: "Die GPX-Karte ist perfekt für die visuelle Abstimmung und die örtliche Zuordnung. Sie hilft außerdem bei der Abstimmung mit Polizei und Rettungsdiensten!",
        actionPrompt: "Betrachte die GPX-Route auf der Live-Standortkarte."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Orts-Regel",
      text: "Jeder Ort nur einmal! Wer Start, Ziel und Streckenposten zentral pflegt, hat überall dieselbe Bezeichnung und liefert jedem Helfer den perfekten mobilen Navigationslink.",
      takeaway: "Orte zentral pflegen und für Schichten, Material und Karten wiederverwenden."
    }
  },
  {
    id: "security",
    title: "11. Schutz & Protokolle",
    subtitle: "Sicherheits-Schwerpunkt für Administratoren",
    iconName: "ShieldCheck",
    estimatedMinutes: 8,
    description: "Besondere Detailtiefe: Rollen, Passwörter, Rechte-Schalter (Aus/Lesen/Schreiben), MFA per Authenticator-App, Notfall-Sperre und revisionssichere Audit-Logs.",
    steps: [
      {
        id: "sec-admin-password",
        stepNumber: 1,
        totalSteps: 5,
        title: "Administrator-Passwort & MFA",
        subtitle: "Höchste Sicherheit für das Vereinskonto",
        explanation: "Das Admin-Passwort muss mindestens 10 Zeichen lang sein. Zusätzlich kann jeder Administrator unter Schutz & Protokolle die Zwei-Faktor-Authentifizierung (MFA) per QR-Code in seiner Authenticator-App aktivieren.",
        targetFocus: "Passwort- & MFA-Bereich",
        klemmiTip: "MFA schützt euer Vereinskonto selbst dann, wenn ein Passwort mal versehentlich ausgespäht wurde!",
        actionPrompt: "Betrachte den QR-Code-Bereich zur MFA-Aktivierung."
      },
      {
        id: "sec-planning-accesses",
        stepNumber: 2,
        totalSteps: 5,
        title: "Planungsteam-Zugänge verwalten",
        subtitle: "Jeder Helfer sein eigener Account",
        explanation: "Keine gemeinsamen Sammelpasswörter! Lege für jedes Teammitglied einen eigenen Zugang an. Du entscheidest, für welche Events der Zugang gilt und ob der Einrichtungslink per Mail versendet wird.",
        targetFocus: "Zugangs-Tabelle",
        klemmiTip: "Eigene Zugänge schaffen Transparenz: Man sieht genau, wer welche Schicht geplant oder geändert hat.",
        actionPrompt: "Klicke auf 'Neuer Zugang' für 'Klaus Streckenchef'."
      },
      {
        id: "sec-rights-switches",
        stepNumber: 3,
        totalSteps: 5,
        title: "Die drei Rechte-Schalter: Aus, Lesen, Schreiben",
        subtitle: "Granulare Fachbereichs-Rechte",
        explanation: "Für jeden Bereich (Helfer, Einsatzplan, Finanzen etc.) gibt es drei Stufen: 'Aus' (Bereich unsichtbar), 'Lesen' (nur Ansicht, keine Änderung) und 'Schreiben' (volle Pflege).",
        targetFocus: "Rechte-Schalter Matrix",
        klemmiTip: "Gib jedem Helferkoordinator nur die Rechte, die er wirklich braucht. Finanzen bleiben z. B. dem Vorstand vorbehalten!",
        actionPrompt: "Setze für Klaus: 'Einsatzplan: Schreiben', 'Finanzen: Aus'."
      },
      {
        id: "sec-emergency-stop",
        stepNumber: 4,
        totalSteps: 5,
        title: "Notfall-Sitzungssperre",
        subtitle: "Sofortige Sicherheit bei Vorfällen",
        explanation: "Sollte ein Vereinsgerät verloren gehen oder ein Sicherheitsvorfall eintreten, sperrt der rote Notfall-Schalter sofort alle Planungsteam-Sitzungen mit einem einzigen Klick.",
        targetFocus: "Notfall-Sperrschalter",
        klemmiTip: "Der Notfall-Stopp ist eure Reißleine – er schützt die Vereinsdaten im Bruchteil einer Sekunde!",
        actionPrompt: "Betrachte die Notfall-Sperroption."
      },
      {
        id: "sec-audit-logs",
        stepNumber: 5,
        totalSteps: 5,
        title: "Audit-Center & Revisionssicherheit",
        subtitle: "Drei Protokollbereiche: Logins, Aktivitäten, Dateien",
        explanation: "Das Audit-Center dokumentiert revisionssicher: 1. Sicherheitsereignisse (Logins, Fehlversuche, MFA), 2. Operative Aktivitäten (Löschungen, Änderungen), 3. Datei-Vorgänge (Excel/JSON-Exporte). Nichts geht heimlich verloren.",
        targetFocus: "Audit-Center Tabs",
        klemmiTip: "Transparenz schützt vor Fehlern und Missverständnissen im Verein. Hier kann jeder Schritt nachvollzogen werden!",
        actionPrompt: "Wechsle zwischen den Audit-Tabs 'Sicherheit', 'Aktivität' und 'Dateien'."
      }
    ],
    klemmiSummary: {
      heading: "Klemmis Sicherheits-Schwerpunkt",
      text: "Als Administrator tragt ihr Verantwortung für Verein, Helfer und DSGVO. Drei goldene Regeln: Keine gemeinsamen Passwörter, Rechte mit 'Aus, Lesen, Schreiben' sparsam vergeben und MFA für Admins aktivieren. Dann schlaft ihr auch vor dem Großevent tief und fest!",
      takeaway: "Individuelle Zugänge + 3-Stufen-Rechte + MFA = Maximale Sicherheit."
    }
  }
];

export const WBT_TRACKS: Record<WbtTrackId, WbtTrackConfig> = {
  helper: {
    id: "helper",
    title: "Web-Based-Training: Helferkoordination",
    badge: "Helferkoordination",
    targetGroup: "Für Helferkoordinatoren, Teamleiter & Bereichsverantwortliche",
    description: "Lerne die komplette Helferorganisation von der Aufnahme über die 6-Schritte-Koordination bis zu Vorbereitung, Spenden und Material.",
    estimatedDuration: "ca. 20–25 Minuten",
    colorScheme: {
      primary: "from-blue-600 to-cyan-600",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-900",
      border: "border-blue-200"
    },
    chapters: WBT_HELPER_CHAPTERS
  },
  admin: {
    id: "admin",
    title: "Web-Based-Training: Planungsteam & Administration",
    badge: "Planungsteam & Admin",
    targetGroup: "Für Vereinsvorstände, Hauptorganisatoren, Co-Admins & IT-Verantwortliche",
    description: "Das umfassende Meistertraining: Enthält die gesamte Helferkoordination plus Einsatzplan, Finanzen, GPX-Standorte und den Sicherheitsschwerpunkt 'Schutz & Protokolle'.",
    estimatedDuration: "ca. 40–45 Minuten",
    colorScheme: {
      primary: "from-orange-600 to-amber-600",
      badgeBg: "bg-orange-100",
      badgeText: "text-orange-950",
      border: "border-orange-200"
    },
    chapters: WBT_ADMIN_CHAPTERS
  }
};
