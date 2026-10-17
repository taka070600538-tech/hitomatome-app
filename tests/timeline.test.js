import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, buildSummary, summaryText, joggingKcal } from '../js/timeline.js';
import { EVENTS } from '../js/settings.js';

const items = [
  ['prev-sleep', '前日の推定入眠'], ['wake', '起床'], ['52ef612a', '血圧測定'],
  ['run-start', 'ジョギング　開始'], ['run-end', 'シャワー　終了'],
  ['walk-start', '母と散歩　出発'], ['walk-end', '母と散歩　帰宅'],
  ['bf-prep-start', '朝食準備　開始'], ['bf-prep-end', '朝食準備　終了'],
  ['bf-end', '朝食　終了'], ['lunch-end', '昼食　終了'],
  ['st-start', '筋トレ　開始'], ['20727e24', '筋トレ　終了'], ['dinner-end', '夕食　終了'],
].map(([id, label]) => ({ id, label }));

const intervals = [
  { id: 'sleep-duration', label: '睡眠時間', start: 'prev-sleep', end: 'wake' },
  { id: 'run-duration', label: '朝の運動時間', start: 'run-start', end: 'run-end' },
  { id: 'bf-prep-duration', label: '朝食準備', start: 'bf-prep-start', end: 'bf-prep-end' },
  { id: 'walk', label: '母の散歩時間', start: 'walk-start', end: 'walk-end' },
  { id: 'st', label: '筋トレ', start: 'st-start', end: '20727e24' },
];

const times = {
  'prev-sleep': '22:00', wake: '05:20', '52ef612a': '05:34', 'walk-start': '05:50',
  'walk-end': '06:10', 'bf-prep-start': '06:40', 'bf-prep-end': '08:20', 'bf-end': '08:43',
};

const defaultTimeOf = Object.fromEntries(EVENTS.map((e) => [e.key, e.defaultTime]));
const bindings = {
  bp: '52ef612a', jogging: 'run-end', strength: '20727e24', breakfast: 'bf-end',
  lunch: 'lunch-end', dinner: 'dinner-end', snack: null,
};
const settings = {
  version: 1,
  bindings: Object.fromEntries(EVENTS.map((e) => [e.key, { itemId: bindings[e.key], defaultTime: defaultTimeOf[e.key] }])),
};

const mkItem = (name, grams, kcal) => ({ name, grams, kcal });
const sheet = {
  title: 'x', goals: { kcal: 1800 }, totals: { kcal: 2236 }, extras: [],
  meals: [
    { type: 'breakfast', label: '朝食', items: [mkItem('レタス', 25, 3), mkItem('ブロッコリー 花序 生', 40, 14), mkItem('ほうれん草 茹で', 30, 7), mkItem('卵', 50, 76)], subtotal: { kcal: 704 } },
    { type: 'lunch', label: '昼食', items: [mkItem('ご飯', 150, 252)], subtotal: { kcal: 795 } },
  ],
};

const exercise = {
  date: '2026-10-15',
  jogging: { distanceKm: 3.6, durationMin: 27, startTime: null, weather: null },
  strength: { situps: 50, backExtensions: 50, squats: 50, gripReps: null, pushups: [34, 10, 6] },
  gripStrength: { leftKg: 36.5, rightKg: 35.5 },
  memo: null,
};
const bpRec = { date: '2026-10-15', sysL: 132, diaL: 84, sysR: 126, diaR: 87 };

function sources(over = {}) {
  return {
    calorie: { available: true, foods: [], meals: [], goals: null },
    exercise: { available: true, record: exercise },
    bp: { available: true, record: bpRec },
    diary: { available: true, state: { items, intervals, days: {} }, day: { times, note: '' } },
    ...over,
  };
}
const build = (o = {}) => buildTimeline({ date: '2026-10-15', sources: o.sources ?? sources(), settings: o.settings ?? settings, sheet: 'sheet' in o ? o.sheet : sheet });
const find = (rows, f) => rows.find(f);

test('前日入眠が最上段で prevDay', () => {
  const { rows } = build();
  assert.equal(rows[0].label, '前日の推定入眠');
  assert.equal(rows[0].prevDay, true);
  assert.equal(rows[0].kind, 'diary');
  assert.equal(rows[0].sortKey, -1);
  assert.equal(rows[1].label, '起床');
  assert.equal(rows[1].prevDay, false);
});

test('起床行に睡眠時間、散歩帰宅行に区間', () => {
  const { rows } = build();
  assert.equal(find(rows, (r) => r.label === '起床').detail, '睡眠時間 7時間20分');
  assert.equal(find(rows, (r) => r.label === '母と散歩　帰宅').detail, '母の散歩時間 20分');
});

