// Plan your trip: dates, a zoomable map and lists of real places and events, a basket, and a day-by-day itinerary.
// All state lives in the link and in localStorage; nothing is sent anywhere.
import { clock, dayList, useRoadTimes } from '/plan/lib/planner.js';
import { createApi } from '/plan/lib/api.js';

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);   // event text comes from other sites
const INTERESTS = [['wine', 'Wine'], ['beer-cider', 'Beer & cider'], ['music', 'Live music'], ['outdoors', 'Trails'], ['scenic', 'Views'], ['food', 'Food'], ['family', 'Family'], ['festival', 'Festivals'], ['market', 'Markets']].map(([k, l]) => [k, l, `var(--i-${k})`]);   // colours are tokens in /shared.css
const token = (v) => getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim();   // 'var(--x)' -> its colour, for the map library
const COLOR = Object.fromEntries(INTERESTS.map(([k, , c]) => [k, c]));
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BASKET = '<path d="M3 9h18l-2 11H5ZM8 9l4-6 4 6M9 13v4M15 13v4"/>';
const ICON = {
  winery: svg('<path d="M7 3h10c0 6-2 9-5 9S7 9 7 3ZM12 12v8M8 21h8"/>'), brewery: svg('<path d="M6 7h10v13H6ZM16 10h3v6h-3M9 11v5M13 11v5M6 7c0-3 10-3 10 0"/>'),
  cidery: svg('<path d="M12 8c-6-3-8 3-6 8s4 5 6 3c2 2 4 2 6-3s0-11-6-8ZM12 8c0-3 1-4 3-5"/>'), distillery: svg('<path d="M10 3h4v5l3 4v9H7v-9l3-4ZM7 15h10"/>'),
  trail: svg('<path d="M3 20 9 8l4 7 3-4 5 9Z"/>'), overlook: svg('<circle cx="17" cy="7" r="3"/><path d="M2 20c4-8 7-8 10-3 2-3 5-3 10 3"/>'),
  park: svg('<path d="M12 3 5 14h14ZM12 14v7"/>'), orchard: svg('<path d="M12 8c-6-3-8 3-6 8s4 5 6 3c2 2 4 2 6-3s0-11-6-8ZM12 8c0-3 1-4 3-5"/>'),
  golf: svg('<path d="M8 21V3l10 4-10 4M5 21h6"/>'),
  studio: svg('<path d="M9 3h6M10 3v4l-4 9a4 4 0 0 0 4 5h4a4 4 0 0 0 4-5l-4-9V3"/>'),
  resort: svg('<path d="M12 2v20M3 7l18 10M21 7 3 17"/>'), town: svg('<path d="M4 21V8l6-4v17M10 21V11h10v10M2 21h20M14 15h2"/>'),
  restaurant: svg('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 2-3 5-3 9h3M17 3v18"/>'), cafe: svg('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3"/>'),
  market: svg(BASKET), grocery: svg(BASKET), 'general-store': svg(BASKET), essentials: svg(BASKET), 'wine-shop': svg('<path d="M10 2h4v5c2 1 3 3 3 5v10H7V12c0-2 1-4 3-5ZM7 15h10"/>'),
  home: svg('<path d="M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6"/>'), event: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
};
for (const [k, as] of [['historic', 'town'], ['spa', 'resort'], ['pizza', 'restaurant'], ['bbq', 'restaurant'], ['deli', 'restaurant'], ['bar', 'restaurant'], ['bakery', 'cafe'], ['ice-cream', 'cafe']]) ICON[k] = ICON[as];
const KEY = 'afton-plan';
const fmtDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const iso = (d) => d.toISOString().slice(0, 10);

