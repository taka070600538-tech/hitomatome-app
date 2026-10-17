import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateJa, formatDateShort, addDays, todayString,
  round1, fmtKcal, fmtG, diffMinutes, formatDuration, isHHMM,
} from '../js/format.js';

test('日付の書式', () => {
  assert.equal(formatDateJa('2026-10-15'), '2026年10月15日(木)');
  assert.equal(formatDateShort('2026-10-15'), '10/15(木)');
});

test('addDays / todayString', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(todayString(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('数値の書式', () => {
  assert.equal(round1(9.24), 9.2);
  assert.equal(fmtKcal(2236.4), '2,236');
  assert.equal(fmtG(25), '25');
  assert.equal(fmtG(9.2), '9.2');
  assert.equal(fmtG(4968), '4,968');
  assert.equal(fmtG(70.12), '70.1');
});

test('時間の計算と書式', () => {
  assert.equal(diffMinutes('22:00', '05:20'), 440);
  assert.equal(diffMinutes('05:00', '06:30'), 90);
  assert.equal(formatDuration(440), '7時間20分');
  assert.equal(formatDuration(20), '20分');
  assert.equal(formatDuration(60), '1時間');
  assert.equal(formatDuration(0), '0分');
});

test('isHHMM', () => {
  assert.equal(isHHMM('05:20'), true);
  assert.equal(isHHMM(''), false);
  assert.equal(isHHMM(undefined), false);
  assert.equal(isHHMM('24:00'), false);
  assert.equal(isHHMM('12:60'), false);
  assert.equal(isHHMM('5:20'), false);
});
