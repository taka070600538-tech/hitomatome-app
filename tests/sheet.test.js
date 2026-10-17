import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSheetHtml, achievement } from '../js/sheet.js';

function item(name, grams, kcal, protein = 0, fat = 0, carb = 0, salt = 0) {
  return { name, grams, kcal, protein, fat, carb, salt };
}

function makeSheet(over = {}) {
  return {
    title: '2026年10月15日(木) の食事',
    goals: { kcal: 1800, protein: 60, fat: 90, carb: 200, salt: 5 },
    totals: { kcal: 2236, protein: 70.1, fat: 97.2, carb: 266.1, salt: 7.4, grams: 1000 },
    extras: [
      { name: 'スルフォラファン', unit: 'mg', amount: 30 },
      { name: 'ALA', unit: 'mg', amount: 4968 },
    ],
    meals: [
      {
        type: 'breakfast', label: '朝食',
        items: [
          item('レタス', 25, 3, 0.2, 0, 0.4),
          item('ブロッコリー 花序 生', 20, 7, 1.1, 0.1, 0.3),
          item('日清有機えごま油', 9.2, 82, 0, 9.2, 0),
        ],
        subtotal: { kcal: 704, protein: 21.8, fat: 44.1, carb: 56.3, salt: 0.5, grams: 819 },
      },
    ],
    ...over,
  };
}

const html = renderSheetHtml({ date: '2026-10-15', sheet: makeSheet() });

test('文書の骨格', () => {
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<meta charset="utf-8">'));
  assert.ok(html.includes('<title>2026年10月15日(木) の食事</title>'));
  assert.ok(html.includes('<h1>2026年10月15日(木) の食事</h1>'));
  assert.ok(html.includes('カロリー計算アプリの記録から'));
  assert.ok(html.includes('@page { size: A4 portrait; margin: 15mm }'));
  assert.ok(html.includes('break-inside: avoid'));
});

test('サマリーと固有栄養素', () => {
  assert.ok(/1日の合計[\s\S]*2,236 kcal/.test(html));
  assert.ok(html.includes('(目標 1,800 kcal)'));
  assert.ok(html.includes('スルフォラファン 30 mg'));
  assert.ok(html.includes('固有栄養素: </b>スルフォラファン 30 mg ／ ALA 4,968 mg') ||
    html.includes('固有栄養素:</b> スルフォラファン 30 mg ／ ALA 4,968 mg'));
});

test('達成率の棒', () => {
  assert.ok(/class="fill over"[^>]*width:82\.7%/.test(html));
  assert.ok(/<b class="over">124%<\/b>/.test(html));
  assert.ok(html.includes('2,236 / 1,800 kcal'));
  assert.ok(html.includes('70.1 / 60 g'));
  for (const l of ['エネルギー', 'たんぱく質', '脂質', '炭水化物', '塩分']) {
    assert.ok(html.includes(`<div class="lab">${l}</div>`), l);
  }
  assert.ok(html.includes('left:66.7%'));
});

test('超過でない棒は over クラスなし', () => {
  const h = renderSheetHtml({
    date: '2026-10-15',
    sheet: makeSheet({ totals: { kcal: 1674, protein: 10, fat: 10, carb: 10, salt: 1, grams: 1 } }),
  });
  assert.ok(/<b>93%<\/b>/.test(h));
  assert.ok(/class="fill" style="width:62%"/.test(h));
});

test('食事ごとの表', () => {
  assert.ok(html.includes('<div class="mealhead"><span>朝食</span><span>704 kcal</span></div>'));
  assert.ok(html.includes('朝食 合計'));
  assert.ok(html.includes('<tr class="subtotal"><td>朝食 合計</td>'));
  assert.ok(html.includes('<td class="n">9.2 g</td>'));
  assert.ok(html.includes('<td class="n">0.0</td>'));
  assert.ok(html.includes('<td class="n">21.8</td>'));
  assert.ok(html.includes('<td class="n">819 g</td>'));
  assert.ok(html.includes('<th class="n">たんぱく質</th>'));
});

test('achievement', () => {
  assert.deepEqual(achievement(2236, 1800), { pct: 124, widthPct: 82.7, over: true });
  assert.deepEqual(achievement(1800, 1800), { pct: 100, widthPct: 66.7, over: false });
  assert.equal(achievement(100, 0), null);
  assert.equal(achievement(100, undefined), null);
  assert.equal(achievement(100, NaN), null);
  assert.equal(achievement(300, 100).widthPct, 100);
});

test('goals が null なら棒なしで目標未設定', () => {
  const h = renderSheetHtml({ date: '2026-10-15', sheet: makeSheet({ goals: null }) });
  assert.ok(!h.includes('エネルギー'));
  assert.ok(!h.includes('class="bars"'));
  assert.ok(h.includes('目標未設定'));
  const h2 = renderSheetHtml({ date: 'x', sheet: makeSheet({ goals: { kcal: 0, protein: 60 } }) });
  assert.ok(!h2.includes('class="bars"'));
  assert.ok(h2.includes('目標未設定'));
});

test('個別の目標なしは行を省く', () => {
  const h = renderSheetHtml({ date: 'x', sheet: makeSheet({ goals: { kcal: 1800, protein: 60, fat: 0, carb: 200 } }) });
  assert.ok(h.includes('<div class="lab">エネルギー</div>'));
  assert.ok(!h.includes('<div class="lab">脂質</div>'));
  assert.ok(!h.includes('<div class="lab">塩分</div>'));
});

test('extras が空なら固有栄養素なし', () => {
  const h = renderSheetHtml({ date: 'x', sheet: makeSheet({ extras: [] }) });
  assert.ok(!h.includes('固有栄養素'));
});

test('HTMLエスケープ', () => {
  const s = makeSheet({
    title: 'a<b>&"',
    extras: [{ name: '<script>x</script>', unit: 'mg', amount: 1 }],
  });
  s.meals[0].items[0].name = '<img src=x onerror=1>&"';
  const h = renderSheetHtml({ date: 'x', sheet: s });
  assert.ok(!h.includes('<script>x'));
  assert.ok(!h.includes('<img src=x'));
  assert.ok(h.includes('&lt;img src=x onerror=1&gt;&amp;&quot;'));
  assert.ok(h.includes('<title>a&lt;b&gt;&amp;&quot;</title>'));
});

test('外部URLに依存しない', () => {
  assert.ok(!html.includes('github.io'));
  assert.ok(!html.includes('app-sync'));
  assert.ok(!/https?:\/\//.test(html));
});
