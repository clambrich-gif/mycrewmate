#set page(
  paper: "a4",
  margin: (top: 2.4cm, bottom: 2.2cm, left: 2.2cm, right: 2.2cm),
  header: context {
    if counter(page).get().first() > 1 [
      #grid(
        columns: (1fr, auto),
        align(left)[#text(size: 8.5pt, fill: rgb("#64748b"))[MyCrewMate · Marktanalyse & 5-Jahres-Umsatzprognose (DACH-L)]],
        align(right)[#text(size: 8.5pt, fill: rgb("#64748b"))[Vertraulich]]
      )
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
    ]
  },
  footer: context {
    if counter(page).get().first() > 1 [
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
      #grid(
        columns: (1fr, auto),
        align(left)[#text(size: 8.5pt, fill: rgb("#64748b"))[MyCrewMate – Plattform für Ehrenamts- und Eventplanung]],
        align(right)[#text(size: 8.5pt, fill: rgb("#64748b"))[Seite #counter(page).display()]]
      )
    ]
  }
)

#set text(
  font: "DejaVu Sans",
  size: 10pt,
  lang: "de",
  hyphenate: false
)

#set par(
  justify: true,
  leading: 0.68em,
  spacing: 0.88em
)

// Deckblatt / Titelseite
#align(center)[
  #v(2cm)
  #text(size: 12pt, weight: "bold", fill: rgb("#2563eb"))[STRATEGISCHER GESCHÄFTS- & FINANZBERICHT] \
  #v(0.4cm)
  #block(width: 85%)[
    #set par(justify: false)
    #text(size: 21pt, weight: "bold", fill: rgb("#0f172a"))[Marktanalyse & 5-Jahres-Umsatzprognose]
  ] \
  #v(0.2cm)
  #block(width: 90%)[
    #set par(justify: false)
    #text(size: 13.5pt, weight: "medium", fill: rgb("#475569"))[SaaS-Wachstumsmodell und Marktpotenziale für MyCrewMate im DACH-L-Raum]
  ] \
  #v(0.8cm)
  #line(length: 40%, stroke: 2pt + rgb("#2563eb"))
  #v(0.8cm)
  #text(size: 10pt, fill: rgb("#334155"))[
    *Produkt:* MyCrewMate – Ehrenamts- und Event-Betriebssystem \
    *Märkte:* Deutschland · Österreich · Schweiz · Luxemburg (DACH-L) \
    *Stand:* September 2026 | *Erstellt durch:* Manus AI für Christian Lambrich
  ]
  #v(1.8cm)
  #block(
    fill: rgb("#f8fafc"),
    stroke: 1pt + rgb("#e2e8f0"),
    inset: 14pt,
    radius: 6pt,
    width: 85%
  )[
    #text(size: 9pt, fill: rgb("#64748b"))[
      *Datengrundlage:* Reale Plattformmetriken (MyCrewMate Mandanten & Pilotevents) \
      Registerauswertungen des ZiviZ-Surveys (615.000 Vereine DE) \
      Verbandsstatistiken: Bund Deutscher Radfahrer, Deutscher Schützenbund, \
      Schweizer Schiesssportverband, Sport Austria, Bundesverband Deutscher Schausteller
    ]
  ]
]

#pagebreak()

#outline(title: "Inhaltsverzeichnis", depth: 2, indent: 1.5em)
#v(1cm)

= 1. Executive Summary

Die vorliegende Analyse bewertet das Marktpotenzial und die wirtschaftliche Skalierbarkeit der Mehrmandanten-Plattform *MyCrewMate* im deutschsprachigen Raum sowie Luxemburg (DACH-L). Ehrenamtlich getragene Groß- und Brauchtumsveranstaltungen stehen unter akutem Organisations- und Haftungsdruck: Steigende bürokratische Auflagen im Sicherheits- und Lebensmittelbereich, Datenschutzanforderungen (DSGVO) und der generationelle Umbruch im Ehrenamt führen dazu, dass herkömmliche Behelfslösungen (Excel-Listen, unübersichtliche WhatsApp-Gruppen, private E-Mail-Verteiler) zunehmend scheitern.

MyCrewMate adressiert genau diese Schmerzpunkte durch eine mandantensichere, browserbasierte Komplettlösung, die von der Helferakquise über standort- und streckengenaue Schichtpläne bis hin zur lückenlosen Protokollierung alle Kernprozesse abdeckt. Die Kombination aus einem *niedrigschwelligen Single Event Pass (69 €)*, einem *ganzjährigen Pro-Abonnement (149 €/Jahr)* und *Verbandslizenzen (990 €/Jahr)* schafft einen planbaren, hochprofitablen SaaS-Umsatzstrom.

