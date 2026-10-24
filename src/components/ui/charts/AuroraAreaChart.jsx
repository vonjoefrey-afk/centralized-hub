import React, { useId } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '../../../theme/auroraSignal';
import ChartTooltip from './ChartTooltip';

/**
 * Aurora Gradient Area (design direction 01).
 *
 * Smooth area under a two-tone indigo→cyan stroke, fading fill, and a glowing
 * endpoint dot. Theme-aware (light + dark) via useChartTheme.
 *
 * @param {Array}  data    - array of row objects
 * @param {string} xKey    - key for the x axis (default 'date')
 * @param {string} yKey    - key for the plotted value (default 'value')
 * @param {number} height  - chart height in px
 * @param {string} unit    - optional unit shown in the tooltip
 */
export default function AuroraAreaChart({ data = [], xKey = 'date', yKey = 'value', height = 220, unit }) {
  const t = useChartTheme();
  const gid = useId().replace(/[:]/g, '');
  const lastIndex = data.length - 1;

  const renderEndDot = (props) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx == null || cy == null) {
      return <circle key={`d${index}`} cx={cx} cy={cy} r={0} fill="none" />;
    }
    return (
      <g key="end">
        <circle cx={cx} cy={cy} r={4.5} fill={t.accents.auroraTo} style={{ filter: `drop-shadow(0 0 5px ${t.accents.glowCyan})` }} />
        <circle cx={cx} cy={cy} r={2} fill="#ffffff" />
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={`af${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accents.auroraFrom} stopOpacity={0.38} />
            <stop offset="100%" stopColor={t.accents.auroraTo} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`as${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.accents.auroraFrom} />
            <stop offset="100%" stopColor={t.accents.auroraTo} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: t.label }} stroke={t.axis} tickLine={false} axisLine={{ stroke: t.grid }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: t.label }} stroke={t.axis} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip content={(p) => <ChartTooltip {...p} t={t} unit={unit} />} cursor={{ stroke: t.axis, strokeDasharray: '3 3' }} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={`url(#as${gid})`}
          strokeWidth={2.5}
          fill={`url(#af${gid})`}
          dot={renderEndDot}
          activeDot={{ r: 5, fill: t.accents.auroraTo, stroke: t.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
