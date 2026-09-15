# Visuelle & Funktionale Optimierung (15. September 2026)

## 1. Desktop-Stammdateneingaben (ab 1024px)
- **Ansprechpartner (`Contacts.tsx`):**
  - Eigene, hervorgehobene Aktions-Karte oberhalb der Tabelle (`border-blue-200 bg-slate-50/80 shadow-sm`).
  - Klare Beschriftungen: „Neuanlage – Name des Ansprechpartners“ und „Neuanlage – Rufnummer“.
  - Prominenter Primär-Button mit ausgefülltem Indigo-Farbton (`bg-indigo-700 hover:bg-indigo-800`), weißem Text und `+`-Icon.
  - Weiße Input-Felder mit sichtbarem Rahmen (`border-slate-300 bg-white shadow-sm`) und kontrastreichem Platzhalter.
- **Helfer (`Helpers.tsx`):**
  - Eigene Aktions-Karte mit „Neuanlage – Name des Helfers“ und prominenter Primär-Schaltfläche „Helfer hinzufügen“ (`bg-indigo-700 hover:bg-indigo-800`).
  - Mobile Ansicht behält die kompakte Smartphone-Anordnung unverändert bei (`lg:hidden`).
- **Einsatzplan (`Plan.tsx`):**
  - Modal-Dialog-Struktur (+ Neue Schicht) bleibt unverändert erhalten.

## 2. Semantisches Farbkonzept für Aktionen
- **Import / Übernahme (Matt-Mintgrün):**
  - `ModuleExcelImportButton.tsx`: `border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`
  - `CopyPreviousPlanButton.tsx`: `border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`
  - `ProjectStorageControls.tsx` (Laden): `border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`
- **Destruktive Resets & Löschungen (Matt-Rose):**
  - `ClearPlanAssignmentsButton.tsx`: `border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`
  - `ResetAreaButton.tsx`: `border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`
  - Zeilenlöschungen in `TaskList.tsx`, `TaskGeneric.tsx`, `Finances.tsx`, `Permissions.tsx`: sanftes Matt-Rose statt grellem Rot.

## 3. Mobiler Auto-Zoom Schutz (iPhone / Smartphone)
- `index.css`: Brute-Force-Regel unter 1024px erzwingt `font-size: 16px !important`, `-webkit-text-size-adjust: 100%` und `touch-action: manipulation` auf allen Input-, Textarea-, Select- und Contenteditable-Elementen.
- `mobileFocusViewport.ts`: Dynamischer Event-Listener bei `focusin`/`pointerdown` sperrt temporär den Viewport (`maximum-scale=1.0, user-scalable=no`) und stellt ihn bei `focusout`/`blur` für uneingeschränkten Barrierefreiheits-Pinch-to-Zoom wieder her.
- `Helpers.tsx` & `LiveChatWidget.tsx`: Keine verkleinernden Klassen (`xl:text-xs`, `xl:text-sm`) mehr auf Eingabefeldern.
