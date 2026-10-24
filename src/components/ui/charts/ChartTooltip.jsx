import React from 'react';

/**
 * Theme-aware tooltip shared by the Aurora Signal charts.
 * Pass the resolved chart theme `t` (from useChartTheme) and an optional unit.
 */
const ChartTooltip = ({ active, payload, label, t, unit }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: t.tooltipBg,
        border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 12,
        padding: '8px 12px',
        fontSize: 12,
        color: t.ink,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          color: t.label,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {payload[0].value}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  );
};

export default ChartTooltip;
