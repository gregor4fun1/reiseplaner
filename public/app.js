const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e; };
// Art: Bezeichnung, Farbe, Symbol (SVG-Pfad auf 24x24)
const KINDS = {
  unterkunft: ['Aufenthalt', '#8944ab', 'M3 11 12 3l9 8v10h-6v-6H9v6H3z'],
  aktivitaet: ['Aktivität', '#248a3d', 'M2 20 9 7l4 7 2-3 7 9z'],
  fahrt: ['Fahrt', '#0071e3', 'M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z'],
  sonstiges: ['Sonstiges', '#a05a00', 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.500a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5z'],
};
const FORM_FIELDS = ['title', 'kind', 'date', 'end_date', 'time', 'note', 'url', 'images'];
const key = location.hash.slice(1);
const saved = () => { try { return JSON.parse(localStorage.trips || '{}'); } catch { return {}; } };
const fail = x => alert(x.status ? x.message : 'Keine Verbindung. Bitte später noch einmal versuchen.');

addEventListener('hashchange', () => location.reload());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

async function api(method, path = '', body) {
  const r = await fetch(`/api/trips${path}`, { method, body: body && JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.error || 'Fehler'), { status: r.status });
  return data;
}

// ---------- Startseite ----------

function start() {
  $('#trip').hidden = true;
  $('#start').hidden = false;
  $('#mine').replaceChildren(...Object.entries(saved()).map(([k, name]) => el('li', {}, el('a', { href: '#' + k, textContent: name }))));
  $('#mineBox').hidden = !$('#mine').children.length;
  $('#create').onsubmit = async e => {
    e.preventDefault();
    try {
      const t = await api('POST', '', { name: new FormData(e.target).get('name') });
      sessionStorage.fresh = '1';
      location.hash = t.adminKey;
    } catch (x) { fail(x); }
  };
  $('#open').onsubmit = e => {
    e.preventDefault();
    const k = new FormData(e.target).get('link').trim().split('#').pop();
    if (k) location.hash = k;
  };
}

// ---------- Reiseseite ----------

let trip, last = '', map, layer, fitted = false, gen = 0, draft = null, picking = false, timer;
const routes = new Map();
const isAdmin = () => trip.role === 'admin';
const me = () => localStorage.me || (localStorage.me = (prompt('Dein Name (steht an deinen Einträgen):') || '').trim().slice(0, 50));
const parentOf = i => i.parent_id && trip.items.find(p => p.id === i.parent_id);
const imgs = i => (i.images || '').split('\n').filter(Boolean);
const kindLabel = i => (i.parent_id ? 'Tagesausflug' : KINDS[i.kind][0]);

async function load() {
  let t;
  try { t = await api('GET', '/' + key); } catch (x) {
    if (x.status === 404) {
      clearInterval(timer);
      const s = saved(); delete s[key]; localStorage.trips = JSON.stringify(s);
      $('#missing').hidden = false;
      start();
    }
    return;
  }
  const s = JSON.stringify(t);
  if (s === last) return;
  last = s; trip = t;
  render();
}

function span(a, b) { // alle Tage von a bis b, höchstens 60
  const out = [];
  for (let t = Date.parse(a); t <= Date.parse(b || a) && out.length < 60; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const date = (d, opts) => new Date(d + 'T12:00:00').toLocaleDateString('de-AT', opts);
const fmtDay = d => date(d, { weekday: 'short', day: 'numeric', month: 'long' });
const fmtShort = d => date(d, { day: 'numeric', month: 'short' });
const fmtDur = m => `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
const clock = i => i.time || '99';
const when = i => (i.date ? fmtShort(i.date) + (i.end_date ? ' bis ' + fmtShort(i.end_date) : '') + (i.time ? ', ' + i.time : '') : 'Idee');

// Symbol oder erstes Bild des Eintrags; dieselbe Form auf der Karte und in den Listen.
function badge(i, cls = '') {
  const d = el('span', { className: `pin ${cls}${i.date ? '' : ' idea'}${i.parent_id ? ' sub' : ''}` });
  d.style.setProperty('--c', KINDS[i.kind][1]);
  d.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${KINDS[i.kind][2]}"/></svg>`;
  const src = imgs(i)[0];
  if (src) {
    d.classList.add('photo');
    d.append(el('img', { src, alt: '', referrerPolicy: 'no-referrer', onerror() { this.remove(); d.classList.remove('photo'); } }));
  }
  return d;
}

function strip(i) {
  const list = imgs(i);
  return list.length ? el('div', { className: 'strip' }, ...list.map(src => el('img', { src, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror() { this.remove(); } }))) : null;
}

function row(i) {
  const meta = [kindLabel(i), i.end_date && 'bis ' + fmtShort(i.end_date), i.place, i.author && 'von ' + i.author].filter(Boolean).join(' · ');
  const leg = el('p', { className: 'leg' });
  leg.dataset.leg = i.id;
  return el('li', {}, el('button', { type: 'button', className: 'item', onclick: () => openItem(i) },
    badge(i, 'rowpin'),
    el('span', {}, el('strong', { textContent: (i.time ? i.time + ' ' : '') + i.title }), el('small', { textContent: meta }))), leg);
}

// Karte, die sich beim Klick auf einen Marker öffnet: Bilder, Text, Knopf zum Eintrag.
function card(i) {
  return el('div', { className: 'card' }, strip(i), el('div', { className: 'cardBody' },
    el('h3', { textContent: i.title }),
    el('p', { className: 'meta', textContent: [kindLabel(i), when(i), i.place].filter(Boolean).join(' · ') }),
    i.note && el('p', { className: 'note', textContent: i.note }),
    i.url && el('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer', textContent: 'Website öffnen' }),
    el('button', { type: 'button', className: 'primary wide', textContent: isAdmin() ? 'Bearbeiten' : 'Details', onclick: () => { map.closePopup(); openItem(i); } })));
}

function render() {
  document.title = trip.name;
  $('#name').textContent = trip.name;
  localStorage.trips = JSON.stringify({ ...saved(), [key]: trip.name });
  document.body.classList.toggle('viewer', !isAdmin());

  const dated = trip.items.filter(i => i.date).sort((a, b) => (a.date + clock(a)).localeCompare(b.date + clock(b)) || a.id - b.id);
  const stays = dated.filter(i => i.kind === 'unterkunft' && i.end_date);
  // Ein Aufenthalt steht einmal am Anreisetag; jeder seiner Tage bekommt eine eigene Überschrift für die Tagesausflüge.
  const days = new Map();
  for (const s of stays) for (const d of span(s.date, s.end_date)) days.set(d, []);
  for (const i of dated) days.set(i.date, [...(days.get(i.date) || []), i]);
  $('#days').replaceChildren(...[...days.keys()].sort().flatMap(d => {
    const base = stays.filter(s => s.date <= d && d <= s.end_date).map(s => s.title).join(', ');
    return [el('h3', {}, fmtDay(d), base && el('small', { textContent: base })), el('ul', {}, ...days.get(d).map(row))];
  }));
  if (!dated.length) $('#days').append(el('p', { className: 'foot', textContent: 'Noch nichts geplant. Einträge mit Datum erscheinen hier.' }));

  const groups = new Map();
  for (const i of trip.items.filter(i => !i.date)) {
    const p = parentOf(i), k = p ? `Rund um ${p.title}` : '';
    groups.set(k, [...(groups.get(k) || []), i]);
  }
  $('#ideas').replaceChildren(...[...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([k, list]) => [k && el('h3', { textContent: k }), el('ul', {}, ...list.map(row))].filter(Boolean)));
  if (!groups.size) $('#ideas').append(el('p', { className: 'foot', textContent: 'Noch keine Ideen. Einträge ohne Datum erscheinen hier.' }));

  layer.clearLayers();
  const located = trip.items.filter(i => i.lat != null);
  for (const i of located) {
    const size = i.kind === 'unterkunft' ? 56 : i.parent_id ? 40 : 48;
    L.marker([i.lat, i.lon], {
      icon: L.divIcon({ html: badge(i), className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] }),
      title: i.title, alt: i.title, zIndexOffset: i.kind === 'unterkunft' ? 1000 : 0,
    }).bindPopup(() => card(i), { minWidth: 280, maxWidth: 280, autoPanPaddingTopLeft: [16, 90], autoPanPaddingBottomRight: [16, 16] }).addTo(layer);
  }
  if (!fitted && located.length) {
    map.fitBounds(located.map(i => [i.lat, i.lon]), { paddingTopLeft: [40, 110], paddingBottomRight: [innerWidth >= 900 ? 440 : 40, 60], maxZoom: 12 });
    fitted = true;
  }
  drawRoute(
    dated.filter(i => i.lat != null && !i.parent_id),
    located.filter(i => parentOf(i)?.lat != null).map(i => [parentOf(i), i]));
}

