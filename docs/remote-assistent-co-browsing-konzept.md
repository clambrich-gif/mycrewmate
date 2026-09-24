# Remote-Assistent / Co-Browsing im Master-Admin-Portal

**Entscheidungskonzept für MyCrewMate**  
**Autor:** Manus AI  
**Stand:** 24. September 2026  
**Status:** Konzept; keine Umsetzung und keine Produktivänderung

## Kurzentscheidung

Die gewünschte Funktion ist **technisch gut umsetzbar**, sollte bei MyCrewMate aber nicht als allgemeine Bildschirmfernsteuerung gebaut werden. Die empfohlene Lösung ist ein **einwilligungsbasiertes, anwendungsinternes Co-Browsing mit semantischer Steuerung**. Der Master-Admin und der Vereinsnutzer teilen dabei ausschließlich den Kontext innerhalb von MyCrewMate: geöffnete Seite, sichtbare Bedienbereiche, Auswahlzustände und einen sichtbaren Support-Zeiger. Es wird weder der gesamte Browser noch der Bildschirm übertragen.

Dieser Ansatz erfüllt den eigentlichen Supportzweck: Der Support kann live erklären, navigieren, auf Schaltflächen hinweisen und freigegebene, harmlose Bedienhandlungen ausführen. Zugleich bleibt er innerhalb der bestehenden Mandantentrennung, funktioniert auf Desktop und Mobilgeräten und vermeidet die Datenschutz- und Sicherheitsrisiken einer klassischen Fernwartung.

Die erste Produktstufe sollte bewusst mit **Live-Führung statt freier Fernsteuerung** beginnen. Der Vereinsnutzer erteilt die Freigabe, sieht den Support-Zeiger und kann die Sitzung jederzeit stoppen. Der Master-Admin kann Bereiche hervorheben, Seiten öffnen und vorbereitete Hilfeschritte auslösen. Freie Formulareingaben, Passwortfelder, Berechtigungsänderungen, Löschungen und Importe bleiben in dieser Stufe ausgeschlossen. Erst nach einem Pilotbetrieb sollte entschieden werden, ob eng begrenzte Bearbeitungsaktionen ergänzt werden.

> **Begriff:** Semantisches Co-Browsing überträgt keine Bildschirmbilder und keinen vollständigen DOM-Inhalt. Es überträgt nur ausdrücklich definierte Zustände und Befehle der Anwendung, beispielsweise „Öffne Einsatzplan“, „Hebe Filter hervor“ oder „Setze sichtbaren Support-Zeiger auf diese Schaltfläche“.

## Ausgangslage und technische Konsequenz

MyCrewMate ist eine React-, Express-, tRPC- und MySQL-Anwendung. Die vorhandene Online-Präsenz arbeitet derzeit mit einem abgesicherten Heartbeat und einer Abfrage im 60-Sekunden-Takt. Dieses Modell genügt für die Online-Anzeige, aber nicht für einen flüssigen Support-Zeiger oder sofortige Zustimmungsdialoge. Für Co-Browsing ist deshalb ein **echtzeitfähiger Nachrichtendienst** erforderlich.

Die bestehende Mandantentrennung, die persönlichen Logins, die widerrufbaren Sitzungen und die bereits vorhandene Präsenzlogik sind eine gute Grundlage. Der Supportdienst muss diese Regeln übernehmen, nicht umgehen. Insbesondere darf der globale Master-Status niemals allein genügen, um einer laufenden Vereins-Sitzung beizutreten oder darin Aktionen auszuführen.

## Empfohlene Zielarchitektur

### Verbindungsmodell

Der Supportdienst wird als zusätzlicher, ausschließlich serverseitig autorisierter Echtzeitkanal unter derselben MyCrewMate-Domain betrieben. Für den Start ist **Socket.IO über WSS** sinnvoll. Es vereinfacht Wiederverbindungen, Heartbeats, Raumverwaltung und die Behandlung mobiler Netzwechsel. Rohes WebSocket-Protokoll wäre zwar möglich, würde aber diese Zustands- und Wiederverbindungslogik vollständig in Eigenentwicklung verlagern.

