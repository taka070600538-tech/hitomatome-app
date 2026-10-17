import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALORIE_DB, EXERCISE_DB, BP_KEY, DIARY_KEY,
  parseBpRecords, parseDiaryState, findByDate, getDiaryDay, loadDaySources,
} from '../js/sources.js';

test('定数', () => {
  assert.equal(CALORIE_DB, 'calorie-app-db');
  assert.equal(EXERCISE_DB, 'exercise-app-db');
  assert.equal(BP_KEY, 'bp-app:records');
  assert.equal(DIARY_KEY, 'time-diary:state');
});

test('parseBpRecords: 正常/不正', () => {
  const r = parseBpRecords('[{"date":"2026-10-15","sysL":132,"diaL":80,"sysR":130,"diaR":78,"createdAt":"x"}]');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { date: '2026-10-15', sysL: 132, diaL: 80, sysR: 130, diaR: 78 });
  assert.deepEqual(parseBpRecords('{broken'), []);
  assert.deepEqual(parseBpRecords('{"a":1}'), []);
  assert.deepEqual(parseBpRecords(null), []);
});

test('parseDiaryState', () => {
  const s = parseDiaryState('{"items":[{"id":"a","label":"起床"}],"intervals":[]}');
  assert.deepEqual(s.days, {});
  assert.equal(s.items.length, 1);
  assert.equal(parseDiaryState('{"items":{},"intervals":[]}'), null);
  assert.equal(parseDiaryState('{"items":[]}'), null);
  assert.equal(parseDiaryState('oops'), null);
  assert.equal(parseDiaryState(null), null);
});

test('findByDate', () => {
  const recs = [{ date: '2026-10-14', v: 1 }, { date: '2026-10-15', v: 2 }];
  assert.equal(findByDate(recs, '2026-10-15').v, 2);
  assert.equal(findByDate(recs, '2026-10-16'), null);
  assert.equal(findByDate(null, '2026-10-16'), null);
});

test('getDiaryDay', () => {
  const state = { items: [], intervals: [], days: { '2026-10-15': { times: { a: '07:00' }, note: 'メモ' } } };
  assert.deepEqual(getDiaryDay(state, '2026-10-15'), { times: { a: '07:00' }, note: 'メモ' });
  assert.deepEqual(getDiaryDay(state, '2026-10-16'), { times: {}, note: '' });
  assert.deepEqual(getDiaryDay(null, '2026-10-16'), { times: {}, note: '' });
});

const D = '2026-10-15';
const fakeStorage = (map) => ({ getItem: (k) => (k in map ? map[k] : null) });

test('loadDaySources: 全部ある', async () => {
  const storage = fakeStorage({
    [BP_KEY]: JSON.stringify([{ date: D, sysL: 130, diaL: 80, sysR: 128, diaR: 79 }]),
    [DIARY_KEY]: JSON.stringify({ items: [{ id: 'a', label: '起床' }], intervals: [], days: { [D]: { times: { a: '06:30' }, note: 'n' } } }),
  });
  const calls = [];
  const readStores = async (db, stores) => {
    calls.push(db);
    if (db === CALORIE_DB) {
      return { available: true, data: {
        foods: [{ id: 1 }],
        meals: [{ date: D, kcal: 500 }, { date: '2026-10-14', kcal: 900 }],
        goals: [{ id: 'default', kcal: 2000 }],
      } };
    }
    return { available: true, data: { records: [{ date: D, x: 1 }, { date: '2026-10-01', x: 2 }] } };
  };
  const r = await loadDaySources(D, { storage, readStores });
  assert.equal(r.calorie.available, true);
  assert.equal(r.calorie.meals.length, 1);
  assert.equal(r.calorie.meals[0].kcal, 500);
  assert.deepEqual(r.calorie.goals, { id: 'default', kcal: 2000 });
  assert.equal(r.calorie.foods.length, 1);
  assert.equal(r.exercise.record.x, 1);
  assert.equal(r.bp.available, true);
  assert.equal(r.bp.record.sysL, 130);
  assert.equal(r.diary.available, true);
  assert.deepEqual(r.diary.day, { times: { a: '06:30' }, note: 'n' });
  assert.ok(calls.includes(CALORIE_DB) && calls.includes(EXERCISE_DB));
});

test('loadDaySources: 取得できないとき例外にならない', async () => {
  const storage = fakeStorage({});
  const readStores = async () => ({ available: false, data: {} });
  const r = await loadDaySources(D, { storage, readStores });
  assert.equal(r.calorie.available, false);
  assert.deepEqual(r.calorie.meals, []);
  assert.equal(r.calorie.goals, null);
  assert.equal(r.exercise.available, false);
  assert.equal(r.exercise.record, null);
  assert.equal(r.bp.available, false);
  assert.equal(r.bp.record, null);
  assert.equal(r.diary.available, false);
  assert.equal(r.diary.state, null);
  assert.deepEqual(r.diary.day, { times: {}, note: '' });
});

test('loadDaySources: storage が例外を投げても落ちない', async () => {
  const storage = { getItem() { throw new Error('denied'); } };
  const readStores = async () => { throw new Error('boom'); };
  const r = await loadDaySources(D, { storage, readStores });
  assert.equal(r.bp.available, false);
  assert.equal(r.calorie.available, false);
});
