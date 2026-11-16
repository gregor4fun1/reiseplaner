const KINDS = ['unterkunft', 'aktivitaet', 'fahrt', 'sonstiges'];
const FIELDS = ['title', 'kind', 'place', 'lat', 'lon', 'date', 'end_date', 'time', 'note', 'url', 'author', 'images', 'parent_id', 'leg'];
const LEGS = ['faehre', 'flug', 'zug']; // Weiterfahrt zur nächsten Station, sonst Auto
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const POINT = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const err = (status, error) => json({ error }, status);
const newKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const tripName = b => (typeof b?.name === 'string' && b.name.trim().slice(0, 100)) || null;

// Gibt den geprüften Eintrag zurück oder einen Fehlertext.
function cleanItem(b) {
  if (!b || typeof b !== 'object') return 'Ungültige Daten';
  const s = (v, max) => (v == null || v === '' ? null : typeof v === 'string' && v.length <= max ? v.trim() || null : undefined);
  const it = {
    title: s(b.title, 200), kind: b.kind, place: s(b.place, 200), lat: b.lat ?? null, lon: b.lon ?? null,
    date: s(b.date, 10), end_date: s(b.end_date, 10), time: s(b.time, 5),
    note: s(b.note, 5000), url: s(b.url, 2000), author: s(b.author, 50),
    images: s(Array.isArray(b.images) ? b.images.join('\n') : b.images, 3000), parent_id: b.parent_id ?? null, leg: s(b.leg, 10),
  };
  if (Object.values(it).includes(undefined)) return 'Ein Feld ist zu lang oder hat den falschen Typ';
  if (!it.title) return 'Titel fehlt';
  if (!KINDS.includes(it.kind)) return 'Unbekannte Art';
  if ((it.lat === null) !== (it.lon === null)) return 'Koordinaten unvollständig';
  if (it.lat !== null && !(typeof it.lat === 'number' && typeof it.lon === 'number' && Math.abs(it.lat) <= 90 && Math.abs(it.lon) <= 180))
    return 'Ungültige Koordinaten';
  if (it.date && !DATE.test(it.date)) return 'Ungültiges Datum';
  if (it.end_date && (!it.date || !DATE.test(it.end_date) || it.end_date < it.date)) return 'Ungültiges Enddatum';
  if (it.time && (!it.date || !TIME.test(it.time))) return 'Uhrzeit braucht ein Datum im Format HH:MM';
  // Nur http(s), sonst könnte ein Link Skript ausführen.
  if (it.url && !/^https?:\/\//i.test(it.url)) return 'Link muss mit http:// oder https:// beginnen';
  if (it.images) {
    const list = it.images.split('\n').map(u => u.trim()).filter(Boolean);
    if (list.length > 6 || list.some(u => !/^https?:\/\/\S+$/i.test(u))) return 'Bilder: höchstens 6 Links, je einer pro Zeile, mit http:// oder https://';
    it.images = list.join('\n') || null;
  }
  if (it.leg && !LEGS.includes(it.leg)) return 'Weiterfahrt muss faehre, flug oder zug sein (leer = Auto)';
  if (it.parent_id !== null && !Number.isInteger(it.parent_id)) return 'Ungültiger Aufenthalt';
  if (it.parent_id !== null && it.kind === 'unterkunft') return 'Ein Aufenthalt kann nicht zu einem anderen Aufenthalt gehören';
  return it;
}

async function geocode(q) {
  if (!q || q.length > 200) return err(400, 'Suchbegriff fehlt');
  const r = await fetch(`https://photon.komoot.io/api/?limit=5&lang=de&q=${encodeURIComponent(q)}`);
  if (!r.ok) return err(502, 'Ortssuche nicht erreichbar');
  const { features = [] } = await r.json();
  return json(features.map(f => {
    const p = f.properties || {};
    return {
      name: [...new Set([p.name, p.city, p.state, p.country].filter(Boolean))].join(', '),
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
    };
  }));
}

// null heißt: keine Straßenroute, die Oberfläche zeichnet eine gerade Linie.
async function routeData(db, env, from, to) {
  const k = `${from};${to}`;
  const hit = await db.prepare('SELECT json FROM routes WHERE k = ?').bind(k).first();
  if (hit) return JSON.parse(hit.json);
  if (!env.ORS_KEY) return null;
  const flip = p => p.split(',').reverse().join(','); // OpenRouteService erwartet lon,lat
  const r = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${env.ORS_KEY}&start=${flip(from)}&end=${flip(to)}`);
  if (!r.ok) return null;
  const f = (await r.json()).features?.[0];
  if (!f) return null;
  const out = {
    coords: f.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    km: f.properties.summary.distance / 1000,
    min: f.properties.summary.duration / 60,
  };
  await db.prepare('INSERT OR REPLACE INTO routes (k, json) VALUES (?, ?)').bind(k, JSON.stringify(out)).run();
  return out;
}

// Übersicht aller Strecken einer Reise, damit man sie prüfen kann (vor allem per MCP).
// Reihenfolge wie in der Oberfläche: Stationen nach Datum und Uhrzeit, dazu Tagesausflüge ab ihrem Aufenthalt.
async function routesOverview(db, env, items) {
  const pt = i => `${i.lat.toFixed(5)},${i.lon.toFixed(5)}`;
  const rad = d => d * Math.PI / 180;
  const air = (a, b) => 12742 * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2));
  const order = i => i.date + (i.time || '99');
  const chain = items.filter(i => i.date && i.lat != null && !i.parent_id).sort((a, b) => order(a).localeCompare(order(b)) || a.id - b.id);
  const pairs = chain.slice(1).map((b, n) => [chain[n], b, chain[n].leg || 'auto', 'station']);
  for (const i of items) {
    const stay = i.parent_id && items.find(p => p.id === i.parent_id);
    if (stay && stay.lat != null && i.lat != null) pairs.push([stay, i, 'auto', 'tagesausflug']);
  }
  const out = [];
  for (const [a, b, mode, type] of pairs) {
    const leg = { from: { id: a.id, title: a.title }, to: { id: b.id, title: b.title }, type, mode, luftlinie_km: Math.round(air(a, b)) };
    if (mode === 'auto' && pt(a) !== pt(b)) {
      const r = await routeData(db, env, pt(a), pt(b));
      if (r) {
        const step = Math.ceil(r.coords.length / 12);
        Object.assign(leg, { km: Math.round(r.km), min: Math.round(r.min), verlauf: r.coords.filter((_, n) => n % step === 0).map(([la, lo]) => [+la.toFixed(3), +lo.toFixed(3)]) });
      } else leg.hinweis = 'Keine Straßenroute gefunden, die Karte zeigt eine gerade Linie.';
    }
    out.push(leg);
  }
  return out;
}

export async function handleApi(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const [root, key, sub, id] = url.pathname.replace(/^\/api\//, '').split('/');
  const m = request.method;
  if (root !== 'trips') return err(404, 'Nicht gefunden');
  const body = m === 'GET' || m === 'DELETE' ? null : await request.json().catch(() => null);

  if (!key) {
    if (m !== 'POST') return err(405, 'Nicht erlaubt');
    const name = tripName(body);
    if (!name) return err(400, 'Name fehlt');
    const adminKey = newKey(), viewKey = newKey();
    await db.prepare('INSERT INTO trips (name, admin_key, view_key) VALUES (?, ?, ?)').bind(name, adminKey, viewKey).run();
    return json({ name, adminKey, viewKey }, 201);
  }

  const trip = await db.prepare('SELECT * FROM trips WHERE admin_key = ? OR view_key = ?').bind(key, key).first();
  if (!trip) return err(404, 'Reise nicht gefunden');
  const admin = trip.admin_key === key;
  // Die Rolle kommt nur aus dem Schlüssel: alles außer Lesen braucht den Admin-Schlüssel.
  if (m !== 'GET' && !admin) return err(403, 'Nur mit Admin-Link möglich');

  if (!sub) {
    if (m === 'GET') {
      const { results } = await db.prepare(`SELECT id, ${FIELDS.join(', ')} FROM items WHERE trip_id = ? ORDER BY id`).bind(trip.id).all();
      return json({ name: trip.name, role: admin ? 'admin' : 'viewer', viewKey: trip.view_key, items: results });
    }
    if (m === 'PATCH') {
      const name = tripName(body);
      if (!name) return err(400, 'Name fehlt');
      await db.prepare('UPDATE trips SET name = ? WHERE id = ?').bind(name, trip.id).run();
      return json({ name });
    }
    if (m === 'DELETE') {
      await db.prepare('DELETE FROM items WHERE trip_id = ?').bind(trip.id).run();
      await db.prepare('DELETE FROM trips WHERE id = ?').bind(trip.id).run();
      return json({ ok: true });
    }
  }

  if (sub === 'rotate' && m === 'POST') {
    const adminKey = newKey(), viewKey = newKey();
    await db.prepare('UPDATE trips SET admin_key = ?, view_key = ? WHERE id = ?').bind(adminKey, viewKey, trip.id).run();
    return json({ adminKey, viewKey });
  }
  if (sub === 'geocode' && m === 'GET') return geocode(url.searchParams.get('q'));
  if (sub === 'route' && m === 'GET') {
    const from = url.searchParams.get('from') || '', to = url.searchParams.get('to') || '';
    if (!POINT.test(from) || !POINT.test(to)) return err(400, 'Ungültige Punkte');
    return json(await routeData(db, env, from, to));
  }
  if (sub === 'routes' && m === 'GET') {
    const { results } = await db.prepare(`SELECT id, ${FIELDS.join(', ')} FROM items WHERE trip_id = ?`).bind(trip.id).all();
    return json(await routesOverview(db, env, results));
  }

  // Tagesausflüge bleiben erhalten, wenn ihr Aufenthalt gelöscht wird oder keiner mehr ist.
  const orphan = stayId => db.prepare('UPDATE items SET parent_id = NULL WHERE parent_id = ? AND trip_id = ?').bind(stayId, trip.id).run();

  if (sub === 'items') {
    if (m === 'DELETE' && id) {
      const gone = await db.prepare('DELETE FROM items WHERE id = ? AND trip_id = ? RETURNING id').bind(Number(id), trip.id).first();
      if (gone) await orphan(Number(id));
      return gone ? json({ ok: true }) : err(404, 'Eintrag nicht gefunden');
    }
    const it = cleanItem(body);
    if (typeof it === 'string') return err(400, it);
    if (it.parent_id !== null) {
      const stay = await db.prepare("SELECT id FROM items WHERE id = ? AND trip_id = ? AND kind = 'unterkunft'").bind(it.parent_id, trip.id).first();
      if (!stay || it.parent_id === Number(id)) return err(400, 'Aufenthalt nicht gefunden');
    }
    const values = FIELDS.map(f => it[f]);
    if (m === 'POST' && !id) {
      const row = await db.prepare(`INSERT INTO items (trip_id, ${FIELDS.join(', ')}) VALUES (?, ${FIELDS.map(() => '?').join(', ')}) RETURNING id`)
        .bind(trip.id, ...values).first();
      return json({ id: row.id, ...it }, 201);
    }
    if (m === 'PUT' && id) {
      const row = await db.prepare(`UPDATE items SET ${FIELDS.map(f => `${f} = ?`).join(', ')} WHERE id = ? AND trip_id = ? RETURNING id`)
        .bind(...values, Number(id), trip.id).first();
      if (row && it.kind !== 'unterkunft') await orphan(row.id);
      return row ? json({ id: row.id, ...it }) : err(404, 'Eintrag nicht gefunden');
    }
  }
  return err(405, 'Nicht erlaubt');
}
