import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRequestId, buildPrintRequest, requestPath } from '../js/printRequest.js';

test('makeRequestId: UTC日時 + base36 6文字', () => {
  const id = makeRequestId(new Date(Date.UTC(2026, 9, 17, 8, 30, 12)), () => 0.5);
  assert.match(id, /^20261017T083012Z-[0-9a-z]{6}$/);
});

test('makeRequestId: random が 0 でも 6文字になる', () => {
  const id = makeRequestId(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)), () => 0);
  assert.match(id, /^20260102T030405Z-[0-9a-z]{6}$/);
});

test('buildPrintRequest: 形が仕様どおりで sheet はそのまま通す', () => {
  const sheet = { title: 't', rows: [1, 2] };
  const now = new Date(Date.UTC(2026, 9, 17, 8, 30, 12));
  const req = buildPrintRequest({ date: '2026-10-17', sheet, now, requestId: 'abc' });
  assert.deepEqual(req, {
    version: 1,
    requestId: 'abc',
    date: '2026-10-17',
    requestedAt: '2026-10-17T08:30:12.000Z',
    sheet,
  });
  assert.equal(req.sheet, sheet);
});

test('buildPrintRequest: requestId 省略時は makeRequestId 形式', () => {
  const now = new Date(Date.UTC(2026, 9, 17, 8, 30, 12));
  const req = buildPrintRequest({ date: '2026-10-17', sheet: {}, now });
  assert.match(req.requestId, /^20261017T083012Z-[0-9a-z]{6}$/);
});

test('requestPath: daily-summary/print-requests/<date>_<id>.json', () => {
  assert.equal(
    requestPath({ date: '2026-10-17', requestId: 'abc' }),
    'daily-summary/print-requests/2026-10-17_abc.json'
  );
});
