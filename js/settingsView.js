import { EVENTS, loadSettings, saveSettings, validateSettings } from './settings.js';
import { loadDaySources } from './sources.js';
import { todayString } from './format.js';
import { esc } from './sheet.js';

export async function renderSettingsView(container) {
  let items = [];
  let diaryOk = false;
  try {
    const s = await loadDaySources(todayString());
    items = s.diary.state?.items ?? [];
    diaryOk = !!s.diary.state;
  } catch {
    items = [];
  }
  const settings = loadSettings(localStorage, items);

  const rowsHtml = EVENTS.map((e) => {
    const b = settings.bindings[e.key];
    const select = e.key === 'snack' ? '' : `<select data-key="${e.key}" class="bind-select">
      <option value="">結びつけない</option>
      ${items.map((it) => `<option value="${esc(it.id)}"${it.id === b.itemId ? ' selected' : ''}>${esc(it.label)}</option>`).join('')}
    </select>`;
    return `<div class="bind-row"><span class="bind-label">${esc(e.label)}</span>${select}
      <input type="time" data-key="${e.key}" class="bind-time" value="${esc(b.defaultTime)}"></div>`;
  }).join('');

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">タイムラインの結びつけ</h2>
      ${diaryOk ? '' : '<p class="panel-note">時間管理ダイアリーのデータが見つかりません</p>'}
      ${rowsHtml}
    </section>
    <section class="panel" id="backup-section"></section>
    <section class="panel" id="token-section"></section>
    <section class="panel">
      <h2 class="panel-title">インポート・エクスポート</h2>
      <p class="panel-note">アプリのデータをJSONファイルに書き出したり、ファイルから取り込んだりできます。</p>
      <button type="button" id="export-file-btn" class="save-btn">ファイルにエクスポート</button>
      <button type="button" id="import-file-btn" class="save-btn">ファイルからインポート</button>
      <input type="file" id="import-file-input" accept="application/json" hidden>
      <p id="file-backup-message" class="save-message" role="status"></p>
    </section>`;

  const persist = () => {
    const next = loadSettings(localStorage, items);
    container.querySelectorAll('.bind-select').forEach((sel) => {
      next.bindings[sel.dataset.key].itemId = sel.value || null;
    });
    container.querySelectorAll('.bind-time').forEach((inp) => {
      if (inp.value) next.bindings[inp.dataset.key].defaultTime = inp.value;
    });
    saveSettings(localStorage, next);
  };
  container.querySelectorAll('.bind-select, .bind-time').forEach((el) => el.addEventListener('change', persist));

  const importInput = container.querySelector('#import-file-input');
  const message = container.querySelector('#file-backup-message');
  container.querySelector('#export-file-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadSettings(localStorage, items), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-summary-settings-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  container.querySelector('#import-file-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const data = validateSettings(JSON.parse(await file.text()));
      saveSettings(localStorage, data);
      renderSettingsView(container);
    } catch {
      message.textContent = 'ファイルの形式が正しくありません。';
    }
  });

  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => {
      sync.renderBackupControls(container.querySelector('#backup-section'));
      sync.renderTokenSettings(container.querySelector('#token-section'));
    })
    .catch(() => {
      const m = '<p class="panel-note">GitHubバックアップ機能は現在利用できません(オフラインの可能性)。</p>';
      container.querySelector('#backup-section').innerHTML = m;
      container.querySelector('#token-section').innerHTML = m;
    });
}
