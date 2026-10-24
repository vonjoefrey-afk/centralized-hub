import React, { useId } from 'react';
import { useChartTheme } from '../../../theme/auroraSignal';

/**
 * Neon Gauge (design direction 07 → 12 Cyber).
 *
 * A 270° glowing cyan→magenta arc over a recessive track, centered on a single
 * headline percentage. Pure SVG (no recharts), theme-aware.
 *
 * @param {number} value   - 0–100
 * @param {string} label   - caption under the number (e.g. "Active rate")
 * @param {number} height  - svg height in px
 * @param {string} display - optional override for the centered text (default `${value}%`)
 */
export default function NeonGauge({ value = 0, label = '', height = 220, display }) {
  const t = useChartTheme();
  const gid = useId().replace(/[:]/g, '');
  const pct = Math.max(0, Math.min(100, value));

  const cx = 160;
  const cy = 118;
  const r = 74;
  const start = Math.PI * 0.75; // 135°
  const end = Math.PI * 2.25; //   405° (i.e. 45°), a 270° sweep

  const pt = (ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const arc = (a0, a1) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
  };
  const valueEnd = start + (end - start) * (pct / 100);

  return (
    <svg viewBox="0 0 320 180" width="100%" height={height} role="img" aria-label={`${label} ${pct}%`}>
      <defs>
        <linearGradient id={`gg${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={t.accents.neonFrom} />
          <stop offset="100%" stopColor={t.accents.neonTo} />
        </linearGradient>
        {/* userSpaceOnUse so the glow region covers the whole gauge — otherwise
            a tiny (low-%) arc gets its blur clipped into a boxy/pixelated stub. */}
        <filter id={`gge${gid}`} filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="200">
          <feGaussianBlur stdDeviation="3.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={arc(start, end)} fill="none" stroke={t.gaugeTrack} strokeWidth={14} strokeLinecap="round" />
      {pct > 0 && (
        <path d={arc(start, valueEnd)} fill="none" stroke={`url(#gg${gid})`} strokeWidth={14} strokeLinecap="round" filter={`url(#gge${gid})`} />
      )}
      <text x={cx} y={cy + 4} textAnchor="middle" style={{ fill: t.ink }} fontSize="34" fontWeight="750" fontFamily="system-ui, sans-serif">
        {display != null ? display : `${Math.round(pct)}%`}
      </text>
      {label ? (
        <text x={cx} y={cy + 24} textAnchor="middle" style={{ fill: t.label }} fontSize="10" letterSpacing="1.5" fontFamily="ui-monospace, monospace">
          {label.toUpperCase()}
        </text>
      ) : null}
    </svg>
  );
}
