// Plan your trip: dates, a zoomable map and lists of real places and events, a basket, and a day-by-day itinerary.
// All state lives in the link and in localStorage; nothing is sent anywhere.
import { clock, dayList } from '/plan/lib/planner.js';
import { createApi } from '/plan/lib/api.js';

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);   // event text comes from other sites
const INTERESTS = [['wine', 'Wine'], ['beer-cider', 'Beer & cider'], ['music', 'Live music'], ['outdoors', 'Trails'], ['scenic', 'Views'], ['food', 'Food'], ['family', 'Family'], ['festival', 'Festivals'], ['market', 'Markets']].map(([k, l]) => [k, l, `var(--i-${k})`]);   // colours are tokens in /shared.css
const token = (v) => getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim();   // 'var(--x)' -> its colour, for the map library
const COLOR = Object.fromEntries(INTERESTS.map(([k, , c]) => [k, c]));
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  winery: svg('<path d="M7 3h10c0 6-2 9-5 9S7 9 7 3ZM12 12v8M8 21h8"/>'), brewery: svg('<path d="M6 7h10v13H6ZM16 10h3v6h-3M9 11v5M13 11v5M6 7c0-3 10-3 10 0"/>'),
  cidery: svg('<path d="M12 8c-6-3-8 3-6 8s4 5 6 3c2 2 4 2 6-3s0-11-6-8ZM12 8c0-3 1-4 3-5"/>'), distillery: svg('<path d="M10 3h4v5l3 4v9H7v-9l3-4ZM7 15h10"/>'),
  trail: svg('<path d="M3 20 9 8l4 7 3-4 5 9Z"/>'), overlook: svg('<circle cx="17" cy="7" r="3"/><path d="M2 20c4-8 7-8 10-3 2-3 5-3 10 3"/>'),
  park: svg('<path d="M12 3 5 14h14ZM12 14v7"/>'), orchard: svg('<path d="M12 8c-6-3-8 3-6 8s4 5 6 3c2 2 4 2 6-3s0-11-6-8ZM12 8c0-3 1-4 3-5"/>'),
  golf: svg('<path d="M8 21V3l10 4-10 4M5 21h6"/>'),
  resort: svg('<path d="M12 2v20M3 7l18 10M21 7 3 17"/>'), town: svg('<path d="M4 21V8l6-4v17M10 21V11h10v10M2 21h20M14 15h2"/>'),
  restaurant: svg('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 2-3 5-3 9h3M17 3v18"/>'), cafe: svg('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3"/>'),
  home: svg('<path d="M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6"/>'), event: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
};
const KEY = 'afton-plan';
const fmtDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const iso = (d) => d.toISOString().slice(0, 10);

// Everything about the property (where the house is, its links, its quiet hours) comes from one config file.
const get = (u) => fetch(u).then((r) => r.json());
const [evData, places, region, property] = await Promise.all([get('/api/events.json'), get('/api/places.json'), get('/api/region.json'), get('/config/property.json')]);
const events = evData.events, HOME = property.origin;
for (const p of places) p.color = COLOR[p.interests[0]] ?? 'var(--ink)';
const api = createApi({ events, places, region });
const placeById = Object.fromEntries(places.map((p) => [p.id, p])), eventById = Object.fromEntries(events.map((e) => [e.id, e]));
$('#updated').textContent = `Last refreshed ${new Date(evData.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`;

