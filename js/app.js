import { renderTimelineView } from './timelineView.js';
import { renderSettingsView } from './settingsView.js';
import { loadSettings, saveSettings, validateSettings } from './settings.js';
import { parseDiaryState, DIARY_KEY } from './sources.js';
import { todayString } from './format.js';

const SYNC_URL = 'https://taka070600538-tech.github.io/app-sync/v1/sync.js';

function currentItems() {
  try {
    return parseDiaryState(localStorage.getItem(DIARY_KEY))?.items ?? [];
  } catch {
    return [];
  }
}

function switchView(viewName) {
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  }
  if (viewName === 'timeline') renderTimelineView(document.getElementById('view-timeline'), { date: todayString() });
  if (viewName === 'settings') renderSettingsView(document.getElementById('view-settings'));
}

function init() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  switchView('timeline');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有バックアップ基盤は動的import。オフライン/障害時は黙ってスキップする。
  import(SYNC_URL)
    .then((sync) => sync.initDailyBackup({
      appId: 'daily-summary',
      collect: async () => loadSettings(localStorage, currentItems()),
      restore: async (data) => saveSettings(localStorage, validateSettings(data)),
    }))
    .catch(() => {});
}

if (typeof document !== 'undefined') init();
