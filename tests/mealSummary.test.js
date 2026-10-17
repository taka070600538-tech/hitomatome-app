import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEAL_ORDER, MEAL_LABELS, buildSheet, foodNameOf, sortMealsForDisplay } from '../js/mealSummary.js';

const D = '2026-10-15';
const foods = [
  { id: 1, name: 'ごはん' },
  { id: 2, name: 'サプリ' },
  { id: 3, name: '鶏むね' },
];
const m = (o) => ({ date: D, mealType: 'breakfast', foodId: 1, amountGrams: 0, kcal: 0, protein: 0, fat: 0, carb: 0, salt: 0, ...o });

function sample() {
  return [
    m({ id: 1, mealType: 'lunch', foodId: 3, amountGrams: 300, kcal: 100, protein: 20 }),
    m({ id: 2, mealType: 'breakfast', foodId: 1, amountGrams: 25, kcal: 3, extras: [{ name: 'ALA', unit: 'mg', amount: 2000 }] }),
    m({ id: 3, mealType: 'breakfast', foodId: 2, amountGrams: 20, kcal: 7, extras: [{ name: 'ALA', unit: 'mg', amount: 2968 }] }),
    m({ id: 9, date: '2026-10-14', kcal: 999 }),
  ];
}

test('定数', () => {
  assert.deepEqual(MEAL_ORDER, ['breakfast', 'lunch', 'dinner', 'snack']);
  assert.equal(MEAL_LABELS.dinner, '夕食');
});

test('タイトル・区分順・小計・合計・extras合算', () => {
  const sheet = buildSheet({ date: D, meals: sample(), foods, goals: null });
  assert.equal(sheet.title, '2026年10月15日(木) の食事');
  assert.deepEqual(sheet.meals.map((x) => x.type), ['breakfast', 'lunch']);
  assert.equal(sheet.meals[0].label, '朝食');
  assert.equal(sheet.meals[0].subtotal.kcal, 10);
  assert.equal(sheet.totals.grams, 25 + 20 + 300);
  assert.equal(sheet.totals.kcal, 110);
  assert.deepEqual(sheet.extras, [{ name: 'ALA', unit: 'mg', amount: 4968 }]);
  assert.equal(sheet.meals[0].items[0].name, 'ごはん');
});

test('order → orderなし(id順)', () => {
  const meals = [
    m({ id: 5, foodId: 1 }),
    m({ id: 4, foodId: 2, order: 1 }),
    m({ id: 6, foodId: 3, order: 0 }),
  ];
  const sheet = buildSheet({ date: D, meals, foods, goals: null });
  assert.deepEqual(sheet.meals[0].items.map((i) => i.name), ['鶏むね', 'サプリ', 'ごはん']);
  assert.deepEqual(sortMealsForDisplay(meals).map((x) => x.id), [6, 4, 5]);
});

test('マスタに無い foodId は不明な食品、freeText を優先、kcalは合計に含む', () => {
  const meals = [m({ id: 1, foodId: 99, kcal: 50 }), m({ id: 2, foodId: 98, freeText: '手作り', kcal: 5 })];
  const sheet = buildSheet({ date: D, meals, foods, goals: null });
  assert.deepEqual(sheet.meals[0].items.map((i) => i.name), ['不明な食品', '手作り']);
  assert.equal(sheet.totals.kcal, 55);
  assert.equal(foodNameOf(meals[0], new Map(foods.map((f) => [f.id, f]))), '不明な食品');
});

test('未知のmealTypeは既知4種の後ろに登場順、ラベルは生の値', () => {
  const meals = [
    m({ id: 1, mealType: 'zzz' }),
    m({ id: 2, mealType: 'aaa' }),
    m({ id: 3, mealType: 'snack' }),
  ];
  const sheet = buildSheet({ date: D, meals, foods, goals: null });
  assert.deepEqual(sheet.meals.map((x) => x.type), ['snack', 'zzz', 'aaa']);
  assert.equal(sheet.meals[1].label, 'zzz');
});

test('goals: 指定ありは5項目、無しはnull', () => {
  const g = { id: 'default', kcal: 2000, protein: 60, fat: 50, carb: 300, salt: 7 };
  const s1 = buildSheet({ date: D, meals: sample(), foods, goals: g });
  assert.deepEqual(s1.goals, { kcal: 2000, protein: 60, fat: 50, carb: 300, salt: 7 });
  assert.equal(buildSheet({ date: D, meals: sample(), foods, goals: undefined }).goals, null);
});

test('その日の記録が無ければ null、欠損数値は0', () => {
  assert.equal(buildSheet({ date: '2026-01-01', meals: sample(), foods, goals: null }), null);
  const sheet = buildSheet({ date: D, meals: [{ id: 1, date: D, mealType: 'lunch', foodId: 1 }], foods, goals: null });
  assert.equal(sheet.totals.kcal, 0);
  assert.deepEqual(sheet.extras, []);
});
