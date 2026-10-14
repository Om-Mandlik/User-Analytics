import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

/** Track an element's width so the heatmap can scale to fit. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const mode = (nums) => {
  const counts = new Map();
  nums.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

export default function Heatmap() {
  const [pages, setPages] = useState(null);
  const [page, setPage] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [style, setStyle] = useState('heat');
  const [showPage, setShowPage] = useState(true);

  useEffect(() => {
    api
      .pages()
      .then((d) => {
        const withClicks = d.pages.filter((p) => p.clicks > 0);
        setPages(withClicks);
        if (withClicks[0]) setPage(withClicks[0].page);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!page) return;
    setData(null);
    setError('');
    api.heatmap(page).then(setData).catch((e) => setError(e.message));
  }, [page]);

  if (error) return <div className="notice"><h2>Couldn’t load the heatmap</h2><p>{error}</p></div>;
  if (!pages) return <p className="muted pad">Loading pages…</p>;
  if (pages.length === 0)
    return (
      <div className="notice">
        <h2>No clicks recorded yet</h2>
        <p>Click around on a tracked page and it will show up here.</p>
      </div>
    );

  return (
    <div className="heatmap-view">
      <div className="toolbar">
        <label>
          Page
          <select value={page} onChange={(e) => setPage(e.target.value)}>
            {pages.map((p) => (
              <option key={p.page} value={p.page}>
                {p.page} ({p.clicks} clicks)
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" role="group" aria-label="Display style">
          <button aria-pressed={style === 'heat'} onClick={() => setStyle('heat')}>Heat</button>
          <button aria-pressed={style === 'dots'} onClick={() => setStyle('dots')}>Dots</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />
          Show page behind clicks
        </label>
      </div>

      {!data ? <p className="muted pad">Loading clicks…</p> : <Stage page={page} data={data} style={style} showPage={showPage} />}
    </div>
  );
}

function Stage({ page, data, style, showPage }) {
  const [ref, width] = useWidth();
  const clicks = data.clicks.filter((c) => c.pageWidth && c.pageHeight);

  // Reference page size: the most common recorded width, and the tallest page seen.
  const { refW, refH } = useMemo(
    () => ({
      refW: mode(clicks.map((c) => c.pageWidth)) || 1280,
      refH: Math.max(...clicks.map((c) => c.pageHeight), 600),
    }),
    [clicks]
  );

  const scale = width ? width / refW : 0;
  const height = refH * scale;

  return (
    <>
      <p className="muted stat">
        {data.total.toLocaleString()} click{data.total === 1 ? '' : 's'} on this page
        {data.total >= 10000 ? ' (showing the latest 10,000)' : ''}. Positions are measured from the top-left of the full page, so scrolled clicks land in the right place.
      </p>
      <div className="stage-scroll">
        <div className="stage" ref={ref} style={{ height: height || 400 }}>
          {showPage && scale > 0 && (
            <iframe
              title="Page preview"
              src={`${page}?cf_preview=1`}
              style={{ width: refW, height: refH, transform: `scale(${scale})` }}
              tabIndex={-1}
            />
          )}
          {!showPage && <div className="grid-bg" />}
          {scale > 0 &&
            clicks.map((c, i) => {
              const left = (c.pageX / c.pageWidth) * width;
              const top = c.pageY * scale;
              return <span key={i} className={`hit ${style}`} style={{ left, top }} />;
            })}
        </div>
      </div>
    </>
  );
}