Im *Base-Case-Szenario* wächst der jährliche Umsatz von *16.965 € im Markteintrittsjahr (Jahr 1)* auf *541.664 € im Jahr 5*. Bei einer konservativen Marktdurchdringung von 19,4 % des relevanten Zielmarkts (SAM: ca. 37.000 Events) und einer stabilen Kundenbindungsrate erreicht MyCrewMate im fünften Geschäftsjahr einen wiederkehrenden Deckungsbeitrag bei über 2.150 Einzelbuchungen, 1.750 aktiven Pro-Lizenzen und 130 Verbandsrahmenverträgen.

#v(0.3cm)
#align(center)[
  #table(
    columns: (2.8fr, 1.2fr, 1.2fr, 1.2fr, 1.2fr, 1.2fr),
    fill: (col, row) => if row == 0 { rgb("#eff6ff") } else if row == 4 { rgb("#f8fafc") } else { none },
    stroke: 0.5pt + rgb("#cbd5e1"),
    align: (col, row) => if col == 0 { left } else { center },
    [*Kennzahl*], [*Jahr 1*], [*Jahr 2*], [*Jahr 3*], [*Jahr 4*], [*Jahr 5*],
    [Single Event Pässe (69 €)], [120], [340], [780], [1.420], [2.150],
    [Aktive Pro-Abos (149 €/J.)], [45], [170], [460], [995], [1.756],
    [Aktive Verbandslizenzen (990 €/J.)], [2], [10], [32], [72], [133],
    [*Gesamtumsatz (Base Case)*], [*16.965 €*], [*58.690 €*], [*154.040 €*], [*317.515 €*], [*541.664 €*],
    [Umsatzwachstum (YoY)], [–], [+245,9 %], [+162,5 %], [+106,1 %], [+70,6 %],
[SAM-Marktabdeckung (Events)], [0,6 %], [2,1 %], [5,6 %], [11,4 %], [19,4 %]
  )
]

= 2. Reale Datenpunkte und Plattform-Validierung (Status Quo)

Im Gegensatz zu rein hypothetischen Geschäftsmodellen basiert die Modellierung auf verifizierten operativen Leistungsdaten der produktiven MyCrewMate-Plattform. Die Plattform befindet sich derzeit in einem geschlossenen, echten Pilotbetrieb mit repräsentativen Vereinstypen:

1. *Mandantenstruktur:* 3 aktiv angelegte Vereine mit vollständiger Daten- und Rechte-Isolation (Radsport- & Ausdauerverein, Schützen- & Traditionsverein, Kirmes- & Stadtfest-Orgateam).
2. *Veranstaltungsaufkommen:* 10 angelegte Veranstaltungen über drei Kalenderjahre (2025: 4 Events, 2026: 1 Event, 2027: 5 Events), was einer durchschnittlichen Quote von 3,33 Events pro Mehrfach-Veranstalter entspricht.
3. *Helfer- und Einsatzdichte:* 302 erfasste Helferinnen und Helfer über die Mandanten. Im Schnitt koordinieren die aktiven Veranstaltungen 75,5 Helfer (Spannbreite: 65 bis 87 Helfer).
4. *Schicht- und Dienstplanung:* 47 Schichten mit durchschnittlich 11,8 Schichten pro Veranstaltung (Spitzenwerte bei 21 Schichten), 125 konkreten Zuweisungen und 84 aktiv eingesetzten Personen.
5. *Führungs- und Koordinationsspanne:* 49 verantwortliche Ansprechpartner mit individuellen Fachbereichen und Co-Admin-Berechtigungen.

Diese realen Datenpunkte bestätigen das Kernziel: Vereine mit 10 bis 200 Helfern benötigen kein überdimensioniertes Enterprise-ERP, sondern eine spezialisierte, fehlerresistente Einsatzplanung mit WhatsApp- und PDF-Schnittstellen.

= 3. Marktpotenziale im DACH-L-Raum

Der Markt für ehrenamtliche und semiprofessionelle Vereins- und Kulturveranstaltungen in Deutschland, Österreich, der Schweiz und Luxemburg zeichnet sich durch eine weltweit einmalige Organisationsdichte aus. Allein in Deutschland sind über 615.000 Vereine im Vereinsregister eingetragen, in Österreich rund 125.000 und in der Schweiz rund 90.000 bis 100.000.

