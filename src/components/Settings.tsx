import { useI18n } from '../i18n/LocaleContext';
import { useState } from 'react';
import {
  Download,
  Upload,
  Save,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';

import { isLanguage } from '../i18n/types';

export function SettingsSheet() {
  const {
    t: tr,
    formatError,
    formatDuration,
    formatNumber,
    formatTime,
  } = useI18n();

  const { state, savedAt, saveError } = useGame();
  const [text, setText] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [confirmReset, setConfirmReset] = useState(false);
  function exportGame() {
    setText(gameStore.export());
    setMessage('Save exported. Copy the text below or download a backup.');
    setError('');
  }
  function importGame() {
    try {
      gameStore.import(text);
      setMessage('Save imported. Your civilization has been restored.');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setMessage('');
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Save copied to clipboard.');
    } catch {
      setMessage('Select the save text and copy it manually.');
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([gameStore.export()], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `civilization-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup downloaded.');
  }
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('YOUR WORKBOOK')}</div>
          <h1>{tr('Keep your story safe.')}</h1>
          <p>
            {tr(
              'Progress lives in this browser. Export a backup to take it with you.',
            )}
          </p>
        </div>
        <button
          className="button"
          onClick={() => {
            gameStore.save();
            setMessage('Save requested. Check the storage status below.');
          }}
        >
          <Save size={16} />
          {tr('Save now')}
        </button>
      </div>
      <div className="settings-grid">
        <div className="panel settings-panel">
          <h2>{tr('Save & restore')}</h2>
          <p>{tr('Autosaved every 10 seconds and when you leave the page.')}</p>
          <div className={`save-info ${saveError ? 'save-warning' : ''}`}>
            <span className="tiny-dot" />
            {saveError
              ? formatError(saveError)
              : tr('Last saved at {time}', { time: formatTime(savedAt) })}
          </div>
          <div className="settings-actions">
            <button className="button" onClick={exportGame}>
              <Download size={16} />
              {tr('Export Save')}
            </button>
            <button className="button" onClick={download}>
              <Download size={16} />
              {tr('Download backup')}
            </button>
          </div>
          <label className="field-label" htmlFor="save-text">
            {tr('Save text')}
          </label>
          <textarea
            id="save-text"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr(
              'Export your save, or paste one here to restore it…',
            )}
          />
          <div className="settings-actions">
            <button
              className="button primary"
              onClick={importGame}
              disabled={!text.trim()}
              title={
                !text.trim()
                  ? tr('Paste a save first')
                  : tr('Replace your current game with this save')
              }
            >
              <Upload size={16} />
              {tr('Import Save')}
            </button>
            <button className="button" onClick={copy} disabled={!text.trim()}>
              <Copy size={16} />
              {tr('Copy text')}
            </button>
          </div>
          {message && (
            <p className="message success" role="status">
              <Check size={16} />
              {tr(message)}
            </p>
          )}
          {error && (
            <p className="message error" role="alert">
              <AlertTriangle size={16} />
              {formatError(error)}
            </p>
          )}
        </div>
        <div className="settings-side">
          <div className="panel settings-panel">
            <h2>{tr('Preferences')}</h2>
            <label className="language-control">
              <strong>{tr('Language')}</strong>
              <select
                aria-label={tr('Language')}
                value={state.settings.language}
                onChange={(event) => {
                  if (isLanguage(event.target.value))
                    gameStore.dispatch({
                      type: 'settings',
                      settings: { language: event.target.value },
                    });
                }}
              >
                <option value="en">{tr('English')}</option>
                <option value="cs">{tr('Czech')}</option>
              </select>
            </label>
            <p className="sheet-note">
              {tr(
                'Czech translation is being prepared. Untranslated text uses English.',
              )}
            </p>
            <label className="toggle-row">
              <span>
                <strong>{tr('Milestone notifications')}</strong>
                <small>{tr('A little celebration for a big step.')}</small>
              </span>
              <input
                type="checkbox"
                checked={state.settings.notifications}
                onChange={(e) =>
                  gameStore.dispatch({
                    type: 'settings',
                    settings: { notifications: e.target.checked },
                  })
                }
              />
              <span className="toggle" />
            </label>
            <div className="settings-detail">
              <span>{tr('Offline production limit')}</span>
              <strong>{tr('8 hours')}</strong>
            </div>
            <div className="settings-detail">
              <span>{tr('Time simulated')}</span>
              <strong>
                {formatDuration(state.statistics.totalPlayTime.toNumber())}
              </strong>
            </div>
            <div className="settings-detail">
              <span>{tr('Manual actions')}</span>
              <strong>
                {formatNumber(state.statistics.totalManualClicks, 0)}
              </strong>
            </div>
            <div className="settings-detail">
              <span>{tr('Save version')}</span>
              <strong>{formatNumber(state.saveVersion, 0)}</strong>
            </div>
          </div>
          <div className="panel settings-panel reset-panel">
            <h2>{tr('A fresh beginning')}</h2>
            <p>
              {tr(
                'Reset your civilization and start with one person. Export a backup first if you want to keep this story.',
              )}
            </p>
            <button
              className="button danger"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw size={15} />
              {tr('Reset Game')}
            </button>
          </div>
        </div>
      </div>
      {confirmReset && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <button
              className="modal-close"
              aria-label={tr('Cancel reset')}
              onClick={() => setConfirmReset(false)}
            >
              <X size={19} />
            </button>
            <div className="modal-symbol danger-symbol">
              <RotateCcw size={26} />
            </div>
            <h2 id="reset-title">{tr('Start a new civilization?')}</h2>
            <p>
              {tr(
                'This resets your resources, discoveries, skills, and achievements. Your current save will be replaced.',
              )}
            </p>
            <div className="settings-actions">
              <button
                className="button"
                autoFocus
                onClick={() => setConfirmReset(false)}
              >
                {tr('Keep playing')}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  gameStore.reset();
                  setText('');
                  setError('');
                  setMessage('A new civilization has begun.');
                  setConfirmReset(false);
                }}
              >
                {tr('Yes, reset everything')}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