test('血圧行は 05:34 に統合', () => {
  const { rows } = build();
  const bp = rows.filter((r) => r.kind === 'bp');
  assert.equal(bp.length, 1);
  assert.equal(bp[0].time, '05:34');
  assert.equal(bp[0].detail, '左 132/84 ・ 右 126/87 mmHg');
  assert.equal(bp[0].skipped, false);
  assert.equal(rows.filter((r) => r.label === '血圧測定').length, 0);
});

test('ジョギング時刻なし → skipped 06:30、データあり', () => {
  const { rows } = build();
  const r = find(rows, (x) => x.eventKey === 'jogging');
  assert.equal(r.skipped, true);
  assert.equal(r.time, '06:30');
  assert.equal(r.label, 'ジョギング スキップ');
  assert.equal(r.detail, '3.6 km ／ 27分 ・ 約180 kcal');
  assert.equal(r.note, '(時刻未入力)');
  assert.equal(r.kind, 'jogging');
});

test('朝食は 08:43 に統合、detail と expand', () => {
  const { rows } = build();
  const r = find(rows, (x) => x.eventKey === 'breakfast');
  assert.equal(r.time, '08:43');
  assert.equal(r.kind, 'meal');
  assert.equal(r.label, '朝食');
  assert.equal(r.skipped, false);
  assert.equal(r.detail, '朝食 704 kcal — レタス、ブロッコリー 花序 生、ほうれん草 茹で …4品');
  assert.equal(r.expand.length, 4);
  assert.equal(r.expand[0], 'レタス 25 g 3 kcal');
  assert.equal(rows.filter((x) => x.label === '朝食　終了').length, 0);
});

test('3品以下なら全部、…なし', () => {
  const s = { ...sheet, meals: [{ type: 'breakfast', label: '朝食', items: [mkItem('a', 1, 1), mkItem('b', 1, 1)], subtotal: { kcal: 2 } }] };
  const r = find(build({ sheet: s }).rows, (x) => x.eventKey === 'breakfast');
  assert.equal(r.detail, '朝食 2 kcal — a、b');
});

test('昼食 時刻なし+データ → skipped 13:00 note', () => {
  const r = find(build().rows, (x) => x.eventKey === 'lunch');
  assert.equal(r.skipped, true);
  assert.equal(r.time, '13:00');
  assert.equal(r.label, '昼食 スキップ');
  assert.match(r.detail, /^昼食 795 kcal — ご飯$/);
  assert.equal(r.note, '(時刻未入力)');
});

test('夕食 データなし → skipped 19:00 空 detail', () => {
  const r = find(build().rows, (x) => x.eventKey === 'dinner');
  assert.equal(r.skipped, true);
  assert.equal(r.time, '19:00');
  assert.equal(r.label, '夕食 スキップ');
  assert.equal(r.detail, '');
  assert.equal(r.note, null);
});

test('筋トレ 時刻なし+データ → skipped 17:30', () => {
  const r = find(build().rows, (x) => x.eventKey === 'strength');
  assert.equal(r.skipped, true);
  assert.equal(r.time, '17:30');
  assert.equal(r.detail, '腕立て 34+10+6 ／ 腹筋 50 ／ 背筋 50 ／ スクワット 50 ／ 握力 右35.5 左36.5 kg');
  assert.deepEqual(r.expand, ['腕立て 34+10+6', '腹筋 50', '背筋 50', 'スクワット 50', '握力 右35.5 左36.5 kg']);
  assert.equal(r.note, '(時刻未入力)');
});

test('筋トレ時刻あり → 区間を detail に追記', () => {
  const t = { ...times, 'st-start': '17:00', '20727e24': '17:45' };
  const src = sources({ diary: { available: true, state: { items, intervals, days: {} }, day: { times: t, note: '' } } });
  const r = find(build({ sources: src }).rows, (x) => x.eventKey === 'strength');
  assert.equal(r.skipped, false);
  assert.equal(r.time, '17:45');
  assert.ok(r.detail.endsWith(' ・ 筋トレ 45分'));
  assert.equal(find(build({ sources: src }).rows, (x) => x.label === '筋トレ　開始').kind, 'diary');
});

test('snack はデータなしなら行なし、あれば defaultTime の通常行', () => {
  assert.equal(build().rows.filter((r) => r.eventKey === 'snack').length, 0);
  const s = { ...sheet, meals: [...sheet.meals, { type: 'snack', label: '間食', items: [mkItem('飴', 5, 20)], subtotal: { kcal: 20 } }] };
  const r = find(build({ sheet: s }).rows, (x) => x.eventKey === 'snack');
  assert.equal(r.time, '15:00');
  assert.equal(r.skipped, false);
  assert.equal(r.label, '間食');
  assert.equal(r.kind, 'meal');
});