Der aktuelle Coolify-Betrieb mit einer einzelnen Express-Anwendung kann einen solchen Kanal tragen. Für den ersten Pilotbetrieb ist deshalb kein externer Realtime-Anbieter erforderlich. Wenn später mehrere Anwendungsinstanzen betrieben werden, müssen Sitzungsräume und Ereignisse über einen zentralen Nachrichtenkanal, beispielsweise Redis mit Socket.IO-Adapter, synchronisiert werden. Ohne diese Komponente könnten Master-Admin und Vereinsnutzer auf unterschiedlichen Instanzen landen und einander nicht erreichen. Ein dauerhaft betriebener WebSocket-Prozess spricht bei zukünftiger Skalierung für eine einzelne, reservierte Anwendungseinheit oder eine zustandsfreie Skalierung mit zentralem Adapter.

Alle Echtzeitverbindungen laufen ausschließlich über **HTTPS und WSS**, nie über unverschlüsselte Verbindungen. Das entspricht dem etablierten Sicherheitsmuster vergleichbarer Co-Browsing-Architekturen.[1]

### Zwei klar getrennte Kanäle

Die Lösung braucht zwei Ebenen mit unterschiedlichen Zwecken.

| Ebene | Inhalt | Empfohlene Regel |
|---|---|---|
| Steuerkanal | Sitzungsanfrage, Zustimmung, Ende, Herzschlag und Audit-Ereignisse | Ausschließlich serverseitig autorisiert; keine Fach- oder Formulardaten im Ereignistext |
| Assistenzkanal | Route, sichtbare Bedienfläche, Markierung, Support-Zeiger und ausdrücklich zugelassene Aktionsbefehle | Strikte Ereignis-Whitelist; keine Bildschirmbilder, DOM-Dumps, Tastatureingaben oder Zwischenablagen |

Der Master-Admin erhält keine generische Fernbedienung des Browsers. Er kann nur Befehle aus einer vordefinierten Liste senden. Beispiele sind `navigateToModule`, `highlightElement`, `openHelpTip`, `openSafeDialog` und `requestUserConfirmation`. Ein Ereignis wie `executeJavaScript`, „klicke bei X/Y“ oder „übermittle Tastendrücke“ darf es nicht geben.

### Sitzungslifecycle

Eine Support-Sitzung wird nicht durch eine URL und auch nicht durch einen sichtbaren Code abgesichert. Sie wird serverseitig als kurzlebiger Datensatz angelegt und ist an drei Identitäten gebunden: den authentifizierten Master-Admin, den aktuellen Vereinsnutzer und den Vereinsmandanten.

| Zustand | Bedeutung | Zulässiger Übergang |
|---|---|---|
| `requested` | Der Master-Admin fordert Unterstützung für eine aktuell aktive Sitzung an. | Vereinsnutzer nimmt an oder lehnt ab. |
| `accepted` | Der Nutzer hat bewusst zugestimmt; der Echtzeitraum wird eröffnet. | Beide Parteien können aktiv werden. |
| `active` | Der Support-Zeiger und freigegebene Assistenzfunktionen sind nutzbar. | Ende, Inaktivität, Abmeldung, Archivierung oder Widerruf. |
| `ended` | Die Sitzung ist beendet und kann nicht wieder aufgenommen werden. | Nur neue Anfrage möglich. |
| `denied` oder `expired` | Die Anfrage wurde abgelehnt oder nicht rechtzeitig beantwortet. | Nur neue Anfrage möglich. |

Eine Anfrage verfällt nach maximal fünf Minuten. Eine aktive Sitzung endet automatisch nach 15 Minuten ohne bestätigte Aktivität und hat zusätzlich eine absolute Höchstdauer, beispielsweise 30 Minuten. Das schließt vergessene oder verwaiste Verbindungen aus.

### Rechteprüfung auf jeder Ebene

Bei **jedem** Verbindungsaufbau und jeder Nachricht prüft der Server folgende Bedingungen:

