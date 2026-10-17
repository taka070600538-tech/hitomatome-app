// 4アプリ(カロリー/運動/血圧/時間管理)のデータを読む。読み取り専用で、他アプリのDB・キーは作成も変更もしない。
import { readStores as defaultReadStores } from './idbRead.js';

export const CALORIE_DB = 'calorie-app-db';
export const EXERCISE_DB = 'exercise-app-db';
export const BP_KEY = 'bp-app:records';
export const DIARY_KEY = 'time-diary:state';

export function parseBpRecords(raw) {
  if (typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((r) => r && typeof r === 'object')
      .map(({ date, sysL, diaL, sysR, diaR }) => ({ date, sysL, diaL, sysR, diaR }));
  } catch {
    return [];
  }
}

export function parseDiaryState(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.items) || !Array.isArray(s.intervals)) return null;
    s.days ??= {};
    return s;
  } catch {
    return null;
  }
}

export function findByDate(records, date) {
  if (!Array.isArray(records)) return null;
  return records.find((r) => r && r.date === date) ?? null;
}

export function getDiaryDay(state, date) {
  const d = state?.days?.[date];
  return { times: d?.times ?? {}, note: d?.note ?? '' };
}

function readLocal(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}

export async function loadDaySources(
  date,
  { storage = globalThis.localStorage, readStores = defaultReadStores } = {},
) {
  const safeRead = async (db, stores) => {
    try { return (await readStores(db, stores)) ?? { available: false, data: {} }; }
    catch { return { available: false, data: {} }; }
  };
  const [cal, ex] = await Promise.all([
    safeRead(CALORIE_DB, ['foods', 'meals', 'goals']),
    safeRead(EXERCISE_DB, ['records']),
  ]);

  const calData = cal.data ?? {};
  const calorie = {
    available: !!cal.available,
    foods: calData.foods ?? [],
    meals: (calData.meals ?? []).filter((m) => m && m.date === date),
    goals: (calData.goals ?? []).find((g) => g && g.id === 'default') ?? null,
  };
  const exercise = {
    available: !!ex.available,
    record: findByDate(ex.data?.records, date),
  };

  const bpRaw = storage ? readLocal(storage, BP_KEY) : null;
  const bp = { available: bpRaw != null, record: findByDate(parseBpRecords(bpRaw), date) };

  const diaryState = parseDiaryState(storage ? readLocal(storage, DIARY_KEY) : null);
  const diary = { available: diaryState != null, state: diaryState, day: getDiaryDay(diaryState, date) };

  return { calorie, exercise, bp, diary };
}
