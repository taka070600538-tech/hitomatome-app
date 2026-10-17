import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLedger, requestIdFromFile, planRun, markEntry, prunePdfList } from '../tools/printQueue.mjs';

const ID1 = '20261017T083012Z-abc123';
const ID2 = '20261017T090000Z-def456';

test('parseLedger: null・壊れたJSON・entries不正は null', () => {
  assert.equal(parseLedger(null), null);
  assert.equal(parseLedger('{oops'), null);
  assert.equal(parseLedger('{"version":1}'), null);
  assert.equal(parseLedger('{"version":1,"entries":[]}'), null);
  assert.equal(parseLedger('{"version":1,"entries":null}'), null);
});

test('parseLedger: 正常な台帳', () => {
  const l = parseLedger(JSON.stringify({ version: 1, entries: { [ID1]: { status: 'printed', at: 'x' } } }));
  assert.equal(l.entries[ID1].status, 'printed');
});

test('requestIdFromFile', () => {
  assert.equal(requestIdFromFile(`2026-10-15_${ID1}.json`), ID1);
  assert.equal(requestIdFromFile('2026-10-15_bad.json'), null);
  assert.equal(requestIdFromFile(`${ID1}.json`), null);
  assert.equal(requestIdFromFile(`2026-10-15_${ID1}.txt`), null);
});

test('planRun: 台帳なしは初期化で全件skip', () => {
  const r = planRun({ fileNames: [`2026-10-15_${ID1}.json`, 'memo.txt'], ledger: null });
  assert.equal(r.initializing, true);
  assert.deepEqual(r.toSkip, [`2026-10-15_${ID1}.json`]);
  assert.deepEqual(r.toPrint, []);
});

test('planRun: 台帳済みを除外し昇順', () => {
  const ledger = { version: 1, entries: { [ID1]: { status: 'printed', at: 'x' } } };
  const a = `2026-10-15_${ID1}.json`;
  const b = `2026-10-16_${ID2}.json`;
  const c = '2026-10-17_20261017T100000Z-zzz999.json';
  const r = planRun({ fileNames: [c, b, a, 'junk.json'], ledger });
  assert.equal(r.initializing, false);
  assert.deepEqual(r.toPrint, [b, c]);
  assert.deepEqual(r.toSkip, []);
});

test('planRun: printing など台帳にあるキーはすべて除外', () => {
  const entries = {
    [ID1]: { status: 'printing', at: 'x' },
    [ID2]: { status: 'failed', at: 'x', error: 'e' },
  };
  const r = planRun({ fileNames: [`2026-10-15_${ID1}.json`, `2026-10-15_${ID2}.json`], ledger: { version: 1, entries } });
  assert.deepEqual(r.toPrint, []);
});

test('planRun: 同名ファイルは1回だけ、同日付の別requestIdは両方', () => {
  const a = `2026-10-15_${ID1}.json`;
  const b = `2026-10-15_${ID2}.json`;
  const r = planRun({ fileNames: [a, a, b], ledger: { version: 1, entries: {} } });
  assert.deepEqual(r.toPrint, [a, b]);
});

test('markEntry: 元を変えない', () => {
  const l = { version: 1, entries: {} };
  const n = markEntry(l, ID1, { status: 'failed', at: 't', error: 'e' });
  assert.deepEqual(l.entries, {});
  assert.equal(n.entries[ID1].error, 'e');
  assert.equal(n.version, 1);
});

test('prunePdfList: 31件から最古1件', () => {
  const names = Array.from({ length: 31 }, (_, i) => `f${String(i).padStart(2, '0')}.pdf`);
  assert.deepEqual(prunePdfList([...names].reverse()), ['f00.pdf']);
  assert.deepEqual(prunePdfList(names.slice(0, 30)), []);
});
