/**
 * Aurora Signal — chart theme
 *
 * The blended visual system (design directions 01 Midnight Aurora + 02 Nordic
 * Frost + 08 Gradient Vitals + 12 Cyber Neon), reduced to the tokens the charts
 * need. Two full palettes — light (Nordic Frost base) and dark (Aurora + Cyber
 * base) — plus the accent gradients that stay vivid on either ground.
 *
 * The categorical colors were validated for colorblind separation and contrast
 * per surface (see the data-viz palette validator); light uses deeper steps so
 * they hold ≥3:1 on white, dark uses the brighter signal steps.
 *
 * Use `useChartTheme()` inside any chart component to get the resolved palette
 * for the currently active theme. It reacts to the app's ThemeContext toggle.
 */

import { useTheme } from '../contexts/ThemeContext';

export const AURORA_SIGNAL = {
  light: {
    ink: '#0F1720',
    muted: '#5A6B85',
    grid: 'rgba(15,23,42,0.07)',
    axis: '#B4BECD',
    label: '#647389',
    surface: '#FFFFFF',
    tooltipBg: '#FFFFFF',
    tooltipBorder: '#E4EAF3',
    gaugeTrack: 'rgba(15,23,42,0.08)',
    categorical: ['#4F46E5', '#0E9AB8', '#DB2777', '#D97706', '#059669'],
  },
  dark: {
    ink: '#EEF0F7',
    muted: '#9298AE',
    grid: 'rgba(255,255,255,0.07)',
    axis: '#3B4157',
    label: '#8B90A6',
    surface: '#13151E',
    tooltipBg: '#13151E',
    tooltipBorder: 'rgba(255,255,255,0.10)',
    gaugeTrack: 'rgba(255,255,255,0.08)',
    categorical: ['#6366F1', '#22D3EE', '#FF5E8A', '#F5A623', '#10B981'],
  },
  // Accent gradients — identical in both themes (they read on either ground).
  accents: {
    auroraFrom: '#6366F1',
    auroraTo: '#22D3EE',
    neonFrom: '#22D3EE',
    neonTo: '#F02FC2',
    glowCyan: 'rgba(34,211,238,0.55)',
    glowMagenta: 'rgba(240,47,194,0.50)',
  },
};

/**
 * Resolve the active chart palette. Falls back to reading the root `dark` class
 * (set by ThemeContext) if the hook is somehow used outside the provider.
 */
export const useChartTheme = () => {
  const ctx = useTheme();
  const resolved =
    ctx?.theme ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light');
  const theme = resolved === 'dark' ? 'dark' : 'light';
  return { theme, ...AURORA_SIGNAL[theme], accents: AURORA_SIGNAL.accents };
};