function route(a, b) {
  const p = i => `${i.lat.toFixed(5)},${i.lon.toFixed(5)}`, k = `${p(a)};${p(b)}`;
  if (!routes.has(k)) routes.set(k, fetch(`/api/trips/${key}/route?from=${p(a)}&to=${p(b)}`).then(r => (r.ok ? r.json() : null)).catch(() => null));
  return routes.get(k);
}

// Hauptroute verbindet die Stationen der Reise; Tagesausflüge hängen als eigene Linie an ihrem Aufenthalt.
async function drawRoute(chain, spokes) {
  const g = ++gen;
  const main = chain.slice(1).map((b, n) => [chain[n], b]).filter(([a, b]) => a.lat !== b.lat || a.lon !== b.lon);
  const all = [...main, ...spokes];
  const legs = await Promise.all(all.map(([a, b]) => route(a, b)));
  if (g !== gen) return; // inzwischen neu gezeichnet
  all.forEach(([a, b], n) => {
    const r = legs[n], spoke = n >= main.length;
    // Gestrichelte gerade Linie, wenn es keine Straßenroute gibt.
    L.polyline(r ? r.coords : [[a.lat, a.lon], [b.lat, b.lon]], { className: spoke ? 'route spoke' : 'route', weight: spoke ? 3 : 5, dashArray: r ? null : '6 8', interactive: false })
      .addTo(layer).bringToBack();
    const out = document.querySelector(`[data-leg="${spoke ? b.id : a.id}"]`);
    if (out && r) out.textContent = spoke ? `${Math.round(r.km)} km · ${fmtDur(r.min)} ab ${a.title}` : `↓ ${Math.round(r.km)} km · ${fmtDur(r.min)} bis ${b.title}`;
  });
}

