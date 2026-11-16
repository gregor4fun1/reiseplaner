import { handleApi } from './api.js';

const key = { type: 'string', description: 'Schlüssel oder Link der Reise (Admin zum Bearbeiten, Viewer nur zum Lesen)' };
const itemProps = {
  title: { type: 'string' },
  kind: { type: 'string', enum: ['unterkunft', 'aktivitaet', 'fahrt', 'sonstiges'], description: 'unterkunft = Aufenthalt über mehrere Tage (Hütte, Fahrziel) mit date und end_date' },
  parent_id: { type: 'number', description: 'ID eines Aufenthalts (kind unterkunft). Macht den Eintrag zum Tagesausflug von dort.' },
  images: { type: 'string', description: 'Bild-Links (http/https), einer pro Zeile, höchstens 6' },
  place: { type: 'string', description: 'Ortsname' },
  lat: { type: 'number' }, lon: { type: 'number' },
  date: { type: 'string', description: 'YYYY-MM-DD. Ohne Datum ist der Eintrag eine Idee.' },
  end_date: { type: 'string', description: 'YYYY-MM-DD, für mehrtägige Einträge' },
  time: { type: 'string', description: 'HH:MM' },
  note: { type: 'string' }, url: { type: 'string' }, author: { type: 'string' },
};
const tool = (name, description, properties, required) => ({ name, description, inputSchema: { type: 'object', properties, required } });
const TOOLS = [
  tool('create_trip', 'Legt eine neue Reise an und gibt Admin-Link und Viewer-Link zurück.', { name: { type: 'string' } }, ['name']),
  tool('get_trip', 'Liest eine Reise mit allen Einträgen.', { key }, ['key']),
  tool('add_item', 'Legt einen Eintrag an (Ort, Aktivität, Unterkunft, Fahrt oder Idee).', { key, ...itemProps }, ['key', 'title', 'kind']),
  tool('update_item', 'Ändert die angegebenen Felder eines Eintrags.', { key, id: { type: 'number' }, ...itemProps }, ['key', 'id']),
  tool('delete_item', 'Löscht einen Eintrag endgültig.', { key, id: { type: 'number' } }, ['key', 'id']),
  tool('search_place', 'Sucht einen Ort und gibt Namen mit Koordinaten zurück.', { key, query: { type: 'string' } }, ['key', 'query']),
];

async function call(env, origin, name, a = {}) {
  const api = async (method, path, body) => {
    const r = await handleApi(new Request(`${origin}/api/trips${path}`, { method, body: body && JSON.stringify(body) }), env);
    return { ok: r.ok, data: await r.json() };
  };
  const k = '/' + encodeURIComponent(String(a.key || '').split(/[#/]/).pop());
  const { key: _, id, ...fields } = a;
  switch (name) {
    case 'create_trip': {
      const r = await api('POST', '', { name: a.name });
      if (r.ok) r.data = { name: r.data.name, adminLink: `${origin}/#${r.data.adminKey}`, viewerLink: `${origin}/#${r.data.viewKey}` };
      return r;
    }
    case 'get_trip': return api('GET', k);
    case 'add_item': return api('POST', `${k}/items`, { author: 'Claude', ...fields });
    case 'update_item': {
      const trip = await api('GET', k);
      if (!trip.ok) return trip;
      const old = trip.data.items.find(i => i.id === id);
      if (!old) return { ok: false, data: { error: 'Eintrag nicht gefunden' } };
      return api('PUT', `${k}/items/${id}`, { ...old, ...fields });
    }
    case 'delete_item': return api('DELETE', `${k}/items/${Number(id)}`);
    case 'search_place': return api('GET', `${k}/geocode?q=${encodeURIComponent(a.query || '')}`);
    default: return { ok: false, data: { error: 'Unbekanntes Werkzeug' } };
  }
}

// shortcut: MCP ohne Sitzungen und ohne SSE, nur JSON-Antworten auf POST; auf das offizielle SDK wechseln, sobald ein Client mehr verlangt.
export async function handleMcp(request, env) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  const reply = (id, rest) => new Response(JSON.stringify({ jsonrpc: '2.0', id, ...rest }), { headers: { 'content-type': 'application/json' } });
  const msg = await request.json().catch(() => null);
  if (!msg || Array.isArray(msg) || typeof msg.method !== 'string') return reply(null, { error: { code: -32600, message: 'Invalid Request' } });
  if (msg.id === undefined) return new Response(null, { status: 202 }); // Benachrichtigung
  switch (msg.method) {
    case 'initialize':
      return reply(msg.id, { result: {
        protocolVersion: msg.params?.protocolVersion || '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'reiseplaner', version: '1.0.0' },
      } });
    case 'ping': return reply(msg.id, { result: {} });
    case 'tools/list': return reply(msg.id, { result: { tools: TOOLS } });
    case 'tools/call': {
      const r = await call(env, new URL(request.url).origin, msg.params?.name, msg.params?.arguments);
      return reply(msg.id, { result: { content: [{ type: 'text', text: JSON.stringify(r.data) }], isError: !r.ok } });
    }
    default: return reply(msg.id, { error: { code: -32601, message: 'Method not found' } });
  }
}