// ---------- state ----------
function nextWeekend() { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); const e = new Date(d); e.setDate(e.getDate() + 2); return [iso(d), iso(e)]; }
const q = new URLSearchParams(location.search), saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } })();
const [f0, t0] = nextWeekend();
const state = {
  from: q.get('in') ?? q.get('from') ?? saved.from ?? f0, to: q.get('out') ?? q.get('to') ?? saved.to ?? t0,     // ?in=&out= lets a booking confirmation link straight in
  interests: new Set((q.get('i') ?? saved.interests?.join(',') ?? '').split(',').filter((k) => COLOR[k])),
  pace: q.get('pace') ?? saved.pace ?? 'steady', kids: q.has('b') ? q.get('kids') === '1' : !!saved.kids, driver: q.has('b') ? q.get('dd') === '1' : !!saved.driver,
  basket: q.has('b') ? q.get('b').split(',').filter(Boolean).map((s) => { const [type, id, date, start] = s.split('~'); return { type: type === 'e' ? 'event' : 'place', id, ...(date ? { pin: { date, start: +start } } : {}) }; }) : saved.basket ?? [],
  open: null,
  booked: q.has('in') && q.has('out') ? { from: q.get('in'), to: q.get('out') } : saved.booked ?? null,   // arrived from a booking confirmation link
};
if (state.from < iso(new Date())) [state.from, state.to] = [f0, t0];
if (q.has('add')) { const [t, id] = q.get('add').split('~'), type = t === 'e' ? 'event' : 'place'; if (!state.basket.some((b) => b.type === type && b.id === id)) state.basket.push({ type, id }); }   // arriving from an Explore page
state.basket = state.basket.filter((b) => (b.type === 'event' ? eventById : placeById)[b.id]);
const inBasket = (type, id) => state.basket.some((b) => b.type === type && b.id === id);
function shareUrl() {
  const p = new URLSearchParams({ from: state.from, to: state.to, i: [...state.interests].join(','), pace: state.pace, kids: +state.kids, dd: +state.driver, b: state.basket.map((b) => [b.type[0], b.id, b.pin?.date, b.pin?.start].filter((x) => x != null).join('~')).join(',') });
  return `${location.origin}${location.pathname}?${p}`;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, interests: [...state.interests], open: undefined })); } catch { /* private mode */ }
  history.replaceState(null, '', state.basket.length ? shareUrl() : location.pathname);
}
const toast = (t) => { $('#toast').textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => { $('#toast').textContent = ''; }, 5000); };