1. Der Master-Admin ist die ausdrücklich berechtigte Plattformidentität.
2. Der Zielnutzer besitzt eine aktive, persönliche Sitzung in genau diesem Verein.
3. Der Verein ist nicht archiviert oder pausiert.
4. Die Sitzungs- und Berechtigungsversion des Zielnutzers ist noch gültig.
5. Die angefragte Aktion ist in der Support-Whitelist enthalten.
6. Die zugrunde liegende Vereinsrolle dürfte dieselbe Aktion auch ohne Support ausführen.

Der letzte Punkt ist wesentlich: Co-Browsing darf keine Berechtigungserweiterung erzeugen. Selbst wenn der Master-Admin einen Schritt anstößt, erfolgt die eigentliche Fachaktion unter der bereits bestehenden, mandantengebundenen Berechtigung des Vereinsnutzers. Ein Planungsteammitglied kann daher während einer Support-Sitzung keine Admin-Aktion ausführen.

Die bereits vorhandene Sperrung von Sitzungen bei Archivierung, Passwortwechsel oder Zugangsverlust muss die Support-Sitzung sofort mitbeenden. Dadurch bleibt der Sicherheitsgrundsatz erhalten, dass eine Archivierung keine fortbestehende Zugangsbeziehung hinterlässt.

## Konkrete Bedienidee

Im Master-Admin-Portal erscheint bei jedem aktiven, nicht archivierten Verein ein Bereich **„Live-Unterstützung“**. Dieser zeigt nur aktuell erreichbare, supportfähige Sitzungen dieses Vereins. Die Anzeige kann zunächst auf Rolle und Vorname beschränkt sein. Es ist nicht erforderlich, die gesamte Benutzerliste oder zusätzliche Kontaktdaten in die Live-Ansicht zu übertragen.

Der Master-Admin wählt eine aktive Sitzung und löst eine Anfrage aus. Der Vereinsnutzer sieht sofort einen nicht verdeckbaren Dialog:

> **Live-Unterstützung anfragen**  
> Der Systemadministrator möchte Ihnen für diese MyCrewMate-Sitzung helfen. Übertragen werden nur Bedienhinweise innerhalb von MyCrewMate. Passwörter, Zwischenablage und andere Browser-Tabs werden nicht freigegeben.  
> **[Ablehnen] [Einmal zulassen]**

Nach der Zustimmung sehen beide Seiten eine dauerhafte Statusleiste mit Namen bzw. Rolle des Gegenübers, Sitzungsdauer und der Schaltfläche **„Support beenden“**. Der Vereinsnutzer kann die Sitzung jederzeit mit einem Klick beenden. Der Master-Admin kann dies ebenfalls. Ein Verbindungsabbruch beendet die Sitzung fail-closed; ein stiller Wiederbeitritt ist ausgeschlossen.

In der ersten Stufe sind diese Funktionen sinnvoll:

| Funktion | Nutzen | Freigabestufe |
|---|---|---|
| Sichtbarer Support-Zeiger | Der Support kann zeigen, wo geklickt werden soll. | V1 |
| Feld- und Bereichsmarkierung | Der Support hebt einen Filter, Button oder Abschnitt hervor. | V1 |
| Seiten- und Modulnavigation | Der Support kann die Vereinsansicht auf eine zulässige Seite führen. | V1 |
| Kontextbezogene Hilfe | Ein erklärender Hinweis erscheint beim Nutzer direkt am Zielbereich. | V1 |
| Auslösen einer ungefährlichen UI-Aktion | Beispielsweise Öffnen eines Filters oder einer Ansicht. | V1, nur Whitelist |
| Feldänderungen | Vorbefüllen nicht sensibler, explizit freigegebener Felder. | Später, einzeln freigegeben |
| Löschungen, Imports, Berechtigungen, Passwort- und E-Mail-Änderungen | Immer lokale Bestätigung des Vereinsnutzers und bestehende Fachautorisierung. | Nicht in V1 |

Der Master-Admin kann in dieser Architektur nicht unbemerkt „mit der Maus übernehmen“. Das ist beabsichtigt. Eine echte Übertragung beliebiger Maus- und Tastaturereignisse wäre auf Mobilgeräten unzuverlässig und bei Formularen mit personenbezogenen Daten deutlich riskanter. Die Anwendung soll stattdessen die fachliche Absicht übertragen und sicher ausführen.

