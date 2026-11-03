#!/usr/bin/env node
// Einmalig im Wartungsfenster (keine parallelen Deployments/DDL): node /app/scripts/retire-public-demo-data.mjs [--dry-run|--apply]
// DATABASE_URL erforderlich; BACKUP_DIR optional. Keine Uploadlöschung, kein Scheduler, keine App-Imports.
import mysql from 'mysql2/promise';
import { open, mkdir, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const TECH = /^tenant-admin:demo-session-[a-z0-9_-]+@beispiel\.invalid$/;
const MARKER = 'Automatisch angelegte, temporäre öffentliche Vereinsdemo';
const q = name => '`' + name.replaceAll('`', '``') + '`';
const same = (a, b) => a != null && b != null && String(a) === String(b);
const digest = value => createHash('sha256').update(value).digest('hex');
export function mode(args) {
  if (args.some(a => !['--apply', '--dry-run'].includes(a)) || new Set(args).size !== args.length || args.length > 1) throw Error('invalid_flags');
  return args[0] === '--apply';
}
export function technicalUser(user, credentials = []) {
  const email = user?.openId?.slice('tenant-admin:'.length);
  return Boolean(TECH.test(user?.openId ?? '') && (!user.email || user.email === email) && credentials.every(c => c.email === email));
}
export function sqlValue(value) {
  if (value === null) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('unsupported_value');
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw Error('unsupported_value');
  return mysql.escape(value);
}
const owns = (plan, table, row) => plan.get(table)?.has(row) ?? false;
const userColumns = table => table.columns.filter(c => /userId$|openId$/i.test(c.name));
function reference(row, user, columns) {
  return columns.some(c => /openId$/i.test(c.name) ? row[c.name] === user.openId : same(row[c.name], user.id));
}
function foreignEffects(plan, tables, fks, ignored = new Map()) {
  return fks.some(fk => {
    const parentKeys = new Set([...plan.get(fk.parent) ?? []].map(r => JSON.stringify(fk.parts.map(p => String(r[p.parentColumn])))));
    return tables.get(fk.child).rows.some(r => !owns(plan, fk.child, r) && !owns(ignored, fk.child, r) && fk.parts.every(p => r[p.column] != null) && parentKeys.has(JSON.stringify(fk.parts.map(p => String(r[p.column])))));
  });
}
export function tenantPlan(id, tables, fks) {
  const data = name => tables.get(name)?.rows ?? [];
  const tenant = data('tenants').find(r => r.id === id);
  if (!id.startsWith('mycrewmate-demo-') || tenant?.status !== 'sample' || !data('tenant_product_assignments').some(r => r.tenantId === id && r.internalNote?.includes(MARKER))) return { reason: 'identity_markers_missing' };
  const memberships = data('user_tenant_memberships').filter(r => r.tenantId === id);
  const users = data('users');
  if (!memberships.some(r => r.role === 'tenant_admin') || memberships.some(m => {
    const u = users.find(r => same(r.id, m.userId));
    return !technicalUser(u, data('tenant_admin_credentials').filter(c => same(c.userId, m.userId))) || data('user_tenant_memberships').some(r => same(r.userId, m.userId) && r.tenantId !== id);
  })) return { reason: 'real_or_shared_membership' };
  const events = new Set(data('events').filter(r => r.tenantId === id).map(r => String(r.id)));
  const plan = new Map();
  for (const [name, table] of tables) {
    const selected = table.rows.filter(r => name === 'tenants' ? r.id === id : table.columns.some(c => c.name === 'tenantId') ? r.tenantId === id : table.columns.some(c => c.name === 'eventId') && events.has(String(r.eventId)));
    if (selected.some(r => r.eventId != null && !events.has(String(r.eventId)))) return { reason: 'foreign_event_scope' };
    if (selected.length) plan.set(name, new Set(selected));
  }
  const contacts = new Set([...plan.get('contacts') ?? []].map(r => String(r.id)));
  const accesses = data('planning_team_accesses').filter(a => contacts.has(String(a.contactId)) || data('planning_team_access_events').some(r => same(r.accessId, a.id) && events.has(String(r.eventId))));
  for (const a of accesses) {
    if ((a.contactId != null && !contacts.has(String(a.contactId))) || data('planning_team_access_events').some(r => same(r.accessId, a.id) && !events.has(String(r.eventId))) || data('planning_team_invitations').some(r => same(r.accessId, a.id) && r.tenantId !== id) || users.some(u => u.openId === `planning-team-access-${a.id}`)) return { reason: 'foreign_planning_access' };
  }
  if (accesses.length) plan.set('planning_team_accesses', new Set(accesses));
  const helpers = new Set([...plan.get('helpers') ?? []].map(r => String(r.id)));
  const shares = data('protected_helper_pdf_shares').filter(r => helpers.has(String(r.helperId)));
  if (shares.length) plan.set('protected_helper_pdf_shares', new Set(shares));
  // Auch nicht deklarierte User-/OpenID-Bezüge schützen echte Konten und fremde Vereinsdaten.
  for (const [name, rows] of plan) {
    if ([...rows].some(r => userColumns(tables.get(name)).some(c => r[c.name] != null && !users.some(u => reference(r, u, [c]) && technicalUser(u, data('tenant_admin_credentials').filter(k => same(k.userId, u.id))))))) return { reason: 'real_account_reference' };
  }
  for (const fk of fks.filter(f => f.parent === 'users')) if ([...plan.get(fk.child) ?? []].some(r => fk.parts.every(p => r[p.column] != null) && !users.some(u => fk.parts.every(p => same(r[p.column], u[p.parentColumn])) && technicalUser(u, data('tenant_admin_credentials').filter(c => same(c.userId, u.id)))))) return { reason: 'real_account_reference' };
  for (const fk of fks.filter(f => !['users', 'event_years'].includes(f.parent))) {
    if ([...plan.get(fk.child) ?? []].some(r => fk.parts.every(p => r[p.column] != null) && ![...plan.get(fk.parent) ?? []].some(p => fk.parts.every(k => same(r[k.column], p[k.parentColumn]))))) return { reason: 'foreign_or_ambiguous_reference' };
  }
  if (foreignEffects(plan, tables, fks)) return { reason: 'foreign_or_ambiguous_reference' };
  try { deletionOrder(plan.keys(), fks); } catch { return { reason: 'cyclic_foreign_keys' }; }
  return { plan, events: events.size };
}
export function userPlan(user, tables, fks, removed) {
  const remaining = name => (tables.get(name)?.rows ?? []).filter(r => !owns(removed, name, r));
  const credentials = remaining('tenant_admin_credentials').filter(r => same(r.userId, user.id));
  const remainingMembership = remaining('user_tenant_memberships').filter(r => same(r.userId, user.id)).length;
  if (!technicalUser(user, credentials) || remainingMembership !== 0) return null;
  const plan = new Map([['users', new Set([user])], ['tenant_admin_credentials', new Set(credentials)], ['mfa_login_challenges', new Set(remaining('mfa_login_challenges').filter(r => same(r.userId, user.id) && r.subjectType === 'tenant_admin'))]]);
  for (const [name, table] of tables) if (remaining(name).some(r => !owns(plan, name, r) && reference(r, user, userColumns(table)))) return null;
  return foreignEffects(plan, tables, fks, removed) ? null : plan;
}
export function deletionOrder(tables, fks) {
  const pending = new Set(tables), result = [];
  while (pending.size) {
    const leaf = [...pending].find(t => !fks.some(f => f.parent === t && f.child !== t && pending.has(f.child)));
    if (!leaf) throw Error('cyclic_foreign_keys');
    result.push(leaf); pending.delete(leaf);
  }
  return result;
}
async function metadata(db) {
  const [list] = await db.query("SELECT TABLE_NAME name, ENGINE engine, TABLE_TYPE kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME");
  const [[objects]] = await db.query('SELECT (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()) + (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()) + (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()) AS n');
  if (!list.length || list.some(t => t.kind !== 'BASE TABLE' || t.engine !== 'InnoDB') || Number(objects.n)) throw Error('unsupported_database_objects');
  const [columns] = await db.query('SELECT TABLE_NAME t, COLUMN_NAME name, EXTRA extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION');
  const [keys] = await db.query('SELECT k.TABLE_NAME child, k.CONSTRAINT_NAME name, k.COLUMN_NAME `column`, k.REFERENCED_TABLE_NAME parent, k.REFERENCED_COLUMN_NAME parentColumn, k.REFERENCED_TABLE_SCHEMA parentSchema, r.DELETE_RULE rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION');
  const [[schema]] = await db.query('SELECT DATABASE() name');
  if (keys.some(k => k.parentSchema !== schema.name)) throw Error('external_foreign_keys');
  const [external] = await db.query('SELECT COUNT(*) n FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND TABLE_SCHEMA<>DATABASE()');
  if (Number(external[0].n)) throw Error('external_foreign_keys');
  const fks = [...Map.groupBy(keys, k => k.child + ':' + k.name).values()].map(parts => ({ ...parts[0], parts }));
  const tables = new Map(list.map(t => [t.name, { columns: columns.filter(c => c.t === t.name), rows: [] }]));
  for (const [name, required] of Object.entries({ tenants: ['id', 'status'], users: ['id', 'openId', 'email'], user_tenant_memberships: ['userId', 'tenantId', 'role'], tenant_product_assignments: ['tenantId', 'internalNote'], events: ['id', 'tenantId'], tenant_admin_credentials: ['userId', 'email'], planning_team_accesses: ['id', 'contactId'], planning_team_access_events: ['accessId', 'eventId'] })) if (required.some(c => !tables.get(name)?.columns.some(v => v.name === c))) throw Error('required_schema_missing');
  return { tables, fks };
}
async function snapshot(db, tables, output) {
  const fingerprints = [];
  for (const [name, table] of tables) {
    const [[ddl]] = await db.query(`SHOW CREATE TABLE ${q(name)}`);
    [table.rows] = await db.query(`SELECT * FROM ${q(name)}`);
    const columns = table.columns.filter(c => !/(VIRTUAL|STORED) GENERATED/.test(c.extra));
    const rows = table.rows.map(r => '(' + columns.map(c => sqlValue(r[c.name])).join(',') + ')').sort();
    fingerprints.push(digest(ddl['Create Table'] + '\n' + rows.join('\n')));
    if (output) {
      await output.writeFile(ddl['Create Table'] + ';\n');
      for (const row of rows) await output.writeFile(`INSERT INTO ${q(name)} (${columns.map(c => q(c.name)).join(',')}) VALUES ${row};\n`);
    }
  }
  return digest(JSON.stringify(fingerprints));
}
async function privateFile(path, content) {
  const file = await open(path, 'wx', 0o600);
  try { await file.chmod(0o600); await file.writeFile(content); await file.sync(); } finally { await file.close(); }
}
async function main() {
  const apply = mode(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw Error('database_url_missing');
  const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, jsonStrings: true, multipleStatements: false, timezone: 'Z' });
  const counts = { mode: apply ? 'apply' : 'dry-run', tenants: 0, events: 0, users: 0, rows: 0, fileKeys: 0, skipped: {} };
  const skip = reason => { counts.skipped[reason] = (counts.skipped[reason] ?? 0) + 1; };
  let output;
  try {
    await db.query("SET SESSION time_zone='+00:00'");
    await db.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const { tables, fks } = await metadata(db);
    let directory, stem;
    if (apply) {
      directory = resolve(process.env.BACKUP_DIR || '/app/data/backups/demo-retirement');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      stem = resolve(directory, 'retirement-' + randomUUID());
      output = await open(stem + '.sql.partial', 'wx', 0o600); await output.chmod(0o600);
      await output.writeFile("-- Full database table backup; restore only into an empty database.\nSET NAMES utf8mb4;\nSET time_zone='+00:00';\nSET sql_mode='NO_AUTO_VALUE_ON_ZERO';\nSET FOREIGN_KEY_CHECKS=0;\n");
    }
    const before = await snapshot(db, tables, output);
    if (output) { await output.writeFile('SET FOREIGN_KEY_CHECKS=1;\n-- COMPLETE\n'); await output.sync(); await output.close(); output = null; await rename(stem + '.sql.partial', stem + '.sql'); }
    await db.commit();
    if (apply) {
      // Vollbackup ist geschlossen + fsync, bevor eine neue Schreibtransaktion beginnt.
      const dir = await open(directory, 'r'); try { await dir.sync(); } finally { await dir.close(); }
      await db.query('SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE'); await db.beginTransaction();
      const fresh = await metadata(db);
      if (JSON.stringify([...fresh.tables.keys()]) !== JSON.stringify([...tables.keys()]) || await snapshot(db, fresh.tables) !== before) throw Error('database_changed_since_backup');
      tables.clear(); for (const [name, table] of fresh.tables) tables.set(name, table);
    }
    const removed = new Map(), plans = [];
    for (const tenant of tables.get('tenants').rows.filter(r => r.id.startsWith('mycrewmate-demo-'))) {
      const result = tenantPlan(tenant.id, tables, fks);
      if (result.reason) { skip(result.reason); continue; }
      plans.push(result.plan); counts.tenants++; counts.events += result.events;
      for (const [name, rows] of result.plan) { if (!removed.has(name)) removed.set(name, new Set()); for (const row of rows) removed.get(name).add(row); }
    }
    for (const user of tables.get('users').rows.filter(u => TECH.test(u.openId))) {
      const plan = userPlan(user, tables, fks, removed);
      if (!plan) { skip('technical_user_has_remaining_or_ambiguous_reference'); continue; }
      plans.push(plan); counts.users++;
    }
    const inventory = [];
    for (const plan of plans) for (const [name, rows] of plan) for (const row of rows) {
      counts.rows++;
      for (const column of tables.get(name).columns.filter(c => /(?:file|logo|storage|upload)Key$/i.test(c.name))) if (row[column.name]) inventory.push({ table: name, column: column.name, key: row[column.name] });
    }
    counts.fileKeys = new Set(inventory.map(i => i.key)).size;
    if (apply) {
      await privateFile(stem + '.file-keys.json', JSON.stringify({ backupDigest: before, uploadsDeleted: false, inventory }, null, 2) + '\n');
      const dir = await open(directory, 'r'); try { await dir.sync(); } finally { await dir.close(); }
      for (const plan of plans) for (const name of deletionOrder(plan.keys(), fks)) {
        const table = tables.get(name);
        for (const row of plan.get(name)) {
          if (name === 'users') { const [[{ remainingMembership }]] = await db.query('SELECT COUNT(*) remainingMembership FROM user_tenant_memberships WHERE userId=?', [row.id]); if (Number(remainingMembership) !== 0) throw Error('remaining_membership'); }
          // Alle Werte gebunden, auch eventId UND tenantId (falls vorhanden); SET-NULL-Reste zuerst durch FK-Reihenfolge.
          await db.execute(`DELETE FROM ${q(name)} WHERE ${table.columns.map(c => q(c.name) + ' <=> ?').join(' AND ')}`, table.columns.map(c => row[c.name]));
        }
      }
      await db.commit();
    }
    console.log(JSON.stringify(counts));
  } finally { if (output) await output.close(); await db.rollback().catch(() => {}); await db.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error(JSON.stringify({ error: 'retirement_aborted_no_partial_commit', advice: 'check_flags_schema_backup_permissions_or_concurrent_changes' })); process.exitCode = 1; });
