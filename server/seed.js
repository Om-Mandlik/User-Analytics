// Optional: fills the DB with realistic fake sessions so the dashboard has something to show.
require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./models/Event');

// Use your deployed URL (e.g. https://your-app.vercel.app) so seeded pages match real tracked pages.
const ORIGIN = (process.env.SEED_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
const PAGES = [
  { path: '/demo/index.html', w: 1280, h: 1500, hot: [[0.5, 330], [0.5, 640], [0.22, 980], [0.78, 980]] },
  { path: '/demo/pricing.html', w: 1280, h: 1100, hot: [[0.3, 520], [0.7, 520], [0.5, 900]] },
];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/user_analytics');
  const docs = [];
  for (let s = 0; s < 25; s++) {
    const sessionId = `seed-${Math.random().toString(36).slice(2, 10)}`;
    let t = Date.now() - rnd(0, 3 * 24 * 3600 * 1000);
    const steps = Math.ceil(rnd(1, 3));
    for (let p = 0; p < steps; p++) {
      const pg = p === 0 ? PAGES[0] : pick(PAGES);
      const url = ORIGIN + pg.path;
      docs.push({ sessionId, type: 'page_view', url, page: url, timestamp: new Date((t += rnd(500, 2000))), title: 'Demo' });
      const n = Math.ceil(rnd(1, 6));
      for (let c = 0; c < n; c++) {
        const [fx, fy] = pick(pg.hot);
        const pageX = Math.max(5, Math.min(pg.w - 5, fx * pg.w + rnd(-70, 70)));
        const pageY = Math.max(5, fy + rnd(-45, 45));
        docs.push({
          sessionId, type: 'click', url, page: url, timestamp: new Date((t += rnd(800, 5000))),
          x: pageX, y: pageY % 800, pageX, pageY, pageWidth: pg.w, pageHeight: pg.h,
          viewportWidth: pg.w, viewportHeight: 800, target: pick(['button.cta', 'a.nav', 'div.card', 'img.hero']),
        });
      }
      t += rnd(1000, 4000);
    }
  }
  await Event.insertMany(docs);
  console.log(`Inserted ${docs.length} events.`);
  await mongoose.disconnect();
})();
