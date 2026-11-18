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
/** Runs before the page paints. ?season=pool or ?season=cool overrides the date, for checking the other half of the year. */
export const seasonScript = () => `<script>(function(){var d=new Date(),n=(d.getMonth()+1)*100+d.getDate(),q=new URLSearchParams(location.search).get('season'),s=q==='pool'||q==='cool'?q:(n>=${md(cfg.season.poolOpen)}&&n<=${md(cfg.season.poolClose)}?'pool':'cool');document.documentElement.dataset.season=s;document.addEventListener('DOMContentLoaded',function(){var t=document.querySelector('meta[name="aa:title-'+s+'"]');if(t)document.title=t.content;if(q)document.querySelectorAll('a[href^="/"]').forEach(function(a){if(a.getAttribute('href').indexOf('season=')<0&&a.getAttribute('href').indexOf('#')!==0)a.href=a.getAttribute('href').replace(/(\\?|#|$)/,function(m){return '?season='+s+(m==='?'?'&':m)})})})})()</script>`;

/** Campaign tags (for example ?utm_source=instagram on the link in the Instagram bio) are remembered for the visit and
 *  passed on to the booking site, so a booking that began on Instagram can be counted there. */
export const utmScript = () => `<script>(function(){var K='aa-utm',q=new URLSearchParams(location.search),u={};q.forEach(function(v,k){if(k.indexOf('utm_')===0)u[k]=v});try{if(Object.keys(u).length)sessionStorage.setItem(K,JSON.stringify(u));else u=JSON.parse(sessionStorage.getItem(K)||'{}')}catch(e){}if(!Object.keys(u).length)return;document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('a[href*="eviivo.com"]').forEach(function(a){try{var h=new URL(a.href);Object.keys(u).forEach(function(k){h.searchParams.set(k,u[k])});a.href=h.href}catch(e){}})})})()</script>`;

/** Share image: a 1200×630 JPEG made by tools/og.py from the graded photo of the same name. */
export const og = (name) => `${SITE}/img/og/${name}.jpg`;

/** Canonical, share tags, theme colour and the season switch. `titles` = [pool, cool] when the title is seasonal. */
export function head({ path, title, description, image = 'houseDusk', type = 'website', dark = false, titles, noindex = !cfg.indexable }) {
  const url = SITE + path;
  return `<link rel="canonical" href="${url}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="${dark ? NIGHT : LINEN}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(cfg.brand)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${og(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">${titles ? `\n<meta name="aa:title-pool" content="${esc(titles[0])}"><meta name="aa:title-cool" content="${esc(titles[1])}">` : ''}
${seasonScript()}
${utmScript()}`;
}

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
export const footer = ({ note = '', house = cfg.houseUrl, home = '/', plan = '/plan/', explore = '/explore/' } = {}) => `<footer class="ft" data-mood="evening">
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
.iglink { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; color: inherit; text-underline-offset: .3em; text-decoration-color: #c8955a; }
.iglink .ig { flex: none; } .iglink:hover { color: #f0b352; }
.ft nav a.ft__ig { padding: 0; color: #d6a45e; } .ft nav a.ft__ig span { color: #f3eadb; }
.tagus { max-width: 44rem; margin: 2.2rem auto 0; padding: 0 var(--gutter, 1.1rem); text-align: center; font-family: var(--serif); font-style: italic; font-size: 1.0625rem; color: var(--ink-soft, inherit); }
.tagus .iglink { display: inline; min-height: 0; padding: .8rem 0; color: var(--brass-deep, inherit); font-style: normal; }
`;
