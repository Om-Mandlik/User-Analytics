# User analytics: tracker, API and dashboard

A small full-stack app that records `page_view` and `click` events from any web page, stores them in MongoDB, and shows them in a React dashboard (session journeys and a click heatmap). The whole project deploys to **one Vercel project**.

## Tech stack

| Layer | Choice |
| --- | --- |
| Tracking script | Vanilla JS, no dependencies (`dashboard/public/tracker.js`) |
| Backend | Node.js 18+, Express, Mongoose (runs as a Vercel serverless function) |
| Database | MongoDB Atlas |
| Dashboard | React 18 + Vite |
| Hosting | Vercel (static dashboard + serverless API) |

## Project layout

```
api/index.js           Vercel entry point, exports the Express app
server/app.js          Express app (CORS, body parsing, DB connect, routes)
server/routes.js       All API endpoints + validation
server/models/Event.js Event schema and indexes
server/db.js           Cached MongoDB connection (serverless friendly)
server/local.js        Local dev server (port 4000)
server/seed.js         Optional fake data generator
dashboard/             React + Vite dashboard
dashboard/public/      tracker.js and the demo store pages (served as static files)
vercel.json            Build + routing config
```

## Run locally

Prerequisites: Node.js 18+ and MongoDB (local or Atlas).

```bash
# 1. API (from the project root)
npm install
cp .env.example .env        # set MONGODB_URI if you use Atlas
npm run dev:api             # http://localhost:4000/api/health

# 2. Dashboard (second terminal)
cd dashboard
npm install
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api` to port 4000. Open `http://localhost:5173/demo/index.html`, click around, then view the dashboard at `http://localhost:5173`. To add fake data instead, run `npm run seed` from the project root.

## Deploy to Vercel

1. Push this repo to GitHub (`.env` is git-ignored).
2. In MongoDB Atlas, add `0.0.0.0/0` under Network Access (Vercel uses changing IP addresses).
3. In Vercel choose **Add New, Project**, import the repo, and keep **Root Directory** as the repo root. Set **Framework Preset** to **Other**. The build settings come from `vercel.json`.
4. Add the environment variable `MONGODB_URI` (your Atlas string ending in `/user_analytics`) and deploy.
5. Open `https://YOUR-APP.vercel.app/api/health` (should return `{"ok":true}`), then `/demo/index.html` to generate events, then `/` for the dashboard.

No `VITE_API_URL` is needed because the dashboard and API share one origin.

## Adding the tracker to any page

```html
<script src="https://YOUR-APP.vercel.app/tracker.js" defer></script>
```

The script finds the API from its own `src`. To send events elsewhere, add `data-endpoint="https://api.example.com/api/events"`.

| Field | Notes |
| --- | --- |
| `sessionId` | UUID in `localStorage` (cookie fallback). A new one starts after 30 minutes of inactivity. |
| `type` | `page_view` or `click` |
| `url` | `location.href` |
| `timestamp` | ISO 8601, client clock |
| `x`, `y` | Click position in the viewport (`clientX/Y`) |
| `pageX`, `pageY`, `pageWidth`, `pageHeight` | Click position in the full document, plus document size (used by the heatmap) |
| `viewportWidth`, `viewportHeight`, `target` | Context for each click |

SPA navigation (`pushState`, `replaceState`, `popstate`) is tracked as page views.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/events` | Store events. Body: one event, an array, or `{ "events": [...] }` (max 100). Invalid events are dropped and counted in `rejected`. |
| `GET` | `/api/sessions?limit=50&skip=0` | Sessions with `totalEvents`, `pageViews`, `clicks`, `firstEvent`, `lastEvent`, newest activity first. |
| `GET` | `/api/sessions/:sessionId/events` | All events for a session, ordered by time. |
| `GET` | `/api/pages` | Pages that have data, with view and click counts. |
| `GET` | `/api/heatmap?page=<url>` | Click positions for one page. |
| `GET` | `/api/health` | Health check. |

## Data model

One flat `events` collection (`server/models/Event.js`). Indexes: `{ sessionId, timestamp }` (sessions and journeys), `{ type, page }` (heatmap), `{ timestamp: -1 }` (recency).

## Assumptions and trade-offs

- **Serverless API:** each request may hit a cold function, which adds about a second for the first MongoDB connection. The connection is cached while the function stays warm.
- **Heatmap grouping:** clicks are grouped by `page` = origin + path, so query strings and hashes share one heatmap. The full URL is still stored.
- **Heatmap accuracy:** positions are stored against the full document size and drawn as a fraction of page width. Responsive layouts that reflow at different widths will blur together. A production tool would bucket by viewport width.
- **Page preview:** the heatmap loads the real page in an iframe with `?cf_preview=1`, which the tracker ignores. Sites that block framing will not render, so untick "Show page behind clicks" for a plain grid.
- **Sessions:** a client-side UUID with a 30-minute inactivity timeout. No cross-device identity.
- **Client timestamps:** the browser clock is trusted for ordering. The server also stores `receivedAt`.
- **Transport:** events are batched (about 1 second) and sent with `sendBeacon` as `text/plain`, which avoids CORS preflight and survives page unloads.
- **Open ingestion endpoint:** no auth, rate limiting or bot filtering on `POST /api/events`. `CORS_ORIGINS` only limits which browser origins can read responses.
- **Scale limits:** the sessions list runs a `$group` over all events per request, and the heatmap returns at most the latest 10,000 clicks. For large volumes, precompute a sessions collection and bin clicks on the server.
- **Not included:** dashboard login, automated tests, scroll/hover tracking.
=======
# User-Analytics
>>>>>>> e1f0d9abbf1f46bdf4df794c039f7e2c9f2ffbb2
