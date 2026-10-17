// 日付・数値・時間の書式ユーティリティ(DOM非依存の純粋モジュール)
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function parseDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d); // ローカル日付(UTC解釈を避ける)
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateString(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function formatDateJa(date) {
  const dt = parseDate(date);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日(${WEEKDAYS[dt.getDay()]})`;
}

export function formatDateShort(date) {
  const dt = parseDate(date);
  return `${dt.getMonth() + 1}/${dt.getDate()}(${WEEKDAYS[dt.getDay()]})`;
}

export function addDays(date, n) {
  const dt = parseDate(date);
  dt.setDate(dt.getDate() + n);
  return toDateString(dt);
}

export function todayString(now = new Date()) {
  return toDateString(now);
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function fmtKcal(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtG(n) {
  return round1(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function diffMinutes(start, end) {
  let diff = toMinutes(end) - toMinutes(start);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function isHHMM(v) {
  if (typeof v !== 'string' || !/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h <= 23 && m <= 59;
}
