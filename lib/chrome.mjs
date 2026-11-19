// The parts every page shares: head tags (canonical, share preview, theme colour, season switch), the header,
// the footer, the two standard buttons and the proof lines. Used by build-trip, build-occasions, build-explore and
// build-static (which stamps the hand-written home and plan pages). The Long Light imports it from vite.config.js.
// All wording and numbers come from config/property.json, so they change in one place.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
export const cfg = JSON.parse(readFileSync(ROOT + 'config/property.json', 'utf8'));
export const SITE = cfg.siteUrl.replace(/\/$/, '');
export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NIGHT = '#17120f', LINEN = '#efe6d8';
const md = (s) => +s.replace('-', '');

/** 'pool' between the configured dates, 'cool' the rest of the year. Used for anything a crawler reads (titles, share text). */
export function seasonOn(date = new Date()) {
  const forced = process.env.SEASON; if (forced === 'pool' || forced === 'cool') return forced;
  const now = (date.getMonth() + 1) * 100 + date.getDate();
  return now >= md(cfg.season.poolOpen) && now <= md(cfg.season.poolClose) ? 'pool' : 'cool';
}
export const SEASON = seasonOn();
/** Text or markup that differs by season. Both are in the page; the visitor's own date picks one (see seasonScript). */
export const S = (pool, cool) => (pool === cool ? pool : `<span class="s-pool">${pool}</span><span class="s-cool">${cool}</span>`);
/** For a title or a share tag, which cannot hold both. */
export const now = (pool, cool) => (SEASON === 'pool' ? pool : cool);
/** Ski season on the site (the winter version of the trail page): snowFrom to snowTo, wrapping the new year. */
export function snowOn(date = new Date()) { const n = (date.getMonth() + 1) * 100 + date.getDate(); return n >= md(cfg.season.snowFrom) || n <= md(cfg.season.snowTo); }
export const SNOW = process.env.SNOW ? process.env.SNOW === 'on' : snowOn(process.env.BUILD_DATE ? new Date(process.env.BUILD_DATE + 'T12:00:00') : new Date());
/** Markup that differs in ski season. Both versions are in the page; the visitor's date picks one. */
export const W = (winter, rest) => `<span class="w-on">${winter}</span><span class="w-off">${rest}</span>`;
/** Runs before the page paints. It sets the pool season (data-season) and ski season (data-snow) from the visitor's date.
 *  For checking other times of year: ?date=2026-12-01, or ?season=winter|spring|summer|fall (also pool|cool). */
export const seasonScript = () => `<script>(function(){var P=new URLSearchParams(location.search),q=P.get('season'),qd=P.get('date'),d=qd?new Date(qd+'T12:00:00'):new Date(),n=(d.getMonth()+1)*100+d.getDate(),s=q==='pool'||q==='summer'?'pool':q==='cool'||q==='winter'||q==='spring'?'cool':(n>=${md(cfg.season.poolOpen)}&&n<=${md(cfg.season.poolClose)}?'pool':'cool'),w=q==='winter'?'on':q&&!qd?'off':(n>=${md(cfg.season.snowFrom)}||n<=${md(cfg.season.snowTo)}?'on':'off'),h=document.documentElement;h.dataset.season=s;h.dataset.snow=w;document.addEventListener('DOMContentLoaded',function(){var t=(w==='on'&&document.querySelector('meta[name="aa:title-snow"]'))||document.querySelector('meta[name="aa:title-'+s+'"]');if(t&&!h.dataset.sells)document.title=t.content;if(q||qd)document.querySelectorAll('a[href^="/"]').forEach(function(a){var u=a.getAttribute('href');if(u.indexOf('season=')<0&&u.indexOf('date=')<0&&u.indexOf('#')!==0)a.href=u.replace(/(\\?|#|$)/,function(m){return '?'+(qd?'date='+qd:'season='+q)+(m==='?'?'&':m)})})})})()</script>`;

/** Campaign tags (for example ?utm_source=instagram on the link in the Instagram bio) are remembered for the visit and
 *  passed on to the booking site, so a booking that began on Instagram can be counted there. */
