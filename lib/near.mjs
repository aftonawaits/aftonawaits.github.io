// The "Close by" list on trip and occasion pages. One place per row, optionally under small group headings.
//
// An item is { slug, note, group?, title?, season? }:
//   note    the line under the name. [[slug|words]] links to another place page; [[https://…|words]] links out.
//           Left out, the place's own description is used.
//   title   shown instead of the place's name (for example "Sunday polo at King Family Vineyards")
//   season  'polo': the row's group only shows from Memorial Day weekend to October 31 (see SEASONAL_JS)
// Drive times are road minutes from api/drive.json, as on the Explore pages.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const file = JSON.parse(readFileSync(ROOT + 'api/places.json', 'utf8')), PLACES = file.places ?? file;
const roads = JSON.parse(readFileSync(ROOT + 'api/drive.json', 'utf8')), at = new Map(roads.ids.map((id, i) => [id, i]));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const place = (slug) => { const p = PLACES.find((x) => x.slug === slug); if (!p) throw new Error('No such place on the site: ' + slug); return p; };
export function minutes(slug) { const i = at.get(slug); if (i == null || roads.minutes[0][i] == null) throw new Error(`No road time for ${slug}: run tools/drive-times.mjs`); return Math.max(1, roads.minutes[0][i]); }
/** Escapes a note and turns [[target|words]] into links. Every place it names must still be on the site. */
export const rich = (text) => esc(text).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, to, words) => (/^https?:/.test(to) ? `<a href="${to}" target="_blank" rel="noopener">${words}</a>` : `<a href="/explore/places/${place(to).slug}/">${words}</a>`));

export function resolve(items) { return items.map((it) => { const p = place(it.slug); return { ...it, p, name: it.title ?? p.name, note: it.note ?? p.notes ?? '', mins: minutes(it.slug) }; }); }

/** The list as HTML. `plan` is the planner address the "Add" buttons use. */
export function nearHtml(items, plan) {
  const rows = resolve(items), groups = [];
  for (const r of rows) { const g = groups.find((x) => x.name === (r.group ?? '')) ?? groups[groups.push({ name: r.group ?? '', season: r.season, rows: [] }) - 1]; g.rows.push(r); }
  const row = (r) => `
      <li><div><h3><a href="/explore/places/${r.p.slug}/">${esc(r.name)}</a></h3><p>${rich(r.note)}</p></div><span class="mins">${r.mins} min</span><a class="add" href="${plan}&amp;add=p~${r.p.slug}" aria-label="Add ${esc(r.p.name)} to my trip">Add</a></li>`;
  return groups.map((g, i) => `
    <div class="neargroup"${g.season ? ` data-season-row="${g.season}" hidden` : ''}>${g.name ? `<h3 class="near__h">${esc(g.name)}</h3>` : ''}
    <ul class="near"${i === 0 ? ' id="near-list"' : ''}>${g.rows.sort((a, b) => a.mins - b.mins).map(row).join('')}
    </ul></div>`).join('');
}

// Seasonal rows: shown from the Saturday of Memorial Day weekend to October 31. ?date=2026-06-14 pretends it is that day.
export const SEASONAL_JS = `{ const q = new URLSearchParams(location.search).get('date'), d = q ? new Date(q + 'T12:00:00') : new Date(), y = d.getFullYear();
  const lastMon = new Date(y, 4, 31); while (lastMon.getDay() !== 1) lastMon.setDate(lastMon.getDate() - 1);
  const from = new Date(lastMon); from.setDate(lastMon.getDate() - 2); from.setHours(0, 0, 0, 0); const to = new Date(y, 9, 31, 23, 59, 59);
  for (const el of document.querySelectorAll('[data-season-row="polo"]')) el.hidden = !(d >= from && d <= to); }
// phones show two lines of each description; a tap on the text opens the rest (links inside it still work)
for (const p of document.querySelectorAll('.near li p')) p.addEventListener('click', (e) => { if (!e.target.closest('a')) p.classList.toggle('is-open'); });`;

/** "What's on while you're here": the next three events that suit a trip, from the live calendar. The block stays hidden
 *  when nothing matches in the next 60 days. `interests` is a comma list, e.g. 'wine,music,market'. */
export const whatsOn = (interests) => `  <section class="sec" id="on" hidden>
    <h2>What’s on <em>while you’re here</em></h2>
    <ul class="on" id="events"></ul>
    <p class="more"><a href="/plan/?i=${interests}">See everything on your dates →</a></p>
  </section>`;
export const WHATS_ON_JS = (interests) => `try { const wants = '${interests}'.split(','), data = await (await fetch('/api/events.json')).json(), now = Date.now(), soon = now + 60 * 864e5, safe = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fmt = (s) => new Date(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const seen = new Set(), pick = (data.events ?? data).filter((e) => { const s = Date.parse(e.start); return s > now && s < soon && e.status !== 'cancelled' && e.categories?.some((c) => wants.includes(c)); }).sort((a, b) => a.start.localeCompare(b.start))
    .filter((e) => { const k = e.seriesId || e.title.trim().toLowerCase() + '|' + (e.venueName ?? ''); return seen.has(k) ? false : seen.add(k); }).slice(0, 3);
  if (pick.length) { document.getElementById('events').innerHTML = pick.map((e) => '<li><span>' + (e.through ? 'Through ' + fmt(e.through + 'T12:00:00') : fmt(e.start)) + '</span><h3><a href="/explore/events/' + (e.seriesId || e.id) + '/">' + safe(e.title) + '</a></h3><p>' + safe(e.venueName) + '</p></li>').join(''); document.getElementById('on').hidden = false; }
} catch { /* the calendar did not load: the block stays hidden */ }`;
