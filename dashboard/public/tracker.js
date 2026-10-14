/*!
 * Tracker: page_view + click events.
 * Usage:  <script src="https://YOUR-API/tracker.js" defer></script>
 * Optional: data-endpoint="https://YOUR-API/api/events" to override the target.
 */
(function () {
  'use strict';

  // The dashboard embeds pages with ?cf_preview=1; don't record those as real traffic.
  if (/[?&]cf_preview=1/.test(location.search)) return;

  var script = document.currentScript;
  var ENDPOINT =
    (script && script.getAttribute('data-endpoint')) ||
    (script && script.src ? new URL(script.src).origin : '') + '/api/events';

  var STORE_KEY = 'cf_session';
  var SESSION_TIMEOUT = 30 * 60 * 1000; // new session after 30 min of inactivity
  var FLUSH_DELAY = 1000;

  /* ---------- session id (localStorage, cookie fallback) ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }
  function readStore() {
    try {
      var v = localStorage.getItem(STORE_KEY);
      if (v) return JSON.parse(v);
    } catch (e) {}
    var m = document.cookie.match(new RegExp('(?:^|; )' + STORE_KEY + '=([^;]*)'));
    if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) {} }
    return null;
  }
  function writeStore(obj) {
    var json = JSON.stringify(obj);
    try { localStorage.setItem(STORE_KEY, json); return; } catch (e) {}
    document.cookie = STORE_KEY + '=' + encodeURIComponent(json) + '; path=/; max-age=1800; SameSite=Lax';
  }
  function sessionId() {
    var now = Date.now();
    var s = readStore();
    if (!s || !s.id || now - s.last > SESSION_TIMEOUT) s = { id: uuid(), last: now };
    s.last = now;
    writeStore(s);
    return s.id;
  }

  /* ---------- sending (batched) ---------- */
  var queue = [];
  var timer = null;

  function post(events) {
    var body = JSON.stringify({ events: events });
    try {
      // text/plain keeps this a "simple" CORS request (no preflight).
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true })
        .catch(function () {});
    } catch (e) {}
  }
  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!queue.length) return;
    var batch = queue;
    queue = [];
    post(batch);
  }
  function enqueue(evt) {
    queue.push(evt);
    if (queue.length >= 20) return flush();
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY);
  }

  /* ---------- event builders ---------- */
  function base(type) {
    return {
      sessionId: sessionId(),
      type: type,
      url: location.href,
      timestamp: new Date().toISOString(),
      title: document.title,
      referrer: document.referrer
    };
  }
  function docSize() {
    var d = document.documentElement, b = document.body || d;
    return {
      w: Math.max(d.scrollWidth, b.scrollWidth, d.clientWidth),
      h: Math.max(d.scrollHeight, b.scrollHeight, d.clientHeight)
    };
  }
  function describe(el) {
    if (!el || !el.tagName) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return s.slice(0, 120);
  }

  var lastHref = null;
  function trackPageView() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    enqueue(base('page_view'));
  }

  function onClick(e) {
    // Skip keyboard-triggered "clicks" that have no real pointer position.
    if (e.detail === 0 && e.clientX === 0 && e.clientY === 0) return;
    var size = docSize();
    var evt = base('click');
    evt.x = e.clientX;
    evt.y = e.clientY;
    evt.pageX = e.pageX;
    evt.pageY = e.pageY;
    evt.pageWidth = size.w;
    evt.pageHeight = size.h;
    evt.viewportWidth = window.innerWidth;
    evt.viewportHeight = window.innerHeight;
    evt.target = describe(e.target);
    enqueue(evt);
  }

  /* ---------- wire up ---------- */
  document.addEventListener('click', onClick, true);

  // Single-page apps: treat history navigation as a new page view.
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(trackPageView, 0);
      return r;
    };
  });
  window.addEventListener('popstate', trackPageView);

  // Send whatever is queued when the user leaves.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  trackPageView();
})();
