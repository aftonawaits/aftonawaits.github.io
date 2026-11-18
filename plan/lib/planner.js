// The itinerary planner. Pure functions, no page access, so the same file runs in the browser, in the build and in tests.
// It knows nothing about any property: the starting point (origin) and the region are passed in.
// Times inside the planner are minutes after midnight on a given date (YYYY-MM-DD), Eastern time.

const TASTING = new Set(['winery', 'brewery', 'cidery', 'distillery']);
const DAY_START = 10 * 60, DAY_END = 21 * 60;
const PACE = { easy: { buffer: 30, max: 3 }, steady: { buffer: 20, max: 4 }, full: { buffer: 10, max: 6 } };

export const mins = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
export const clock = (m) => { const h = Math.floor(m / 60) % 24, x = String(Math.round(m % 60)).padStart(2, '0'); return `${h % 12 || 12}:${x} ${h < 12 ? 'AM' : 'PM'}`; };
export const dayList = (from, to) => { const out = []; for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= to && out.length < 14; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };

let ROADS = null;
/** Optional road matrix { ids, minutes, miles } (rows and columns follow ids). With it, a leg between two known
 *  points uses the road time; any other leg falls back to the estimate below. Pass null to clear it. */
export function useRoadTimes(t) { ROADS = t?.ids ? { index: new Map(t.ids.map((id, i) => [id, i])), minutes: t.minutes, miles: t.miles } : null; }

/** Drive time in minutes. Road time when both ends are in the road matrix; otherwise an estimate from straight-line
 *  distance, lengthened for mountain roads, at a rural average speed. */
export function drive(a, b) {
  if (ROADS) { const i = ROADS.index.get(a?.id), j = ROADS.index.get(b?.id), m = i != null && j != null ? ROADS.minutes[i]?.[j] : null; if (m != null) return { minutes: m, miles: ROADS.miles?.[i]?.[j] ?? null, estimated: false }; }
  if (!a?.lat || !b?.lat) return { minutes: 20, miles: null, estimated: true, unknown: true };
  const R = 3958.8, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(h)) * 1.4;
  return { minutes: miles < 0.15 ? 0 : Math.round(miles / 34 * 60 + 3), miles: +miles.toFixed(1), estimated: true };
}

/** Sunset as minutes after midnight, Eastern. Standard solar approximation, good to a few minutes. */
export function sunset(date, lat, lng) {
  const d = new Date(date + 'T12:00:00Z'), n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5), rad = Math.PI / 180;
  const g = 2 * Math.PI / 365 * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
  const utc = 720 - 4 * (lng - ha) - eq;                                  // minutes UTC
  const off = -new Date(date + 'T23:00:00Z').toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).match(/GMT([+-]\d+)/)[1] * 60;
  return Math.round(utc - off);
}

/** Turn a basket entry into something the planner can place. */
function prepare(item) {
  if (item.type === 'event') {
    const e = item.data, date = e.start.slice(0, 10);
    if (e.allDay) return { ...item, date, flexible: true, duration: 90, timeUnknown: true };
    const start = mins(e.start), end = e.end && e.end.slice(0, 10) === date ? mins(e.end) : start + 120;
    return { ...item, date, flexible: false, start, end, assumedEnd: !e.end };
  }
  return { ...item, date: item.pin?.date ?? null, flexible: !item.pin, start: item.pin?.start, end: item.pin ? item.pin.start + item.data.typicalVisitMinutes : undefined, duration: item.data.typicalVisitMinutes };
}
const where = (s) => ({ id: s.data.placeId ?? s.data.id, lat: s.data.lat, lng: s.data.lng });

