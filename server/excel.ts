import * as XLSX from "xlsx";
import * as db from "./db";

const key = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");

const statusMap = (value: string): "offen" | "inArbeit" | "erledigt" => {
  const normalized = key(value);
  if (normalized.includes("erledigt")) return "erledigt";
  if (normalized.includes("arbeit")) return "inArbeit";
  return "offen";
};

const availability = (value: unknown): "ja" | "nein" | "vielleicht" => {
  const normalized = key(value);
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("nein")) return "nein";
  return "vielleicht";
};

const shiftKey = (value: {
  day: string;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
}) =>
  [value.day, value.area, value.task, value.startTime, value.endTime]
    .map(key)
    .join("|");

export async function importExcel(base64: string) {
  const workbook = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
  const result = {
    kontakte: 0,
    helfer: 0,
    schichten: 0,
    zuordnungen: 0,
    vorbereitung: 0,
    nachbereitung: 0,
    material: 0,
    marketing: 0,
    genehmigungen: 0,
    kuchen: 0,
    finanzen: 0,
    aktualisiert: 0,
    uebersprungen: 0,
  };
  const sheet = (name: string) =>
    workbook.Sheets[name]
      ? XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[name], {
          header: 1,
          defval: "",
        })
      : [];

  const contactIdByName = new Map<string, number>();
  for (const contact of await db.listContacts()) {
    contactIdByName.set(key(contact.name), contact.id);
  }
  for (const row of sheet("ANSPRECHPARTNER").slice(7)) {
    const name = String(row?.[0] ?? "").trim();
    if (!name || /name \(ansprechpartner\)/i.test(name) || /^tipp:/i.test(name))
      continue;
    const upserted = await db.upsertContactByName({ name });
    contactIdByName.set(key(name), upserted.id);
    upserted.created ? result.kontakte++ : result.uebersprungen++;
  }

  const helperIdByKey = new Map<string, number>();
  for (const row of sheet("HELFER").slice(9)) {
    const contactName = String(row?.[0] ?? "").trim();
    const name = String(row?.[1] ?? "").trim();
    if (!name || /name helfer/i.test(name)) continue;
    const upserted = await db.upsertHelperByName({
      name,
      contactId: contactIdByName.get(key(contactName)) ?? null,
      willHelp: availability(row?.[3]) === "nein" ? "nein" : "ja",
      availFri: availability(row?.[4]),
      availSat: availability(row?.[5]),
      availSun: availability(row?.[6]),
      confirmed: availability(row?.[8]) === "ja" ? "ja" : "nein",
    });
    helperIdByKey.set(key(name), upserted.id);
    helperIdByKey.set(key(`${name} (${contactName})`), upserted.id);
    if (upserted.created) result.helfer++;
    else result.aktualisiert++;
  }
  for (const helper of await db.listHelpers()) {
    helperIdByKey.set(key(helper.name), helper.id);
    const contact = Array.from(contactIdByName.entries()).find(
      ([, id]) => id === helper.contactId
    );
    if (contact)
      helperIdByKey.set(key(`${helper.name} (${contact[0]})`), helper.id);
  }

  const existingShifts = new Map(
    (await db.listShifts()).map(item => [shiftKey(item), item])
  );
  const assignmentKeys = new Set(
    (await db.listAssignments()).map(item => `${item.shiftId}:${item.slot}`)
  );
  let lastDay = "";
  for (const row of sheet("EINSATZPLAN").slice(8)) {
    const rawDay = String(row?.[0] ?? "").trim();
    const normalizedDay = rawDay
      ? rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase()
      : "";
    if (["Freitag", "Samstag", "Sonntag"].includes(normalizedDay))
      lastDay = normalizedDay;
    const area = String(row?.[1] ?? "").trim();
    const task = String(row?.[2] ?? "").trim();
    if (!task) continue;
    const day = (
      ["Freitag", "Samstag", "Sonntag"].includes(normalizedDay)
        ? normalizedDay
        : lastDay
    ) as "Freitag" | "Samstag" | "Sonntag";
    if (!["Freitag", "Samstag", "Sonntag"].includes(day)) continue;
    if (!area && !String(row?.[5] ?? "").trim()) continue;
    const values = {
      day,
      area: area || "Allgemein",
      task,
      startTime: String(row?.[3] ?? ""),
      endTime: String(row?.[4] ?? ""),
      needed: Number(row?.[5]) || 0,
      note: String(row?.[10] ?? "").trim(),
    };
    const existing = existingShifts.get(shiftKey(values));
    let shiftId = existing?.id;
    if (existing) {
      await db.updateShift(existing.id, {
        needed: values.needed,
        note: values.note,
      });
      result.aktualisiert++;
    } else {
      const inserted: any = await db.createShift(values);
      shiftId = Number(inserted?.[0]?.insertId ?? inserted?.insertId);
      existingShifts.set(shiftKey(values), { ...values, id: shiftId } as any);
      result.schichten++;
    }
    for (let slot = 0; slot < 20 && shiftId; slot++) {
      const raw = row?.[11 + slot];
      if (typeof raw !== "string") continue;
      const cell = raw.trim();
      if (
        !cell ||
        /^(OFFEN|KNAPP|OK)$/i.test(cell) ||
        /doppelbelegung/i.test(cell)
      )
        continue;
      const helperId =
        helperIdByKey.get(key(cell)) ??
        helperIdByKey.get(key(cell.replace(/\s*\(.*\)$/, "")));
      const assignmentKey = `${shiftId}:${slot}`;
      if (!helperId || assignmentKeys.has(assignmentKey)) {
        result.uebersprungen++;
        continue;
      }
      await db.assignHelper({ shiftId, helperId, slot });
      assignmentKeys.add(assignmentKey);
      result.zuordnungen++;
    }
  }

  const contacts = await db.listContacts();
  const contactId = (name: unknown) =>
    contacts.find(item => key(item.name) === key(name))?.id ?? null;

  const prepKeys = new Set((await db.listPrep()).map(item => key(item.task)));
  for (const row of sheet("VORBEREITUNG").slice(8)) {
    const task = String(row?.[0] ?? "").trim();
    if (!task || /^aufgabe$/i.test(task)) continue;
    if (prepKeys.has(key(task))) {
      result.uebersprungen++;
      continue;
    }
    await db.createPrep({
      task,
      contactId: contactId(row?.[2]),
      status: statusMap(String(row?.[3] ?? "")),
      note: [String(row?.[1] ?? ""), String(row?.[4] ?? "")]
        .filter(Boolean)
        .join(" | "),
    });
    prepKeys.add(key(task));
    result.vorbereitung++;
  }

  const postKeys = new Set((await db.listPost()).map(item => key(item.task)));
  for (const row of sheet("NACHBEREITUNG").slice(8)) {
    const task = String(row?.[0] ?? "").trim();
    if (!task || /^aufgabe$/i.test(task)) continue;
    if (postKeys.has(key(task))) {
      result.uebersprungen++;
      continue;
    }
    await db.createPost({
      task,
      contactId: contactId(row?.[1]),
      status: statusMap(String(row?.[2] ?? "")),
      note: String(row?.[3] ?? ""),
    });
    postKeys.add(key(task));
    result.nachbereitung++;
  }

  const materialKeys = new Set(
    (await db.listMaterials()).map(item => key(item.article))
  );
  for (const row of sheet("MATERIAL").slice(8)) {
    const article = String(row?.[0] ?? "").trim();
    if (!article || /^material|artikel/i.test(article)) continue;
    if (materialKeys.has(key(article))) {
      result.uebersprungen++;
      continue;
    }
    await db.createMaterial({
      article,
      category: String(row?.[1] ?? ""),
      quantity: String(row?.[2] ?? ""),
      unit: String(row?.[3] ?? ""),
      contactId: contactId(row?.[6]),
      ordered: key(row?.[7]).startsWith("ja") ? "ja" : "nein",
      note: [String(row?.[4] ?? ""), String(row?.[5] ?? "")]
        .filter(Boolean)
        .join(" | "),
    });
    materialKeys.add(key(article));
    result.material++;
  }

  const marketingKeys = new Set(
    (await db.listMarketing()).map(item => key(item.measure))
  );
  for (const row of sheet("MARKETING").slice(8)) {
    const measure = String(row?.[0] ?? "").trim();
    if (!measure || /^maßnahme|^massnahme|inhalt/i.test(measure)) continue;
    if (marketingKeys.has(key(measure))) {
      result.uebersprungen++;
      continue;
    }
    await db.createMarketing({
      measure,
      channel: String(row?.[1] ?? ""),
      contactId: contactId(row?.[3]),
      status: statusMap(String(row?.[4] ?? "")),
      note: String(row?.[2] ?? ""),
    });
    marketingKeys.add(key(measure));
    result.marketing++;
  }

  const approvalKeys = new Set(
    (await db.listApprovals()).map(item => key(item.request))
  );
  for (const row of sheet("GENEHMIGUNGEN").slice(8)) {
    const request = String(row?.[0] ?? "").trim();
    if (!request || /^art der genehmigung/i.test(request)) continue;
    if (approvalKeys.has(key(request))) {
      result.uebersprungen++;
      continue;
    }
    const status = key(row?.[4]);
    await db.createApproval({
      request,
      contactId: contactId(row?.[3]),
      status: (["offen", "beantragt", "genehmigt", "abgelehnt"].includes(status)
        ? status
        : "offen") as any,
      note: [
        String(row?.[1] ?? ""),
        String(row?.[2] ?? ""),
        String(row?.[5] ?? ""),
      ]
        .filter(Boolean)
        .join(" | "),
    });
    approvalKeys.add(key(request));
    result.genehmigungen++;
  }

  const cakeKeys = new Set(
    (await db.listCakes()).map(item => `${key(item.donor)}|${key(item.cake)}`)
  );
  for (const row of sheet("KUCHEN").slice(8)) {
    const donor = String(row?.[0] ?? "").trim();
    const cake = String(row?.[1] ?? "").trim();
    if (!donor || /^name spender/i.test(donor)) continue;
    const cakeKey = `${key(donor)}|${key(cake)}`;
    if (cakeKeys.has(cakeKey)) {
      result.uebersprungen++;
      continue;
    }
    await db.createCake({
      donor,
      cake,
      dropoffTime: String(row?.[3] ?? ""),
      note: [String(row?.[2] ?? ""), String(row?.[4] ?? "")]
        .filter(Boolean)
        .join(" | "),
    });
    cakeKeys.add(cakeKey);
    result.kuchen++;
  }

  const financeKeys = new Set(
    (await db.listFinances()).map(item => key(item.category))
  );
  for (const row of sheet("FINANZEN").slice(8)) {
    const position = String(row?.[0] ?? "").trim();
    const category = String(row?.[1] ?? "").trim();
    if (
      !position ||
      /^position$/i.test(position) ||
      /^einnahmen$|^ausgaben$/i.test(category)
    )
      continue;
    if (financeKeys.has(key(position))) {
      result.uebersprungen++;
      continue;
    }
    const amount =
      Math.round(
        parseFloat(String(row?.[3] ?? row?.[2] ?? "0").replace(",", ".")) * 100
      ) || 0;
    const isIncome = /einnahme/i.test(category);
    await db.createFinance({
      category: position,
      incomeCents: isIncome ? amount : 0,
      expenseCents: isIncome ? 0 : amount,
      note: String(row?.[5] ?? ""),
    });
    financeKeys.add(key(position));
    result.finanzen++;
  }
  return result;
}