// ---------- Eintrag ----------

function openItem(i) {
  draft = i ? { ...i } : { kind: 'aktivitaet' };
  showDraft();
}

function showPlace() {
  $('#placeInfo').textContent = draft.lat != null ? `${draft.place || 'Gewählter Punkt'} (${draft.lat.toFixed(4)}, ${draft.lon.toFixed(4)})` : 'Kein Ort';
  $('#noPlace').hidden = draft.lat == null;
}

function showParent() {
  const f = $('#itemForm'), stays = trip.items.filter(i => i.kind === 'unterkunft' && i.id !== draft.id);
  f.elements.parent_id.replaceChildren(el('option', { value: '', textContent: 'Kein Aufenthalt' }), ...stays.map(s => el('option', { value: s.id, textContent: s.title })));
  f.elements.parent_id.value = draft.parent_id ?? '';
  $('#parentRow').hidden = !stays.length || f.elements.kind.value === 'unterkunft';
}

function showDraft() {
  const f = $('#itemForm');
  for (const n of FORM_FIELDS) f.elements[n].value = draft[n] ?? '';
  f.elements.q.value = '';
  f.elements.fields.disabled = !isAdmin();
  $('#itemHead').textContent = draft.id ? draft.title : 'Neuer Eintrag';
  $('#itemImgs').replaceChildren(strip(draft) || '');
  $('#urlOpen').hidden = !draft.url;
  $('#urlOpen').href = draft.url || '';
  $('#itemBy').textContent = draft.author ? `Eingetragen von ${draft.author}` : '';
  $('#del').hidden = !draft.id;
  $('#results').replaceChildren();
  showParent();
  showPlace();
  $('#itemDlg').showModal();
}

function readForm() {
  const f = $('#itemForm');
  for (const n of FORM_FIELDS) draft[n] = f.elements[n].value || null;
  draft.parent_id = draft.kind === 'unterkunft' ? null : Number(f.elements.parent_id.value) || null;
}