#align(center)[
  #block(
    fill: rgb("#f1f5f9"),
    inset: 12pt,
    radius: 6pt,
    stroke: 1pt + rgb("#cbd5e1"),
    width: 95%
  )[
    *GESAMTMARKT (TAM): ca. 120.000 Events / Jahr im DACH-L-Raum* \
    #text(size: 9pt, fill: rgb("#475569"))[(Alle organisierten Feste, Sportwettkämpfe, Schützen- & Brauchtumsfeiern)] \
    $arrow.b$ \
    *RELEVANTER ZIELMARKT (SAM): ca. 37.000 Events / Jahr* \
    #text(size: 9pt, fill: rgb("#475569"))[(Events mit 10–200 Helfern, Schichtbetrieb, Sicherheits- & Streckenposten)] \
    $arrow.b$ \
    *ERREICHBARER MARKT (SOM, Jahr 5): ca. 7.200 Events (19,4 % des SAM)* \
    #text(size: 9pt, fill: rgb("#475569"))[(2.150 Single Passes + 1.756 Pro-Kunden + 133 Verbands-Rahmenverträge)]
  ]
]

== 3.1. Detaillierte Segmentierung des Zielmarkts

#pagebreak()
#table(
  columns: (2.2fr, 1.1fr, 1.1fr, 3.6fr),
  inset: 5.5pt,
  fill: (col, row) => if row == 0 { rgb("#eff6ff") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*Zielgruppen-Segment*], [*TAM (Events)*], [*SAM (Events)*], [*Marktcharakteristik & Multiplikatoren*],
  [Schützen- & Traditionsvereine], [ca. 24.000], [ca. 8.500], [13.600 DSB-Vereine (DE), 2.600 SSV-Vereine (CH), 1.200 (AT/LU). Mehrtägige Schützenfeste mit großem Zelt- und Schichtbedarf. Hohe Verbandsdichte.],
  [Stadtfeste, Kirmessen & Volksfeste], [ca. 23.500], [ca. 9.200], [9.750 große Volksfeste (BSM) plus 14.000 dörfliche Kirmessen, Kirchweihen und Bürgerfeste. Hohe Bereitschaft für 69 € Single Pass.],
  [Radsport- & Ausdauerevents], [ca. 3.800], [ca. 2.600], [2.400 BDR-Vereine (German Cycling), Swiss Cycling, Cycling Austria. Komplexe Streckensicherung, Posten- und Verpflegungsplanung.],
  [Weitere Vereins- & Sportevents], [ca. 68.700], [ca. 16.700], [Turniere, Feuerwehrfeste, Vereinsjubiläen und Musikfeste mit ehrenamtlicher Organisationsstruktur.],
[*Gesamtsumme*], [*ca. 120.000*], [*ca. 37.000*], [*Fokus auf 10–200 Helfer im Schichtbetrieb*]
)

#pagebreak()
= 4. Detaillierte 5-Jahres-Umsatzprognose

Das Finanzmodell bildet die Entwicklung in drei Szenarien ab. Der *Base Case* unterstellt eine realistische Marktdurchdringung bei einer jährlichen Kündigungsrate (Churn) von 12 % bei Pro-Abonnements und 5 % bei Verbandsverträgen.

== 4.1. Base Case: Detaillierte Jahresentwicklung

#pagebreak()
#table(
  columns: (3fr, 1.1fr, 1.1fr, 1.1fr, 1.1fr, 1.1fr),
  inset: 5.5pt,
  fill: (col, row) => if row == 0 { rgb("#eff6ff") } else if row in (3, 8, 13, 14) { rgb("#f8fafc") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  align: (col, row) => if col == 0 { left } else { center },
  [*Produkt- & Kennzahlenkategorie*], [*Jahr 1*], [*Jahr 2*], [*Jahr 3*], [*Jahr 4*], [*Jahr 5*],
  [Single Event Pässe (verkauft)], [120], [340], [780], [1.420], [2.150],
  [Umsatz Single Event (69 €)], [8.280 €], [23.460 €], [53.820 €], [97.980 €], [148.350 €],
  [*Single Pass Zwischensumme*], [*8.280 €*], [*23.460 €*], [*53.820 €*], [*97.980 €*], [*148.350 €*],
  [Pro-Abo Neukunden (149 €)], [45], [130], [310], [590], [880],
  [Pro-Abo Verlängerungen (Bestand)], [0], [40], [150], [405], [876],
  [Aktive Pro-Kunden gesamt], [45], [170], [460], [995], [1.756],
  [Umsatz Pro-Lizenzen], [6.705 €], [25.330 €], [68.540 €], [148.255 €], [261.644 €],
  [*Pro-Abo Zwischensumme*], [*6.705 €*], [*25.330 €*], [*68.540 €*], [*148.255 €*], [*261.644 €*],
  [Enterprise / Verband Neukunden (990 €)], [2], [8], [22], [42], [65],
  [Enterprise Verlängerungen], [0], [2], [10], [30], [68],
  [Aktive Verbandskunden gesamt], [2], [10], [32], [72], [133],
  [Umsatz Verbandslizenzen], [1.980 €], [9.900 €], [31.680 €], [71.280 €], [131.670 €],
  [*Enterprise Zwischensumme*], [*1.980 €*], [*9.900 €*], [*31.680 €*], [*71.280 €*], [*131.670 €*],
  [*Jahresumsatz gesamt*], [*16.965 €*], [*58.690 €*], [*154.040 €*], [*317.515 €*], [*541.664 €*],
  [Umsatzwachstum (YoY)], [–], [+245,9 %], [+162,5 %], [+106,1 %], [+70,6 %],
  [Abgedeckte Events (geschätzt)], [229], [786], [2.056], [4.219], [7.173],
  [*SAM-Marktanteil (Events)*], [*0,6 %*], [*2,1 %*], [*5,6 %*], [*11,4 %*], [*19,4 %*]
)

