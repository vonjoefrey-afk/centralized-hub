import React, { useId } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '../../../theme/auroraSignal';

/**
 * Aurora Donut + KPI (design direction 06).
 *
 * A donut with a themed 2px surface-gap ring between slices, an optional center
 * KPI, a themed legend, and a themed tooltip. Colors default to the validated
 * Aurora categorical palette; pass `colors` (array | {name:color} map | fn) to
 * preserve a semantic palette (e.g. case status).
 *
 * The center KPI and legend render as HTML (overlay + list) rather than via
 * recharts' polar Label/Legend, which keeps the donut perfectly centered and
 * avoids the NaN-viewBox pitfalls of the SVG Label API.
 */
/** Lighten/darken a #rrggbb hex by a factor (>1 lightens, <1 darkens). */
const shade = (hex, factor) => {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export default function AuroraDonutChart({
  data = [], dataKey = 'value', nameKey = 'name', colors, height = 220,
  centerValue, centerLabel, unit, showLegend = true, innerRadius = 55, outerRadius = 82,
  neon = false,
}) {
  const t = useChartTheme();
  const gid = useId().replace(/[:]/g, '');

  const pick = (name, i) => {
    if (!colors) return t.categorical[i % t.categorical.length];
    if (typeof colors === 'function') return colors(name, i);
    if (Array.isArray(colors)) return colors[i % colors.length];
    return colors[name] || t.categorical[i % t.categorical.length];
  };

  const DonutTip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0];
    return (
      <div style={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 12, padding: '8px 12px', fontSize: 12, color: t.ink, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
        <div style={{ color: t.label, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{p.name}</div>
        <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.value}{unit ? ` ${unit}` : ''}</div>
      </div>
    );
  };

  const ring = neon
    ? { inner: innerRadius + 6, outer: outerRadius - 2, pad: 3, strokeW: 2.5 }
    : { inner: innerRadius, outer: outerRadius, pad: 2, strokeW: 2 };

  return (
    <div className={`donut-${gid}`} style={{ width: '100%' }}>
      {neon && (
        <style>{`.donut-${gid} .recharts-sector{filter:drop-shadow(0 0 4px var(--glow-cyan));}`}</style>
      )}
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            {neon && (
              <defs>
                {data.map((entry, i) => {
                  const base = pick(entry[nameKey], i);
                  return (
                    <linearGradient key={`g${gid}${i}`} id={`nd${gid}${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={shade(base, 1.35)} />
                      <stop offset="100%" stopColor={shade(base, 0.85)} />
                    </linearGradient>
                  );
                })}
              </defs>
            )}
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={ring.inner}
              outerRadius={ring.outer}
              paddingAngle={ring.pad}
              stroke={neon ? 'rgba(0,0,0,0)' : t.surface}
              strokeWidth={ring.strokeW}
              isAnimationActive={false}
            >
              {data.map((entry, i) => (
                <Cell
                  key={`c${gid}${i}`}
                  fill={neon ? `url(#nd${gid}${i})` : pick(entry[nameKey], i)}
                  style={neon ? { filter: `drop-shadow(0 0 5px ${pick(entry[nameKey], i)})` } : undefined}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTip />} />
          </PieChart>
        </ResponsiveContainer>

        {centerValue != null && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}
          >
            <span style={{ color: t.ink, fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{centerValue}</span>
            {centerLabel ? (
              <span style={{ color: t.label, fontSize: 9, letterSpacing: '1.3px', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{centerLabel}</span>
            ) : null}
          </div>
        )}
      </div>

      {showLegend && data.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
          {data.map((entry, i) => (
            <li key={`l${gid}${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: pick(entry[nameKey], i), flex: 'none' }} />
              {entry[nameKey]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