async function search() {
  const q = $('#itemForm').elements.q.value.trim();
  if (!q) return;
  try {
    const found = await api('GET', `/${key}/geocode?q=${encodeURIComponent(q)}`);
    $('#results').replaceChildren(...found.map(p => el('li', {}, el('button', {
      type: 'button', className: 'plain', textContent: p.name,
      onclick: () => { Object.assign(draft, { lat: p.lat, lon: p.lon, place: p.name.slice(0, 200) }); $('#results').replaceChildren(); showPlace(); },
    }))));
    if (!found.length) $('#results').append(el('li', { className: 'foot', textContent: 'Nichts gefunden. Versuch es mit einem anderen Namen oder wähle den Ort auf der Karte.' }));
  } catch (x) { fail(x); }
}

function setPicking(on) {
  picking = on;
  $('#hint').hidden = !on;
  if (on) setView('map'); else showDraft();
}

async function saveItem(e) {
  e.preventDefault();
  readForm();
  const body = { ...draft, author: draft.author || me() || null };
  try {
    await api(draft.id ? 'PUT' : 'POST', `/${key}/items${draft.id ? '/' + draft.id : ''}`, body);
    $('#itemDlg').close();
    load();
  } catch (x) { fail(x); }
}

async function deleteItem() {
  if (!confirm(`„${draft.title}“ endgültig löschen?`)) return;
  try { await api('DELETE', `/${key}/items/${draft.id}`); $('#itemDlg').close(); load(); } catch (x) { fail(x); }
}

// ---------- Teilen und Verwalten ----------

function openShare() {
  const base = location.origin + '/';
  $('#adminLink').value = isAdmin() ? base + '#' + key : '';
  $('#viewLink').value = base + '#' + trip.viewKey;
  $('#mcpLink').value = base + 'mcp';
  $('#rename').elements.name.value = trip.name;
  $('#shareDlg').showModal();
}

function setView(v) {
  document.body.dataset.view = v;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-pressed', b.dataset.view === v);
  map.invalidateSize();
}

function openTrip() {
  $('#trip').hidden = false;
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([62, 12], 4); // Skandinavien als Startausschnitt
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', e => {
    if (!picking) return;
    const p = e.latlng.wrap();
    Object.assign(draft, { lat: p.lat, lon: p.lng, place: null });
    setPicking(false);
  });

  for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => setView(b.dataset.view);
  $('#add').onclick = () => openItem();
  $('#share').onclick = openShare;
  $('#itemForm').onsubmit = saveItem;
  $('#itemForm').elements.kind.onchange = showParent;
  $('#itemClose').onclick = () => $('#itemDlg').close();
  $('#del').onclick = deleteItem;
  $('#search').onclick = search;
  $('#itemForm').elements.q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); search(); } };
  $('#pick').onclick = () => { readForm(); $('#itemDlg').close(); setPicking(true); };
  $('#pickCancel').onclick = () => setPicking(false);
  $('#noPlace').onclick = () => { Object.assign(draft, { lat: null, lon: null, place: null }); showPlace(); };
  $('#shareClose').onclick = () => $('#shareDlg').close();
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText($('#' + b.dataset.copy).value).then(() => { b.textContent = 'Kopiert'; });
  $('#rename').onsubmit = async e => {
    e.preventDefault();
    try { await api('PATCH', '/' + key, { name: new FormData(e.target).get('name') }); $('#shareDlg').close(); load(); } catch (x) { fail(x); }
  };
  $('#rotate').onclick = async () => {
    if (!confirm('Beide Links erneuern? Die alten Links funktionieren danach nicht mehr, du musst die neuen wieder verteilen.')) return;
    try { const t = await api('POST', `/${key}/rotate`); sessionStorage.fresh = '1'; location.hash = t.adminKey; } catch (x) { fail(x); }
  };
  $('#delTrip').onclick = async () => {
    if (!confirm(`Reise „${trip.name}“ mit allen Einträgen endgültig löschen?`)) return;
    try { await api('DELETE', '/' + key); location.hash = ''; } catch (x) { fail(x); }
  };

  const net = () => document.body.classList.toggle('offline', !navigator.onLine);
  addEventListener('online', net); addEventListener('offline', net); net();

  setView('map');
  load().then(() => {
    if (!trip) return;
    if (isAdmin()) me();
    if (sessionStorage.fresh) { delete sessionStorage.fresh; openShare(); }
  });
  timer = setInterval(() => { if (document.visibilityState === 'visible' && !$('#itemDlg').open) load(); }, 8000);
}

key ? openTrip() : start();
