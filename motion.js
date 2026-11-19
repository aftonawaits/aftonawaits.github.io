// Site-wide motion that needs a few lines of script: sections that reveal once as they scroll into view, and photos
// that fade in when they have loaded. Loaded with "defer" on every page.
// The head script (lib/chrome.mjs, motionScript) adds the class "mo" to <html> unless the visitor asked for reduced
// motion. If this file never runs, that script removes "mo" again after 3 seconds, so nothing stays hidden.
(function () {
  var html = document.documentElement; if (!html.classList.contains('mo')) return;
  html.classList.add('mo-ok');
  // sections on trip and occasion pages: fade and rise once, the first time they come into view
  var sections = [].slice.call(document.querySelectorAll('body[data-trip] main > .sec, body[data-trip] main > .end'));
  var seen = function (el) { el.classList.add('is-seen', 'is-seen-now'); setTimeout(function () { el.classList.remove('is-seen-now'); }, 1200); };
  if (!('IntersectionObserver' in window)) sections.forEach(seen);
  else { var io = new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) { seen(e.target); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    sections.forEach(function (s) { io.observe(s); }); }
  // a link to a section further down (the jump bar) shows it straight away
  addEventListener('hashchange', function () { var t = location.hash && document.querySelector(location.hash); if (t && t.classList.contains('sec')) seen(t); });
  // photos below the first screen fade in once loaded
  [].forEach.call(document.querySelectorAll('body[data-trip] main img[loading="lazy"]'), function (img) {
    var done = function () { img.classList.add('is-loaded'); };
    if (img.complete) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); }
  });
})();
