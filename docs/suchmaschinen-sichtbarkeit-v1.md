# Suchmaschinen-Sichtbarkeit · MyCrewMate

Stand: 10.10.2026

## Ziel

Die öffentliche Startseite von MyCrewMate soll unter der eindeutigen Hauptadresse `https://www.mycrewmate.de/` von Bing, Google und weiteren Suchmaschinen gefunden werden.

Die App (`app.mycrewmate.de`), das Master-Portal, Rechtstexte, die Vereinsdemo und die Pilotseite bleiben bewusst aus den Suchergebnissen. Sie sind entweder geschützte Bereiche oder dienen als gezielter Weg innerhalb der Hauptseite.

## Technische Grundlagen

- Die Variante ohne `www` leitet dauerhaft auf die Hauptadresse mit `www` weiter. Dadurch gibt es keine zweite, gleichwertige Kopie der Startseite.
- Die Startseite enthält einen eindeutigen Titel, eine Beschreibung, eine Canonical-Adresse, Open-Graph-Daten und strukturierte Angaben zu MyCrewMate als Organisation und Web-Software.
- `https://www.mycrewmate.de/robots.txt` verweist auf die Sitemap.
- `https://www.mycrewmate.de/sitemap.xml` enthält ausschließlich die kanonische, indexierbare Startseite und ihren letzten wesentlichen Änderungszeitpunkt.
- Technische Dateien wie `robots.txt` und `sitemap.xml` erhalten keinen widersprüchlichen `noindex`-Header.
- Ein IndexNow-Bestätigungsnachweis liegt im Stammverzeichnis der Marketingseite. Nach bedeutenden Veröffentlichungen kann die Startseite über IndexNow an teilnehmende Suchmaschinen gemeldet werden.

## Einmalige Schritte des Inhabers

### Bing

1. Bing Webmaster Tools unter `https://www.bing.com/webmaster` öffnen und mit dem eigenen Microsoft-Konto anmelden.
2. Die Website `https://www.mycrewmate.de/` als Website hinzufügen und den angezeigten Eigentumsnachweis durchführen.
3. Im Bereich **Sitemaps** `https://www.mycrewmate.de/sitemap.xml` einreichen.
4. In **URL Inspection** die Startseite prüfen und die Indexierung anfordern.

### Google

1. Google Search Console unter `https://search.google.com/search-console/` öffnen und mit dem eigenen Google-Konto anmelden.
2. Die Domain oder die URL-Präfix-Property `https://www.mycrewmate.de/` bestätigen.
3. Im Bereich **Sitemaps** `sitemap.xml` einreichen.
4. Mit der URL-Prüfung die Startseite prüfen und, falls angeboten, die Indexierung anfordern.

## Laufende Pflege

- Nach inhaltlich wesentlichen Änderungen an der Startseite den Zeitpunkt in der Sitemap aktualisieren.
- Neue, dauerhaft öffentliche Marketingseiten nur dann in die Sitemap aufnehmen, wenn sie eigene, nützliche Inhalte bieten und tatsächlich über Suchmaschinen gefunden werden sollen.
- Geschützte, testweise oder nur kampagnenbezogen verwendete Seiten weiter mit `noindex` belassen.
- Echte, sachliche Erwähnungen und Verlinkungen durch Vereine, Verbände, Veranstalter oder lokale Presse stärken die Auffindbarkeit langfristig. Keine gekauften oder künstlichen Verlinkungen verwenden.

## Grenzen

Sitemap, IndexNow und die Einreichung über Webmaster-Werkzeuge sind Hinweise für Suchmaschinen. Sie beschleunigen die Entdeckung, garantieren aber weder eine Aufnahme noch eine bestimmte Position. Eine fremde, rechtmäßig betriebene Website mit ähnlich klingendem Namen kann nicht technisch aus den Suchergebnissen entfernt werden.

## Quellen

[1]: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a "Bing Webmaster Guidelines"
[2]: https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed "Sitemaps – Bing Webmaster Tools"
[3]: https://www.bing.com/webmasters/help/url-inspection-55a30305 "URL Inspection – Bing Webmaster Tools"
[4]: https://www.indexnow.org/documentation "IndexNow Documentation"
[5]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Build and submit a sitemap – Google Search Central"