export const utmScript = () => `<script>(function(){var K='aa-utm',q=new URLSearchParams(location.search),u={};q.forEach(function(v,k){if(k.indexOf('utm_')===0)u[k]=v});try{if(Object.keys(u).length)sessionStorage.setItem(K,JSON.stringify(u));else u=JSON.parse(sessionStorage.getItem(K)||'{}')}catch(e){}if(!Object.keys(u).length)return;document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('a[href*="eviivo.com"]').forEach(function(a){try{var h=new URL(a.href);Object.keys(u).forEach(function(k){h.searchParams.set(k,u[k])});a.href=h.href}catch(e){}})})})()</script>`;

/** Share image: a 1200×630 JPEG made by tools/og.py from the graded photo of the same name. */
export const og = (name) => `${SITE}/img/og/${name}.jpg`;

/** Canonical, share tags, theme colour and the season switch. `titles` = [pool, cool] when the title is seasonal. */
export function head({ path, title, description, image = 'houseDusk', type = 'website', dark = false, titles, snowTitle, noindex = !cfg.indexable }) {
  const url = SITE + path;
  return `<link rel="canonical" href="${url}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="${dark ? NIGHT : LINEN}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(cfg.brand)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${og(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">${snowTitle ? `\n<meta name="aa:title-snow" content="${esc(snowTitle)}"><meta name="aa:title-pool" content="${esc(title)}"><meta name="aa:title-cool" content="${esc(title)}">` : ''}${titles ? `\n<meta name="aa:title-pool" content="${esc(titles[0])}"><meta name="aa:title-cool" content="${esc(titles[1])}">` : ''}
${seasonScript()}
${utmScript()}
${availScript()}`;
}

/** "Last call" banner and waitlist (config/availability-banner.json). The script decides, from the visitor's date,
 *  what the strip says and where booking buttons go; see lib/avail-runtime.js. */
export const AVAIL = JSON.parse(readFileSync(ROOT + 'config/availability-banner.json', 'utf8'));
export const availScript = ({ home = '/' } = {}) => `<script>(${readFileSync(ROOT + 'lib/avail-runtime.js', 'utf8').replace(/^\/\/.*\n/gm, '').trim()})(${JSON.stringify({ active: !!AVAIL.active, openDates: AVAIL.openDates ?? [], midweekOpen: !!AVAIL.midweekOpen, midweekNights: AVAIL.midweekNights ?? [], noCheckIn: AVAIL.noCheckIn ?? [], nextYear: AVAIL.nextYear, nextYearOpens: AVAIL.nextYearOpens ?? null })},${JSON.stringify({ url: cfg.bookingUrl, start: cfg.booking.startParam, end: cfg.booking.endParam, extra: cfg.booking.extra })},${JSON.stringify({ home, book: cfg.labels.book, direct: cfg.direct.short })})</script>`.replace(/<\/(?=script>.)/g, '<\\/');
/** The top strip. It says "Book direct and save" until the banner is active, then the script rewrites it.
 *  `only`: for pages that have no strip of their own, it shows only while the banner is active. */
export const strip = ({ mood = '', only = false } = {}) =>
  `<a class="strip${only ? ' strip--pin' : ''}" data-avail-strip${mood ? ` data-mood="${mood}"` : ''}${only ? ' hidden' : ''} href="${esc(cfg.bookingUrl)}" target="_blank" rel="noopener"><b>${esc(cfg.direct.short)}.</b> ${esc(cfg.direct.long.replace(cfg.direct.short + '. ', ''))}</a>`;
/** The waitlist card: one field, one button. `dates`: also the line of open dates above it ("full" = on a page with
 *  no strip, the line also says when nothing is left). Hidden until the script shows it. */
