const express = require('express');
const Event = require('./models/Event');

const router = express.Router();
const TYPES = ['page_view', 'click'];
const MAX_BATCH = 100;
const HEATMAP_LIMIT = 10000;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** origin + pathname, trailing slash removed (except root). Returns null if not a valid URL. */
function pageKey(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname;
    return u.origin + path;
  } catch {
    return null;
  }
}

/** Validate + normalise one raw event. Returns a document or null if invalid. */
function clean(e) {
  if (!e || typeof e !== 'object') return null;
  if (!TYPES.includes(e.type)) return null;
  if (typeof e.sessionId !== 'string' || !e.sessionId || e.sessionId.length > 64) return null;
  if (typeof e.url !== 'string' || e.url.length > 2048) return null;

  const page = pageKey(e.url);
  const timestamp = new Date(e.timestamp);
  if (!page || Number.isNaN(timestamp.getTime())) return null;

  const doc = {
    sessionId: e.sessionId,
    type: e.type,
    url: e.url,
    page,
    timestamp,
    title: str(e.title, 300),
    referrer: str(e.referrer, 2048),
  };

  if (e.type === 'click') {
    const x = num(e.x), y = num(e.y), pageX = num(e.pageX), pageY = num(e.pageY);
    if ([x, y, pageX, pageY].some((n) => n === undefined)) return null;
    Object.assign(doc, {
      x, y, pageX, pageY,
      pageWidth: num(e.pageWidth),
      pageHeight: num(e.pageHeight),
      viewportWidth: num(e.viewportWidth),
      viewportHeight: num(e.viewportHeight),
      target: str(e.target, 200),
    });
  }
  return doc;
}

// POST /api/events  — body: a single event, an array, or { events: [...] }
router.post('/events', async (req, res, next) => {
  try {
    const body = req.body;
    const raw = Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [body];
    if (raw.length === 0 || raw.length > MAX_BATCH) {
      return res.status(400).json({ error: `Send between 1 and ${MAX_BATCH} events per request.` });
    }

    const docs = raw.map(clean).filter(Boolean);
    if (docs.length === 0) {
      return res.status(400).json({ error: 'No valid events. Each needs sessionId, type, url and timestamp.' });
    }

    await Event.insertMany(docs, { ordered: false });
    res.status(201).json({ stored: docs.length, rejected: raw.length - docs.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions?limit=50&skip=0 — sessions with event counts, newest activity first
router.get('/sessions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [result] = await Event.aggregate([
      {
        $group: {
          _id: '$sessionId',
          totalEvents: { $sum: 1 },
          pageViews: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
          firstEvent: { $min: '$timestamp' },
          lastEvent: { $max: '$timestamp' },
          pages: { $addToSet: '$page' },
        },
      },
      { $sort: { lastEvent: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0, sessionId: '$_id', totalEvents: 1, pageViews: 1, clicks: 1,
                firstEvent: 1, lastEvent: 1, pageCount: { $size: '$pages' },
              },
            },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    res.json({ total: result.total[0]?.n || 0, sessions: result.data });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:sessionId/events — ordered user journey
router.get('/sessions/:sessionId/events', async (req, res, next) => {
  try {
    const events = await Event.find({ sessionId: req.params.sessionId })
      .sort({ timestamp: 1, _id: 1 })
      .limit(2000)
      .select('-receivedAt')
      .lean();
    if (events.length === 0) return res.status(404).json({ error: 'Session not found.' });
    res.json({ sessionId: req.params.sessionId, count: events.length, events });
  } catch (err) {
    next(err);
  }
});

// GET /api/pages — pages that have data, for the heatmap selector
router.get('/pages', async (_req, res, next) => {
  try {
    const pages = await Event.aggregate([
      {
        $group: {
          _id: '$page',
          views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
        },
      },
      { $sort: { clicks: -1, views: -1 } },
      { $project: { _id: 0, page: '$_id', views: 1, clicks: 1 } },
    ]);
    res.json({ pages });
  } catch (err) {
    next(err);
  }
});

// GET /api/heatmap?page=<url> — click positions for one page
router.get('/heatmap', async (req, res, next) => {
  try {
    const key = pageKey(req.query.page || req.query.url || '');
    if (!key) return res.status(400).json({ error: 'Provide a valid ?page=<url> parameter.' });

    const clicks = await Event.find({ type: 'click', page: key })
      .sort({ timestamp: -1 })
      .limit(HEATMAP_LIMIT)
      .select('x y pageX pageY pageWidth pageHeight viewportWidth viewportHeight target -_id')
      .lean();

    res.json({ page: key, total: clicks.length, clicks });
  } catch (err) {
    next(err);
  }
});

router.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = router;
