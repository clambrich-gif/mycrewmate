import * as XLSX from "xlsx";
import * as db from "./db";

const findContact = async (name: string) => {
  if (!name) return null;
  const cs = await db.listContacts();
  return cs.find(c => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
};
const findHelper = async (name: string) => {
  if (!name) return null;
  const hs = await db.listHelpers();
  const base = name.replace(/\s*\(.*\)$/, "").trim().toLowerCase();
  return hs.find(h => h.name.toLowerCase() === base)?.id ?? null;
};
const statusMap = (v: string): "offen" | "inArbeit" | "erledigt" => {
  const s = (v || "").toLowerCase();
  if (s.includes("erledigt")) return "erledigt";
  if (s.includes("arbeit")) return "inArbeit";
  return "offen";
};

/** Importiert die bestehende MyEifelRide-Excel-Datei (Basis64) in die Datenbank. */
export async function importExcel(base64: string) {
  const wb = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
  const result = { kontakte: 0, helfer: 0, schichten: 0, zuordnungen: 0, vorbereitung: 0, nachbereitung: 0, material: 0, marketing: 0, genehmigungen: 0, kuchen: 0, finanzen: 0 };
  const sheet = (n: string) => wb.Sheets[n] ? XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1 }) : [];

  // Ansprechpartner
  const apRows = sheet("ANSPRECHPARTNER");
  const contactIdByName = new Map<string, number>();
  for (const row of apRows.slice(7)) {
    const name = String(row?.[0] ?? "").trim();
    if (!name || /name \(ansprechpartner\)/i.test(name) || /^tipp:/i.test(name)) continue;
    await db.createContact({ name });
    result.kontakte++;
  }
  for (const c of await db.listContacts()) contactIdByName.set(c.name, c.id);

  // Helfer
  const heRows = sheet("HELFER");
  const helperIdByKey = new Map<string, number>();
  const norm = (v: any): "ja" | "nein" | "vielleicht" => {
    const s = String(v ?? "").toLowerCase();
    if (s.startsWith("ja")) return "ja";
    if (s.startsWith("nein")) return "nein";
    return "vielleicht";
  };
  for (const row of heRows.slice(9)) {
    const apName = String(row?.[0] ?? "").trim();
    const name = String(row?.[1] ?? "").trim();
    if (!name || /name helfer/i.test(name)) continue;
    const willHelp = norm(row?.[3]) === "nein" ? "nein" : "ja";
    const confirmed = norm(row?.[8]) === "ja" ? "ja" : "nein";
    await db.createHelper({
      name,
      contactId: contactIdByName.get(apName) ?? null,
      willHelp,
      availFri: norm(row?.[4]),
      availSat: norm(row?.[5]),
      availSun: norm(row?.[6]),
      confirmed,
    } as any);
    result.helfer++;
  }
  for (const h of await db.listHelpers()) {
    let cname = "";
    if (h.contactId) contactIdByName.forEach((id, nm) => { if (id === h.contactId) cname = nm; });
    helperIdByKey.set(`${h.name} (${cname})`, h.id);
    helperIdByKey.set(h.name, h.id);
  }

  // Einsatzplan (Schichten + Zuordnungen) – Daten ab Zeile 9 (Index 8)
  const epRows = sheet("EINSATZPLAN");
  let lastDay = "";
  for (const row of epRows.slice(8)) {
    const dayRaw = String(row?.[0] ?? "").trim();
    const dayNorm = dayRaw ? dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase() : "";
    if (["Freitag", "Samstag", "Sonntag"].includes(dayNorm)) lastDay = dayNorm;
    const area = String(row?.[1] ?? "").trim();
    const task = String(row?.[2] ?? "").trim();
    if (!task) continue;
    const day = (["Freitag", "Samstag", "Sonntag"].includes(dayNorm) ? dayNorm : lastDay) as any;
    if (!["Freitag", "Samstag", "Sonntag"].includes(day)) continue;
    // Bereichs-Überschriften (Zeile nur mit Bereich, keine Aufgabe) ueberspringen
    if (!area && !String(row?.[5] ?? "").trim()) continue;
    const needed = Number(row?.[5]) || 0;
    const note = String(row?.[10] ?? "").trim();
    const ins: any = await db.createShift({
      day, area: area || "Allgemein", task,
      startTime: String(row?.[3] ?? ""), endTime: String(row?.[4] ?? ""),
      needed, note,
    });
    result.schichten++;
    const shiftId = ins?.[0]?.insertId ?? ins?.insertId;
    // Helfer-Spalten L..AE = Index 11..30 (nur Text, keine Zeit-Zahlen/Status)
    for (let k = 0; k < 20 && shiftId; k++) {
      const raw = row?.[11 + k];
      if (typeof raw !== "string") continue;
      const cell = raw.trim();
      if (!cell || /^(OFFEN|KNAPP|OK)$/i.test(cell) || /doppelbelegung/i.test(cell)) continue;
      const hid = helperIdByKey.get(cell) ?? helperIdByKey.get(cell.replace(/\s*\(.*\)$/, "")) ?? await findHelper(cell);
      if (hid) { await db.assignHelper({ shiftId, helperId: hid, slot: k }); result.zuordnungen++; }
    }
  }

  // Vorbereitung (Aufgabe, Verantwortlich, Status)
  for (const row of sheet("VORBEREITUNG").slice(8)) {
    const task = String(row?.[1] ?? "").trim();
    if (!task || /aufgabe/i.test(task)) continue;
    const contactId = await findContact(String(row?.[2] ?? "").trim());
    await db.createPrep({ task, contactId, status: statusMap(String(row?.[3] ?? "")), note: String(row?.[4] ?? "") });
    result.vorbereitung++;
  }
  // Nachbereitung
  for (const row of sheet("NACHBEREITUNG").slice(8)) {
    const task = String(row?.[1] ?? "").trim();
    if (!task || /aufgabe/i.test(task)) continue;
    const contactId = await findContact(String(row?.[2] ?? "").trim());
    await db.createPost({ task, contactId, status: statusMap(String(row?.[3] ?? "")), note: String(row?.[4] ?? "") });
    result.nachbereitung++;
  }
  // Material (Artikel, Kategorie, Menge, Einheit, Verantwortlich, Bestellt?)
  for (const row of sheet("MATERIAL").slice(8)) {
    const article = String(row?.[0] ?? "").trim();
    if (!article || /artikel/i.test(article)) continue;
    const contactId = await findContact(String(row?.[6] ?? "").trim());
    await db.createMaterial({
      article, category: String(row?.[1] ?? ""), quantity: String(row?.[2] ?? ""),
      unit: String(row?.[3] ?? ""), contactId,
      ordered: String(row?.[7] ?? "").toLowerCase().startsWith("ja") ? "ja" : "nein",
      note: String(row?.[8] ?? ""),
    });
    result.material++;
  }
  // Marketing (Maßnahme, Kanal, Verantwortlich, Status)
  for (const row of sheet("MARKETING").slice(8)) {
    const measure = String(row?.[0] ?? "").trim();
    if (!measure || /maßnahme|massnahme/i.test(measure)) continue;
    const contactId = await findContact(String(row?.[2] ?? "").trim());
    await db.createMarketing({ measure, channel: String(row?.[1] ?? ""), contactId, status: statusMap(String(row?.[4] ?? "")), note: String(row?.[5] ?? "") });
    result.marketing++;
  }
  // Genehmigungen (Antrag, Verantwortlich, Status)
  for (const row of sheet("GENEHMIGUNGEN").slice(8)) {
    const request = String(row?.[0] ?? "").trim();
    if (!request || /antrag|genehmigung/i.test(request)) continue;
    const contactId = await findContact(String(row?.[3] ?? "").trim());
    await db.createApproval({ request, contactId, status: (["offen","beantragt","genehmigt","abgelehnt"].includes(String(row?.[4] ?? "").toLowerCase()) ? String(row?.[4]).toLowerCase() : "offen") as any, note: String(row?.[5] ?? "") });
    result.genehmigungen++;
  }
  // Kuchen (Spender, Kuchen, Abgabezeit)
  for (const row of sheet("KUCHEN").slice(8)) {
    const donor = String(row?.[0] ?? "").trim();
    if (!donor || /spender|name/i.test(donor)) continue;
    await db.createCake({ donor, cake: String(row?.[1] ?? ""), dropoffTime: String(row?.[2] ?? ""), note: String(row?.[3] ?? "") });
    result.kuchen++;
  }
  // Finanzen (Kategorie, Einnahmen, Ausgaben)
  for (const row of sheet("FINANZEN").slice(8)) {
    const category = String(row?.[0] ?? "").trim();
    if (!category || /kategorie|saldo/i.test(category)) continue;
    const incomeCents = Math.round(parseFloat(String(row?.[1] ?? "0").replace(",", ".")) * 100) || 0;
    const expenseCents = Math.round(parseFloat(String(row?.[2] ?? "0").replace(",", ".")) * 100) || 0;
    await db.createFinance({ category, incomeCents, expenseCents });
    result.finanzen++;
  }
  return result;
}

