// その日の食事記録から、印刷用の Sheet オブジェクトを組み立てる純粋関数群(DOM・ストレージ非依存)。
import { formatDateJa } from './format.js';

export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

const NUTRIENTS = ['kcal', 'protein', 'fat', 'carb', 'salt'];

// 食事区分内の表示順。カロリー計算アプリ(Git\カロリー計算アプリ\js\mealOrder.js)の
// sortMealsForDisplay をそのままコピー(他リポジトリは import しない)。
// ドラッグで並べ替えた記録はorder(0始まり)を持ち、
// orderの無い記録(並べ替え前の記録や後から追加した記録)は登録順(id順)で末尾に並ぶ。
export function sortMealsForDisplay(meals) {
  return [...meals].sort((a, b) => {
    const aHas = a.order != null;
    const bHas = b.order != null;
    if (aHas && bHas && a.order !== b.order) return a.order - b.order;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.id - b.id;
  });
}

export function foodNameOf(meal, foodsById) {
  const food = foodsById.get(meal.foodId);
  if (food) return food.name;
  return meal.freeText ?? '不明な食品';
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function emptyTotals() {
  return { kcal: 0, protein: 0, fat: 0, carb: 0, salt: 0, grams: 0 };
}

function addTo(total, item) {
  for (const k of NUTRIENTS) total[k] += item[k];
  total.grams += item.grams;
}

export function buildSheet({ date, meals, foods, goals }) {
  const dayMeals = (meals ?? []).filter((m) => m.date === date);
  if (dayMeals.length === 0) return null;

  const foodsById = new Map((foods ?? []).map((f) => [f.id, f]));

  const types = [...MEAL_ORDER.filter((t) => dayMeals.some((m) => m.mealType === t))];
  for (const m of dayMeals) {
    if (!types.includes(m.mealType)) types.push(m.mealType);
  }

  const totals = emptyTotals();
  const extraMap = new Map();

  const groups = types.map((type) => {
    const sorted = sortMealsForDisplay(dayMeals.filter((m) => m.mealType === type));
    const subtotal = emptyTotals();
    const items = sorted.map((m) => {
      const item = {
        name: foodNameOf(m, foodsById),
        grams: num(m.amountGrams),
        kcal: num(m.kcal),
        protein: num(m.protein),
        fat: num(m.fat),
        carb: num(m.carb),
        salt: num(m.salt),
      };
      addTo(subtotal, item);
      addTo(totals, item);
      for (const e of m.extras ?? []) {
        const key = `${e.name}|${e.unit}`;
        const cur = extraMap.get(key);
        if (cur) cur.amount += num(e.amount);
        else extraMap.set(key, { name: e.name, unit: e.unit, amount: num(e.amount) });
      }
      return item;
    });
    return { type, label: MEAL_LABELS[type] ?? type, items, subtotal };
  });

  return {
    title: `${formatDateJa(date)} の食事`,
    goals: goals ? Object.fromEntries(NUTRIENTS.map((k) => [k, goals[k]])) : null,
    totals,
    extras: [...extraMap.values()],
    meals: groups,
  };
}
