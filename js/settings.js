// タイムラインの結びつけ設定(イベント ↔ 時間管理ダイアリーの項目)。DOM/localStorage 非依存(storage は注入)
export const SETTINGS_KEY = 'daily-summary:settings';

export const EVENTS = [
  { key: 'bp', label: '血圧', defaultTime: '05:30', knownIds: [], labelHints: ['血圧測定'] },
  { key: 'jogging', label: 'ジョギング', defaultTime: '06:30', knownIds: ['run-end'], labelHints: ['ジョギング 終了', 'シャワー 終了'] },
  { key: 'strength', label: '筋トレ', defaultTime: '17:30', knownIds: [], labelHints: ['筋トレ 終了'] },
  { key: 'breakfast', label: '朝食', defaultTime: '08:30', knownIds: ['bf-end'], labelHints: ['朝食 終了'] },
  { key: 'lunch', label: '昼食', defaultTime: '13:00', knownIds: ['lunch-end'], labelHints: ['昼食 終了'] },
  { key: 'dinner', label: '夕食', defaultTime: '19:00', knownIds: ['dinner-end'], labelHints: ['夕食 終了'] },
  { key: 'snack', label: '間食', defaultTime: '15:00', knownIds: [], labelHints: [] },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// 全角/半角スペース・タブ等の空白を全て除去し NFKC 正規化
export function normalizeLabel(s) {
  return String(s ?? '').replace(/[\s　]/g, '').normalize('NFKC');
}

export function resolveItemId(event, items) {
  const list = Array.isArray(items) ? items : [];
  for (const id of event.knownIds || []) {
    if (list.some((it) => it && it.id === id)) return id;
  }
  for (const hint of event.labelHints || []) {
    const h = normalizeLabel(hint);
    const found = list.find((it) => it && normalizeLabel(it.label) === h);
    if (found) return found.id;
  }
  return null;
}

export function defaultSettings(items) {
  const bindings = {};
  for (const e of EVENTS) {
    bindings[e.key] = {
      itemId: e.key === 'snack' ? null : resolveItemId(e, items),
      defaultTime: e.defaultTime,
    };
  }
  return { version: 1, bindings };
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function loadSettings(storage, items) {
  let raw = null;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    raw = null;
  }
  if (raw == null) return defaultSettings(items);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultSettings(items);
  }
  if (!isObj(parsed) || !isObj(parsed.bindings)) return defaultSettings(items);
  const defaults = defaultSettings(items);
  const bindings = {};
  for (const e of EVENTS) {
    const b = parsed.bindings[e.key];
    if (isObj(b)) {
      bindings[e.key] = {
        itemId: typeof b.itemId === 'string' ? b.itemId : null,
        defaultTime: typeof b.defaultTime === 'string' && TIME_RE.test(b.defaultTime) ? b.defaultTime : e.defaultTime,
      };
    } else {
      bindings[e.key] = defaults.bindings[e.key];
    }
  }
  return { version: 1, bindings };
}

export function saveSettings(storage, settings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ファイルインポート用。bindings が無ければ throw、未知キーは捨て、欠けは既定(itemId:null)で補う
export function validateSettings(obj) {
  if (!isObj(obj) || !isObj(obj.bindings)) throw new Error('bindings がありません');
  const bindings = {};
  for (const e of EVENTS) {
    const b = obj.bindings[e.key];
    bindings[e.key] = {
      itemId: isObj(b) && typeof b.itemId === 'string' ? b.itemId : null,
      defaultTime: isObj(b) && typeof b.defaultTime === 'string' && TIME_RE.test(b.defaultTime) ? b.defaultTime : e.defaultTime,
    };
  }
  return { version: 1, bindings };
}
