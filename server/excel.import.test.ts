import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

// Testet das Import-Mapping gegen die Originaldatei (ohne DB).
const file = path.resolve("/home/ubuntu/MyEifelRide_Vorlage_vereinfacht.xlsx");
const hasFile = fs.existsSync(file);

const sheet = (wb: XLSX.WorkBook, n: string) =>
  wb.Sheets[n] ? XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, defval: "" }) : [];

describe("Excel-Import-Mapping (Originaldatei)", () => {
  it.skipIf(!hasFile)("zählt alle Module korrekt", () => {
    const wb = XLSX.read(fs.readFileSync(file));
    const cnt: Record<string, number> = {};

    cnt.kontakte = sheet(wb, "ANSPRECHPARTNER").slice(7).filter(r => {
      const n = String(r?.[0] ?? "").trim();
      return n && !/name \(ansprechpartner\)/i.test(n) && !/^tipp:/i.test(n);
    }).length;

    cnt.helfer = sheet(wb, "HELFER").slice(9).filter(r => {
      const n = String(r?.[1] ?? "").trim();
      return n && !/name helfer/i.test(n);
    }).length;

    let lastDay = ""; let shifts = 0; let assigns = 0;
    for (const row of sheet(wb, "EINSATZPLAN").slice(8)) {
      const d = String(row?.[0] ?? "").trim();
      const dn = d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : "";
      if (["Freitag", "Samstag", "Sonntag"].includes(dn)) lastDay = dn;
      const task = String(row?.[2] ?? "").trim(); if (!task) continue;
      const day = ["Freitag", "Samstag", "Sonntag"].includes(dn) ? dn : lastDay;
      if (!["Freitag", "Samstag", "Sonntag"].includes(day)) continue;
      const area = String(row?.[1] ?? "").trim();
      if (!area && !String(row?.[5] ?? "").trim()) continue;
      shifts++;
      for (let k = 0; k < 20; k++) {
        const raw = row?.[11 + k];
        if (typeof raw === "string") {
          const c = raw.trim();
          if (c && !/^(OFFEN|KNAPP|OK)$/i.test(c) && !/doppelbelegung/i.test(c)) assigns++;
        }
      }
    }
    cnt.schichten = shifts; cnt.zuordnungen = assigns;

    cnt.vorbereitung = sheet(wb, "VORBEREITUNG").slice(8).filter(r => String(r?.[0] ?? "").trim() && !/^aufgabe$/i.test(String(r?.[0]))).length;
    cnt.nachbereitung = sheet(wb, "NACHBEREITUNG").slice(8).filter(r => String(r?.[0] ?? "").trim() && !/^aufgabe$/i.test(String(r?.[0]))).length;
    cnt.material = sheet(wb, "MATERIAL").slice(8).filter(r => { const a = String(r?.[0] ?? "").trim(); return a && !/^material|artikel/i.test(a); }).length;
    cnt.marketing = sheet(wb, "MARKETING").slice(8).filter(r => { const m = String(r?.[0] ?? "").trim(); return m && !/^maßnahme|^massnahme|inhalt/i.test(m); }).length;
    cnt.genehmigungen = sheet(wb, "GENEHMIGUNGEN").slice(8).filter(r => { const g = String(r?.[0] ?? "").trim(); return g && !/^art der genehmigung/i.test(g); }).length;
    cnt.kuchen = sheet(wb, "KUCHEN").slice(8).filter(r => { const d = String(r?.[0] ?? "").trim(); return d && !/^name spender/i.test(d); }).length;
    cnt.finanzen = sheet(wb, "FINANZEN").slice(8).filter(r => { const p = String(r?.[0] ?? "").trim(); const k = String(r?.[1] ?? "").trim(); return p && !/^position$/i.test(p) && !/^einnahmen$|^ausgaben$/i.test(k); }).length;

    expect(cnt.kontakte).toBe(3);
    expect(cnt.helfer).toBe(3);
    expect(cnt.schichten).toBe(78);
    expect(cnt.vorbereitung).toBe(33);
    expect(cnt.nachbereitung).toBe(19);
    expect(cnt.material).toBe(33);
    expect(cnt.marketing).toBe(13);
    expect(cnt.genehmigungen).toBe(9);
    expect(cnt.finanzen).toBe(18);
    // Originaldatei enthält keine eingeteilten Helfer -> 0 Zuordnungen ist erwartbar
    expect(cnt.zuordnungen).toBe(0);
  });
});
