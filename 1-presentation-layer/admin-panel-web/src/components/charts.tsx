import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatCount, niceMax, shortDate } from './chart-format';

/*
 * Small SVG charts for the admin dashboard, following the project's data-viz
 * rules: thin marks, hairline grid, one axis, a legend for two or more series,
 * selective direct labels, a crosshair tooltip that lists every series, and a
 * table view so no value is reachable only by hovering. Series colours come
 * from CSS variables (--series-1..3), validated for colour-vision deficiency.
 */

export interface Series {
  key: string;
  label: string;
  /** CSS colour, normally var(--series-n). */
  color: string;
  values: number[];
}

const PLOT_HEIGHT = 220;
const AXIS_BAND = 28;
// Room on the right for the value labels at the end of each line.
const PAD = { top: 12, right: 36, bottom: AXIS_BAND, left: 44 };

function useWidth(fallback = 720) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Legend({
  series,
}: {
  series: Pick<Series, 'key' | 'label' | 'color'>[];
}) {
  return (
    <ul className="legend" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key}>
          <span
            className="legend-line"
            style={{ background: s.color }}
            aria-hidden="true"
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Lines over days with a crosshair tooltip; a table view on request. */
export function LineChart({
  title,
  dates,
  series,
}: {
  title: string;
  dates: string[];
  series: Series[];
}) {
  const [ref, width] = useWidth();
  const [index, setIndex] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const innerW = width - PAD.left - PAD.right;
  const x = (i: number) =>
    PAD.left +
    (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const y = (v: number) => PAD.top + PLOT_HEIGHT - (v / max) * PLOT_HEIGHT;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  // About one date label per 64 px so they never run into each other.
  const labelEvery = Math.max(
    1,
    Math.ceil(dates.length / Math.max(2, Math.floor(innerW / 64))),
  );
  const last = dates.length - 1;
  const showDate = (i: number) =>
    i === last || (i % labelEvery === 0 && last - i >= labelEvery);

  // Direct end labels only when the line ends are far enough apart.
  const ends = series
    .map((s) => ({ s, y: y(s.values.at(-1) ?? 0) }))
    .sort((a, b) => a.y - b.y);
  const endLabels = ends.every((e, i) => i === 0 || e.y - ends[i - 1].y >= 14);

  const pick = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    const i = Math.round(((px - PAD.left) / innerW) * (dates.length - 1));
    setIndex(Math.min(dates.length - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight')
      setIndex((i) => Math.min(dates.length - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft')
      setIndex((i) => Math.max(0, (i ?? dates.length) - 1));
    else if (e.key === 'Escape') setIndex(null);
    else return;
    e.preventDefault();
  };

  return (
    <div className="viz-root chart">
      <div className="chart-head">
        <Legend series={series} />
        <button className="link-button" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <div className="table-scroll">
          <table className="table compact">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <th scope="row">{shortDate(d)}</th>
                  {series.map((s) => (
                    <td key={s.key} className="num-cell">
                      {formatCount(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="plot-wrap">
          <svg
            width={width}
            height={PLOT_HEIGHT + PAD.top + PAD.bottom}
            role="img"
            aria-label={`${title}. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={(e) =>
              pick(e.clientX, e.currentTarget.getBoundingClientRect())
            }
            onPointerLeave={() => setIndex(null)}
            onBlur={() => setIndex(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? 'axis' : 'grid'}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="tick"
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {formatCount(t)}
                </text>
              </g>
            ))}
            {dates.map((d, i) =>
              showDate(i) ? (
                <text
                  key={d}
                  className="tick"
                  x={x(i)}
                  y={PAD.top + PLOT_HEIGHT + 18}
                  textAnchor={
                    i === 0
                      ? 'start'
                      : i === dates.length - 1
                        ? 'end'
                        : 'middle'
                  }
                >
                  {shortDate(d)}
                </text>
              ) : null,
            )}
            {series.map((s) => (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                />
                <circle
                  cx={x(dates.length - 1)}
                  cy={y(s.values.at(-1) ?? 0)}
                  r={4}
                  fill={s.color}
                  className="ringed"
                />
              </g>
            ))}
            {endLabels &&
              ends.map(({ s, y: ey }) => (
                <text
                  key={s.key}
                  className="end-label"
                  x={x(dates.length - 1) + 8}
                  y={ey}
                  dy="0.32em"
                  textAnchor="start"
                >
                  {formatCount(s.values.at(-1) ?? 0)}
                </text>
              ))}
            {index !== null && (
              <g>
                <line
                  className="crosshair"
                  x1={x(index)}
                  x2={x(index)}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_HEIGHT}
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={x(index)}
                    cy={y(s.values[index] ?? 0)}
                    r={4}
                    fill={s.color}
                    className="ringed"
                  />
                ))}
              </g>
            )}
          </svg>
          {index !== null && (
            <div
              className="tooltip"
              role="status"
              style={{
                left: Math.min(width - 190, Math.max(0, x(index) + 12)),
                top: PAD.top,
              }}
            >
              <div className="tooltip-title">{shortDate(dates[index])}</div>
              {series.map((s) => (
                <div key={s.key} className="tooltip-row">
                  <span
                    className="legend-line"
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  <strong>{formatCount(s.values[index] ?? 0)}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Part of a whole as one horizontal bar with a 2 px gap between parts. */
export function StackedBar({
  parts,
}: {
  parts: { key: string; label: string; color: string; value: number }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total === 0 ? 0 : Math.round((v / total) * 100));
  return (
    <div className="viz-root">
      <div
        className="stacked"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${pct(p.value)}%`).join(', ')}
      >
        {total === 0 ? (
          <span className="stacked-empty" />
        ) : (
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span
                key={p.key}
                className="stacked-part"
                style={{ flexGrow: p.value, background: p.color }}
                title={`${p.label}: ${formatCount(p.value)} (${pct(p.value)}%)`}
              />
            ))
        )}
      </div>
      <ul className="legend legend-values">
        {parts.map((p) => (
          <li key={p.key}>
            <span
              className="legend-box"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span>{p.label}</span>
            <strong>{formatCount(p.value)}</strong>
            <span className="muted">{pct(p.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One series of horizontal bars with the value at each tip. */
export function BarList({
  rows,
  color,
  empty,
}: {
  rows: { label: string; value: number }[];
  color: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                background: color,
              }}
            />
            <span className="bar-value">{formatCount(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