// ---------- dates, filters, options ----------
$('#from').value = state.from; $('#to').value = state.to; $('#from').min = $('#to').min = iso(new Date());
$('#pace').value = state.pace; $('#kids').checked = state.kids; $('#driver').checked = state.driver;
$('#chips').innerHTML = INTERESTS.map(([k, l, c]) => `<button type="button" data-k="${k}" style="--c:${c}" aria-pressed="${state.interests.has(k)}">${l}</button>`).join('');
$('#chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.interests.has(b.dataset.k) ? state.interests.delete(b.dataset.k) : state.interests.add(b.dataset.k); b.setAttribute('aria-pressed', state.interests.has(b.dataset.k)); render(); });
const readForm = () => {
  state.from = $('#from').value || state.from; state.to = $('#to').value || state.to;
  if (state.to < state.from) { state.to = state.from; $('#to').value = state.to; }
  state.pace = $('#pace').value; state.kids = $('#kids').checked; state.driver = $('#driver').checked; render();
};
$('#setup').addEventListener('change', readForm); $('#opts').addEventListener('change', readForm);
$('#setup').addEventListener('submit', (e) => e.preventDefault());

// ---------- lists ----------
const wanted = (cats) => !state.interests.size || cats.some((c) => state.interests.has(c));
const hm = (s) => +s.slice(11, 13) * 60 + +s.slice(14, 16);
const timeOf = (e) => (e.allDay ? 'Time not published' : `${clock(hm(e.start))}${e.end ? ` to ${clock(hm(e.end))}` : ''}`);
const label = (k) => INTERESTS.find(([x]) => x === k)?.[1] ?? k;
const addBtn = (type, id, name) => { const on = inBasket(type, id); return `<button class="add" type="button" data-add="${type}" data-id="${esc(id)}" aria-pressed="${on}">${on ? 'Added ✓' : name ? `Add ${esc(name)}` : 'Add'}</button>`; };
function eventCard(e) {
  return `<li class="card ${inBasket('event', e.id) ? 'is-in' : ''}" style="--c:${COLOR[e.categories[0]] ?? 'var(--ink)'}"><div><p class="when">${esc(timeOf(e))}</p><h3>${esc(e.title)}</h3><p class="venue">${e.placeId ? `<button type="button" class="ghost" data-show="${esc(e.placeId)}">${esc(e.venueName)}</button>` : esc(e.venueName)}${e.price ? ` · ${esc(e.price)}` : ''}</p>
    <p class="tags">${e.categories.map((c) => `<span class="tag">${esc(label(c))}</span>`).join('')}</p></div>${addBtn('event', e.id)}
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}<p class="desc"><a href="${esc(e.sources[0].url)}" rel="noopener">Details at ${esc(e.sources[0].name)}</a></p></li>`;
}
const visit = (p) => (p.typicalVisitMinutes >= 120 ? `${p.typicalVisitMinutes / 60} hours` : `${p.typicalVisitMinutes} min`);
function placeCard(p) {
  return `<li class="card ${inBasket('place', p.id) ? 'is-in' : ''}" style="--c:${p.color}"><div><p class="when">${esc(p.kind)} · about ${visit(p)}</p><h3>${esc(p.name)}</h3>
    ${p.notes ? `<p class="venue">${esc(p.notes)}</p>` : ''}<p class="venue"><button type="button" class="ghost" data-show="${esc(p.id)}">Show on the map</button></p></div>${addBtn('place', p.id)}</li>`;
}
const onDates = () => { const days = dayList(state.from, state.to); return events.filter((e) => days.includes(e.start.slice(0, 10))); };
function renderLists() {
  const days = dayList(state.from, state.to), all = onDates(), shown = all.filter((e) => wanted(e.categories));
  $('#n-events').textContent = shown.length; $('#n-places').textContent = places.filter((p) => wanted(p.interests)).length;
  $('#status').textContent = `${shown.length} event${shown.length === 1 ? '' : 's'} on your dates${state.interests.size && all.length > shown.length ? ` (${all.length - shown.length} more hidden by your filters)` : ''}`;
  $('#list').innerHTML = days.map((d) => { const es = shown.filter((e) => e.start.slice(0, 10) === d); return `<section class="daygroup"><h3>${fmtDay(d)}</h3>${es.length ? `<ul class="cards">${es.map(eventCard).join('')}</ul>` : '<p class="empty">Nothing listed yet for this day. Try the Places tab: those have no set time.</p>'}</section>`; }).join('');
  const ps = places.filter((p) => wanted(p.interests)).sort((x, y) => (inBasket('place', y.id) - inBasket('place', x.id))), cut = state.allPlaces ? ps.length : 10;
  $('#places').innerHTML = (ps.slice(0, cut).map(placeCard).join('') || '<li class="empty">No places match those filters.</li>') + (ps.length > cut ? `<li class="more"><button type="button" class="btn" id="more">Show all ${ps.length} places</button><span>or narrow them with “Show me” in step 1</span></li>` : '');
  $('#more')?.addEventListener('click', () => { state.allPlaces = true; renderLists(); });
}
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-show]');
  if (s) { showTab('map'); openPlace(s.dataset.show, true); $('#step2').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const b = e.target.closest('[data-add]'); if (!b) return;
  const type = b.dataset.add, id = b.dataset.id, i = state.basket.findIndex((x) => x.type === type && x.id === id);
  i >= 0 ? state.basket.splice(i, 1) : state.basket.push({ type, id });
  render(); toast(i >= 0 ? 'Removed from your trip.' : 'Added to your trip.');
});

