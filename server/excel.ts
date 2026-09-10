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

export async function importExcel(
  base64: string,
  options: { skipHelperKeys?: string[] } = {}
) {
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

  const findHeader = (rows: any[][], required: RegExp[]) => {
    const index = rows
      .slice(0, 20)
      .findIndex(row =>
        required.every(pattern => row.some(value => pattern.test(key(value))))
      );
    return index;
  };
  const column = (headers: any[], patterns: RegExp[], fallback: number) => {
    const index = headers.findIndex(value =>
      patterns.some(pattern => pattern.test(key(value)))
    );
    return index >= 0 ? index : fallback;
  };

  const contactIdByName = new Map<string, number>();
  const skipHelperKeys = new Set(options.skipHelperKeys ?? []);
  for (const contact of await db.listContacts()) {
    contactIdByName.set(key(contact.name), contact.id);
  }
  const contactRows = sheet("ANSPRECHPARTNER");
  const contactHeader = findHeader(contactRows, [
    /^name(?: \(ansprechpartner\))?$/,
  ]);
  const contactHeaders = contactHeader >= 0 ? contactRows[contactHeader] : [];
  const contactNameColumn = column(
    contactHeaders,
    [/^name(?: \(ansprechpartner\))?$/],
    0
  );
  const contactPhoneColumn = column(
    contactHeaders,
    [/^rufnummer$/, /^telefon$/],
    1
  );
  const contactNoteColumn = column(
    contactHeaders,
    [/^bemerkung$/, /^notiz$/, /^hinweis$/],
    2
  );
  for (const row of contactRows.slice(
    contactHeader >= 0 ? contactHeader + 1 : 7
  )) {
    const name = String(row?.[contactNameColumn] ?? "").trim();
    if (!name || /name \(ansprechpartner\)/i.test(name) || /^tipp:/i.test(name))
      continue;
    const upserted = await db.upsertContactByName({
      name,
      phone: String(row?.[contactPhoneColumn] ?? "").trim() || undefined,
      note: String(row?.[contactNoteColumn] ?? "").trim() || undefined,
    });
    contactIdByName.set(key(name), upserted.id);
    upserted.created ? result.kontakte++ : result.uebersprungen++;
  }

  const helperRows = sheet("HELFER");
  const helperHeader = findHeader(helperRows, [/^name(?: helfer)?$/]);
  const helperHeaders = helperHeader >= 0 ? helperRows[helperHeader] : [];
  const helperColumns = {
    contact: column(helperHeaders, [/^ansprechpartner$/], 0),
    name: column(helperHeaders, [/^name(?: helfer)?$/], 1),
    email: column(helperHeaders, [/^e-mail$/, /^email$/], -1),
    phone: column(helperHeaders, [/^telefon(?: helfer)?$/, /^rufnummer$/], -1),
    willHelp: column(helperHeaders, [/^helfen\??$/], 3),
    fri: column(helperHeaders, [/^fr(?:eitag)?$/], 4),
    sat: column(helperHeaders, [/^sa(?:mstag)?$/], 5),
    sun: column(helperHeaders, [/^so(?:nntag)?$/], 6),
    note: column(
      helperHeaders,
      [/^bemerkung$/, /^hinweis(?: für pdf)?$/, /^notiz$/],
      -1
    ),
    confirmed: column(helperHeaders, [/^bestätigt\??$/, /^bestaetigt\??$/], 8),
  };
  for (const row of helperRows.slice(
    helperHeader >= 0 ? helperHeader + 1 : 9
  )) {
    const contactName = String(row?.[helperColumns.contact] ?? "").trim();
    const name = String(row?.[helperColumns.name] ?? "").trim();
    if (!name || /name helfer/i.test(name)) continue;
    if (skipHelperKeys.has(db.normalizePersonName(name))) {
      result.uebersprungen++;
      continue;
    }
    const upserted = await db.upsertHelperByName({
      name,
      contactId: contactIdByName.get(key(contactName)) ?? null,
      email: String(row?.[helperColumns.email] ?? "").trim() || undefined,
      phone: String(row?.[helperColumns.phone] ?? "").trim() || undefined,
      note: String(row?.[helperColumns.note] ?? "").trim() || undefined,
      willHelp:
        availability(row?.[helperColumns.willHelp]) === "nein" ? "nein" : "ja",
      availFri: availability(row?.[helperColumns.fri]),
      availSat: availability(row?.[helperColumns.sat]),
      availSun: availability(row?.[helperColumns.sun]),
      confirmed:
        availability(row?.[helperColumns.confirmed]) === "ja" ? "ja" : "nein",
    });
    if (upserted.created) result.helfer++;
    else result.aktualisiert++;
  }

  const contacts = await db.listContacts();
  const contactId = (name: unknown) =>
    contacts.find(item => key(item.name) === key(name))?.id ?? null;

  const prepKeys = new Set((await db.listPrep()).map(item => key(item.task)));
  const prepRows = sheet("VORBEREITUNG");
  const prepHeader = findHeader(prepRows, [/^aufgabe$/]);
  const prepHeaders = prepHeader >= 0 ? prepRows[prepHeader] : [];
  const prepColumns = {
    task: column(prepHeaders, [/^aufgabe$/], 0),
    dueText: column(
      prepHeaders,
      [/^zu erledigen bis$/, /^frist$/, /^fällig(?:keit)?$/],
      -1
    ),
    contact: column(prepHeaders, [/^verantwortlich$/], 2),
    status: column(prepHeaders, [/^status$/], 3),
    note: column(prepHeaders, [/^bemerkung$/, /^notiz$/], 4),
  };
  for (const row of prepRows.slice(prepHeader >= 0 ? prepHeader + 1 : 8)) {
    const task = String(row?.[prepColumns.task] ?? "").trim();
    if (!task || /^aufgabe$/i.test(task)) continue;
    if (prepKeys.has(key(task))) {
      result.uebersprungen++;
      continue;
    }
    await db.createPrep({
      task,
      dueText:
        prepColumns.dueText >= 0
          ? String(row?.[prepColumns.dueText] ?? "").trim()
          : "",
      contactId: contactId(row?.[prepColumns.contact]),
      status: statusMap(String(row?.[prepColumns.status] ?? "")),
      note: String(row?.[prepColumns.note] ?? "").trim() || undefined,
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
  await db.syncContactsToSelfHelpers();
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
    shifts.map(shift => {
      const assigned = byShift.get(shift.id) ?? [];
      return {
        Tag: shift.day,
        Bereich: shift.area,
        Aufgabe: shift.task,
        Beginn: shift.startTime,
        Ende: shift.endTime,
        Bedarf: shift.needed,
        Bemerkung: shift.note ?? "",
        ...Object.fromEntries(
          Array.from({ length: 20 }, (_, slot) => [
            `Helfer ${slot + 1}`,
            assigned[slot] ?? "",
          ])
        ),
      };
    })
  );
  add(
    "VORBEREITUNG",
    (await db.listPrep()).map(item => ({
      Aufgabe: item.task,
      "Zu erledigen bis": item.dueText,
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
