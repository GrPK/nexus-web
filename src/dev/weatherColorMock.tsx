/* eslint-disable i18next/no-literal-string */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../lib/polyfills';
import '../styles/variables.scss';
import '../styles/global.scss';
import '../panel/styles/tokens.scss';
import { applyAccentColor, applyThemeMode } from '../lib/settings';
import { buildEmbeddedPanelThemeVars } from '../panel/theme/panelTheme';
import { setForceLanMode } from '../api/service';
import { I18nProvider } from '../lib/i18n';
import { WeatherSettings } from '../panel/widgets/weather/WeatherSettings';
import { WeatherWidget } from '../panel/widgets/weather/WeatherWidget';
import type { WeatherBarColors } from '../panel/widgets/weather/weatherTempColors';
import type { WeatherSnapshot } from '../api/weather';
import type { PanelWidget } from '../panel/types';

// Dev-only harness: renders the real WeatherWidget three times with fixture
// snapshots served through a patched fetch.

interface Scenario { name: string; current: number; days: Array<[number, number, number]> }

const SCENARIOS: Scenario[] = [
  { name: 'Hot summer', current: 84, days: [[70, 91, 1], [58, 74, 1], [52, 71, 3], [54, 76, 1], [60, 71, 61]] },
  { name: 'Mild spring', current: 59, days: [[48, 66, 3], [45, 63, 61], [50, 68, 1], [47, 61, 3], [44, 58, 61]] },
  { name: 'Cold winter', current: 30, days: [[22, 35, 3], [18, 31, 3], [20, 34, 1], [25, 35, 3], [19, 28, 3]] },
];

const ACCENTS: Array<[string, string]> = [
  ['Nexus blue', '#2563eb'], ['Purple', '#a855f7'], ['Green', '#22c55e'], ['Pink', '#ec4899'], ['Orange', '#f97316'],
];

const toC = (f: number) => Math.round(((f - 32) * 5) / 9);

function snapshot(s: Scenario): WeatherSnapshot {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const hourly = Array.from({ length: 8 }, (_, i) => {
    const f = Math.round(s.current + Math.sin((i / 7) * Math.PI) * 3 - i * 0.5);
    return { time: new Date(start.getTime() + (i + 1) * 3600_000).toISOString(), weatherCode: i % 3 === 2 ? 3 : 1, temperatureF: f, temperatureC: toC(f) };
  });
  const daily = s.days.map(([lo, hi, code], i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date, weatherCode: code, temperatureMinF: lo, temperatureMaxF: hi, temperatureMinC: toC(lo), temperatureMaxC: toC(hi) };
  });
  return {
    temperatureF: s.current, temperatureC: toC(s.current), weatherCode: 1, condition: 'Clear', humidityPct: 48, windKph: 11,
    locationLabel: 'Santa Cruz', countryCode: 'US', asOf: new Date().toISOString(), hourly, daily,
  };
}

const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/weather')) {
    const lat = Number(new URL(url, location.href).searchParams.get('lat'));
    return Promise.resolve(new Response(JSON.stringify(snapshot(SCENARIOS[lat] ?? SCENARIOS[0])), { headers: { 'Content-Type': 'application/json' } }));
  }
  return realFetch(input, init);
};

setForceLanMode(true);
applyThemeMode('dark');
localStorage.setItem('nexus_token', 'harness');

function Card({ title, mode, accentBars, scenario, unit, accent, children }: { title: string; mode?: WeatherBarColors; accentBars?: boolean; scenario: number; unit: 'F' | 'C'; accent: string; children?: React.ReactNode }) {
  const vars = useMemo(() => buildEmbeddedPanelThemeVars(accent, 'dark'), [accent]);
  const widget: PanelWidget = {
    id: `w-${title}`, type: 'weather', size: '4x4', col: 0, row: 0,
    config: { unit, accentBars: accentBars === true, location: { lat: scenario, lon: 0, label: 'Santa Cruz', cc: 'US' } },
  };
  return (
    <div>
      <div style={{ font: '600 13px system-ui', color: '#bbb', margin: '0 0 8px' }}>{title}</div>
      <div className="panel-root" data-surface="desktop" style={{ ...vars, position: 'relative', width: 390, height: 390, '--panel-cell-size': '90px' } as React.CSSProperties}>
        <div className="panel-card" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <I18nProvider initialLanguage="en"><WeatherWidget widget={widget} barColors={mode} /></I18nProvider>
        </div>
        {children}
      </div>
    </div>
  );
}

function Live({ scenario, unit, accent }: { scenario: number; unit: 'F' | 'C'; accent: string }) {
  const [accentBars, setAccentBars] = useState(false);
  const vars = useMemo(() => buildEmbeddedPanelThemeVars(accent, 'dark'), [accent]);
  const widget: PanelWidget = {
    id: 'w-live', type: 'weather', size: '4x4', col: 0, row: 0,
    config: { unit, accentBars, location: { lat: scenario, lon: 0, label: 'Santa Cruz', cc: 'US' } },
  };
  return (
    <Card title="Live: toggle in the real settings sheet" accentBars={accentBars} scenario={scenario} unit={unit} accent={accent}>
      <div className="panel-root" data-surface="desktop" style={{ ...vars, position: 'absolute', top: 400, width: 390 } as React.CSSProperties}>
        <div className="panel-card" style={{ padding: 16 }}>
          <I18nProvider initialLanguage="en">
            <WeatherSettings widget={widget} surface="desktop" desktopEditor onUpdate={patch => { if ('accentBars' in patch) setAccentBars(patch.accentBars === true); }} onResize={() => {}} />
          </I18nProvider>
        </div>
      </div>
    </Card>
  );
}

function Harness() {
  const [scenario, setScenario] = useState(0);
  const [unit, setUnit] = useState<'F' | 'C'>('F');
  const [accent, setAccent] = useState(ACCENTS[0][1]);
  const pick = (hex: string) => { setAccent(hex); applyAccentColor(hex); };
  const btn = (on: boolean) => ({ padding: '5px 12px', borderRadius: 999, border: '1px solid #444', background: on ? '#2d6cdf' : '#16161a', color: '#fff', cursor: 'pointer' });
  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#0b0b0d', color: '#eee', font: '13px system-ui' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ display: 'flex', gap: 6 }}>{SCENARIOS.map((s, i) => <button key={s.name} style={btn(i === scenario)} onClick={() => setScenario(i)}>{s.name}</button>)}</span>
        <span style={{ display: 'flex', gap: 6 }}>{(['F', 'C'] as const).map(u => <button key={u} style={btn(u === unit)} onClick={() => setUnit(u)}>{`°${u}`}</button>)}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Accent {ACCENTS.map(([n, hex]) => <button key={n} title={n} onClick={() => pick(hex)} style={{ width: 22, height: 22, borderRadius: '50%', background: hex, border: accent === hex ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />)}
          <input type="color" value={accent} onChange={e => pick(e.target.value)} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Card title="Current (origin/main)" mode="current" scenario={scenario} unit={unit} accent={accent} />
        <Card title="Setting off: absolute (default)" scenario={scenario} unit={unit} accent={accent} />
        <Card title="Setting on: accent" accentBars scenario={scenario} unit={unit} accent={accent} />
        <Live scenario={scenario} unit={unit} accent={accent} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
