export const ACTIVE_EXCEL_IMPORT_AREAS = [
  { id: "ORTE", label: "Orte & Standorte", sheetName: "Orte & Standorte" },
  { id: "ANSPRECHPARTNER", label: "Ansprechpartner", sheetName: "Ansprechpartner" },
  { id: "HELFER", label: "Helfer", sheetName: "Helfer" },
  { id: "EINSATZPLAN", label: "Einsatzplan", sheetName: "Einsatzplan" },
  { id: "VORBEREITUNG", label: "Vorbereitung", sheetName: "Vorbereitung" },
  { id: "NACHBEREITUNG", label: "Nachbereitung", sheetName: "Nachbereitung" },
  { id: "MATERIAL", label: "Material", sheetName: "Material" },
  { id: "KUCHEN", label: "Spenden", sheetName: "Spenden" },
  { id: "FINANZEN", label: "Finanzen", sheetName: "Finanzen" },
] as const;

export type ActiveExcelImportArea = (typeof ACTIVE_EXCEL_IMPORT_AREAS)[number]["id"];

export const ACTIVE_EXCEL_SHEET_NAME = Object.fromEntries(
  ACTIVE_EXCEL_IMPORT_AREAS.map(({ id, sheetName }) => [id, sheetName])
) as Record<ActiveExcelImportArea, string>;