## Datenschutz und DSGVO

### Rechtsgrundlage und Rollenklärung

Die Zustimmungsabfrage ist ein wichtiges **Zugriffs- und Transparenzsignal**, aber nicht automatisch die vollständige datenschutzrechtliche Rechtsgrundlage. Vor der Markteinführung muss für das konkrete Vertragsmodell geklärt werden, ob MyCrewMate als Auftragsverarbeiter für den Verein tätig wird. In diesem Fall gehören die Supportfunktion, mögliche Unterauftragsverarbeiter und der Zweck der temporären Einsicht in die Auftragsverarbeitungsvereinbarung.

Die Verarbeitung muss zweckgebunden, transparent und auf das notwendige Maß begrenzt sein. Diese Prinzipien ergeben sich aus Artikel 5 DSGVO. Datenschutz durch Technikgestaltung und datenschutzfreundliche Voreinstellungen sind nach Artikel 25 einzubeziehen; ein Co-Browsing-Modus, der standardmäßig keine Bildschirm- oder Formulardaten überträgt, folgt genau diesem Ansatz.[2]

Die App-Hilfe, die Datenschutzerklärung und die Vertragsunterlagen sollten den Funktionsumfang klar beschreiben. Bei Nutzung externer Realtime- oder Co-Browsing-Dienste sind zusätzlich Standort der Verarbeitung, Auftragsverarbeitung, Unterauftragsverarbeiter und mögliche Drittlandtransfers zu prüfen. Für den Pilotbetrieb ist deshalb ein eigener, im bestehenden Hosting betriebener Echtzeitkanal die datensparsamere Ausgangsoption.

### Technische und organisatorische Schutzmaßnahmen

Die folgende Mindestkonfiguration ist verbindlich zu planen:

| Schutzmaßnahme | Konkrete Umsetzung |
|---|---|
| Freiwilligkeit und Kontrolle | Keine Sitzung ohne aktives „Einmal zulassen“; jederzeit sichtbare End-Schaltfläche für beide Seiten; keine automatische Wiederaufnahme. |
| Datenminimierung | Keine Video-, Bildschirm-, DOM-, Tastatur- oder Zwischenablagenübertragung. Nur vordefinierte Status- und Assistenzereignisse. |
| Feldschutz | Passwort-, E-Mail-, Kontakt-, Finanz- und sensible Freitextfelder sind für Markierung, Vorbefüllung und jede spätere Spiegelung technisch gesperrt. |
| Mandantentrennung | Jede Sitzung trägt `tenantId`; alle Serverabfragen und Räume werden zusätzlich gegen den aktuellen Vereinskontext geprüft. |
| Authentisierung | Persönliche Logins, kurzlebige serverseitige Sitzungsbindung und bei der Master-Identität eine zusätzliche starke Authentisierung. Die EDPB empfiehlt eindeutige Benutzerkennungen, rollenbasierte Berechtigungen und die Entfernung temporärer Rechte.[3] |
| Transport- und Integritätsschutz | TLS für HTTP und WSS, sichere Cookies, Origin-Prüfung, Content-Security-Policy, CSRF-Schutz für Mutationen sowie Rate Limits gegen Anfragespam. |
| Audit ohne Inhaltsprotokoll | Protokolliert werden Anfrage, Zustimmung oder Ablehnung, Beginn, Ende, Initiator, Zielrolle, Verein, Dauer und Aktionstyp. Werte aus Formularen, Mauspfade und Bildschirminhalte werden nicht gespeichert. |
| Aufbewahrung | Supportprotokolle erhalten eine dokumentierte kurze Frist, beispielsweise 90 Tage, und werden anschließend automatisiert gelöscht. Die konkrete Frist wird mit dem fachlichen Bedarf und Datenschutzkonzept abgestimmt. |
| Rechteentzug | Logout, Passwortreset, Rollenentzug, Archivierung und Sitzungswiderruf beenden den Raum unverzüglich. |