// Everything about the property (where the house is, its links, its quiet hours) comes from one config file.
const get = (u) => fetch(u).then((r) => r.json());
const [evData, places, region, property] = await Promise.all([get('/api/events.json'), get('/api/places.json'), get('/api/region.json'), get('/config/property.json')]);
const events = evData.events, HOME = { ...property.origin, id: 'origin' };
let ROAD = new Map();   // road minutes from the house to each place
try { const roads = await get('/api/drive.json'); useRoadTimes(roads); ROAD = new Map(roads.ids.map((id, i) => [id, roads.minutes[0][i]]).filter(([, m]) => m != null)); } catch { /* no road matrix: the planner falls back to its estimate */ }
const KINDS = { winery: 'Winery', brewery: 'Brewery', cidery: 'Cidery', distillery: 'Distillery', restaurant: 'Restaurant', pizza: 'Pizza', bbq: 'Barbecue', deli: 'Deli', bar: 'Bar', cafe: 'Café', bakery: 'Bakery', 'ice-cream': 'Ice cream', trail: 'Hike', park: 'Park', overlook: 'Overlook', grocery: 'Grocery', 'general-store': 'Country store', market: 'Market', 'wine-shop': 'Liquor store', essentials: 'Essentials', orchard: 'Orchard', resort: 'Resort', golf: 'Golf course', studio: 'Studio or gallery', historic: 'Historic site', spa: 'Spa', town: 'Town', venue: 'Venue' };
// the Places guide, in this order; anything else falls under "More to do". The places themselves are the site's one list (api/places.json).
const SECTIONS = [['wineries', 'Wineries', ['winery']], ['breweries', 'Breweries and cideries', ['brewery', 'cidery', 'distillery']], ['food', 'Food', ['restaurant', 'pizza', 'bbq', 'deli', 'bar']], ['coffee', 'Coffee and bakeries', ['cafe', 'bakery', 'ice-cream']], ['hikes', 'Hikes', ['trail', 'park']], ['views', 'Views', ['overlook']], ['groceries', 'Groceries', ['grocery', 'general-store', 'market', 'wine-shop']]];
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
  // the view: which day and tab, the three switches, the open row and any "show more" that has been opened. All of it travels in the link.
  day: q.get('d') ?? saved.day ?? null, tab: q.get('tab') ?? saved.tab ?? 'events', row: q.get('r') ?? null,
  near: q.has('f') ? q.get('f').includes('near') : !!saved.near, free: q.has('f') ? q.get('f').includes('free') : !!saved.free, kid: q.has('f') ? q.get('f').includes('kid') : saved.kid ?? (q.has('b') ? q.get('kids') === '1' : !!saved.kids),
  more: new Set((q.get('x') ?? saved.more?.join(',') ?? '').split(',').filter(Boolean)),
  booked: q.has('in') && q.has('out') ? { from: q.get('in'), to: q.get('out') } : saved.booked ?? null,   // arrived from a booking confirmation link
};
if (state.from < iso(new Date())) [state.from, state.to] = [f0, t0];
if (q.has('add')) { const [t, id] = q.get('add').split('~'), type = t === 'e' ? 'event' : 'place'; if (!state.basket.some((b) => b.type === type && b.id === id)) state.basket.push({ type, id }); }   // arriving from an Explore page
state.basket = state.basket.filter((b) => (b.type === 'event' ? eventById : placeById)[b.id]);
const inBasket = (type, id) => state.basket.some((b) => b.type === type && b.id === id);
function shareUrl() {
  const p = new URLSearchParams({ from: state.from, to: state.to, i: [...state.interests].join(','), d: state.day ?? '', tab: state.tab, f: ['near', 'free', 'kid'].filter((k) => state[k]).join(','), x: [...state.more].join(','), r: state.row ?? '', pace: state.pace, kids: +state.kids, dd: +state.driver, b: state.basket.map((b) => [b.type[0], b.id, b.pin?.date, b.pin?.start].filter((x) => x != null).join('~')).join(',') });
  for (const k of ['i', 'd', 'f', 'x', 'r', 'b']) if (!p.get(k)) p.delete(k);
  return `${location.origin}${location.pathname}?${p}`;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, interests: [...state.interests], more: [...state.more], open: undefined, row: undefined })); } catch { /* private mode */ }
  history.replaceState(null, '', shareUrl());
}
const toast = (t) => { $('#toast').textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => { $('#toast').textContent = ''; }, 5000); };

// ---------- dates, filters, options ----------
$('#from').value = state.from; $('#to').value = state.to; $('#from').min = $('#to').min = iso(new Date());
$('#pace').value = state.pace; $('#kids').checked = state.kids; $('#driver').checked = state.driver;
const readForm = () => {
  state.from = $('#from').value || state.from; state.to = $('#to').value || state.to;
  if (state.to < state.from) { state.to = state.from; $('#to').value = state.to; }
  if ($('#kids').checked !== state.kids) state.kid = $('#kids').checked;        // "Kids are coming" turns the kid-friendly filter on with it
  state.pace = $('#pace').value; state.kids = $('#kids').checked; state.driver = $('#driver').checked; render();
};
$('#setup').addEventListener('change', readForm); $('#opts').addEventListener('change', readForm);
$('#setup').addEventListener('submit', (e) => e.preventDefault());

