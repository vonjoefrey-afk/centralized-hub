import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ArrowLeftIcon,
  Squares2X2Icon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_META, DOCS } from './docsContent';
import MermaidDiagram from './MermaidDiagram';
import { FLOWCHARTS, FLOWCHART_TABS } from './flowchartData';
import { FEATURE_FLOWS } from './featureFlows';

const ACCENT_DOT = {
  indigo: 'bg-indigo-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
};

const ACCENT_CHIP = {
  indigo: 'bg-indigo-500 text-white shadow-indigo-500/30',
  blue: 'bg-blue-500 text-white shadow-blue-500/30',
  violet: 'bg-violet-500 text-white shadow-violet-500/30',
  emerald: 'bg-emerald-500 text-white shadow-emerald-500/30',
  rose: 'bg-rose-500 text-white shadow-rose-500/30',
};

const DocsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState('docs'); // 'docs' | 'flowchart'
  const [activeFlow, setActiveFlow] = useState('overview');
  const [activeDashboard, setActiveDashboard] = useState(DOCS[0].id);
  const [activeFeature, setActiveFeature] = useState(DOCS[0].features[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentDashboard = useMemo(
    () => DOCS.find((d) => d.id === activeDashboard) || DOCS[0],
    [activeDashboard]
  );
  const currentFeature = useMemo(
    () => currentDashboard.features.find((f) => f.id === activeFeature) || currentDashboard.features[0],
    [currentDashboard, activeFeature]
  );

  const selectFeature = (dashboardId, featureId) => {
    setActiveDashboard(dashboardId);
    setActiveFeature(featureId);
    setView('docs');
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#0a0a0a]/80 border-b border-gray-200/60 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <DocumentTextIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight truncate">{APP_META.name}</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-0.5">Documentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/60 dark:border-white/10">
              <button
                onClick={() => setView('docs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  view === 'docs'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4" /> Docs
              </button>
              <button
                onClick={() => setView('flowchart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  view === 'flowchart'
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" /> Flowchart
              </button>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <ArrowLeftIcon className="w-4 h-4" /> App
            </Link>
          </div>
        </div>

        {/* Mobile view toggle */}
        <div className="sm:hidden flex border-t border-gray-200/60 dark:border-white/10">
          <button
            onClick={() => setView('docs')}
            className={`flex-1 py-2.5 text-xs font-bold ${view === 'docs' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500'}`}
          >
            Docs
          </button>
          <button
            onClick={() => setView('flowchart')}
            className={`flex-1 py-2.5 text-xs font-bold ${view === 'flowchart' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500'}`}
          >
            Flowchart
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        {view === 'flowchart' ? (
          <div className="animate-in fade-in duration-500">
            <div className="mb-6 max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Flowcharts</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Pick the overview or a specific dashboard to see its flow.
              </p>
            </div>

            {/* Dashboard selector */}
            <div className="flex flex-wrap gap-2 mb-8">
              {FLOWCHART_TABS.map((tab) => {
                const active = activeFlow === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFlow(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                      active
                        ? ACCENT_CHIP[tab.accent] || ACCENT_CHIP.indigo
                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-black tracking-tight">{FLOWCHARTS[activeFlow].title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                {FLOWCHARTS[activeFlow].subtitle}
              </p>
            </div>

            <FlowLegend />

            <div className="mt-4 bg-white dark:bg-[#0f0f0f] rounded-3xl border border-gray-200/60 dark:border-white/10 shadow-xl p-6 sm:p-10 overflow-x-auto">
              <MermaidDiagram definition={FLOWCHARTS[activeFlow].definition} />
            </div>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Sidebar */}
            <aside
              className={`${
                sidebarOpen ? 'block' : 'hidden'
              } lg:block fixed lg:static inset-x-0 top-[104px] lg:top-0 bottom-0 z-20 lg:z-0 bg-white lg:bg-transparent dark:bg-[#0a0a0a] lg:dark:bg-transparent overflow-y-auto lg:overflow-visible p-4 lg:p-0 lg:w-72 lg:shrink-0`}
            >
              <nav className="space-y-6">
                {DOCS.map((dash) => (
                  <div key={dash.id}>
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${ACCENT_DOT[dash.accent] || 'bg-gray-400'}`}></span>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        {dash.dashboard}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {dash.features.map((feat) => {
                        const active = dash.id === activeDashboard && feat.id === activeFeature;
                        return (
                          <li key={feat.id}>
                            <button
                              onClick={() => selectFeature(dash.id, feat.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                active
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold'
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                              }`}
                            >
                              {feat.name}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 mb-3">
                  <span>{currentDashboard.dashboard}</span>
                  <span>›</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{currentFeature.name}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{currentFeature.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">{currentDashboard.blurb}</p>
              </div>

              <div className="space-y-4 max-w-3xl">
                <Section title="Problem it solves" tone="rose" body={currentFeature.problem} />
                <Section title="How it works" tone="indigo" body={currentFeature.howItWorks} />
                <Section title="The outcome" tone="emerald" body={currentFeature.solution} />
              </div>

              {/* Per-feature flowchart */}
              {FEATURE_FLOWS[`${currentDashboard.id}:${currentFeature.id}`] && (
                <div className="mt-8 max-w-3xl">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
                    Feature Flowchart
                  </h3>
                  <FlowLegend />
                  <div className="mt-4 bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-sm p-6 sm:p-8 overflow-x-auto">
                    <MermaidDiagram definition={FEATURE_FLOWS[`${currentDashboard.id}:${currentFeature.id}`]} />
                  </div>
                </div>
              )}

              {/* Prev / next within dashboard */}
              <FeatureNav
                dashboard={currentDashboard}
                activeFeatureId={activeFeature}
                onSelect={(fid) => selectFeature(currentDashboard.id, fid)}
              />
            </main>
          </div>
        )}
      </div>
    </div>
  );
};

const FlowLegend = () => {
  const items = [
    { shape: <span className="inline-block w-7 h-4 rounded-full border-2 border-emerald-400" />, label: 'Start / End' },
    { shape: <span className="inline-block w-7 h-4 rounded-[3px] border-2 border-gray-400 dark:border-white/30" />, label: 'Process' },
    { shape: <span className="inline-block w-4 h-4 rotate-45 border-2 border-amber-400" />, label: 'Decision' },
    { shape: <span className="inline-block w-7 h-4 border-2 border-violet-400 -skew-x-[18deg]" />, label: 'Input / Output' },
    {
      shape: (
        <span className="inline-block w-6 h-4 border-2 border-blue-400 rounded-[40%/60%]" style={{ borderRadius: '45% / 30%' }} />
      ),
      label: 'Stored record',
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          {it.shape}
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{it.label}</span>
        </div>
      ))}
    </div>
  );
};

const Section = ({ title, tone, body }) => {
  const bar = {
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
  };
  return (
    <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-sm overflow-hidden">
      <div className="flex">
        <div className={`w-1 shrink-0 ${bar[tone] || 'bg-gray-400'}`}></div>
        <div className="p-5 sm:p-6">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
            {title}
          </h3>
          <p className="text-sm sm:text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">{body}</p>
        </div>
      </div>
    </div>
  );
};

const FeatureNav = ({ dashboard, activeFeatureId, onSelect }) => {
  const idx = dashboard.features.findIndex((f) => f.id === activeFeatureId);
  const prev = idx > 0 ? dashboard.features[idx - 1] : null;
  const next = idx < dashboard.features.length - 1 ? dashboard.features[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <div className="mt-10 pt-6 border-t border-gray-200/60 dark:border-white/10 flex justify-between gap-3 max-w-3xl">
      {prev ? (
        <button
          onClick={() => onSelect(prev.id)}
          className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors max-w-[48%]"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Previous</div>
          <div className="text-sm font-bold truncate">{prev.name}</div>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          onClick={() => onSelect(next.id)}
          className="text-right px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors max-w-[48%] ml-auto"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Next</div>
          <div className="text-sm font-bold truncate">{next.name}</div>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
};

export default DocsPage;