Für produktive Kundendaten ist vor der Einführung eine Datenschutz-Folgenabschätzungs-Vorprüfung zu dokumentieren. Ob eine vollständige Folgenabschätzung erforderlich ist, hängt von Umfang, Kategorien der Daten und der konkreten Überwachungswirkung ab. Das Ergebnis sollte gemeinsam mit fachkundiger Datenschutzberatung festgehalten werden; dieses Konzept ersetzt keine Rechtsberatung.

## Vergleich der Lösungswege

| Ansatz | Eignung für MyCrewMate | Vorteile | Nachteile und Risiken |
|---|---|---|---|
| **Empfohlen: Eigenes semantisches Co-Browsing über WSS/Socket.IO** | Sehr gut für den geschlossenen Pilot und die bestehende Mandantenarchitektur. | Datensparsam, exakt auf Rollen und Module zuschneidbar, keine Bildschirmübertragung, keine neue externe Datenverarbeitung, mobile-tauglich. | Mehr Entwicklungsaufwand als ein fertiger Dienst; nur vorher definierte Aktionen möglich. |
| Externer Co-Browsing-Dienst | Sinnvoll, wenn schnell ein sehr umfassender Funktionsumfang benötigt wird. | Reife Funktionen wie Remote-Zeiger, Maskierung und eventuell Video; manche Dienste unterstützen Zustimmung vor Fernsteuerung.[4] | Auftragsverarbeitung, Datenstandort, Unterauftragsverarbeiter, Abhängigkeit vom Anbieter und Lizenzkosten müssen geprüft werden. Vollständige Sicht kann der Datenminimierung widersprechen. |
| Selbst gehostete Session-Replay-/Co-Browsing-Plattform | Nur bei strategischem Bedarf an Analyse und Session Replay sinnvoll. | Große Funktionsbreite; OpenReplay beschreibt etwa aktive Sitzungen, Remote-Control und Rollenmodelle.[4] | Zusätzliche Plattform, Betrieb und Angriffsfläche. Session Replay ist für reinen Support meist überdimensioniert und datenschutzintensiver. |
| WebRTC-Bildschirmfreigabe | Nicht empfohlen. | Schnell verständlich, möglicherweise rasch prototypisierbar. | Nutzer kann versehentlich Browser-Tabs oder den ganzen Bildschirm teilen; keine angemessene feingranulare Mandanten- und Feldkontrolle; schlechter passend für mobile Nutzung. |
| DOM-Mirroring mit generischen Maus- und Tastaturereignissen | Nicht empfohlen. | Nah an klassischer Fernwartung. | Komplexe Maskierung, schwer kontrollierbare Datenübertragung, fragile Bedienung bei Responsive Layouts und hohes Missbrauchspotenzial. |

Ein reifer Fremddienst kann technisch sicher betrieben werden; etablierte Co-Browsing-Systeme verwenden etwa verschlüsselte Verbindungen, serverseitig signierte Sitzungsbindungen und Maskierungsregeln.[1] Für MyCrewMate ist aber die Frage nicht nur, ob dies möglich ist. Entscheidend ist, dass der Nutzen einer allgemeinen Fernsteuerung den zusätzlichen Datenzugriff rechtfertigt. Im aktuellen Pilotbetrieb überwiegen die Vorteile einer eng begrenzten Eigenlösung.

## Umsetzungsphasen und Aufwand

Die Angaben gelten für einen erfahrenen Fullstack-Entwickler einschließlich Tests, Review und Pilotbegleitung. Sie setzen voraus, dass keine Video- oder Bildschirmfreigabe Teil des ersten Releases wird.