// ---------- lists ----------
// The principle: a few good things shown large, everything else small, sorted and one tap away.
const hm = (s) => +s.slice(11, 13) * 60 + +s.slice(14, 16);
const short = (m) => clock(m).replace(':00', '');
const timeOf = (e) => (e.allDay ? 'Confirm times with organizer' : `${clock(hm(e.start))}${e.end ? ` to ${clock(hm(e.end))}` : ''}`);
const label = (k) => INTERESTS.find(([x]) => x === k)?.[1] ?? k;
const minsHome = (placeId) => (placeId && ROAD.has(placeId) ? ROAD.get(placeId) : null);
const kidOk = (e) => e.familyFriendly === true || e.categories.includes('family');
const wanted = (cats) => !state.interests.size || cats.some((c) => state.interests.has(c));
/** Does an event pass every filter? `skipInterests` is for the counts on the interest chips. */
const passEvent = (e, skipInterests) => (skipInterests || wanted(e.categories)) && (!state.near || (minsHome(e.placeId) ?? 99) <= 15) && (!state.free || e.free === true) && (!state.kid || kidOk(e));
const passPlace = (p) => wanted(p.interests) && (!state.near || (minsHome(p.id) ?? 99) <= 15);
const addBtn = (type, id, name) => { const on = inBasket(type, id); return `<button class="add" type="button" data-add="${type}" data-id="${esc(id)}" aria-pressed="${on}">${on ? 'Added ✓' : name ? `Add ${esc(name)}` : 'Add'}</button>`; };
const dots = (cats) => cats.slice(0, 3).map((c) => `<i class="dot" style="--c:${COLOR[c] ?? 'var(--ink)'}"></i>`).join('');
const sourceLinks = (e) => { const ls = e.sources.filter((s) => s.url).map((s) => `<a href="${esc(s.url)}" rel="noopener">Details at ${esc(s.name)}</a>`); return ls.length ? ls.join(' · ') : `<a href="/explore/events/${e.seriesId ?? e.id}/">More about this event</a>`; };
const facts = (e) => [e.price ? esc(e.price) : '', e.free === true ? 'Free' : '', kidOk(e) ? 'Family-friendly' : ''].filter(Boolean).join(' · ');
const visit = (p) => (p.typicalVisitMinutes >= 120 ? `${p.typicalVisitMinutes / 60} hours` : `${p.typicalVisitMinutes} min`);

/** A pick: the large card, the most room any event gets. */
function eventCard(e) {
  const m = minsHome(e.placeId);
  return `<li class="card ${inBasket('event', e.id) ? 'is-in' : ''}" style="--c:${COLOR[e.categories[0]] ?? 'var(--ink)'}" data-place="${esc(e.placeId ?? '')}"><div><p class="when">${esc(timeOf(e))}</p><h3>${esc(e.title)}</h3><p class="venue">${e.placeId ? `<button type="button" class="ghost" data-show="${esc(e.placeId)}">${esc(e.venueName)}</button>` : esc(e.venueName)}${m != null ? ` · <span class="nw">${m} min</span>` : ''}${e.price ? ` · ${esc(e.price)}` : ''}</p>
    <p class="tags">${e.categories.map((c) => `<span class="tag">${esc(label(c))}</span>`).join('')}</p></div>${addBtn('event', e.id)}
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}<p class="desc">${sourceLinks(e)}</p>${clashNote('e:' + e.id)}</li>`;
}
const clashNote = (key) => (clash.has(key) ? `<p class="row__clash" role="note"><b>These two clash.</b> ${esc(clash.get(key))}</p>` : '');
/** A compact row. `time` is the left column; `sub` the small line; `more` the details that open in place. */
function row({ key, place, time, title, sub, cats, more, add, cls = '' }) {
  const open = state.row === key, id = 'm-' + key.replace(/[^a-z0-9]+/gi, '-');
  return `<li class="row ${open ? 'is-open' : ''} ${cls}" data-row="${esc(key)}" data-place="${esc(place ?? '')}">
    <button type="button" class="row__main" aria-expanded="${open}" aria-controls="${id}"><span class="row__time">${time}</span><span class="row__text"><span class="row__title">${esc(title)}</span><span class="row__sub">${sub}</span></span><span class="row__dots" aria-hidden="true">${dots(cats)}</span></button>${add}
    <div class="row__more" id="${id}" ${open ? '' : 'hidden'}>${open ? more : ''}${clashNote(key)}</div></li>`;
}
const eventRow = (e) => { const m = minsHome(e.placeId), f = facts(e);
  return row({ key: 'e:' + e.id, place: e.placeId, time: e.allDay ? '<small>Time<br>to confirm</small>' : esc(short(hm(e.start))), title: e.title, cats: e.categories, cls: inBasket('event', e.id) ? 'is-in' : '',
    sub: [esc(e.venueName), m != null ? `<span class="nw">${m} min</span>` : '', esc(e.categories.slice(0, 2).map(label).join(', '))].filter(Boolean).join(' · '), add: addBtn('event', e.id),
    more: `<p class="row__when">${esc(timeOf(e))}${f ? ' · ' + f : ''}</p>${e.description ? `<p>${esc(e.description)}</p>` : ''}<p class="row__links">${sourceLinks(e)}${e.ticketUrl ? ` · <a href="${esc(e.ticketUrl)}" rel="noopener">Tickets</a>` : ''}${e.placeId ? ` · <button type="button" class="ghost" data-show="${esc(e.placeId)}">Show on map</button>` : ''}</p>` }); };