/** Exportiert die Planungsdaten als Excel-Datei (Buffer). */
export async function exportExcel(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  const [contacts, helpers, shifts, assignments] = await Promise.all([db.listContacts(), db.listHelpers(), db.listShifts(), db.listAssignments()]);
  const cname = new Map(contacts.map(c => [c.id, c.name]));
  const hname = new Map(helpers.map(h => [h.id, h.name]));

  add("ANSPRECHPARTNER", contacts.map(c => ({ Name: c.name })));
  add("HELFER", helpers.map(h => ({
    Ansprechpartner: h.contactId ? cname.get(h.contactId) ?? "" : "",
    Name: h.name, "Helfen?": h.willHelp === "ja" ? "Ja" : "Nein",
    Fr: h.availFri, Sa: h.availSat, So: h.availSun,
    "Bestätigt?": h.confirmed === "ja" ? "Ja" : "Nein",
  })));
  const byShift = new Map<number, string[]>();
  for (const a of assignments) {
    if (!byShift.has(a.shiftId)) byShift.set(a.shiftId, []);
    byShift.get(a.shiftId)![a.slot] = hname.get(a.helperId) ?? "";
  }
  add("EINSATZPLAN", shifts.map(s => ({
    Tag: s.day, Bereich: s.area, Aufgabe: s.task, Beginn: s.startTime, Ende: s.endTime,
    Bedarf: s.needed, Helfer: (byShift.get(s.id) ?? []).filter(Boolean).join(", "),
  })));
  add("VORBEREITUNG", (await db.listPrep()).map(t => ({ Aufgabe: t.task, Verantwortlich: t.contactId ? cname.get(t.contactId) ?? "" : "", Status: t.status })));
  add("NACHBEREITUNG", (await db.listPost()).map(t => ({ Aufgabe: t.task, Verantwortlich: t.contactId ? cname.get(t.contactId) ?? "" : "", Status: t.status })));
  add("MATERIAL", (await db.listMaterials()).map(m => ({ Artikel: m.article, Kategorie: m.category, Menge: m.quantity, Einheit: m.unit, Verantwortlich: m.contactId ? cname.get(m.contactId) ?? "" : "", Bestellt: m.ordered })));
  add("MARKETING", (await db.listMarketing()).map(m => ({ "Maßnahme": m.measure, Kanal: m.channel, Verantwortlich: m.contactId ? cname.get(m.contactId) ?? "" : "", Status: m.status })));
  add("GENEHMIGUNGEN", (await db.listApprovals()).map(a => ({ Antrag: a.request, Verantwortlich: a.contactId ? cname.get(a.contactId) ?? "" : "", Status: a.status })));
  add("KUCHEN", (await db.listCakes()).map(c => ({ Spender: c.donor, Kuchen: c.cake, Abgabezeit: c.dropoffTime })));
  add("FINANZEN", (await db.listFinances()).map(f => ({ Kategorie: f.category, Einnahmen: f.income / 100, Ausgaben: f.expense / 100 })));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
