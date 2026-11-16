import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleApi, ferryPath } from '../src/api.js';
import { handleMcp } from '../src/mcp.js';

// Tests gehen nie ins Netz: Ortssuche, Routen- und Fährdienst antworten als nicht erreichbar.
globalThis.fetch = async () => new Response('', { status: 503 });

// Kleinster D1-Ersatz über node:sqlite, nur die Methoden, die der Code nutzt.
function env() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => void db.prepare(sql).run(...args),
  });
  return { DB: { prepare: sql => stmt(sql) } };
}

const call = async (e, method, path, body) => {
  const r = await handleApi(new Request(`https://x/api/trips${path}`, { method, body: body && JSON.stringify(body) }), e);
  return { status: r.status, data: await r.json() };
};
const item = { title: 'Preikestolen', kind: 'aktivitaet', lat: 58.98, lon: 6.19, date: '2027-07-02', time: '09:00' };

test('Admin kann anlegen, ändern, löschen', async () => {
  const e = env();
  const { data: t } = await call(e, 'POST', '', { name: 'Norwegen' });
  const made = await call(e, 'POST', `/${t.adminKey}/items`, item);
  assert.equal(made.status, 201);
  assert.equal((await call(e, 'PUT', `/${t.adminKey}/items/${made.data.id}`, { ...item, title: 'Kjerag' })).status, 200);
  let trip = (await call(e, 'GET', `/${t.adminKey}`)).data;
  assert.equal(trip.role, 'admin');
  assert.equal(trip.items[0].title, 'Kjerag');
  assert.equal((await call(e, 'DELETE', `/${t.adminKey}/items/${made.data.id}`)).status, 200);
  trip = (await call(e, 'GET', `/${t.adminKey}`)).data;
  assert.equal(trip.items.length, 0);
});

test('Viewer kann lesen, aber nichts ändern', async () => {
  const e = env();
  const { data: t } = await call(e, 'POST', '', { name: 'Norwegen' });
  const { data: made } = await call(e, 'POST', `/${t.adminKey}/items`, item);
  const v = `/${t.viewKey}`;
  const seen = await call(e, 'GET', v);
  assert.equal(seen.data.role, 'viewer');
  assert.equal(seen.data.items.length, 1);
  assert.ok(!JSON.stringify(seen.data).includes(t.adminKey), 'Admin-Schlüssel darf nicht beim Viewer landen');
  for (const [m, p, b] of [
    ['POST', `${v}/items`, item], ['PUT', `${v}/items/${made.id}`, item], ['DELETE', `${v}/items/${made.id}`],
    ['PATCH', v, { name: 'x' }], ['POST', `${v}/rotate`], ['DELETE', v],
  ]) assert.equal((await call(e, m, p, b)).status, 403, `${m} ${p}`);
  assert.equal((await call(e, 'GET', v)).data.items[0].title, item.title);
});

test('Unbekannter Schlüssel bekommt nichts', async () => {
  const e = env();
  await call(e, 'POST', '', { name: 'Norwegen' });
  assert.equal((await call(e, 'GET', '/falsch')).status, 404);
  assert.equal((await call(e, 'POST', '/falsch/items', item)).status, 404);
});

test('Einträge fremder Reisen sind nicht erreichbar', async () => {
  const e = env();
  const a = (await call(e, 'POST', '', { name: 'A' })).data, b = (await call(e, 'POST', '', { name: 'B' })).data;
  const { data: made } = await call(e, 'POST', `/${a.adminKey}/items`, item);
  assert.equal((await call(e, 'PUT', `/${b.adminKey}/items/${made.id}`, item)).status, 404);
  assert.equal((await call(e, 'DELETE', `/${b.adminKey}/items/${made.id}`)).status, 404);
});

test('Links erneuern macht alte Schlüssel ungültig', async () => {
  const e = env();
  const { data: t } = await call(e, 'POST', '', { name: 'Norwegen' });
  const { data: neu } = await call(e, 'POST', `/${t.adminKey}/rotate`);
  assert.equal((await call(e, 'GET', `/${t.adminKey}`)).status, 404);
  assert.equal((await call(e, 'GET', `/${t.viewKey}`)).status, 404);
  assert.equal((await call(e, 'GET', `/${neu.adminKey}`)).status, 200);
});

