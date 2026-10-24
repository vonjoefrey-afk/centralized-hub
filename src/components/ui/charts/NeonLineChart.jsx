import React, { useId } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '../../../theme/auroraSignal';
import ChartTooltip from './ChartTooltip';

/**
 * Neon Signal Line (design direction 02 → 12 Cyber).
 *
 * Thin luminous cyan→magenta line with a soft bloom (drop-shadow on the curve),
 * faint grid, and a glowing magenta marker on the latest point. Theme-aware.
 *
 * @param {Array}  data   - array of row objects
 * @param {string} xKey   - key for the x axis (default 'date')
 * @param {string} yKey   - key for the plotted value (default 'value')
 * @param {number} height - chart height in px
 * @param {string} unit   - optional unit shown in the tooltip
 */
export default function NeonLineChart({ data = [], xKey = 'date', yKey = 'value', height = 220, unit }) {
  const t = useChartTheme();
  const gid = useId().replace(/[:]/g, '');
  const lastIndex = data.length - 1;

  const renderDot = (props) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return <circle key={`d${index}`} r={0} fill="none" />;
    const isLast = index === lastIndex;
    return (
      <circle
        key={`d${index}`}
        cx={cx}
        cy={cy}
        r={isLast ? 4.5 : 2.6}
        fill={isLast ? t.accents.neonTo : t.accents.neonFrom}
        style={{ filter: `drop-shadow(0 0 4px ${isLast ? t.accents.glowMagenta : t.accents.glowCyan})` }}
      />
    );
  };

  return (
    <div className={`neon-line-${gid}`} style={{ width: '100%' }}>
      <style>{`.neon-line-${gid} .recharts-line-curve{filter:drop-shadow(0 0 3px ${t.accents.glowCyan});}`}</style>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={`nl${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={t.accents.neonFrom} />
              <stop offset="100%" stopColor={t.accents.neonTo} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: t.label }} stroke={t.axis} tickLine={false} axisLine={{ stroke: t.grid }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: t.label }} stroke={t.axis} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
          <Tooltip content={(p) => <ChartTooltip {...p} t={t} unit={unit} />} cursor={{ stroke: t.axis, strokeDasharray: '3 3' }} />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={`url(#nl${gid})`}
            strokeWidth={2}
            dot={renderDot}
            activeDot={{ r: 5, fill: t.accents.neonTo, stroke: t.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
