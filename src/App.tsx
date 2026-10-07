import { useEffect, useState } from 'react';
import {
  Grid2X2,
  Check,
  ChevronDown,
  Save,
  Settings,
  CircleHelp,
  ArrowLeft,
  Leaf,
  Sprout,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  PanelTop,
  Minus,
  Plus,
} from 'lucide-react';
import { useGame } from './hooks/useGame';
import { gameStore } from './game/store';
import { isFeatureUnlocked } from './game/engine/conditions';
import { formatNumber, formatDuration } from './game/utils/numbers';
import { sheets } from './components/sheets';
import { SettingsSheet } from './components/Settings';
import { HelpSheet } from './components/Help';
import { DebugPanel, OfflineModal, Toasts } from './components/Overlays';
import { eras } from './game/content/eras';
import {
  WorkbookNavigation,
  type WorkforceFocus,
} from './components/navigation';

export default function App() {
  const snapshot = useGame(),
    { state, saveError } = snapshot;
  const [selectedSheet, setSheet] = useState('overview'),
    [zoom, setZoom] = useState(100);
  const [workforceFocus, setWorkforceFocus] = useState<WorkforceFocus | null>(
    null,
  );
  function openWorkforce(resource: string) {
    if (!isFeatureUnlocked(state, 'jobs')) return;
    setWorkforceFocus((current) => ({
      resource,
      request: (current?.request ?? 0) + 1,
    }));
    setSheet('workforce');
  }
  useEffect(() => gameStore.start(), []);
  const visible = sheets.filter((s) =>
    isFeatureUnlocked(state, s.requiredFeature),
  );
  const isUtility = selectedSheet === 'settings' || selectedSheet === 'help';
  const active = visible.find((s) => s.id === selectedSheet) ?? visible[0];
  const Sheet =
    selectedSheet === 'settings'
      ? SettingsSheet
      : selectedSheet === 'help'
        ? HelpSheet
        : active.component;
  const pageName = isUtility
    ? selectedSheet === 'settings'
      ? 'Settings'
      : 'Help'
    : active.name;
  const era = eras.find((e) => e.id === state.currentEra)!;
  return (
    <div className="app-shell">
      <header className="title-bar">
        <div className="workbook-brand">
          <span className="app-icon">
            <Grid2X2 size={20} />
          </span>
          <span>
            Civilization<span className="filename-extension">.xlsx</span>
          </span>
          <span className="title-divider" />
          <span className="saved-indicator">
            {saveError ? <AlertTriangle size={13} /> : <Check size={13} />}
            {saveError ? 'Save needs attention' : 'Saved locally'}
          </span>
        </div>
        <div className="title-right">
          <span className="title-tag">A living workbook</span>
          <button
            aria-label="Open settings"
            onClick={() => setSheet('settings')}
          >
            <Settings size={17} />
          </button>
          <span className="avatar">C</span>
        </div>
      </header>
      <div className="menu-bar">
        <nav aria-label="Workbook menu">
          <button
            className={!isUtility ? 'selected' : ''}
            onClick={() => setSheet('overview')}
          >
            Home
          </button>
          <button
            className={selectedSheet === 'settings' ? 'selected' : ''}
            onClick={() => setSheet('settings')}
          >
            Settings
          </button>
          <button
            className={selectedSheet === 'help' ? 'selected' : ''}
            onClick={() => setSheet('help')}
          >
            Help
          </button>
        </nav>
        <span className="menu-caption">
          <Sprout size={13} />
          Made to grow
        </span>
      </div>
      <div className="ribbon">
        <div className="ribbon-group">
          <div className="ribbon-tools">
            <button className="ribbon-large" onClick={() => gameStore.save()}>
              <Save size={24} strokeWidth={1.4} />
              <span>Save</span>
            </button>
            <button
              className="ribbon-large"
              onClick={() => setSheet('settings')}
            >
              <FileSpreadsheet size={24} strokeWidth={1.4} />
              <span>Workbook</span>
            </button>
          </div>
          <span className="ribbon-caption">Your workbook</span>
        </div>
        <div className="ribbon-group">
          <div className="ribbon-tools">
            <button
              className="ribbon-large"
              onClick={() => {
                setSheet('overview');
                gameStore.dispatch({ type: 'gather', resource: 'food' });
              }}
            >
              <Leaf size={25} strokeWidth={1.5} />
              <span>Gather Food</span>
            </button>
            <button
              className="ribbon-large"
              onClick={() => setSheet('overview')}
            >
              <PanelTop size={25} strokeWidth={1.4} />
              <span>Overview</span>
            </button>
          </div>
          <span className="ribbon-caption">Getting started</span>
        </div>
        <div className="ribbon-group era-ribbon">
          <div>
            <span className="ribbon-era-label">CURRENT ERA</span>
            <strong>
              <span className="tiny-dot" />
              {era.name}
              <ChevronDown size={12} />
            </strong>
            <small>{era.subtitle}</small>
          </div>
          <span className="ribbon-caption">Civilization</span>
        </div>
        <div className="ribbon-spacer" />
        <div className="ribbon-tip">
          <Clock size={16} />
          <div>
            <strong>Your progress stays with you</strong>
            <span>Autosaved every 10 seconds</span>
          </div>
        </div>
      </div>
      <div className="formula-bar">
        <span className="cell-name">
          A1
          <ChevronDown size={12} />
        </span>
        <span className="formula-fx">ƒx</span>
        <span className="formula-value">{state.eventLog.at(-1)?.message}</span>
        <CircleHelp size={14} />
      </div>
      <div className="worksheet">
        <div className="column-headers">
          <span className="corner-cell" />
          {'ABCDEFGH'.split('').map((letter) => (
            <span key={letter}>{letter}</span>
          ))}
        </div>
        <div className="worksheet-body">
          <div className="row-headers" aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <span key={i}>{formatNumber(i + 1, 0)}</span>
            ))}
          </div>
          <main className="sheet-canvas" style={{ fontSize: `${zoom}%` }}>
            <div className="sheet-inner">
              {isUtility && (
                <button
                  className="back-link"
                  onClick={() => setSheet('overview')}
                >
                  <ArrowLeft size={14} />
                  Back to Overview
                </button>
              )}
              <WorkbookNavigation.Provider
                value={{ openWorkforce, workforceFocus }}
              >
                <Sheet />
              </WorkbookNavigation.Provider>
              <DebugPanel />
            </div>
          </main>
        </div>
      </div>
      <div className="sheet-tabs">
        <span className="sheet-navigation">
          <Grid2X2 size={15} />
        </span>
        <nav aria-label="Sheets">
          {visible.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                className={!isUtility && active.id === s.id ? 'active' : ''}
                aria-current={
                  !isUtility && active.id === s.id ? 'page' : undefined
                }
                onClick={() => setSheet(s.id)}
              >
                <Icon size={14} />
                {s.name}
              </button>
            );
          })}
        </nav>
        <span className="sheet-tabs-hint">{pageName} worksheet</span>
      </div>
      <footer className="status-bar">
        <div>
          <span className={`tiny-dot ${saveError ? 'warning-dot' : ''}`} />
          <span>{saveError ? 'Save unavailable' : 'Ready'}</span>
          <span className="status-divider" />
          <span>{era.name}</span>
        </div>
        <div className="status-middle">
          <Clock size={12} />
          {formatDuration(state.statistics.totalPlayTime.toNumber())} simulated
        </div>
        <div className="zoom-control">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 80}
            onClick={() => setZoom((z) => z - 10)}
          >
            <Minus size={12} />
          </button>
          <span className="zoom-track">
            <span style={{ left: `${((zoom - 80) / 40) * 100}%` }} />
          </span>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 120}
            onClick={() => setZoom((z) => z + 10)}
          >
            <Plus size={12} />
          </button>
          <span>{formatNumber(zoom, 0)}%</span>
        </div>
      </footer>
      <Toasts />
      <OfflineModal />
    </div>
  );
}
