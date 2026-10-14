import React, { useEffect, useMemo, useState } from 'react';
import { api, formatTime, formatDuration, pathOf } from './api.js';

export default function Sessions() {
  const [sessions, setSessions] = useState(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api
      .sessions()
      .then((d) => {
        setSessions(d.sessions);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions ? sessions.filter((s) => s.sessionId.toLowerCase().includes(q)) : [];
  }, [sessions, query]);

  const kpis = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const events = sessions.reduce((n, s) => n + s.totalEvents, 0);
    const clicks = sessions.reduce((n, s) => n + s.clicks, 0);
    const views = sessions.reduce((n, s) => n + s.pageViews, 0);
    return { events, clicks, views, avg: events / sessions.length };
  }, [sessions]);

  if (error) return <Notice title="Couldn’t load sessions" body={error} action={load} actionLabel="Try again" />;
  if (!sessions) return <p className="muted pad">Loading sessions…</p>;
  if (sessions.length === 0)
    return (
      <Notice
        title="No sessions yet"
        body="Open /demo/index.html on this site and click around, or run npm run seed from the project root."
        action={load}
        actionLabel="Refresh"
      />
    );

  return (
    <>
      <section className="kpis" aria-label="Summary">
        <Kpi label="Sessions" value={total.toLocaleString()} />
        <Kpi label="Events" value={kpis.events.toLocaleString()} />
        <Kpi label="Page views" value={kpis.views.toLocaleString()} />
        <Kpi label="Clicks" value={kpis.clicks.toLocaleString()} />
        <Kpi label="Events per session" value={kpis.avg.toFixed(1)} />
      </section>
      {total > sessions.length && (
        <p className="muted footnote">Totals other than sessions are based on the latest {sessions.length} sessions.</p>
      )}

      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <h2>Sessions</h2>
            <button className="link" onClick={load}>Refresh</button>
          </div>
          <div className="search">
            <input
              type="search"
              placeholder="Search by session ID"
              aria-label="Search sessions by ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="session-list">
            {filtered.length === 0 && <li className="muted pad">No sessions match “{query}”.</li>}
            {filtered.map((s) => (
              <li key={s.sessionId}>
                <button className="session-row" aria-pressed={selected === s.sessionId} onClick={() => setSelected(s.sessionId)}>
                  <span className="session-id">{s.sessionId.slice(0, 8)}</span>
                  <span className="session-count">
                    <strong>{s.totalEvents}</strong> events
                  </span>
                  <span className="session-when">{formatTime(s.lastEvent)}</span>
                  <span className="session-meta">
                    {s.pageViews} view{s.pageViews === 1 ? '' : 's'} · {s.clicks} click{s.clicks === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel journey-panel">
          {selected ? (
            <Journey key={selected} sessionId={selected} />
          ) : (
            <p className="muted pad">Select a session to see the user journey.</p>
          )}
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

function Journey({ sessionId }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.sessionEvents(sessionId).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, [sessionId]);

  if (error) return <Notice title="Couldn’t load events" body={error} />;
  if (!events) return <p className="muted pad">Loading journey…</p>;

  const start = new Date(events[0].timestamp).getTime();
  const end = new Date(events[events.length - 1].timestamp).getTime();

  return (
    <>
      <div className="panel-head">
        <h2>User journey</h2>
        <span className="muted">
          {events.length} events over {formatDuration(end - start)}
        </span>
      </div>
      <p className="session-full muted">Session {sessionId}</p>
      <ol className="timeline">
        {events.map((e) => {
          const offset = (new Date(e.timestamp).getTime() - start) / 1000;
          return (
            <li key={e._id} className={`event ${e.type}`}>
              <span className="marker" aria-hidden="true" />
              <div className="event-body">
                <div className="event-title">
                  {e.type === 'page_view' ? 'Viewed page' : 'Clicked'}
                  <span className="event-path">{pathOf(e.url)}</span>
                </div>
                {e.type === 'click' && (
                  <div className="event-detail">
                    at x {Math.round(e.x)}, y {Math.round(e.y)}
                    {e.target ? ` on ${e.target}` : ''}
                  </div>
                )}
                {e.type === 'page_view' && e.title && <div className="event-detail">{e.title}</div>}
              </div>
              <time className="event-time" dateTime={e.timestamp} title={new Date(e.timestamp).toLocaleString()}>
                +{offset.toFixed(1)}s
              </time>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Notice({ title, body, action, actionLabel }) {
  return (
    <div className="notice">
      <h2>{title}</h2>
      <p>{body}</p>
      {action && <button className="btn" onClick={action}>{actionLabel}</button>}
    </div>
  );
}