// ---------- map ----------
const DAYCOLOR = [1, 2, 3, 4, 5].map((n) => `var(--route-${n})`);   // tokens in /shared.css
let map = null, pins = [], mapReady = false, popup = null;
function initMap() {
  try {
    const touch = matchMedia('(pointer: coarse)').matches;
    map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/bright', center: [HOME.lng - 0.02, HOME.lat + 0.03], zoom: 10.2, minZoom: 7.5, maxZoom: 17, cooperativeGestures: touch, attributionControl: { compact: true } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
    // Recolour the base map from the tokens in /shared.css: linen land, a muted warm blue-grey for water, cream roads.
    const warm = () => { const t = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), set = (id, prop, v) => { try { map.setPaintProperty(id, prop, v); } catch { /* a layer without that property */ } };
      for (const { id, type } of map.getStyle().layers) {
        if (type === 'background') set(id, 'background-color', t('--map-land'));
        else if (type === 'fill') { if (/^water/.test(id)) set(id, 'fill-color', t('--map-water')); else if (/wood/.test(id)) { set(id, 'fill-color', t('--map-wood')); set(id, 'fill-opacity', .55); } else if (/park|grass/.test(id)) set(id, 'fill-color', t('--map-green')); else if (/building/.test(id)) set(id, 'fill-color', t('--map-building')); else if (/landuse|landcover|aeroway|highway-area|pier/.test(id)) set(id, 'fill-color', t('--map-land-2')); }
        else if (type === 'line') { if (/^waterway|ferry/.test(id)) set(id, 'line-color', t('--map-water')); else if (/rail/.test(id)) set(id, 'line-color', t('--map-rail')); else if (/casing/.test(id)) set(id, 'line-color', t('--map-road-edge')); else if (/path/.test(id)) set(id, 'line-color', t('--map-rail')); else if (/motorway|trunk|primary/.test(id)) set(id, 'line-color', t('--map-road-major')); else if (/highway|bridge|tunnel|road|aeroway/.test(id)) set(id, 'line-color', t('--map-road')); }
        else if (type === 'symbol') { set(id, 'text-color', t('--ink-soft')); set(id, 'text-halo-color', t('--map-land')); }
      } };
    map.on('load', () => { warm();
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'routes', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1.5, 1.5] }, layout: { 'line-cap': 'round' } });
      mapReady = true; drawRoutes();
    });
    $('#mapnote').textContent = touch ? 'Pinch to zoom, two fingers to move the map. Tap a pin for details.' : 'Scroll or use + and − to zoom. Click a pin for details.';
    $('#reset').addEventListener('click', fitAll);
  } catch { map = null; $('#mapnote').textContent = 'The map could not load on this device. Everything on it is in the lists below.'; $('#reset').hidden = true; }
}
function fitAll() {
  const b = new maplibregl.LngLatBounds([HOME.lng, HOME.lat], [HOME.lng, HOME.lat]);
  for (const p of places.filter((x) => wanted(x.interests))) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding: 50, maxZoom: 13 });
}
function renderPins() {
  if (!map) return;
  pins.forEach((p) => p.remove()); pins = [];
  const add = (lng, lat, cls, color, icon, name, id, n) => {
    const el = Object.assign(document.createElement('button'), { type: 'button', className: `pin ${cls}`, innerHTML: icon });
    el.style.setProperty('--c', color); if (n) el.dataset.n = n;
    el.addEventListener('click', (e) => { e.stopPropagation(); id ? openPlace(id) : openHome(); });
    pins.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
    el.setAttribute('aria-label', name);                              // after addTo: the map library sets a generic label of its own
  };
  add(HOME.lng, HOME.lat, 'pin--home', 'var(--ink)', ICON.home, 'The house (approximate)', null);
  const live = onDates().filter((e) => wanted(e.categories));
  for (const p of places) {
    const n = live.filter((e) => e.placeId === p.id).length;
    if (!n && !wanted(p.interests)) continue;
    const mine = inBasket('place', p.id) || live.some((e) => e.placeId === p.id && inBasket('event', e.id));
    add(p.lng, p.lat, `${n ? 'pin--busy' : ''} ${mine ? 'pin--in' : ''} ${state.open === p.id ? 'is-open' : ''}`, p.color, ICON[p.kind] ?? ICON.event, `${p.name}${n ? `, ${n} event${n > 1 ? 's' : ''} on your dates` : ''}`, p.id, n);
  }
}
function drawRoutes() {
  if (!mapReady) return;
  const features = (plan?.days ?? []).filter((d) => d.stops.length).map((d, i) => ({ type: 'Feature', properties: { color: token(DAYCOLOR[i % DAYCOLOR.length]) }, geometry: { type: 'LineString', coordinates: [[HOME.lng, HOME.lat], ...d.stops.filter((s) => s.data.lat).map((s) => [s.data.lng, s.data.lat]), [HOME.lng, HOME.lat]] } }));
  map.getSource('routes').setData({ type: 'FeatureCollection', features });
}
function openPlace(id, fly) {
  state.open = id; const p = placeById[id]; if (!p) return;
  if (map && fly) map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 12.5), essential: false });
  renderPins(); renderDetail(); showPopup();
}
function openHome() {
  state.open = null; renderPins(); renderDetail(); popup?.remove();
  popup = new maplibregl.Popup({ offset: 30, maxWidth: '17rem', focusAfterOpen: false }).setLngLat([HOME.lng, HOME.lat])
    .setHTML('<p class="when">Where you’re staying</p><h3>' + property.brand + '</h3><p>The house, on Route 151 in the Rockfish Valley. The pin is approximate; the hosts send the address before your stay.</p><p class="row"><a href="' + property.houseUrl + '">See the house</a><a href="' + property.roomsUrl + '">Rooms and plan</a></p>').addTo(map);
  popup.on('close', () => { popup = null; });
}
/** The name card that opens on the map, right at the pin. */
function popupHtml(p) {
  const es = onDates().filter((e) => e.placeId === p.id);
  return `<p class="when">${esc(p.kind)} · about ${visit(p)}</p><h3>${esc(p.name)}</h3>${p.notes ? `<p>${esc(p.notes)}</p>` : ''}${/^Trailhead/.test(p.address) ? `<p class="pop__start">${esc(p.address)}</p>` : ''}
    ${es.length ? `<p class="pop__on">${es.length === 1 ? `${esc(es[0].title)}, ${esc(fmtDay(es[0].start.slice(0, 10)).split(',')[0])} ${esc(timeOf(es[0]).split(' to ')[0])}` : `${es.length} events on your dates`}</p>` : ''}
    <p class="row">${addBtn('place', p.id, 'a visit')}${p.url ? `<a href="${esc(p.url)}" rel="noopener">Website</a>` : ''}</p>${es.length ? '<p class="pop__more">Events are listed just below the map.</p>' : ''}`;
}
function showPopup() {
  const p = placeById[state.open];
  if (!map) return;
  if (!p) { popup?.remove(); popup = null; return; }
  if (popup && !popup._forPlace) { const old = popup; popup = null; old.remove(); }
  if (!popup) { popup = new maplibregl.Popup({ offset: 26, maxWidth: '17rem', focusAfterOpen: false }); popup._forPlace = true; popup.on('close', () => { if (popup && state.open) { state.open = null; popup = null; renderPins(); renderDetail(); } }); }
  popup.setLngLat([p.lng, p.lat]).setHTML(popupHtml(p)).addTo(map);
}
function renderDetail() {
  const p = placeById[state.open], el = $('#detail');
  if (!p) { el.innerHTML = ''; return; }
  const es = onDates().filter((e) => e.placeId === p.id);
  el.style.setProperty('--c', p.color);
  el.innerHTML = `<p class="when">${esc(p.kind)} · about ${visit(p)}</p><h3>${esc(p.name)}</h3>${p.notes ? `<p>${esc(p.notes)}</p>` : ''}${p.address ? `<p>${esc(p.address)}</p>` : ''}
    <p class="row">${addBtn('place', p.id, 'a visit')}${p.url ? `<a href="${esc(p.url)}" rel="noopener">Website</a>` : ''}<button type="button" class="ghost" id="close">Close</button></p>
    ${es.length ? `<p class="when" style="margin-top:1rem">On your dates here</p><ul class="cards">${es.map(eventCard).join('')}</ul>` : ''}`;
  $('#close').addEventListener('click', () => { state.open = null; renderPins(); renderDetail(); showPopup(); });
}