| Phase | Inhalt | Aufwand |
|---|---|---:|
| 0. Fachliche und Datenschutz-Spezifikation | Rollen, freigegebene Aktionen, Maskierungsregeln, Audit- und Löschfrist, Vertrags- und Datenschutzprüfung. | 3–5 Personentage |
| 1. Sichere Sitzungsbasis | Datenmodell, WSS-Gateway, Authentisierung, Raumregeln, Zustimmungsdialog, Ende-Mechanik und Audit. | 8–12 Personentage |
| 2. Live-Führung | Support-Zeiger, Markierungen, Seitenwechsel, Hilfehinweise, mobile Darstellung und Abbruchfälle. | 6–9 Personentage |
| 3. Qualität und Pilot | Automatisierte Sicherheits- und Mandantentests, Last- und Wiederverbindungstests, Datenschutznachweise, Pilotleitfaden. | 6–10 Personentage |
| **Erste produktionsreife Stufe** | Live-Führung ohne freie Formulareingabe. | **23–36 Personentage** |
| 4. Optionale kontrollierte Bearbeitung | Einzelne sichere Aktionen, zusätzliche Bestätigungen, erweiterte Maskierung und UX. | 10–18 Personentage |

Kalenderisch ist für die erste Stufe mit etwa **vier bis sechs Wochen** zu rechnen, wenn Entwicklung, Datenschutzfreigabe und Pilotbetrieb parallel vorbereitet werden können. Die zweite Stufe sollte nur folgen, wenn die erste Stufe in echten Supportfällen erkennbar nicht genügt.

Ein externer Dienst kann die reine Entwicklungszeit verkürzen, verlagert aber den Aufwand in Auswahl, Datenschutzprüfung, Vertrag, technische Integration und laufende Kosten. Bei einem geschlossenen Pilotbetrieb ist er daher nicht automatisch der schnellere Gesamtweg.

## Akzeptanzkriterien für die erste Stufe

Die Umsetzung sollte erst als erfolgreich gelten, wenn die folgenden Prüfungen bestanden sind:

1. Eine Support-Sitzung kann ausschließlich für eine aktive Sitzung im ausgewählten Verein angefragt werden.
2. Ohne explizite Zustimmung ist weder Ansicht noch Steuerereignis verfügbar.
3. Der Vereinsnutzer kann die Sitzung jederzeit beenden; Logout, Archivierung und Rechteentzug beenden sie ebenfalls sofort.
4. Der Master-Admin kann nur Aktionen aus der freigegebenen Liste senden.
5. Eine Assistenzaktion erweitert niemals die Rechte des Vereinsnutzers.
6. Passwörter, sensible Formularwerte, Zwischenablage, andere Browser-Tabs und Bildschirmbilder werden nicht übertragen oder gespeichert.
7. Jeder Lifecycle-Schritt wird revisionsfähig, aber ohne Inhaltsdaten protokolliert.
8. Tests beweisen die Mandantentrennung auch bei parallelen Sitzungen zweier Vereine.
9. Desktop und Mobilansicht zeigen dieselbe sichtbare Support-Statusleiste und dieselbe jederzeit nutzbare Beendigung.

## Empfohlene Entscheidung

MyCrewMate sollte die Funktion in zwei Schritten entwickeln. Zunächst wird **„Live-Unterstützung mit Zustimmung“** als eigener, mandantengebundener Echtzeitdienst umgesetzt. Sie bietet Live-Zeiger, Bereichsmarkierung, Navigation und Hilfetexte, aber keine freie Fernsteuerung und keine Inhaltsaufzeichnung. Diese Variante deckt den beschriebenen Supportfall zuverlässig ab und hält die Datenverarbeitung auf ein gut kontrollierbares Maß begrenzt.

Nach einem Pilot mit ausgewählten Vereinen wird ausgewertet, welche Hilfehandlungen tatsächlich fehlen. Erst dann sollte über einzelne, ausdrücklich erlaubte Bearbeitungsaktionen entschieden werden. Eine Vollbildfernwartung oder ein DOM-/Bildschirm-Mirroring wird nicht empfohlen.

## Referenzen

[1]: https://docs.glance.cx/users/security/security_cobrowse/ "Glance Cobrowse Security Architecture"
[2]: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng "Regulation (EU) 2016/679 (General Data Protection Regulation)"
[3]: https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en "European Data Protection Board: Secure personal data"
[4]: https://docs.openreplay.com/en/co-browsing/ "OpenReplay Co-browsing documentation"