export async function exportExcel(): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();
  const add = (name: string, rows: any[]) =>
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      name
    );
  const [contacts, helpers, shifts, assignments] = await Promise.all([
    db.listContacts(),
    db.listHelpers(),
    db.listShifts(),
    db.listAssignments(),
  ]);
  const contactName = new Map(
    contacts.map(contact => [contact.id, contact.name])
  );
  const helperName = new Map(helpers.map(helper => [helper.id, helper.name]));

  add(
    "ANSPRECHPARTNER",
    contacts.map(contact => ({
      Name: contact.name,
      Rufnummer: contact.phone ?? "",
    }))
  );
  add(
    "HELFER",
    helpers.map(helper => ({
      Ansprechpartner: helper.contactId
        ? (contactName.get(helper.contactId) ?? "")
        : "",
      Name: helper.name,
      Telefon: helper.phone ?? "",
      Bemerkung: helper.note ?? "",
      "Helfen?": helper.willHelp === "ja" ? "Ja" : "Nein",
      Fr: helper.availFri,
      Sa: helper.availSat,
      So: helper.availSun,
      "Bestätigt?": helper.confirmed === "ja" ? "Ja" : "Nein",
    }))
  );
  const byShift = new Map<number, string[]>();
  for (const assignment of assignments) {
    if (!byShift.has(assignment.shiftId)) byShift.set(assignment.shiftId, []);
    byShift.get(assignment.shiftId)![assignment.slot] =
      helperName.get(assignment.helperId) ?? "";
  }
  add(
    "EINSATZPLAN",
    shifts.map(shift => ({
      Tag: shift.day,
      Bereich: shift.area,
      Aufgabe: shift.task,
      Beginn: shift.startTime,
      Ende: shift.endTime,
      Bedarf: shift.needed,
      Helfer: (byShift.get(shift.id) ?? []).filter(Boolean).join(", "),
    }))
  );
  add(
    "VORBEREITUNG",
    (await db.listPrep()).map(item => ({
      Aufgabe: item.task,
      Verantwortlich: item.contactId
        ? (contactName.get(item.contactId) ?? "")
        : "",
      Status: item.status,
    }))
  );
  add(
    "NACHBEREITUNG",
    (await db.listPost()).map(item => ({
      Aufgabe: item.task,
      Verantwortlich: item.contactId
        ? (contactName.get(item.contactId) ?? "")
        : "",
      Status: item.status,
    }))
  );
  add(
    "MATERIAL",
    (await db.listMaterials()).map(item => ({
      Artikel: item.article,
      Kategorie: item.category,
      Menge: item.quantity,
      Einheit: item.unit,
      Verantwortlich: item.contactId
        ? (contactName.get(item.contactId) ?? "")
        : "",
      Bestellt: item.ordered,
    }))
  );
  add(
    "MARKETING",
    (await db.listMarketing()).map(item => ({
      Maßnahme: item.measure,
      Kanal: item.channel,
      Verantwortlich: item.contactId
        ? (contactName.get(item.contactId) ?? "")
        : "",
      Status: item.status,
    }))
  );
  add(
    "GENEHMIGUNGEN",
    (await db.listApprovals()).map(item => ({
      Antrag: item.request,
      Verantwortlich: item.contactId
        ? (contactName.get(item.contactId) ?? "")
        : "",
      Status: item.status,
    }))
  );
  add(
    "KUCHEN",
    (await db.listCakes()).map(item => ({
      Spender: item.donor,
      Kuchen: item.cake,
      Abgabezeit: item.dropoffTime,
    }))
  );
  add(
    "FINANZEN",
    (await db.listFinances()).map(item => ({
      Kategorie: item.category,
      Einnahmen: item.income / 100,
      Ausgaben: item.expense / 100,
    }))
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