// ---------- plan ----------
let plan = null;
function renderPlan() {
  $('#count').textContent = state.basket.length;
  const n = state.basket.length;
  $('#send').hidden = $('#opts').hidden = !n; $('#tray').hidden = !n; $('#tray-text').textContent = `${n} ${n === 1 ? 'stop' : 'stops'} in your trip`;
  if (!n) { plan = null; $('#plan').innerHTML = '<p class="empty"><strong>Nothing here yet.</strong> Add a few things in step 2 and your days appear here in order, with drive times. Then you can email the plan to yourself, add it to your calendar, or share a link.</p>'; return; }
  plan = api.planItinerary({ origin: HOME, from: state.from, to: state.to, items: state.basket.map((b) => ({ type: b.type, slug: b.id, pin: b.pin })), interests: [...state.interests], constraints: { pace: state.pace, driver: state.driver, kids: state.kids, homeBy: property.homeBy } });
  const LABEL = { hard: 'These two clash', soft: 'Worth knowing', info: 'A small note', gap: 'Room to breathe' };
  const bad = new Set(plan.days.flatMap((d) => d.notes.filter((n) => n.level === 'hard').flatMap((n) => n.keys)));
  const stop = (s, d) => {
    const place = s.type === 'place', b = state.basket.find((x) => `${x.type[0]}:${x.id}` === s.key), at = `data-key="${esc(s.key)}" data-date="${d.date}" data-start="${s.start}"`;
    return `<li class="stop ${bad.has(s.key) ? 'is-bad' : ''}"><span class="when">${clock(s.start)} to ${clock(s.end)}${place && !b.pin ? ' · suggested' : ''}</span><h3>${esc(s.data.title ?? s.data.name)}</h3>${s.data.venueName ? `<p>${esc(s.data.venueName)}</p>` : ''}
      <p class="stop__tools">${place ? `<button type="button" data-act="lock" ${at} aria-pressed="${!!b.pin}">${b.pin ? 'Locked' : 'Lock this time'}</button><button type="button" data-act="shift" data-by="-30" ${at}>Earlier</button><button type="button" data-act="shift" data-by="30" ${at}>Later</button>${plan.days.length > 1 ? `<button type="button" data-act="day" ${at}>Move to next day</button>` : ''}` : ''}
      <button type="button" data-act="remove" data-key="${esc(s.key)}">Remove</button></p></li>`;
  };
  const leg = (l) => `<li class="leg">${l.minutes ? `About ${l.minutes} min drive${l.miles ? ` · ${l.miles} mi` : ''}` : 'Next door'}</li>`;
  $('#plan').innerHTML = plan.days.map((d, i) => `<article class="day" style="--c:${DAYCOLOR[i % DAYCOLOR.length]}"><header class="day__date"><h3>${fmtDay(d.date)}</h3><small>Sunset ${clock(d.sunset)}</small></header>
    ${d.stops.length ? `<ol class="line"><li class="leg" style="opacity:1">Leave the house</li>${d.stops.map((s, k) => leg(d.legs[k]) + stop(s, d)).join('')}${leg(d.legs.at(-1))}<li class="leg" style="opacity:1">Back at the house, about ${clock(d.stops.at(-1).end + d.legs.at(-1).minutes)}</li></ol>` : '<p class="empty">A free day. Pool, porch, nothing.</p>'}
    ${d.notes.length ? `<ul class="notes">${d.notes.map((n) => `<li class="${n.level}"><b>${LABEL[n.level]}</b>${esc(n.text)}${n.suggest?.length ? `<span>${n.suggest.map((id) => `<button type="button" data-add="place" data-id="${esc(id)}">Add ${esc(placeById[id].name)}</button>`).join('')}</span>` : ''}</li>`).join('')}</ul>` : ''}</article>`).join('')
    + (plan.unplaced.length ? `<ul class="notes">${plan.unplaced.map((u) => `<li class="hard"><b>Not placed</b>${esc(u.item.data.title ?? u.item.data.name)}. ${esc(u.why)} <button type="button" data-act="remove" data-key="${esc(u.item.key)}">Remove</button></li>`).join('')}</ul>` : '');
}
$('#plan').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const i = state.basket.findIndex((x) => `${x.type[0]}:${x.id}` === t.dataset.key), b = state.basket[i]; if (!b) return;
  const { act, date } = t.dataset, start = +t.dataset.start;
  if (act === 'remove') state.basket.splice(i, 1);
  if (act === 'lock') b.pin ? delete b.pin : (b.pin = { date, start });
  if (act === 'shift') b.pin = { date, start: Math.max(8 * 60, Math.min(21 * 60, start + +t.dataset.by)) };
  if (act === 'day') { const ds = dayList(state.from, state.to); b.pin = { date: ds[(ds.indexOf(date) + 1) % ds.length], start }; }
  render();
});
$('#ics').addEventListener('click', () => {
  if (!plan) return toast('Add something first.');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([api.toCalendar(plan, { calendarName: property.calendarName, uidDomain: location.hostname })], { type: 'text/calendar' })), download: 'afton-weekend.ics' });
  a.click(); URL.revokeObjectURL(a.href); toast('Calendar file downloaded. Open it to add the stops to your calendar.');
});
$('#share').addEventListener('click', async () => {
  if (!state.basket.length) return toast('Add something first.');
  try { await navigator.clipboard.writeText(shareUrl()); toast('Link copied. Anyone who opens it sees this plan.'); } catch { toast('Copy the address from your browser’s address bar.'); }
});
$('#clear').addEventListener('click', () => { state.basket = []; render(); toast('Cleared.'); });

