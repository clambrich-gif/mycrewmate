/**
 * Einheitliche Desktop-Tabellenbehandlung für die operativen Hauptmodule.
 * Der Scrollbereich bleibt innerhalb der Karte; dadurch haftet die Kopfzeile
 * immer am oberen Rand derselben sichtbaren Datentabelle.
 */
export const STICKY_TABLE_CONTAINER_CLASS =
  "max-h-[calc(100dvh-18rem)] overflow-x-auto overflow-y-auto overscroll-contain";

export const STICKY_TABLE_HEADER_CLASS =
  "sticky top-0 z-10 border-b border-gray-200 bg-white opacity-100 text-left font-semibold text-gray-700 shadow-sm [&>tr>th]:bg-white";

export const STICKY_TABLE_HEADER_CELL_CLASS = "px-3 py-2.5";