export const waitlist = ({ id = 'waitlist', dates = false, block = true, h = 'h2' } = {}) => { const Y = AVAIL.nextYear, tag = `waitlist-${Y}`;
  const opens = AVAIL.nextYearOpens ? `opens ${new Date(AVAIL.nextYearOpens + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : 'opens soon';
  return `<div class="avail"${block ? ' data-avail-block' : ''} hidden>${dates ? `<p class="avail__dates" id="dates" data-avail-dates${dates === 'full' ? '="full"' : ''} hidden></p>` : ''}
<div class="wl-card"><form class="wl" id="${id}" name="${esc(AVAIL.signup.form)}" method="POST" action="${esc(AVAIL.signup.endpoint)}" data-netlify="true" netlify-honeypot="company" data-waitlist novalidate>
<input type="hidden" name="form-name" value="${esc(AVAIL.signup.form)}"><input type="hidden" name="list" value="${tag}">
<p class="wl__sr"><label>Leave this empty <input name="company" tabindex="-1" autocomplete="off"></label></p>
<${h} class="wl__h">Want first pick of ${Y}?</${h}>
<p class="wl__p">The calendar ${opens}, and the best weekends always go first: fall foliage, UVA game days and summer pool weekends. Leave your email and you’ll hear before anyone else.</p>
<div class="wl__row"><label class="wl__sr" for="${id}-email">Email address</label><input type="email" id="${id}-email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" required aria-describedby="${id}-msg ${id}-fine"><button type="submit">Put me on the list</button></div>
<p class="wl__err" id="${id}-msg" role="alert" hidden></p>
<p class="wl__fine" id="${id}-fine">One email when ${Y} opens. That’s it. We’ll only use this to tell you when ${Y} opens.</p>
</form><p class="wl__done" role="status" tabindex="-1" hidden>You’re on the list. You’ll hear from us the moment ${Y} opens.</p></div></div>`; };

const book = (cls = 'btn') => `<a class="${cls}" href="${esc(cfg.bookingUrl)}" target="_blank" rel="noopener" data-book>${esc(cfg.labels.book)}</a>`;
const planA = (href, cls) => `<a class="${cls}" href="${esc(href)}">${esc(cfg.labels.plan)}</a>`;

/** The Instagram link: a small glyph in the text colour and the handle, both from config. Plain link, no embed. */
export const IG_ICON = '<svg class="ig" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>';
export const insta = ({ cls = '', icon = true, text = `@${cfg.instagramHandle}` } = {}) =>
  `<a class="iglink ${cls}" href="${esc(cfg.instagramUrl)}" target="_blank" rel="noopener" aria-label="Afton Awaits on Instagram (opens in a new tab)">${icon ? IG_ICON : ''}<span>${esc(text)}</span></a>`;
/** "Staying with us? Tag @afton.awaits." for the end of trip pages. */
export const tagUs = () => `<p class="tagus">Staying with us? Tag ${insta({ icon: false })}. We share our favorite guest photos.</p>`;

/** The same header on every page: the mark, then Plan your trip (outline) and Check dates and book (honey). */
export const header = ({ plan = '/plan/', extra = '', home = '/' } = {}) =>
  `<header class="hd" data-mood="evening"><a class="mark" href="${home}">Afton <em>Awaits</em></a><nav aria-label="Site">${extra}${planA(plan, 'hd__plan')}${book('hd__book')}</nav></header>`;

/** The two standard buttons, with the rating beside them. */
export const cta = (plan = '/plan/', { proofLine = true } = {}) =>
  `<p class="cta">${book('btn')}${planA(plan, 'btn btn--ghost')}</p>${proofLine ? `\n<p class="proof">${esc(cfg.proof.line)}</p>` : ''}`;
export const proof = () => `<p class="proof">${esc(cfg.proof.line)}</p>`;
export const safe = () => `<p class="proof proof--safe">${esc(cfg.proof.safe)}</p>`;

/** The same footer on every page. `note` is a line specific to the page (for example when the listings were refreshed). */
export const footer = ({ note = '', house = cfg.houseUrl, home = '/', plan = '/plan/', explore = '/explore/', minimal = false } = {}) => minimal
  // the home page keeps its links in the corner menu, so its footer is only the name and the host line
  ? `<footer class="ft ft--min" data-mood="evening">\n<p class="mark">Afton <em>Awaits</em></p>\n<p class="ft__where">Afton, Nelson County, Virginia · ${esc(cfg.host)}</p>\n</footer>`
  : `<footer class="ft" data-mood="evening">
<p class="mark">Afton <em>Awaits</em></p>
<p class="ft__where">Afton, Nelson County, Virginia · ${esc(cfg.host)}</p>
<nav aria-label="Footer"><a href="${esc(house)}">The house</a><a href="${plan}">${esc(cfg.labels.plan)}</a><a href="${explore}">Things to do</a>${insta({ cls: 'ft__ig' })}</nav>
<p class="ft__book">${book('btn')}</p>
<p class="proof">${esc(cfg.proof.line)}</p>
<p class="proof proof--safe">${esc(cfg.proof.safe)}</p>${note ? `\n<p class="ft__note">${note}</p>` : ''}
</footer>`;

// "Send this to the group": the phone's own share sheet where there is one, otherwise the link is copied.
export const SHARE_JS = `for (const b of document.querySelectorAll('[data-share]')) b.addEventListener('click', async () => { const url = location.origin + location.pathname, title = document.title;
  try { if (navigator.share) { await navigator.share({ title, url }); return; } await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; } catch { /* closed the sheet */ }
  setTimeout(() => { b.textContent = 'Send this to the group'; }, 2400); });`;

/** The CSS for the header and footer, for pages that do not load shared.css (the Long Light). Kept beside the markup. */
export const CHROME_CSS = `
.hd { position: sticky; top: 0; z-index: 30; display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: .6rem clamp(.75rem, 3vw, 2rem); background: color-mix(in srgb, #17120f 92%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid rgb(200 149 90 / .28); color: #f3eadb; }
.hd .mark { color: #f3eadb; white-space: nowrap; text-decoration: none; }
.hd nav { display: flex; align-items: center; gap: .5rem; font-family: var(--sans); font-size: .875rem; }
.hd nav a { white-space: nowrap; text-decoration: none; font-weight: 600; padding: .45rem .95rem; border-radius: 99px; border: 1px solid transparent; line-height: 1.2; }
.hd nav a.hd__link { font-weight: 500; color: #b5a48f; padding-inline: .2rem; text-decoration: underline; text-underline-offset: .3em; }
.hd nav a.hd__link:hover { color: #f3eadb; }
.hd__plan { color: #f3eadb; border-color: #c8955a !important; } .hd__plan:hover { background: rgb(200 149 90 / .16); }
.hd__book { color: #2a2019; background: #d6a45e; border-color: #d6a45e !important; } .hd__book:hover { background: #e0b577; }
@media (max-width: 520px) { .hd { gap: .4rem; padding-inline: .7rem; } .hd .mark { font-size: 1.02rem; } .hd nav { gap: .35rem; font-size: .75rem; } .hd nav a { padding: .4rem .6rem; } .hd nav a.hd__link { display: none; } }
@media (max-width: 370px) { .hd .mark em { display: none; } }
.ft { display: grid; gap: .7rem; justify-items: start; padding: 2.6rem clamp(1.1rem, 4vw, 4rem) calc(2.8rem + env(safe-area-inset-bottom)); background: #17120f; color: #f3eadb; border-top: 1px solid rgb(200 149 90 / .28); font-family: var(--sans); font-size: .9375rem; }
.ft p { margin: 0; } .ft .mark { font-size: 1.5rem; color: #f3eadb; } .ft .mark em { color: #d6a45e; }
.ft__where, .ft__note { color: #b5a48f; } .ft__note { font-size: .8125rem; max-width: 46rem; }
.ft nav { display: flex; flex-wrap: wrap; gap: .3rem 1.4rem; } .ft nav a { color: #f3eadb; text-underline-offset: .3em; text-decoration-color: #c8955a; padding: .35rem 0; }
.ft nav a:hover { color: #f0b352; }
.ft__book { margin-top: .5rem !important; }
.ft .btn { display: inline-flex; align-items: center; min-height: 3rem; padding: .55rem 1.4rem; border-radius: 99px; background: #d6a45e; border: 1px solid #d6a45e; color: #2a2019; font-weight: 600; text-decoration: none; }
.proof { margin: .7rem 0 0; font-family: var(--sans); font-size: .8125rem; line-height: 1.45; letter-spacing: .01em; color: color-mix(in srgb, currentColor 78%, transparent); }
.proof--safe { margin-top: .25rem; font-size: .78rem; opacity: .9; }
[data-season='pool'] .s-cool, [data-season='cool'] .s-pool { display: none !important; }
[data-snow='on'] .w-off, [data-snow='off'] .w-on, html:not([data-snow]) .w-on { display: none !important; }
.iglink { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; color: inherit; text-underline-offset: .3em; text-decoration-color: #c8955a; }
.iglink .ig { flex: none; } .iglink:hover { color: #f0b352; }
.ft nav a.ft__ig { padding: 0; color: #d6a45e; } .ft nav a.ft__ig span { color: #f3eadb; }
.tagus { max-width: 44rem; margin: 2.2rem auto 0; padding: 0 var(--gutter, 1.1rem); text-align: center; font-family: var(--serif); font-style: italic; font-size: 1.0625rem; color: var(--ink-soft, inherit); }
.strip--avail { display: block; margin: 0; padding: .6rem 1rem; text-align: center; text-decoration: none; background: #17120f !important; color: #d6a45e !important; border-block: 1px solid rgb(200 149 90 / .5) !important; font-family: var(--serif); font-style: italic; font-size: .9375rem; line-height: 1.4; }
.strip--avail[hidden] { display: none; } .strip--pin { position: sticky; top: 0; z-index: 60; } .strip--avail b { font-weight: 500; color: #f3eadb !important; } .strip--avail u { text-underline-offset: .3em; white-space: nowrap; } .strip--avail:hover { background: #221a15 !important; }
html:not([data-avail='off']) [data-avail-strip]:not(.strip--avail) { visibility: hidden; }
html:not([data-avail='off']) [data-moment] { display: none !important; }            /* one message at a time: the banner comes before a seasonal moment */
.avail { display: grid; gap: 1rem; } .avail[hidden] { display: none; }
.avail__dates { margin: 0; font-family: var(--serif); font-size: 1.125rem; line-height: 1.5; } .avail__dates small { display: block; margin-top: .15rem; font-size: .9375rem; font-style: italic; opacity: .85; } .avail__dates[hidden] { display: none; }
.avail__dates a { display: inline-block; padding: .5rem 0; color: #d6a45e; font-weight: 600; font-family: var(--sans); font-size: 1rem; text-underline-offset: .3em; white-space: nowrap; } .avail__dates a:hover { color: #f0b352; }
.wl-card { max-width: 34rem; padding: 1.2rem 1.25rem 1.1rem; border-radius: 1.1rem; background: #efe6d8; color: #2a2019; border: 1px solid rgb(42 32 25 / .14); text-align: left; }
.wl { display: grid; gap: .6rem; margin: 0; } .wl[hidden] { display: none; }
.wl__h { margin: 0; font-family: var(--serif); font-weight: 400; font-style: normal; font-size: 1.45rem; line-height: 1.15; letter-spacing: -.01em; color: #2a2019; }
.wl__p { margin: 0; font-family: var(--sans); font-size: 1rem; line-height: 1.5; color: #2a2019; max-width: none; }
.wl__row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .2rem; }
.wl__row input { flex: 1 1 13rem; min-width: 0; min-height: 3rem; padding: .5rem .9rem; border-radius: .7rem; border: 1px solid #8a7460; background: #fbf6ee; color: #2a2019; font: inherit; font-family: var(--sans); font-size: 1rem; }
.wl__row input:focus-visible { outline: 2px solid #2a2019; outline-offset: 2px; } .wl__row input[aria-invalid='true'] { border-color: #a3341f; box-shadow: 0 0 0 1px #a3341f; }
.wl__row button { flex: 0 0 auto; min-height: 3rem; padding: .5rem 1.2rem; border-radius: 99px; border: 1px solid #2a2019; background: #2a2019; color: #f3eadb; font: inherit; font-family: var(--sans); font-size: 1rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.wl__row button:hover { background: #3a2c22; } .wl__row button:disabled { opacity: .6; cursor: progress; }
.wl__err { margin: 0; font-family: var(--sans); font-size: .9375rem; font-weight: 600; color: #8f2c1a; } .wl__err[hidden], .wl__done[hidden] { display: none; }
.wl__fine { margin: 0; font-family: var(--sans); font-size: .875rem; line-height: 1.45; color: #6a5744; }
.wl__done { margin: 0; font-family: var(--serif); font-size: 1.25rem; line-height: 1.35; color: #2a2019; } .wl__done:focus { outline: none; }
.wl__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 480px) { .wl__row button { flex: 1 1 100%; } }
.tagus .iglink { display: inline; min-height: 0; padding: .8rem 0; color: var(--brass-deep, inherit); font-style: normal; }
`;