const placeRow = (p) => { const m = minsHome(p.id);
  return row({ key: 'p:' + p.id, place: p.id, time: m != null ? `<span class="nw">${m}<small> min</small></span>` : '', title: p.name, cats: p.interests, cls: (inBasket('place', p.id) ? 'is-in ' : '') + (p.ownerPick ? 'is-pick' : ''),
    sub: [esc(KINDS[p.kind] ?? p.kind), p.ownerPick ? 'Our pick' : '', `allow ${visit(p)}`].filter(Boolean).join(' · '), add: addBtn('place', p.id),
    more: `${p.ownerNote ? `<p class="row__note">“${esc(p.ownerNote)}”</p>` : ''}${p.notes ? `<p>${esc(p.notes)}</p>` : ''}${p.address ? `<p class="row__when">${esc(p.address.replace(/^Trailhead: /, 'Start: '))}</p>` : ''}<p class="row__when">Hours aren’t checked here. Confirm before you go.</p><p class="row__links">${p.url ? `<a href="${esc(p.url)}" rel="noopener">Website</a> · ` : ''}<button type="button" class="ghost" data-show="${esc(p.id)}">Show on map</button></p>` }); };

const onDates = () => { const days = dayList(state.from, state.to); return events.filter((e) => days.includes(e.start.slice(0, 10))); };
/** The stay as an agenda: duplicates merged, things that run across the stay pulled out, the rest by day. */
function agenda() {
  const days = dayList(state.from, state.to), seen = new Map();
  for (const e of onDates()) { const k = `${e.title.trim().toLowerCase()}|${e.placeId ?? e.venueName}|${e.start}`, twin = seen.get(k);
    if (!twin) { seen.set(k, e); continue; }
    for (const s of e.sources) if (!twin.sources.some((x) => x.id === s.id && x.url === s.url)) twin.sources.push(s); }   // one event from two sources: shown once, with both links
  const groups = new Map();
  for (const e of seen.values()) { const k = e.seriesId ?? `${e.title.trim().toLowerCase()}|${e.placeId ?? e.venueName}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(e); }
  const ongoing = [], single = [];
  for (const g of groups.values()) { if (g[0].seriesId || new Set(g.map((e) => e.start.slice(0, 10))).size > 1) ongoing.push(g); else single.push(...g); }
  return { days, ongoing, single };
}
/** Three to five picks for a day: the owners' flags first, then what matches the guest's interests, then the nearest, never two of a kind. */
function picksFor(list) {
  const want = Math.min(3, list.length);
  const score = (e) => [e.ownerPick ? 0 : 1, state.interests.size ? -e.categories.filter((c) => state.interests.has(c)).length : 0, minsHome(e.placeId) ?? 60];
  const ranked = [...list].sort((a, b) => { const x = score(a), y = score(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }), out = [], kinds = new Set();
  for (const e of ranked) { if (out.length >= want) break; if (e.ownerPick || !kinds.has(e.categories[0])) { out.push(e); kinds.add(e.categories[0]); } }
  for (const e of ranked) { if (out.length >= want) break; if (!out.includes(e)) out.push(e); }      // not enough variety to go round
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
const PARTS = [['morning', 'Morning', (e) => !e.allDay && hm(e.start) < 720], ['afternoon', 'Afternoon', (e) => !e.allDay && hm(e.start) >= 720 && hm(e.start) < 1020], ['evening', 'Evening', (e) => !e.allDay && hm(e.start) >= 1020], ['anytime', 'Time to confirm', (e) => e.allDay]];
const span = (g, days) => { const ds = [...new Set(g.map((e) => e.start.slice(0, 10)))]; return ds.length >= days.length && days.length > 1 ? 'every day' : ds.map((d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })).join(' & '); };
let pickPlaces = new Set(), dayEvents = [], byDay = new Map(), ongoingNow = [];

function renderLists() {
  const { days, ongoing, single } = agenda();
  if (!days.includes(state.day)) state.day = days[0];
  const flags = ['near', 'free', 'kid'].filter((k) => state[k]).length;
  // the bar: interests with their counts on these dates, a Filters button, and jump links
  const countable = [...single, ...ongoing.map((g) => g[0])].filter((e) => passEvent(e, true));
  $('#chips').innerHTML = INTERESTS.map(([k, l, c]) => { const n = countable.filter((e) => e.categories.includes(k)).length; return `<button type="button" data-k="${k}" style="--c:${c}" aria-pressed="${state.interests.has(k)}"${n || state.interests.has(k) ? '' : ' class="is-none"'}>${l} <b>${n}</b></button>`; }).join('');
  for (const b of document.querySelectorAll('[data-flag]')) b.setAttribute('aria-pressed', !!state[b.dataset.flag]);
  $('#filters-n').textContent = flags; $('#filters-n').hidden = !flags; $('#clear-filters').hidden = !(flags || state.interests.size);
  const shownSingle = single.filter((e) => passEvent(e)).sort((a, b) => a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) || a.allDay - b.allDay || a.start.localeCompare(b.start)), shownOngoing = ongoing.filter((g) => passEvent(g[0]));
  $('#n-events').textContent = shownSingle.length + shownOngoing.length; $('#n-places').textContent = places.filter(passPlace).length;
  $('#status').textContent = `${shownSingle.length + shownOngoing.length} things on your dates${state.interests.size || flags ? ' with these filters' : ''}`;
  const dname = (d, o) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...o });

  // three picks for the whole stay, then everything else as rows, day after day
  const picks = picksFor(shownSingle), rest = shownSingle.filter((e) => !picks.includes(e));
  byDay = new Map(days.map((d) => [d, shownSingle.filter((e) => e.start.slice(0, 10) === d)])); ongoingNow = shownOngoing;
  pickPlaces = new Set([...picks.map((e) => e.placeId), ...places.filter((p) => p.ownerPick).map((p) => p.id)].filter(Boolean));
  const strip = shownOngoing.length ? `<section class="allweek" aria-label="Running across your stay"><h4>${days.length > 4 ? 'All through your stay' : 'All weekend'}</h4><ul>${shownOngoing.map((g) => { const e = g[0], key = 'e:' + e.id, open = state.row === key;
      return `<li class="${open ? 'is-open' : ''} ${inBasket('event', e.id) ? 'is-in' : ''} ${e.ownerPick ? 'is-pick' : ''}" data-row="${esc(key)}" data-place="${esc(e.placeId ?? '')}"><button type="button" class="chip" aria-expanded="${open}"><i class="dot" style="--c:${COLOR[e.categories[0]] ?? 'var(--ink)'}"></i><span>${esc(e.title)}</span><small>${e.ownerPick ? 'our pick · ' : ''}${esc(span(g, days))}</small></button>${open ? `<div class="allweek__more"><p class="row__when">${esc(e.venueName)}${minsHome(e.placeId) != null ? ` · <span class="nw">${minsHome(e.placeId)} min</span>` : ''} · ${esc(e.categories.map(label).join(', '))}</p>${e.description ? `<p>${esc(e.description)}</p>` : ''}<p class="row__links">${sourceLinks(e)}${e.placeId ? ` · <button type="button" class="ghost" data-show="${esc(e.placeId)}">Show on map</button>` : ''}</p>${addBtn('event', e.id)}</div>` : ''}</li>`; }).join('')}</ul></section>` : '';
  const dayHtml = days.map((d) => { const rows = rest.filter((e) => e.start.slice(0, 10) === d), total = byDay.get(d).length;
    const body = !rows.length ? `<p class="daynote">${total ? `${dname(d, { weekday: 'long' })}’s ${total === 1 ? 'event is' : 'events are'} in my picks above.` : state.interests.size || flags ? 'Nothing this day matches those filters.' : 'Nothing listed yet for this day. Places have no set time.'}</p>`
      : rows.length > 4 ? PARTS.map(([, name, test]) => { const part = rows.filter(test); return part.length ? `<h5 class="partlabel">${name}</h5><ul class="rows">${part.map(eventRow).join('')}</ul>` : ''; }).join('')
      : `<ul class="rows">${rows.map(eventRow).join('')}</ul>`;
    return `<section class="dayblock" id="day-${d}" data-day="${d}"><h3 class="dayhead"><span>${fmtDay(d)}</span><small>${total} ${total === 1 ? 'event' : 'events'}</small></h3>${body}</section>`; }).join('');
  $('#list').innerHTML = `${picks.length ? `<section class="picks"><h4>My picks for your ${days.length > 4 ? 'stay' : 'weekend'}</h4><ul class="cards">${picks.map(eventCard).join('')}</ul></section>` : ''}${strip}${dayHtml}`;

  // places: a guide by kind, owners' picks first, then the nearest
  const ps = places.filter(passPlace), near = (a, b) => (minsHome(a.id) ?? 99) - (minsHome(b.id) ?? 99), used = new Set(SECTIONS.flatMap((s) => s[2]));
  const sections = [['picks', 'My picks', ps.filter((p) => p.ownerPick).sort(near)], ...SECTIONS.map(([id, name, kinds]) => [id, name, ps.filter((p) => kinds.includes(p.kind)).sort((a, b) => !!b.ownerPick - !!a.ownerPick || near(a, b))]), ['more', 'More to do', ps.filter((p) => !used.has(p.kind)).sort(near)]].filter((s) => s[2].length);
  $('#places').innerHTML = sections.map(([id, name, list]) => {
    const openAll = id === 'picks' || state.more.has('places:' + id), base = Math.max(4, list.filter((p) => p.ownerPick).length), shown = openAll ? list : list.slice(0, base);
    return `<section class="dayblock" id="places-${id}"><h3 class="dayhead"><span>${name}</span><small>${list.length}</small></h3><ul class="rows">${shown.map(placeRow).join('')}</ul>${list.length > shown.length ? `<button type="button" class="showmore" data-more="places:${id}">Show all ${list.length} ${esc(name.toLowerCase())}</button>` : ''}</section>`; }).join('') || '<p class="empty">No places match those filters.</p>';

  // jump links: days on "On your dates", sections on "Places"
  const SHORT = { picks: 'Picks', wineries: 'Wineries', breweries: 'Breweries', food: 'Food', coffee: 'Coffee', hikes: 'Hikes', views: 'Views', groceries: 'Groceries', more: 'More' };
  $('#jump-links').innerHTML = state.tab === 'places' ? sections.map(([id]) => `<a href="#places-${id}" data-jump="places-${id}">${SHORT[id]}</a>`).join('')
    : days.length > 1 ? days.map((d) => `<a href="#day-${d}" data-jump="day-${d}" ${d === state.day ? 'aria-current="true"' : ''}>${dname(d, { weekday: 'short' })} <b>${byDay.get(d).length}</b></a>`).join('') : '';
  setDay(state.day, true); watchDays();
}
/** The day the reader has scrolled to: the map shows that day's events, and its jump link is marked. */
function setDay(d, quiet) {
  if (!byDay.has(d)) return; const changed = state.day !== d; state.day = d;
  dayEvents = [...byDay.get(d), ...ongoingNow.map((g) => g.find((e) => e.start.slice(0, 10) === d) ?? g[0])];
  for (const a of document.querySelectorAll('#jump-links [data-jump^="day-"]')) a.toggleAttribute('aria-current', a.dataset.jump === 'day-' + d);
  if (changed && !quiet) { renderPins(); save(); }
}
let dayWatch = null;
function watchDays() {
  dayWatch?.disconnect(); if (!('IntersectionObserver' in window)) return;
  dayWatch = new IntersectionObserver((entries) => { const on = entries.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (on && state.tab !== 'places') setDay(on.target.dataset.day); }, { rootMargin: '-25% 0px -60% 0px' });
  for (const el of document.querySelectorAll('#list .dayblock')) dayWatch.observe(el);
}
const goTo = (id) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
// the bar's height feeds the sticky day headings, which sit just beneath it
{ const sizes = () => { document.documentElement.style.setProperty('--bar-h', `${Math.round($('#filters').getBoundingClientRect().height)}px`); document.documentElement.style.setProperty('--hd-h', `${Math.round(document.querySelector('.hd').getBoundingClientRect().height)}px`); };
  const ro = new ResizeObserver(sizes); ro.observe($('#filters')); ro.observe(document.querySelector('.hd')); }
// jump links, "show more", opening a row, the filters
$('#step2').addEventListener('click', (e) => {
  const jump = e.target.closest('[data-jump]'); if (jump) { e.preventDefault(); if (jump.dataset.jump.startsWith('day-')) setDay(jump.dataset.jump.slice(4)); goTo(jump.dataset.jump); return; }
  const more = e.target.closest('[data-more]'); if (more) { state.more.add(more.dataset.more); render(); return; }
  if (e.target.closest('#filters-btn')) { const p = $('#filter-panel'); p.hidden = !p.hidden; $('#filters-btn').setAttribute('aria-expanded', !p.hidden); return; }
  const flag = e.target.closest('[data-flag]'); if (flag) { state[flag.dataset.flag] = !state[flag.dataset.flag]; render(); return; }
  if (e.target.closest('#clear-filters')) { state.interests.clear(); state.near = state.free = state.kid = false; render(); return; }
  const chip = e.target.closest('#chips button'); if (chip) { state.interests.has(chip.dataset.k) ? state.interests.delete(chip.dataset.k) : state.interests.add(chip.dataset.k); const x = $('#chips').scrollLeft; render(); $('#chips').scrollLeft = x; document.querySelector(`#chips [data-k="${chip.dataset.k}"]`)?.focus({ preventScroll: true }); return; }
  const main = e.target.closest('.row__main, .allweek .chip'); if (main) { const key = main.closest('[data-row]').dataset.row; state.row = state.row === key ? null : key; render(); document.querySelector(`[data-row="${CSS.escape(key)}"] button`)?.focus({ preventScroll: true }); }
});
// a row lights its pin; arrow keys move between tabs
$('#step2').addEventListener('pointerover', (e) => { const r = e.target.closest('[data-place]'); hoverPin(r?.dataset.place || null); });
$('#step2').addEventListener('focusin', (e) => { const r = e.target.closest('[data-place]'); hoverPin(r?.dataset.place || null); });
for (const list of document.querySelectorAll('[role="tablist"]')) list.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')].filter((t) => t.offsetParent), i = tabs.indexOf(document.activeElement); if (i < 0) return;
  e.preventDefault(); tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].click();
});
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-show]');
  if (s) { if (!wide.matches) { showTab('map'); $('#step2').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } openPlace(s.dataset.show, true); return; }
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
  for (const p of places.filter(passPlace)) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding: 50, maxZoom: 13 });
}
function renderPins() {
  if (!map) return;
  pins.forEach((p) => p.remove()); pins = []; pinEls.clear();
  const add = (lng, lat, cls, color, icon, name, id, n) => {
    const el = Object.assign(document.createElement('button'), { type: 'button', className: `pin ${cls}`, innerHTML: icon });
    el.style.setProperty('--c', color); if (n) el.dataset.n = n;
    el.addEventListener('click', (e) => { e.stopPropagation(); if (id) { openPlace(id); revealRow(id); } else openHome(); });
    if (id) pinEls.set(id, el);
    pins.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
    el.setAttribute('aria-label', name);                              // after addTo: the map library sets a generic label of its own
  };
  add(HOME.lng, HOME.lat, 'pin--home', 'var(--ink)', ICON.home, 'The house (approximate)', null);
  const live = dayEvents;                                             // what the list is showing: the chosen day, after the filters
  for (const p of places) {
    const n = live.filter((e) => e.placeId === p.id).length;
    if (!n && !passPlace(p)) continue;
    const mine = inBasket('place', p.id) || live.some((e) => e.placeId === p.id && inBasket('event', e.id));
    add(p.lng, p.lat, `${n ? 'pin--busy' : ''} ${mine ? 'pin--in' : ''} ${pickPlaces.has(p.id) ? 'pin--pick' : ''} ${state.open === p.id ? 'is-open' : ''}`, p.color, ICON[p.kind] ?? ICON.event, `${p.name}${n ? `, ${n} event${n > 1 ? 's' : ''} on your dates` : ''}`, p.id, n);
  }
}
const pinEls = new Map();
function hoverPin(id) { for (const [k, el] of pinEls) el.classList.toggle('is-hover', k === id); }
/** From a pin to its row in the list that is showing: scroll there and open it. */
function revealRow(placeId) {
  const el = document.querySelector(`[data-panel]:not([hidden]) [data-row][data-place="${CSS.escape(placeId)}"]`); if (!el || !wide.matches) return;
  state.row = el.dataset.row; renderLists(); save();
  document.querySelector(`[data-row="${CSS.escape(state.row)}"]`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
    <p class="row">${addBtn('place', p.id, 'a visit')}${p.url ? `<a href="${esc(p.url)}" rel="noopener">Website</a>` : ''}</p>${es.length ? '<p class="pop__more">They are in the list for that day.</p>' : ''}`;
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
let plan = null, clash = new Map();   // item key -> what it overlaps with
function renderPlan() {
  clash = new Map();
  $('#count').textContent = state.basket.length;
  const n = state.basket.length;
  $('#send').hidden = $('#opts').hidden = !n; $('#tray').hidden = !n; $('#tray-text').textContent = `${n} added`;
  if (!n) { plan = null; $('#plan').innerHTML = '<p class="empty"><strong>Nothing here yet.</strong> Add a few things in step 2 and your days appear here in order, with drive times. Then you can email the plan to yourself, add it to your calendar, or share a link.</p>'; return; }
  plan = api.planItinerary({ origin: HOME, from: state.from, to: state.to, items: state.basket.map((b) => ({ type: b.type, slug: b.id, pin: b.pin })), interests: [...state.interests], constraints: { pace: state.pace, driver: state.driver, kids: state.kids, homeBy: property.homeBy } });
  const LABEL = { hard: 'These two clash', soft: 'Worth knowing', info: 'A small note', gap: 'Room to breathe' };
  const bad = new Set(plan.days.flatMap((d) => d.notes.filter((n) => n.level === 'hard').flatMap((n) => n.keys)));
  for (const d of plan.days) for (const n of d.notes) if (n.level === 'hard') for (const k of n.keys ?? []) clash.set(k, n.text);
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
  const A = window.AA_AVAIL;   // no booking link starts on a no-check-in day (config/availability-banner.json)
  $('#avail').href = $('#avail2').href = A ? A.link(state.from, state.to) ?? property.bookingUrl : u.href;
  $('#avail-row').classList.toggle('is-booked', !!mine);
  $('#avail-note').textContent = mine ? `Your stay: ${short(state.from)} to ${short(state.to)}. Check-in from ${property.checkIn}, check-out by ${property.checkOut}.` : '';
  $('#avail2').hidden = !!mine;
  // while the "last call" banner is on: if the house is not open for these dates, the waitlist takes the booking line's place
  const closed = !!A && A.state !== 'off' && !mine && !A.covers(state.from, state.to);
  $('#avail-row').hidden = closed; $('#avail-closed').hidden = !closed; if (A) $('#avail-year').textContent = A.year;
  if (closed) $('#avail2').hidden = true;
  const card = document.querySelector('#stay3 .avail'); if (card) card.hidden = !closed;
}
const wide = matchMedia('(min-width: 1024px)');   // list and map side by side: the map is always there, so it is not a tab
function showTab(name) {
  if (wide.matches && name === 'map') name = 'events';
  state.tab = name;
  for (const b of document.querySelectorAll('[data-tab]')) { b.setAttribute('aria-selected', b.dataset.tab === name); b.tabIndex = b.dataset.tab === name ? 0 : -1; }
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel === 'map' ? !wide.matches && name !== 'map' : p.dataset.panel !== name;
  $('#filters').hidden = name === 'map' && !wide.matches;
  if (map) map.resize();
}
for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { showTab(b.dataset.tab); render(); b.focus(); });
wide.addEventListener('change', () => showTab(state.tab));

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

function render() { renderBooking(); renderPlan(); renderLists(); renderPins(); renderDetail(); if (popup && state.open) popup.setHTML(popupHtml(placeById[state.open])); drawRoutes(); save(); }
showTab(state.tab);
initMap();
render();
if (q.get('d') && q.get('d') !== dayList(state.from, state.to)[0]) requestAnimationFrame(() => document.getElementById('day-' + q.get('d'))?.scrollIntoView({ block: 'start' }));
else if (q.get('r')) requestAnimationFrame(() => document.querySelector(`[data-row="${CSS.escape(q.get('r'))}"]`)?.scrollIntoView({ block: 'center' }));
