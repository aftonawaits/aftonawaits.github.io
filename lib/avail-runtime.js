// The "last call" banner and the waitlist, in the visitor's browser. This function's source is placed in every page's
// head by lib/chrome.mjs (availScript), called with config/availability-banner.json, the booking link's settings and
// the page's own paths. It runs before the page paints, so nothing flashes.
//   state "off"  : the banner is not active; pages look as they always did
//   state "open" : one or more stays in openDates are still open
//   state "full" : nothing is open; every booking button opens the waitlist
// A stay drops off the day after its "from" date (or after "lastArrival", when it has one).
// No booking link ever starts on a day in noCheckIn. To see another day: ?date=2026-12-19
function availRuntime(A, B, T) {
  var P = new URLSearchParams(location.search), qd = P.get('date'), d = qd ? new Date(qd + 'T12:00:00') : new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; }, iso = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }, today = iso(d);
  var next = function (day, n) { var x = new Date(day + 'T12:00:00'); x.setDate(x.getDate() + (n || 1)); return iso(x); };
  var closedIn = A.noCheckIn || [];
  // the stays still open; one that can be joined late (Christmas) starts today once its first day has gone by
  var open = !A.active ? [] : (A.openDates || []).filter(function (o) { return (o.lastArrival || o.from) >= today; }).map(function (o) {
    var from = o.from > today ? o.from : today; while (closedIn.indexOf(from) >= 0 && from < o.to) from = next(from);
    return { from: from, to: o.to, label: o.label, christmas: !!o.christmas, note: o.note || '', lastArrival: o.lastArrival || o.from }; }).filter(function (o) { return o.from < o.to && closedIn.indexOf(o.from) < 0; });
  var state = !A.active ? 'off' : open.length ? 'open' : 'full';
  var Y = A.nextYear, was = Y - 1, html = document.documentElement; html.dataset.avail = state;
  // every open night: the nights of each open stay, and the midweek nights while they are open
  var nights = {}, mark = function (from, last) { for (var x = from; x <= last; x = next(x)) if (x >= today) nights[x] = 1; };
  open.forEach(function (o) { mark(o.from, next(o.to, -1)); }); if (A.active && A.midweekOpen) (A.midweekNights || []).forEach(function (r) { mark(r[0], r[1]); });
  var midweek = A.active && A.midweekOpen && (A.midweekNights || []).some(function (r) { return r[1] >= today; });
  /** Is the house open for a stay from..to? Every night must be open, and arrival must not fall on a no-check-in day. */
  var covers = function (from, to) { if (!(from < to) || closedIn.indexOf(from) >= 0) return false; for (var x = from; x < to; x = next(x)) if (!nights[x]) return false; return true; };
  /** The booking page on these dates, or null when the stay would start on a no-check-in day. */
  var link = function (from, to) { if (closedIn.indexOf(from) >= 0) return null; var u = new URL(B.url), k; u.searchParams.set(B.start, from); u.searchParams.set(B.end, to); for (k in B.extra) u.searchParams.set(k, B.extra[k]); return u.href; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var opens = A.nextYearOpens ? Y + ' opens ' + new Date(A.nextYearOpens + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + '.' : Y + ' opens soon.';
  window.AA_AVAIL = { state: state, open: open, link: link, covers: covers, year: Y };
  if (state === 'off') return;
  // "Two December weekends and Christmas are all that's left", from the list
  var WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'], xmas = open.some(function (o) { return o.christmas; }), ends = open.filter(function (o) { return !o.christmas; });
  var months = ends.map(function (o) { return new Date(o.from + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' }); }), month = months.length && months.every(function (m) { return m === months[0]; }) ? months[0] + ' ' : '';
  var count = ends.length ? (WORDS[ends.length] || ends.length) + ' ' + month + (ends.length === 1 ? 'weekend' : 'weekends') : '';
  var left = count && xmas ? count + ' and Christmas are all that’s left' : count ? count + (ends.length === 1 ? ' is all that’s left' : ' are all that’s left') : 'Just Christmas is left';
  var dateLinks = function () { return open.map(function (o) { return '<a data-avail-date href="' + esc(link(o.from, o.to)) + '" target="_blank" rel="noopener"' + (o.note ? ' title="' + esc(o.note) + '"' : '') + '>' + esc(o.label) + '</a>'; }).join(' · '); };
  var keep = qd ? '?date=' + qd : '';
  /** Fills the strip, the date line and the pill. Safe to call more than once: pages call it as soon as each piece has
   *  been read (so nothing changes size after the first paint), and it runs again when the whole page is ready. */
  var paint = function () {
    var form = document.querySelector('[data-waitlist]'), line = document.querySelector('[data-avail-dates]');
    var toWait = form ? '#' + form.id : T.home + keep + '#waitlist', toDates = line ? '#dates' : T.home + keep + '#dates';
    // the top strip
    document.querySelectorAll('[data-avail-strip]').forEach(function (s) {
      s.hidden = false; s.classList.add('strip--avail'); s.removeAttribute('target'); s.removeAttribute('rel');
      if (state === 'open') { s.href = toDates; s.innerHTML = '<b>Last call for ' + was + '.</b> ' + left + ', and ' + Y + ' isn’t open yet. <u>See the dates →</u>'; }
      else { s.href = toWait; s.innerHTML = '<b>' + was + ' is full.</b> ' + opens + ' <u>Get first pick →</u>'; }
    });
    var pin = document.querySelector('.strip--pin'); if (pin) { var size = function () { html.style.setProperty('--avail-h', pin.offsetHeight + 'px'); }; size(); if (!pin.sized) { pin.sized = 1; addEventListener('resize', size); } }
    // the date line: each date opens the booking page with those dates filled in
    document.querySelectorAll('[data-avail-dates]').forEach(function (p) {
      if (open.length) { var x = open.filter(function (o) { return o.christmas; })[0], by = x ? +x.lastArrival.slice(8) : 0, th = by % 10 === 1 && by !== 11 ? 'st' : by % 10 === 2 && by !== 12 ? 'nd' : by % 10 === 3 && by !== 13 ? 'rd' : 'th';
        var small = [midweek ? 'Midweek nights are open too.' : '', x ? 'Christmas guests: arrive by the ' + by + th + '.' : ''].filter(Boolean).join(' ');
        p.hidden = false; p.innerHTML = 'The last of ' + was + ' is going fast: ' + dateLinks() + '. After that, the calendar’s closed until ' + Y + '.' + (small ? '<small>' + small + '</small>' : ''); }
      else if (p.dataset.availDates === 'full') { p.hidden = false; p.innerHTML = was + ' is full. ' + opens + ' <a href="' + toWait + '">Get first pick →</a>'; }
    });
    // on a phone the home page's photo carries a short pointer to that line (the line itself sits below the first screen)
    document.querySelectorAll('[data-avail-pill]').forEach(function (p) { p.hidden = false; var a = p.firstElementChild; a.href = state === 'open' ? toDates : toWait; a.textContent = state === 'open' ? 'Last call for ' + was + '. See the dates' : was + ' is full. Get first pick of ' + Y; });
    document.querySelectorAll('[data-avail-block]').forEach(function (b) { b.hidden = false; });
  };
  window.AA_AVAIL.paint = paint;
  var run = function () {
    paint();
    var form = document.querySelector('[data-waitlist]'), line = document.querySelector('[data-avail-dates]');
    var toWait = form ? '#' + form.id : T.home + keep + '#waitlist', toDates = line ? '#dates' : T.home + keep + '#dates';
    // booking buttons never open an empty calendar: they go to the list of open dates, or to the waitlist
    var base = B.url.split('?')[0];
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (a.href.indexOf(base) !== 0 || a.hasAttribute('data-avail-date') || a.hasAttribute('data-avail-strip') || a.hasAttribute('data-avail-keep') || a.closest('[data-moment]')) return;
      a.removeAttribute('target'); a.removeAttribute('rel'); a.href = state === 'open' ? toDates : toWait;
      if (state === 'full') { var t = a.children.length === 1 && !a.firstElementChild.children.length ? a.firstElementChild : a, said = t.textContent.trim().replace(/\.$/, '');
        if ((!a.children.length || t !== a) && (said === T.book || said === T.direct)) t.textContent = a.classList.contains('hd__book') ? Y + ' waitlist' : 'Join the ' + Y + ' waitlist'; }
    });
    // a link to the waitlist puts the cursor in the email field
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href$="#waitlist"]'); if (a && form && a.pathname === location.pathname) setTimeout(function () { form.querySelector('input[type=email]').focus({ preventScroll: true }); }, 500); });
    // the sign-up form
    document.querySelectorAll('[data-waitlist]').forEach(function (f) {
      var input = f.querySelector('input[type=email]'), err = f.querySelector('.wl__err'), btn = f.querySelector('button'), done = f.parentNode.querySelector('.wl__done');
      var fail = function (msg) { err.textContent = msg; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); };
      input.addEventListener('input', function () { err.hidden = true; input.removeAttribute('aria-invalid'); });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var v = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return fail(v ? 'That doesn’t look like an email address. Please check it.' : 'Please enter your email address.');
        var body = new URLSearchParams(new FormData(f)); body.set('email', v); body.set('page', location.pathname); btn.disabled = true;
        fetch(f.getAttribute('action') || '/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
          .then(function (r) { if (!r.ok) throw 0; f.hidden = true; done.hidden = false; })
          .catch(function () { btn.disabled = false; fail('Sorry, that didn’t go through. Please try again in a moment.'); });
      });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