/** Build a day-by-day plan.  basket: [{ key, type: 'event'|'place', data, pin?, locked? }] */
export function buildPlan(basket, { origin, from, to, pace = 'steady', places = [], interests = [], driver = false, kids = false, corridors = [], homeBy = null } = {}) {
  if (!origin?.lat) throw new Error('buildPlan needs an origin { lat, lng }');
  const HOME = origin;
  const P = PACE[pace] ?? PACE.steady, dates = dayList(from, to);
  const days = dates.map((date) => ({ date, stops: [], legs: [], notes: [], sunset: sunset(date, origin.lat, origin.lng) }));
  const byDate = Object.fromEntries(days.map((d) => [d.date, d])), unplaced = [];
  const items = basket.map(prepare);

  // 1. Things with a fixed time go in first.
  for (const it of items.filter((i) => !i.flexible)) {
    const day = byDate[it.date];
    if (!day) { unplaced.push({ item: it, why: 'It is outside your dates.' }); continue; }
    day.stops.push(it);
  }
  for (const d of days) d.stops.sort((a, b) => a.start - b.start);

  // 2. Flexible things take the gap that adds the least driving. Scenic sunset stops aim for the light.
  const fits = (day, it, start) => {
    const end = start + it.duration, s = [...day.stops, { ...it, start, end }].sort((a, b) => a.start - b.start), i = s.findIndex((x) => x.key === it.key);
    const prev = s[i - 1], next = s[i + 1];
    if (start < DAY_START || end > DAY_END) return null;
    if (prev && prev.end + drive(where(prev), where(it)).minutes + P.buffer > start) return null;
    if (next && end + drive(where(it), where(next)).minutes + P.buffer > next.start) return null;
    return drive(prev ? where(prev) : HOME, where(it)).minutes + drive(where(it), next ? where(next) : HOME).minutes - drive(prev ? where(prev) : HOME, next ? where(next) : HOME).minutes;
  };
  for (const it of items.filter((i) => i.flexible)) {
    let best = null;
    for (const day of it.date ? [byDate[it.date]].filter(Boolean) : days) {
      if (day.stops.length >= P.max) continue;
      const starts = it.data.bestLight === 'sunset' ? [day.sunset - it.duration + 10] : [];
      for (let t = DAY_START; t + it.duration <= DAY_END; t += 15) starts.push(t);
      for (const [n, t] of starts.entries()) {
        const cost = fits(day, it, t);
        if (cost == null) continue;
        const score = cost + day.stops.length * 12 + (it.data.bestLight === 'sunset' && n === 0 ? -60 : 0) + t / 600;   // spread across days, earlier first
        if (!best || score < best.score) best = { day, t, score };
        if (it.data.bestLight !== 'sunset' || n > 0) break;                  // earliest slot in this day is enough
      }
    }
    if (!best) { unplaced.push({ item: it, why: it.date && !byDate[it.date] ? 'It is outside your dates.' : 'No gap is long enough. Remove something or choose an easier day.' }); continue; }
    best.day.stops.push({ ...it, start: best.t, end: best.t + it.duration });
    best.day.stops.sort((a, b) => a.start - b.start);
  }

  // 3. Legs and feedback.
  for (const d of days) {
    const s = d.stops, note = (level, text, keys = []) => d.notes.push({ level, text, keys });
    for (let i = 0; i <= s.length; i++) {
      if (!s.length) break;
      const a = s[i - 1], b = s[i], leg = drive(a ? where(a) : HOME, b ? where(b) : HOME);
      d.legs.push({ from: a?.key ?? 'home', to: b?.key ?? 'home', mode: 'drive', ...leg, options: [] });   // options[]: shuttles, drivers, bikes attach here later
      if (!a || !b) continue;
      const gap = b.start - a.end;
      if (gap < 0) note('hard', `${a.data.title ?? a.data.name} and ${b.data.title ?? b.data.name} overlap by ${-gap} minutes.`, [a.key, b.key]);
      else if (gap < leg.minutes) note('hard', `About ${leg.minutes} minutes’ drive from ${a.data.venueName || a.data.name} to ${b.data.venueName || b.data.name}, but only ${gap} between them.`, [a.key, b.key]);
      else if (gap - leg.minutes < 15) note('soft', `Tight: ${gap - leg.minutes} minutes to spare getting to ${b.data.title ?? b.data.name}.`, [b.key]);
      else if (gap - leg.minutes >= 90) {
        const have = new Set(basket.flatMap((x) => [x.data.id, x.data.placeId])), near = places.filter((p) => !have.has(p.id) && p.lat && (!interests.length || interests.some((k) => (p.interests ?? []).includes(k))))
          .map((p) => ({ p, extra: drive(where(a), p).minutes + drive(p, where(b)).minutes })).filter((x) => x.extra + x.p.typicalVisitMinutes + 20 <= gap).sort((x, y) => x.extra - y.extra).slice(0, 3);
        d.notes.push({ level: 'gap', text: `${Math.floor((gap - leg.minutes) / 60)} free hours after ${clock(a.end)}.`, suggest: near.map((x) => x.p.id), keys: [] });
      }
    }
    const kind = (x) => x.type === 'place' ? x.data.kind : x.placeKind;
    let run = 0;
    for (const x of s) { run = TASTING.has(kind(x)) && !(x.data.categories ?? []).includes('food') ? run + 1 : 0; if (run === 3) note('soft', 'Three tastings in a row. Put a meal or a walk between them.'); }
    const tastings = s.filter((x) => TASTING.has(kind(x))).length;
    if (tastings >= 2 && !driver) note('soft', `${tastings} tasting stops today. Decide who is driving, or tick “designated driver”.`);
    for (const c of corridors) {                                           // a north-south road people tend to zigzag along
      const lat = s.filter((x) => x.data.lat && Math.abs(x.data.lng - c.lng) < c.halfWidth).map((x) => x.data.lat);
      let turns = 0; for (let i = 2; i < lat.length; i++) if (Math.abs(lat[i - 1] - lat[i - 2]) > 0.01 && Math.abs(lat[i] - lat[i - 1]) > 0.01 && Math.sign(lat[i] - lat[i - 1]) !== Math.sign(lat[i - 1] - lat[i - 2])) turns++;
      if (turns) note('soft', `You double back along ${c.name}. Reordering the stops north to south would save driving.`);
    }
    for (const x of s) {
      if (x.timeUnknown) note('soft', `${x.data.title} has no published time. Check with the venue; we pencilled it in at ${clock(x.start)}.`, [x.key]);
      if (x.assumedEnd) note('info', `${x.data.title} has no end time listed; we allowed two hours.`, [x.key]);
      if (x.data.scenic && x.data.bestLight === 'sunset' && Math.abs(x.end - d.sunset) > 45) note('soft', `Sunset is at ${clock(d.sunset)}. ${x.data.name} is best in that light.`, [x.key]);
      if (x.data.scenic && x.start > d.sunset) note('soft', `${x.data.name} starts after dark (sunset ${clock(d.sunset)}).`, [x.key]);
      if (x.data.weatherSensitive) note('info', `${x.data.name} depends on the weather. Check the forecast the day before.`, [x.key]);
      if (kids && TASTING.has(kind(x)) && x.data.familyFriendly !== true) note('info', `${x.data.venueName || x.data.name}: check that children are welcome.`, [x.key]);
    }
    if (homeBy && s.length && s.at(-1).end + d.legs.at(-1).minutes > homeBy.minutes) note('soft', homeBy.message);
  }
  return { days, unplaced };
}

/** The plan as an iCalendar file (Google, Apple and Outlook all import it). */
export function toICS(plan, { calendarName = 'Itinerary', uidDomain = 'itinerary.local' } = {}) {
  const stamp = (date, m) => `${date.replaceAll('-', '')}T${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
  const esc = (s = '') => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${calendarName}//EN`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${calendarName}`];
  for (const d of plan.days) for (const s of d.stops) L.push('BEGIN:VEVENT', `UID:${s.key}-${d.date}@${uidDomain}`, `DTSTAMP:${stamp(d.date, 0)}Z`, `DTSTART;TZID=America/New_York:${stamp(d.date, s.start)}`, `DTEND;TZID=America/New_York:${stamp(d.date, s.end)}`, `SUMMARY:${esc(s.data.title ?? s.data.name)}`, `LOCATION:${esc([s.data.venueName, s.data.address].filter(Boolean).join(', ') || s.data.name)}`, `URL:${s.data.sources?.[0]?.url ?? s.data.url ?? ''}`, 'END:VEVENT');
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
