import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_KEY, EVENTS, normalizeLabel, resolveItemId,
  defaultSettings, loadSettings, saveSettings, validateSettings,
} from '../js/settings.js';

function fakeStorage(init = {}) {
  const m = { ...init };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    _m: m,
  };
}
const ev = (key) => EVENTS.find((e) => e.key === key);
const UUID = '3f2b8c1e-aaaa-bbbb-cccc-1234567890ab';

test('SETTINGS_KEY', () => {
  assert.equal(SETTINGS_KEY, 'daily-summary:settings');
});

test('normalizeLabel: 全角/半角スペースの違いを吸収', () => {
  assert.equal(normalizeLabel('朝食　終了'), normalizeLabel('朝食 終了'));
  assert.equal(normalizeLabel('朝食\t終了'), '朝食終了');
});

test('resolveItemId: knownIds を優先', () => {
  const items = [{ id: UUID, label: 'ジョギング 終了' }, { id: 'run-end', label: 'なにか' }];
  assert.equal(resolveItemId(ev('jogging'), items), 'run-end');
});

test('resolveItemId: 全角スペースのラベルを UUID id で解決', () => {
  const items = [{ id: UUID, label: '筋トレ　終了' }];
  assert.equal(resolveItemId(ev('strength'), items), UUID);
});

test('resolveItemId: 見つからなければ null', () => {
  assert.equal(resolveItemId(ev('strength'), [{ id: 'x', label: '散歩' }]), null);
  assert.equal(resolveItemId(ev('snack'), [{ id: 'x', label: '間食' }]), null);
});

test('defaultSettings: 全イベントを含み snack は null', () => {
  const s = defaultSettings([{ id: 'bf-end', label: '朝食　終了' }]);
  assert.equal(s.version, 1);
  assert.deepEqual(Object.keys(s.bindings).sort(), EVENTS.map((e) => e.key).sort());
  assert.equal(s.bindings.breakfast.itemId, 'bf-end');
  assert.equal(s.bindings.breakfast.defaultTime, '08:30');
  assert.equal(s.bindings.snack.itemId, null);
});

test('loadSettings: 壊れたJSON/無し → 既定', () => {
  const items = [{ id: 'run-end', label: 'x' }];
  const a = loadSettings(fakeStorage({ [SETTINGS_KEY]: '{broken' }), items);
  assert.deepEqual(a, defaultSettings(items));
  const b = loadSettings(fakeStorage(), items);
  assert.deepEqual(b, defaultSettings(items));
});

test('loadSettings: 形が不正 → 既定', () => {
  const st = fakeStorage({ [SETTINGS_KEY]: JSON.stringify({ version: 1 }) });
  assert.deepEqual(loadSettings(st, []), defaultSettings([]));
});

test('loadSettings: 保存値が既定より優先、未知キーは補完', () => {
  const items = [{ id: 'run-end', label: 'x' }, { id: 'bf-end', label: 'y' }];
  const stored = { version: 1, bindings: { jogging: { itemId: 'custom', defaultTime: '07:00' } } };
  const s = loadSettings(fakeStorage({ [SETTINGS_KEY]: JSON.stringify(stored) }), items);
  assert.equal(s.bindings.jogging.itemId, 'custom');
  assert.equal(s.bindings.jogging.defaultTime, '07:00');
  assert.equal(s.bindings.breakfast.itemId, 'bf-end');
  assert.equal(s.bindings.snack.itemId, null);
});

test('loadSettings: getItem が throw → 既定', () => {
  const st = { getItem() { throw new Error('denied'); }, setItem() {} };
  assert.deepEqual(loadSettings(st, []), defaultSettings([]));
});

test('saveSettings: JSON で保存し loadSettings で戻る', () => {
  const st = fakeStorage();
  const s = defaultSettings([]);
  s.bindings.snack.defaultTime = '16:00';
  saveSettings(st, s);
  assert.equal(JSON.parse(st._m[SETTINGS_KEY]).bindings.snack.defaultTime, '16:00');
  assert.equal(loadSettings(st, []).bindings.snack.defaultTime, '16:00');
});

test('validateSettings: bindings が無ければ throw', () => {
  assert.throws(() => validateSettings({}), /bindings がありません/);
  assert.throws(() => validateSettings(null), /bindings がありません/);
  assert.throws(() => validateSettings({ bindings: 1 }), /bindings がありません/);
});

test('validateSettings: 正規化(未知キー除去・補完・不正時刻置換)', () => {
  const s = validateSettings({
    bindings: { bp: { itemId: 'a', defaultTime: '25:99' }, lunch: { itemId: 'b', defaultTime: '12:15' }, zzz: { itemId: 'q', defaultTime: '01:00' } },
  });
  assert.equal(s.version, 1);
  assert.equal('zzz' in s.bindings, false);
  assert.equal(s.bindings.bp.itemId, 'a');
  assert.equal(s.bindings.bp.defaultTime, '05:30');
  assert.equal(s.bindings.lunch.defaultTime, '12:15');
  assert.deepEqual(s.bindings.dinner, { itemId: null, defaultTime: '19:00' });
});