/** Booking calls to action: the property's booking page, opened on the chosen dates. Hidden once we know the guest has booked them. */
function renderBooking() {
  const u = new URL(property.bookingUrl), b = property.booking;
  u.searchParams.set(b.startParam, state.from); u.searchParams.set(b.endParam, state.to); for (const k in b.extra) u.searchParams.set(k, b.extra[k]);
  const short = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const mine = state.booked && state.booked.from === state.from && state.booked.to === state.to;
  $('#avail').href = $('#avail2').href = u.href;
  $('#avail').textContent = `Check availability for ${short(state.from)} to ${short(state.to)}`;
  $('#avail-row').classList.toggle('is-booked', !!mine);
  $('#avail-note').textContent = mine ? `Your stay: ${short(state.from)} to ${short(state.to)}. Check-in from ${property.checkIn}, check-out by ${property.checkOut}.` : 'Opens the booking page on these dates.';
  $('#avail2').hidden = !!mine;
}
function showTab(name) {
  for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === name);
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  if (name === 'map' && map) map.resize();
}
for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => showTab(b.dataset.tab));

/** The itinerary as plain text, for the email and the form. */
function planText() {
  if (!plan) return '';
  const out = [`My trip near Afton, Virginia`, ''];
  for (const d of plan.days) { out.push(fmtDay(d.date).toUpperCase()); if (!d.stops.length) out.push('  Free day'); for (const s of d.stops) out.push(`  ${clock(s.start)} to ${clock(s.end)}  ${s.data.title ?? s.data.name}${s.data.venueName ? `, ${s.data.venueName}` : ''}`); out.push(''); }
  out.push(`Open or change this plan: ${shareUrl()}`, '', `Stay at ${property.brand}: ${property.houseUrl}`);
  return out.join('\n');
}
// "Email me this itinerary": the address is saved through the site's form (when the site is live), then the guest's own
// mail app opens with the plan addressed to them. Sending it for them automatically needs an email service; see the README.
$('#mail').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target, to = $('#mail-to').value.trim(); if (!to) return;
  $('#mail-plan').value = planText(); $('#mail-link').value = shareUrl(); $('#mail-dates').value = `${state.from} to ${state.to}`;
  try { await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() }); } catch { /* offline or not deployed: the mail link below still works */ }
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('My trip near Afton, Virginia')}&body=${encodeURIComponent(planText())}`;
  toast('Your mail app is opening with the plan addressed to you. Press send.');
});

function render() { renderBooking(); renderLists(); renderPlan(); renderPins(); renderDetail(); if (popup && state.open) popup.setHTML(popupHtml(placeById[state.open])); drawRoutes(); save(); }
initMap();
render();
