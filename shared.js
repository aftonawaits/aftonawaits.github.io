// Shared by the three landing prototypes: the trips, remembering a choice, and going to a trip page.
export const TRIPS = [
  { id: 'family', key: 1, name: 'Family', long: 'A family trip', img: 'poolLevel-800' },
  { id: 'girls', key: 2, name: 'The girls', long: 'A girls’ trip', img: 'patioPorch-800' },
  { id: 'game-day', key: 3, name: 'Game day', long: 'A UVA game weekend with the kids', img: 'porchView-800' },
  { id: 'outdoors', key: 4, name: 'Trails & snow', long: 'An outdoor and ski trip', img: 'valleyDusk-800' },
  { id: 'trail151', key: 5, name: 'Route 151', long: 'A wine and beer trail trip', img: 'dining-800' },
];
/** Trips that have been renamed: an old id in a saved choice or a link maps to its replacement. */
export const ALIAS = { golf: 'game-day' };
/** What the planner opens with for each trip (its interest filters). */
export const PLAN_INTERESTS = { family: ['family', 'festival', 'market'], girls: ['wine', 'music', 'market'], 'game-day': ['music', 'beer-cider', 'food'], outdoors: ['outdoors', 'scenic'], trail151: ['wine', 'beer-cider', 'music'] };
export const byId = (id) => TRIPS.find((t) => t.id === (ALIAS[id] ?? id));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'afton-trip';

// The girls' weekend lives on its own site. In a mixed trip the other choice leads and the girls' site is linked from that page.
export const EXTERNAL = {};   // every trip now has its own page here
export const HOUSE = '/long-light/';
export const url = (ids) => {
  const o = [...ids].sort((a, b) => (a in EXTERNAL) - (b in EXTERNAL));
  return o[0] in EXTERNAL ? EXTERNAL[o[0]] : `/trips/${byId(o[0]).id}/${o[1] ? `?also=${byId(o[1]).id}` : ''}`;
};
export function remember(ids) { try { localStorage.setItem(KEY, JSON.stringify({ ids, from: location.pathname, at: Date.now() })); } catch { /* private mode */ } }
const DAY = 24 * 60 * 60 * 1000;
/** The remembered trip, or null. It is forgotten after 24 hours. */
export function recall() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && !(Date.now() - v.at < DAY)) { localStorage.removeItem(KEY); return null; } if (v?.ids?.some((i) => i in ALIAS)) { v.ids = [...new Set(v.ids.map((i) => ALIAS[i] ?? i))]; localStorage.setItem(KEY, JSON.stringify(v)); }   // a saved 'golf' becomes 'game-day'
  return v && v.ids?.every(byId) ? v : null; } catch { return null; } }
export function forget() { try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ } }
export function go(ids, delay = 0) { remember(ids); setTimeout(() => { location.href = url(ids); }, reduced ? 0 : delay); }
export const label = (ids) => ids.map((i) => byId(i).name).join(' + ');

/** Returning visitors: a quiet banner that takes them back to their trip, with a way to switch.
 *  In production this would redirect straight away; the prototype shows the banner so you can keep testing. */
export function welcomeBack(el) {
  const v = recall(); if (!v || !el) return;
  el.innerHTML = `<span>Welcome back.</span> <a href="${url(v.ids)}">Continue to ${label(v.ids)}</a> <button type="button">Switch trip</button>`;
  el.hidden = false;
  el.querySelector('button').addEventListener('click', () => { forget(); el.hidden = true; });
}