test('Eingaben werden geprüft', async () => {
  const e = env();
  const { data: t } = await call(e, 'POST', '', { name: 'Norwegen' });
  for (const bad of [
    { ...item, title: ' ' }, { ...item, kind: 'x' }, { ...item, lat: 91 }, { ...item, lon: undefined },
    { ...item, date: '2.7.2027' }, { ...item, end_date: '2027-07-01' }, { ...item, url: 'javascript:alert(1)' },
    { ...item, date: null }, { ...item, note: 5 },
  ]) assert.equal((await call(e, 'POST', `/${t.adminKey}/items`, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call(e, 'POST', `/${t.adminKey}/items`, { title: 'Idee', kind: 'sonstiges' })).status, 201);
  assert.equal((await call(e, 'POST', '', { name: '' })).status, 400);
});

test('Tagesausflüge gehören zu einem Aufenthalt, Bilder werden geprüft', async () => {
  const e = env();
  const { data: t } = await call(e, 'POST', '', { name: 'Norwegen' });
  const items = `/${t.adminKey}/items`;
  const { data: hut } = await call(e, 'POST', items, { title: 'Hütte', kind: 'unterkunft', date: '2027-07-01', end_date: '2027-07-08' });
  const { data: other } = await call(e, 'POST', items, item);
  const trip = { ...item, title: 'Gletscher', parent_id: hut.id, images: ['https://x.test/a.jpg', 'https://x.test/b.jpg'] };
  const made = await call(e, 'POST', items, trip);
  assert.equal(made.status, 201);
  assert.equal(made.data.images, 'https://x.test/a.jpg\nhttps://x.test/b.jpg');
  for (const bad of [
    { ...trip, parent_id: other.id }, { ...trip, parent_id: 999 }, { ...trip, kind: 'unterkunft' },
    { ...trip, images: 'javascript:alert(1)' }, { ...trip, images: Array(7).fill('https://x.test/a.jpg') },
  ]) assert.equal((await call(e, 'POST', items, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call(e, 'PUT', `${items}/${hut.id}`, { title: 'Hütte', kind: 'unterkunft', parent_id: hut.id })).status, 400);
  await call(e, 'DELETE', `${items}/${hut.id}`);
  const left = (await call(e, 'GET', `/${t.adminKey}`)).data.items.find(i => i.id === made.data.id);
  assert.equal(left.parent_id, null, 'Tagesausflug bleibt ohne Aufenthalt erhalten');
});

test('MCP: Reise anlegen, Eintrag anlegen und teilweise ändern, Viewer gesperrt', async () => {
  const e = env();
  const rpc = async (method, params) => {
    const r = await handleMcp(new Request('https://x/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }), e);
    return (await r.json()).result;
  };
  const tool = async (name, args) => {
    const r = await rpc('tools/call', { name, arguments: args });
    return { error: r.isError, data: JSON.parse(r.content[0].text) };
  };
  assert.equal((await rpc('initialize', { protocolVersion: '2025-06-18' })).protocolVersion, '2025-06-18');
  assert.equal((await rpc('tools/list')).tools.length, 7);
  const { data: t } = await tool('create_trip', { name: 'Schweden' });
  const { data: made } = await tool('add_item', { key: t.adminLink, title: 'Stockholm', kind: 'aktivitaet', date: '2027-07-10' });
  await tool('update_item', { key: t.adminLink, id: made.id, note: 'Vasa-Museum' });
  const { data: trip } = await tool('get_trip', { key: t.viewerLink });
  assert.deepEqual([trip.items[0].title, trip.items[0].note, trip.items[0].author], ['Stockholm', 'Vasa-Museum', 'Claude']);
  assert.equal((await tool('add_item', { key: t.viewerLink, title: 'x', kind: 'fahrt' })).error, true);
  // Bilder als Liste, Fähre als Weiterfahrt, Streckenübersicht
  const pics = await tool('update_item', { key: t.adminLink, id: made.id, images: ['https://x.test/a.jpg'], lat: 59.33, lon: 18.07, leg: 'faehre' });
  assert.equal(pics.data.images, 'https://x.test/a.jpg');
  await tool('add_item', { key: t.adminLink, title: 'Helsinki', kind: 'aktivitaet', date: '2027-07-11', lat: 60.17, lon: 24.94 });
  const { data: legs } = await tool('get_routes', { key: t.viewerLink });
  assert.deepEqual([legs.length, legs[0].mode, legs[0].to.title, legs[0].luftlinie_km > 350], [1, 'faehre', 'Helsinki', true]);
  assert.equal((await tool('update_item', { key: t.adminLink, id: made.id, leg: 'rakete' })).error, true);
  assert.equal((await tool('update_item', { key: t.adminLink, id: made.id, leg: '' })).data.leg, null);
});

test('Fährverlauf: durchgehende Linie, zwei Teilstücke, nichts Passendes', () => {
  const bergen = [60.39, 5.32], stavanger = [58.92, 5.58], hirtshals = [57.59, 9.96], kiel = [54.32, 10.14];
  const direct = [hirtshals, [58.5, 8], bergen];                      // andersherum erfasst
  const part1 = [bergen, [59.5, 5.2], stavanger], part2 = [hirtshals, [58, 8], stavanger];
  const other = [bergen, [61, 5]];
  assert.deepEqual(ferryPath([other, direct], bergen, hirtshals), [bergen, [58.5, 8], hirtshals]);
  assert.deepEqual(ferryPath([other, part1, part2], bergen, hirtshals), [bergen, [59.5, 5.2], stavanger, stavanger, [58, 8], hirtshals]);
  assert.equal(ferryPath([other, part1], bergen, kiel), null);
});
