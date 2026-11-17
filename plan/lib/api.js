// The internal API: the only way the presentation layer (or a future standalone site) reaches the data and the planner.
// Plain functions over data you hand it, so the same file works in a browser, in a build script, or behind a server.
// It knows about a region, never about a property.
import { buildPlan, toICS, drive, dayList } from './planner.js';

/** @param {{ events: object[], places: object[], region: object }} data */
export function createApi({ events, places, region }) {
  const eventBySlug = new Map(events.map((e) => [e.id, e])), placeBySlug = new Map(places.map((p) => [p.id, p]));
  const within = (item, near, minutes) => !near || !item.lat || drive(near, item).minutes <= minutes;
  const hasCat = (cats, want) => !want?.length || (cats ?? []).some((c) => want.includes(c));
  return {
    region,
    /** Events between two dates (YYYY-MM-DD, inclusive), optionally by category and by drive time from a point. */
    listEvents({ from, to, categories, near, minutes = region.radiusMinutes } = {}) {
      const days = from && to ? new Set(dayList(from, to)) : null;
      return events.filter((e) => (!days || days.has(e.start.slice(0, 10))) && hasCat(e.categories, categories) && within(e, near, minutes));
    },
    listPlaces({ categories, kinds, near, minutes = region.radiusMinutes } = {}) {
      return places.filter((p) => hasCat(p.interests, categories) && (!kinds?.length || kinds.includes(p.kind)) && within(p, near, minutes));
    },
    getEvent: (slug) => eventBySlug.get(slug) ?? null,
    getPlace: (slug) => placeBySlug.get(slug) ?? null,
    /** items: [{ type: 'event'|'place', slug, pin?: { date, start } }]. origin: { lat, lng, label }. */
    planItinerary({ origin, from, to, items, interests = [], constraints = {} }) {
      const basket = items.map((it) => {
        const data = it.type === 'event' ? eventBySlug.get(it.slug) : placeBySlug.get(it.slug);
        return data && { key: `${it.type[0]}:${it.slug}`, type: it.type, data, placeKind: it.type === 'event' ? placeBySlug.get(data.placeId)?.kind : undefined, pin: it.pin };
      }).filter(Boolean);
      return buildPlan(basket, { origin, from, to, places, interests, corridors: region.corridors ?? [], pace: constraints.pace, kids: constraints.kids, driver: constraints.driver, homeBy: constraints.homeBy ?? null });
    },
    /** Places that would fit a free slot of `gap` minutes starting from `from` (a point), nearest first. */
    suggest({ from, gap, interests = [], exclude = [] }) {
      return places.filter((p) => p.lat && !exclude.includes(p.id) && hasCat(p.interests, interests))
        .map((p) => ({ place: p, minutes: drive(from, p).minutes })).filter((x) => x.minutes * 2 + x.place.typicalVisitMinutes <= gap).sort((a, b) => a.minutes - b.minutes).slice(0, 5);
    },
    toCalendar: (itinerary, opts) => toICS(itinerary, opts),
  };
}
