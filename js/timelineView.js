import { addDays, formatDateShort, todayString } from './format.js';
import { loadDaySources } from './sources.js';
import { buildSheet } from './mealSummary.js';
import { renderSheetHtml, esc } from './sheet.js';
import { loadSettings } from './settings.js';
import { buildTimeline, buildSummary, summaryText } from './timeline.js';
import { buildPrintRequest, requestPath } from './printRequest.js';
import { SYNC_URL } from './syncUrl.js';


export async function renderTimelineView(container, { date = todayString() } = {}) {
  const token = Symbol('render');
  container._renderToken = token;
  container.innerHTML = `${navHtml(date)}<p class="panel-note">読み込み中…</p>`;
  bindNav(container, date);
  try {
    const sources = await loadDaySources(date);
    if (container._renderToken !== token) return;
    const c = sources.calorie;
    const sheet = buildSheet({ date, meals: c.meals, foods: c.foods, goals: c.goals });
    const items = sources.diary.state?.items ?? [];
    const settings = loadSettings(localStorage, items);
    const { rows, notices } = buildTimeline({ date, sources, settings, sheet });
    const summary = summaryText(buildSummary({ sources, sheet, settings }));
    container.innerHTML = navHtml(date) + bodyHtml(summary, notices, rows, sheet);
    bindNav(container, date);
    bindRows(container);
    const btn = container.querySelector('#print-btn');
    if (btn && sheet) btn.addEventListener('click', () => openPrintModal(date, sheet));
  } catch (e) {
    if (container._renderToken !== token) return;
    container.innerHTML = `${navHtml(date)}<p class="panel-note error">読み込みに失敗しました: ${esc(e && e.message ? e.message : e)}</p>`;
    bindNav(container, date);
  }
}

function navHtml(date) {
  return `<div class="date-nav">
    <button type="button" class="date-prev" aria-label="前の日">◀</button>
    <button type="button" class="date-center">${esc(formatDateShort(date))}</button>
    <button type="button" class="date-next" aria-label="次の日">▶</button>
  </div>
  <input type="date" class="date-input hidden" value="${esc(date)}">`;
}

function bindNav(container, date) {
  const go = (d) => renderTimelineView(container, { date: d });
  container.querySelector('.date-prev').addEventListener('click', () => go(addDays(date, -1)));
  container.querySelector('.date-next').addEventListener('click', () => go(addDays(date, 1)));
  const input = container.querySelector('.date-input');
  container.querySelector('.date-center').addEventListener('click', () => input.classList.toggle('hidden'));
  input.addEventListener('change', () => { if (input.value) go(input.value); });
}

function bodyHtml(summary, notices, rows, sheet) {
  const noticeHtml = notices.length
    ? `<ul class="notices">${notices.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
  const rowsHtml = rows.map((r) => {
    const cls = ['row', `kind-${r.kind}`];
    if (r.skipped) cls.push('is-skipped');
    if (r.prevDay) cls.push('is-prev');
    const expandable = Array.isArray(r.expand) && r.expand.length > 0;
    if (expandable) cls.push('expandable');
    const time = (r.prevDay ? '前日 ' : '') + esc(r.time);
    return `<li class="${cls.join(' ')}">
      <span class="time">${time}</span><span class="dot"></span>
      <div class="body"><div class="label">${esc(r.label)}</div>
      ${r.detail ? `<div class="detail">${esc(r.detail)}</div>` : ''}
      ${r.note ? `<small>${esc(r.note)}</small>` : ''}
      ${expandable ? `<ul class="expand hidden">${r.expand.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </div></li>`;
  }).join('');
  return `<div class="summary-card">${esc(summary)}</div>${noticeHtml}
    <ul class="timeline">${rowsHtml}</ul>
    <div class="print-area">
      <button type="button" id="print-btn" class="primary-btn"${sheet ? '' : ' disabled'}>この日の食事を印刷(PCへ送る)</button>
      ${sheet ? '' : '<p class="panel-note">この日の食事記録がありません</p>'}
    </div>`;
}

function bindRows(container) {
  container.querySelectorAll('li.row.expandable').forEach((li) => {
    li.querySelector('.body').addEventListener('click', () => {
      li.querySelector('ul.expand').classList.toggle('hidden');
    });
  });
}

function openPrintModal(date, sheet) {
  const request = buildPrintRequest({ date, sheet });
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-card">
    <iframe class="sheet-preview" title="印刷プレビュー"></iframe>
    <p class="send-result" role="status"></p>
    <div class="modal-actions">
      <button type="button" class="primary-btn send-btn">送信</button>
      <button type="button" class="close-btn">閉じる</button>
    </div></div>`;
  modal.querySelector('iframe').srcdoc = renderSheetHtml(request);
  document.body.appendChild(modal);
  const result = modal.querySelector('.send-result');
  const sendBtn = modal.querySelector('.send-btn');
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  sendBtn.addEventListener('click', async () => {
    sendBtn.disabled = true;
    let sync;
    try {
      sync = await import(SYNC_URL);
    } catch {
      result.textContent = 'オフラインのため送信できません';
      sendBtn.disabled = false;
      return;
    }
    try {
      const r = await sync.putFile(requestPath(request), JSON.stringify(request, null, 2), { message: 'print-request: ' + date });
      if (r.ok) { result.textContent = 'PCへ送りました。PCが起動していれば10分以内に印刷されます'; return; }
      else if (r.message === 'トークンが未設定です') result.textContent = '設定タブでGitHub連携を設定してください';
      else result.textContent = r.message;
    } catch (e) {
      result.textContent = String(e && e.message ? e.message : e);
    }
    sendBtn.disabled = false;
  });
}
