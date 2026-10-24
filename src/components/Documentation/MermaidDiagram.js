import React, { useEffect, useState, useId } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Renders a Mermaid flowchart definition as an SVG. Mermaid handles real graph
 * layout — branching, merging, and loops — so the definitions can express true
 * flowcharts rather than a single vertical line. Re-renders on theme change and
 * scales responsively (see the .mermaid-svg-wrap rule in index.css).
 */
const MermaidDiagram = ({ definition }) => {
  const { theme } = useTheme();
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const dark = theme === 'dark';
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'inherit',
      flowchart: { curve: 'basis', htmlLabels: true, padding: 14, nodeSpacing: 40, rankSpacing: 46, useMaxWidth: true },
      themeVariables: dark
        ? {
            background: '#0f0f0f',
            primaryColor: '#1b1b3a',
            primaryBorderColor: '#818cf8',
            primaryTextColor: '#e5e7eb',
            lineColor: '#6b7280',
            secondaryColor: '#3f1d38',
            tertiaryColor: '#1a2e05',
            fontSize: '14px',
          }
        : {
            background: '#ffffff',
            primaryColor: '#eef2ff',
            primaryBorderColor: '#6366f1',
            primaryTextColor: '#1e293b',
            lineColor: '#94a3b8',
            secondaryColor: '#fdf2f8',
            tertiaryColor: '#f0fdf4',
            fontSize: '14px',
          },
    });

    const run = async () => {
      try {
        const { svg: out } = await mermaid.render(`mmd-${reactId}-${dark ? 'd' : 'l'}`, definition);
        if (!cancelled) {
          setSvg(out);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to render diagram');
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [definition, theme, reactId]);

  if (error) {
    return <div className="text-sm text-rose-500 font-mono">Diagram error: {error}</div>;
  }

  return <div className="mermaid-svg-wrap w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
};

export default MermaidDiagram;