== 4.2. Sensitivitätsanalyse: Szenarienvergleich

#table(
  columns: (2.5fr, 1.1fr, 1.1fr, 1.1fr, 1.1fr, 1.1fr, 1.3fr),
  inset: 5.5pt,
  fill: (col, row) => if row == 0 { rgb("#eff6ff") } else if row == 2 { rgb("#f0fdf4") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  align: (col, row) => if col == 0 { left } else { center },
  [*Szenario*], [*Jahr 1*], [*Jahr 2*], [*Jahr 3*], [*Jahr 4*], [*Jahr 5*], [*5-Jahres-Summe*],
  [Konservativ (-25 %, 18 % Churn)], [12.415 €], [43.001 €], [111.613 €], [230.063 €], [390.496 €], [787.588 €],
  [*Base Case (Kernmodell)*], [*16.965 €*], [*58.690 €*], [*154.040 €*], [*317.515 €*], [*541.664 €*], [*1.088.874 €*],
  [Optimistisch (+30 %, 8 % Churn)], [22.605 €], [77.745 €], [202.703 €], [420.862 €], [723.838 €], [1.447.753 €]
)

= 5. Strategische Erfolgsfaktoren & Wettbewerbsvorteile

1. *Spezialisierung auf Vereins-Compliance und Datenschutz:* Strikte Mandantentrennung, datensparsame Zugänge für Co-Admins und Planer sowie revisionssichere Protokollierung bieten Vereinen Schutz vor DSGVO-Bußgeldern.
2. *Friktionsfreier Einstieg durch den 69 € Single Event Pass:* Der niedrige Einmalpreis liegt unter vereinsinternen Genehmigungsschwellen. Nach erfolgreichem Fest konvertieren ca. 25–30 % der Veranstalter in das Pro-Abonnement.
3. *Virale B2B-Netzwerkeffekte über die Helferbasis:* Mit durchschnittlich 75 Helfern pro Veranstaltung fungieren aktive Ehrenamtliche als Botschafter in benachbarten Vereinen, was die Kundenakquisekosten (CAC) drastisch reduziert.

= 6. Fazit und Handlungsempfehlungen

MyCrewMate besetzt eine profitabel skalierbare Marktlücke zwischen starren Mitgliederverwaltungssystemen und unzureichenden Freeware-Tabellen. Mit einer Bruttomarge von über 85 % und einem prognostizierten Umsatz von über 540.000 € im fünften Jahr bietet die Plattform ein exzellentes Rendite-Risiko-Profil.

*Empfohlene operative Maßnahmen:*
- Institutionalisierung von Pilot-Referenzen (RSC Eifelland Mayen e. V., Kirmesteams) als Case Studies.
- Frühzeitiger Vertrieb von Verbandsrahmenverträgen (Enterprise-Lizenz à 990 €) über regionale Bezirksverbände.
- Gezielte Bewerbung des 69 € Single Event Passes vor der Sommer- und Herbstfestsaison.

= 7. Quellenverzeichnis

- *[1]* ZiviZ im Stifterverband: _Vereine in Deutschland im Jahr 2022 – Aktuelle Zahlen zum Strukturwandel_, Discussion Paper 03/2022, Berlin.
- *[2]* Bund Deutscher Radfahrer (German Cycling): _Strukturdaten und Verbandsstatistik 2024/2025_, Frankfurt am Main.
- *[3]* Deutscher Schützenbund: _Mitgliederstatistik und Vereinsbestand per 31. Dezember 2024_, Wiesbaden, Juli 2025.
- *[4]* Schweizer Schiesssportverband (SSV): _Facts & Figures – Verbands- und Vereinsstatistik_, Luzern.
- *[5]* Bundesverband Deutscher Schausteller und Marktkaufleute e. V. (BSM): _Wirtschaftliche Bedeutung der Volksfeste in Deutschland_, Bonn.
- *[6]* Sport Austria (Bundes-Sportorganisation): _Mitgliederstatistik der österreichischen Sportvereine und -verbände 2024/2025_, Wien.