test('結びつけ先が items に無い', () => {
  const st = { ...settings, bindings: { ...settings.bindings, dinner: { itemId: 'nope', defaultTime: '19:00' } } };
  const r = find(build({ settings: st }).rows, (x) => x.eventKey === 'dinner');
  assert.equal(r.skipped, true);
  assert.equal(r.note, '結びつけ先の項目が見つかりません(設定で選び直してください)');
});

test('times に空文字が混ざっても throw せず項目は無い', () => {
  const t = { ...times, wake: '', 'walk-end': undefined };
  const src = sources({ diary: { available: true, state: { items, intervals, days: {} }, day: { times: t, note: '' } } });
  const { rows } = build({ sources: src });
  assert.equal(rows.filter((r) => r.label === '起床').length, 0);
  assert.equal(rows.filter((r) => r.label === '母と散歩　帰宅').length, 0);
});

test('exercise 不在 → 運動行なし + notice', () => {
  const src = sources({ exercise: { available: false, record: null } });
  const { rows, notices } = build({ sources: src });
  assert.equal(rows.filter((r) => r.kind === 'jogging' || r.kind === 'strength').length, 0);
  assert.ok(notices.includes('運動管理アプリのデータが見つかりません(この端末で一度開くと表示されます)'));
});

test('calorie / bp 不在の notice と行なし', () => {
  const src = sources({ calorie: { available: false, foods: [], meals: [], goals: null }, bp: { available: false, record: null } });
  const { rows, notices } = build({ sources: src });
  assert.ok(notices.includes('カロリー計算アプリのデータが見つかりません(この端末で一度開くと表示されます)'));
  assert.ok(notices.includes('血圧手帳アプリのデータが見つかりません(この端末で一度開くと表示されます)'));
  assert.equal(rows.filter((r) => r.kind === 'meal' || r.kind === 'bp').length, 0);
});

test('diary 不在 → 全バインドが defaultTime の skipped 行 + notice', () => {
  const src = sources({ diary: { available: false, state: null, day: { times: {}, note: '' } } });
  const { rows, notices } = build({ sources: src });
  assert.ok(notices.includes('時間管理ダイアリーのデータが見つかりません(この端末で一度開くと表示されます)'));
  assert.equal(rows.filter((r) => r.kind === 'diary').length, 0);
  const bp = find(rows, (r) => r.eventKey === 'bp');
  assert.equal(bp.skipped, true);
  assert.equal(bp.time, '05:30');
  assert.equal(find(rows, (r) => r.eventKey === 'dinner').time, '19:00');
  assert.deepEqual(rows.map((r) => r.sortKey), [...rows.map((r) => r.sortKey)].sort((a, b) => a - b));
});

test('行は sortKey 昇順', () => {
  const keys = build().rows.map((r) => r.sortKey);
  assert.deepEqual(keys, [...keys].sort((a, b) => a - b));
});

test('joggingKcal', () => {
  assert.equal(joggingKcal(27), 180);
  assert.equal(joggingKcal(null), 0);
  assert.equal(joggingKcal(NaN), 0);
});

test('ジョギング分のみ', () => {
  const ex = { ...exercise, jogging: { distanceKm: null, durationMin: 27, startTime: null, weather: null } };
  const src = sources({ exercise: { available: true, record: ex } });
  const r = find(build({ sources: src }).rows, (x) => x.eventKey === 'jogging');
  assert.equal(r.detail, '27分 ・ 約180 kcal');
});

test('buildSummary / summaryText', () => {
  const s = buildSummary({ sources: sources(), sheet, settings });
  assert.deepEqual(s, { kcal: 2236, goalKcal: 1800, joggingMin: 27, bp: { sys: 132, dia: 84 }, sleepMin: 440 });
  assert.equal(summaryText(s), '食事 2,236 kcal(目標 1,800) ・ ジョギング 27分 ・ 血圧 132/84 ・ 睡眠 7時間20分');
});

test('summaryText は null を省き、全 null は定型文', () => {
  assert.equal(summaryText({ kcal: null, goalKcal: null, joggingMin: 27, bp: null, sleepMin: null }), 'ジョギング 27分');
  assert.equal(summaryText({ kcal: 100, goalKcal: null, joggingMin: null, bp: null, sleepMin: null }), '食事 100 kcal');
  assert.equal(summaryText({ kcal: null, goalKcal: null, joggingMin: null, bp: null, sleepMin: null }), 'この日の記録はありません');
});
