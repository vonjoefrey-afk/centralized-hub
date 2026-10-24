import React, { useId } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '../../../theme/auroraSignal';
import ChartTooltip from './ChartTooltip';

/**
 * Aurora Gradient Bars (design direction 03).
 *
 * Rounded bars with a vertical indigo→cyan gradient by default, theme-aware
 * axes/grid/tooltip, and a subtle themed hover cursor (no more grey block).
 *
 * Pass `colors` to override the gradient with per-bar solid colors — an array,
 * a { name: color } map, or a (name, index) => color function. This lets charts
 * that encode meaning (e.g. status/origin) keep their semantic palette while
 * still adopting the Aurora treatment.
 */
export default function AuroraBarChart({
  data = [], xKey = 'name', yKey = 'value', height = 220, unit,
  colors, barSize, xTickAngle = 0,
}) {
  const t = useChartTheme();
  const gid = useId().replace(/[:]/g, '');
  const cursorFill = t.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';

  const pick = (name, i) => {
    if (!colors) return null;
    if (typeof colors === 'function') return colors(name, i);
    if (Array.isArray(colors)) return colors[i % colors.length];
    return colors[name] || t.categorical[i % t.categorical.length];
  };

  const angled = xTickAngle !== 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: angled ? 18 : 0 }} barSize={barSize}>
        <defs>
          <linearGradient id={`bg${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accents.auroraFrom} />
            <stop offset="100%" stopColor={t.accents.auroraTo} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: t.label }}
          stroke={t.axis}
          tickLine={false}
          axisLine={{ stroke: t.grid }}
          interval={0}
          angle={xTickAngle}
          textAnchor={angled ? 'end' : 'middle'}
          height={angled ? 50 : undefined}
        />
        <YAxis tick={{ fontSize: 10, fill: t.label }} stroke={t.axis} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip content={(p) => <ChartTooltip {...p} t={t} unit={unit} />} cursor={{ fill: cursorFill, radius: 6 }} />
        <Bar dataKey={yKey} radius={[6, 6, 0, 0]} fill={`url(#bg${gid})`} isAnimationActive={false}>
          {colors
            ? data.map((entry, i) => <Cell key={`c${i}`} fill={pick(entry[xKey], i)} />)
            : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
