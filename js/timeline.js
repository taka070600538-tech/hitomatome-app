// 4アプリの1日分の記録を時刻順のタイムラインに組み立てる純粋モジュール(DOM・ストレージ非依存)
import { diffMinutes, formatDuration, isHHMM, fmtKcal, fmtG, round1 } from './format.js';
import { EVENTS } from './settings.js';
import { MEAL_LABELS } from './mealSummary.js';

export const JOGGING_KCAL_PER_HOUR = 400;

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SKIP_NOTE = '(時刻未入力)';
const DUP_NOTE = '結びつけ先が他の出来事と重複しています(設定で選び直してください)';
const NOT_FOUND_NOTE = '結びつけ先の項目が見つかりません(設定で選び直してください)';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function joggingKcal(durationMin) {
  if (!isNum(durationMin) || durationMin <= 0) return 0;
  return Math.round((durationMin / 60) * JOGGING_KCAL_PER_HOUR);
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const NOTICES = {
  calorie: 'カロリー計算アプリ',
  exercise: '運動管理アプリ',
  bp: '血圧手帳アプリ',
  diary: '時間管理ダイアリー',
};
const noticeText = (k) => `${NOTICES[k]}のデータが見つかりません(この端末で一度開くと表示されます)`;

function eventAppKey(key) {
  if (key === 'bp') return 'bp';
  if (key === 'jogging' || key === 'strength') return 'exercise';
  return 'calorie';
}

function bpData(sources) {
  const r = sources.bp?.record;
  if (!r || !isNum(r.sysL) || !isNum(r.diaL) || !isNum(r.sysR) || !isNum(r.diaR)) return null;
  return { detail: `左 ${r.sysL}/${r.diaL} ・ 右 ${r.sysR}/${r.diaR} mmHg`, expand: null };
}

function joggingData(sources) {
  const j = sources.exercise?.record?.jogging;
  if (!j) return null;
  const parts = [];
  if (isNum(j.distanceKm)) parts.push(`${round1(j.distanceKm)} km`);
  if (isNum(j.durationMin)) parts.push(`${j.durationMin}分`);
  if (parts.length === 0) return null;
  let detail = parts.join(' ／ ');
  if (isNum(j.durationMin) && j.durationMin > 0) detail += ` ・ 約${joggingKcal(j.durationMin)} kcal`;
  return { detail, expand: null };
}

function strengthData(sources) {
  const rec = sources.exercise?.record;
  if (!rec) return null;
  const s = rec.strength || {};
  const parts = [];
  const push = Array.isArray(s.pushups) ? s.pushups.filter(isNum) : [];
  if (push.length > 0) parts.push(`腕立て ${push.join('+')}`);
  if (isNum(s.situps)) parts.push(`腹筋 ${s.situps}`);
  if (isNum(s.backExtensions)) parts.push(`背筋 ${s.backExtensions}`);
  if (isNum(s.squats)) parts.push(`スクワット ${s.squats}`);
  const g = rec.gripStrength || {};
  const grip = [];
  if (isNum(g.rightKg)) grip.push(`右${g.rightKg}`);
  if (isNum(g.leftKg)) grip.push(`左${g.leftKg}`);
  if (grip.length > 0) parts.push(`握力 ${grip.join(' ')} kg`);
  if (parts.length === 0) return null;
  return { detail: parts.join(' ／ '), expand: parts };
}

function mealData(key, sheet) {
  const meal = sheet?.meals?.find((m) => m.type === key);
  if (!meal) return null;
  const label = MEAL_LABELS[key] ?? meal.label;
  const names = meal.items.map((i) => i.name);
  let detail = `${label} ${fmtKcal(meal.subtotal.kcal)} kcal — ${names.slice(0, 3).join('、')}`;
  if (names.length > 3) detail += ` …${names.length}品`;
  const expand = meal.items.map((i) => `${i.name} ${fmtG(i.grams)} g ${fmtKcal(i.kcal)} kcal`);
  return { detail, expand };
}

function eventData(key, sources, sheet) {
  if (key === 'bp') return bpData(sources);
  if (key === 'jogging') return joggingData(sources);
  if (key === 'strength') return strengthData(sources);
  if (MEAL_KEYS.includes(key)) return mealData(key, sheet);
  return null;
}

function eventKind(key) {
  if (key === 'bp') return 'bp';
  if (key === 'jogging') return 'jogging';
  if (key === 'strength') return 'strength';
  return 'meal';
}

export function buildTimeline({ date, sources, settings, sheet }) {
  void date;
  const notices = [];
  for (const k of Object.keys(NOTICES)) {
    if (!sources[k]?.available) notices.push(noticeText(k));
  }

  const diaryAvail = !!sources.diary?.available;
  const items = diaryAvail && Array.isArray(sources.diary.state?.items) ? sources.diary.state.items : [];
  const intervals = diaryAvail && Array.isArray(sources.diary.state?.intervals) ? sources.diary.state.intervals : [];
  const rawTimes = (diaryAvail && sources.diary.day?.times) || {};
  const times = {};
  for (const it of items) {
    if (isHHMM(rawTimes[it.id])) times[it.id] = rawTimes[it.id];
  }

  // 前日判定: start が end より遅い
  const prevDayIds = new Set();
  for (const iv of intervals) {
    if (times[iv.start] && times[iv.end] && toMin(times[iv.start]) > toMin(times[iv.end])) prevDayIds.add(iv.start);
  }

  const intervalText = (itemId) => {
    const out = [];
    for (const iv of intervals) {
      if (iv.end === itemId && times[iv.start] && times[iv.end]) {
        out.push(`${iv.label} ${formatDuration(diffMinutes(times[iv.start], times[iv.end]))}`);
      }
    }
    return out.join(' ・ ');
  };

  const bindingOf = (key) => {
    const fallback = EVENTS.find((e) => e.key === key).defaultTime;
    const b = settings?.bindings?.[key];
    return { itemId: b?.itemId ?? null, defaultTime: isHHMM(b?.defaultTime) ? b.defaultTime : fallback };
  };

  // item id -> EVENTS のうち、その項目に結びつき、かつ対象アプリが利用可能なもの(先勝ち)
  const eventByItem = new Map();
  for (const e of EVENTS) {
    const id = bindingOf(e.key).itemId;
    if (id && !eventByItem.has(id) && sources[eventAppKey(e.key)]?.available) eventByItem.set(id, e);
  }

  const entries = []; // { row, rank, idx }

  // ダイアリー行(結びつけ項目は統合)
  items.forEach((it, idx) => {
    const time = times[it.id];
    if (!time) return;
    const prevDay = prevDayIds.has(it.id);
    const ev = eventByItem.get(it.id);
    const ivText = intervalText(it.id);
    let row;
    if (ev) {
      const data = eventData(ev.key, sources, sheet);
      let detail = data ? data.detail : '';
      if (ivText) detail = detail ? `${detail} ・ ${ivText}` : ivText;
      row = {
        kind: eventKind(ev.key), eventKey: ev.key, time, prevDay, label: ev.label,
        detail, expand: data ? data.expand : null, skipped: false, note: null,
      };
    } else {
      row = {
        kind: 'diary', eventKey: null, time, prevDay, label: it.label,
        detail: ivText, expand: null, skipped: false, note: null,
      };
    }
    row.sortKey = prevDay ? -1 : toMin(time);
    entries.push({ row, rank: 0, idx });
  });

  // 時刻の取れなかった結びつけイベント
  EVENTS.forEach((e, eIdx) => {
    if (!sources[eventAppKey(e.key)]?.available) return;
    const b = bindingOf(e.key);
    const data = eventData(e.key, sources, sheet);
    const hasTime = !!(b.itemId && times[b.itemId]);
    const duplicate = hasTime && eventByItem.get(b.itemId) !== e;
    if (hasTime && !duplicate) return;
    if (e.key === 'snack' && !b.itemId) {
      if (!data) return;
      entries.push({
        row: {
          kind: 'meal', eventKey: 'snack', time: b.defaultTime, prevDay: false, label: e.label,
          detail: data.detail, expand: data.expand, skipped: false, note: null, sortKey: toMin(b.defaultTime),
        },
        rank: 1, idx: eIdx,
      });
      return;
    }
    let note = data ? SKIP_NOTE : null;
    if (duplicate) note = DUP_NOTE;
    else if (b.itemId && diaryAvail && !items.some((it) => it.id === b.itemId)) note = NOT_FOUND_NOTE;
    entries.push({
      row: {
        kind: eventKind(e.key), eventKey: e.key, time: b.defaultTime, prevDay: false,
        label: `${e.label} スキップ`, detail: data ? data.detail : '', expand: data ? data.expand : null,
        skipped: true, note, sortKey: toMin(b.defaultTime),
      },
      rank: 1, idx: eIdx,
    });
  });

  entries.sort((a, b) => a.row.sortKey - b.row.sortKey || a.rank - b.rank || a.idx - b.idx);
  return { rows: entries.map((x) => x.row), notices };
}

export function buildSummary({ sources, sheet }) {
  const kcal = isNum(sheet?.totals?.kcal) ? sheet.totals.kcal : null;
  const goalKcal = isNum(sheet?.goals?.kcal) ? sheet.goals.kcal : null;
  const jm = sources?.exercise?.record?.jogging?.durationMin;
  const joggingMin = isNum(jm) ? jm : null;
  const r = sources?.bp?.record;
  const bp = r && isNum(r.sysL) && isNum(r.diaL) ? { sys: r.sysL, dia: r.diaL } : null;

  let sleepMin = null;
  const d = sources?.diary;
  if (d?.available) {
    const iv = (d.state?.intervals || []).find((x) => x.id === 'sleep-duration');
    const t = d.day?.times || {};
    if (iv && isHHMM(t[iv.start]) && isHHMM(t[iv.end])) sleepMin = diffMinutes(t[iv.start], t[iv.end]);
  }
  return { kcal, goalKcal, joggingMin, bp, sleepMin };
}

export function summaryText(s) {
  const parts = [];
  if (s.kcal != null) {
    parts.push(`食事 ${fmtKcal(s.kcal)} kcal${s.goalKcal != null ? `(目標 ${fmtKcal(s.goalKcal)})` : ''}`);
  }
  if (s.joggingMin != null) parts.push(`ジョギング ${s.joggingMin}分`);
  if (s.bp) parts.push(`血圧 ${s.bp.sys}/${s.bp.dia}`);
  if (s.sleepMin != null) parts.push(`睡眠 ${formatDuration(s.sleepMin)}`);
  return parts.length ? parts.join(' ・ ') : 'この日の記録はありません';
}
