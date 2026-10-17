// 印刷用シートのHTMLレンダラ(DOM非依存の純粋モジュール。スマホのプレビューとPC(Node)の両方で使う)
import { fmtKcal, fmtG, round1 } from './format.js';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 栄養素の表示用: 常に小数1桁(0.0, 21.8)
function fmt1(n) {
  return round1(n).toFixed(1);
}

// 目標達成率。goal が有限の正数でなければ null
export function achievement(value, goal) {
  if (typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) return null;
  const pct = Math.round((value / goal) * 100);
  const widthPct = Math.round((Math.min(pct, 150) / 150) * 1000) / 10;
  return { pct, widthPct, over: pct > 100 };
}

const CSS = `
@page { size: A4 portrait; margin: 15mm }
body { margin:0; background:#fff; color:#111; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:10.5pt; line-height:1.45; }
.sheet { max-width:720px; margin:0 auto; padding:12px 8px; box-sizing:border-box; }
.sheet h1 { font-size:18px; margin:0 0 2px; color:#111; }
.sheet .meta { color:#555; font-size:10px; margin-bottom:10px; }
.sheet table { width:100%; border-collapse:collapse; margin-bottom:4px; }
.sheet th, .sheet td { padding:1px 4px; border-bottom:1px solid #e3e3e3; text-align:left; }
.sheet th { background:#f1f1f1; font-weight:600; }
.sheet td:first-child { white-space:nowrap; }
.sheet td.n, .sheet th.n { text-align:right; white-space:nowrap; }
.sheet tr.subtotal td { font-weight:700; background:#f7f7f7; border-top:1.5px solid #999; border-bottom:none; }
.sheet .mealhead { display:flex; justify-content:space-between; font-weight:700; font-size:13px; margin:10px 0 2px; border-bottom:2px solid #333; padding-bottom:1px; }
.meal { break-inside: avoid; }
.summary { border:2px solid #333; padding:10px 12px; margin:6px 0 10px; }
.summary .total { display:flex; justify-content:space-between; align-items:baseline; font-size:22px; font-weight:700; }
.summary .total .goal { font-size:13px; font-weight:400; color:#444; }
.summary .extras { font-size:13px; margin:6px 0 8px; }
.summary .extras b { font-weight:700; }
.bars { display:grid; grid-template-columns:auto 1fr auto; gap:3px 10px; align-items:center; font-size:12px; }
.bars .lab { font-weight:600; white-space:nowrap; }
.bars .track { position:relative; height:12px; background:#ececec; border-radius:2px; overflow:hidden; }
.bars .fill { position:absolute; left:0; top:0; bottom:0; background:#4b5563; }
.bars .fill.over { background:#dc2626; }
.bars .mark { position:absolute; top:-2px; bottom:-2px; width:2px; background:#111; }
.bars .val { white-space:nowrap; text-align:right; font-variant-numeric:tabular-nums; }
.bars .val b.over { color:#dc2626; }
.note { font-size:10px; color:#666; margin-top:4px; }
@media print { .sheet { max-width:none; padding:0; } }
`;

const BAR_ROWS = [
  { label: 'エネルギー', key: 'kcal', unit: 'kcal', fmt: fmtKcal },
  { label: 'たんぱく質', key: 'protein', unit: 'g', fmt: fmtG },
  { label: '脂質', key: 'fat', unit: 'g', fmt: fmtG },
  { label: '炭水化物', key: 'carb', unit: 'g', fmt: fmtG },
  { label: '塩分', key: 'salt', unit: 'g', fmt: fmtG },
];

function renderBars(totals, goals) {
  const rows = [];
  for (const r of BAR_ROWS) {
    const a = achievement(totals[r.key], goals[r.key]);
    if (!a) continue;
    const pctHtml = a.over ? `<b class="over">${a.pct}%</b>` : `<b>${a.pct}%</b>`;
    rows.push(
      `<div class="lab">${r.label}</div>` +
      `<div class="track"><div class="fill${a.over ? ' over' : ''}" style="width:${a.widthPct}%"></div>` +
      `<div class="mark" style="left:66.7%"></div></div>` +
      `<div class="val">${r.fmt(totals[r.key])} / ${r.fmt(goals[r.key])} ${r.unit} ${pctHtml}</div>`
    );
  }
  if (rows.length === 0) return '';
  return `<div class="bars">${rows.join('')}</div>\n    <div class="note">縦線が目標(100%)。目標を超えた分は赤。棒の右端は150%。</div>`;
}

function renderMeal(meal) {
  const head = `<div class="mealhead"><span>${esc(meal.label)}</span><span>${fmtKcal(meal.subtotal.kcal)} kcal</span></div>`;
  const th = '<tr><th>品目</th><th class="n">量</th><th class="n">kcal</th><th class="n">たんぱく質</th><th class="n">脂質</th><th class="n">炭水化物</th><th class="n">塩分</th></tr>';
  const rows = meal.items.map((it) =>
    `<tr><td>${esc(it.name)}</td><td class="n">${fmtG(it.grams)} g</td><td class="n">${fmtKcal(it.kcal)}</td>` +
    `<td class="n">${fmt1(it.protein)}</td><td class="n">${fmt1(it.fat)}</td><td class="n">${fmt1(it.carb)}</td><td class="n">${fmt1(it.salt)}</td></tr>`
  );
  const s = meal.subtotal;
  rows.push(
    `<tr class="subtotal"><td>${esc(meal.label)} 合計</td><td class="n">${fmtG(s.grams)} g</td><td class="n">${fmtKcal(s.kcal)}</td>` +
    `<td class="n">${fmt1(s.protein)}</td><td class="n">${fmt1(s.fat)}</td><td class="n">${fmt1(s.carb)}</td><td class="n">${fmt1(s.salt)}</td></tr>`
  );
  return `<div class="meal">\n  ${head}\n  <table>\n    ${th}\n    ${rows.join('\n    ')}\n  </table>\n</div>`;
}

export function renderSheetHtml({ date, sheet }) {
  const { title, goals, totals, extras, meals } = sheet;
  const hasGoals = !!goals && typeof goals.kcal === 'number' && Number.isFinite(goals.kcal) && goals.kcal > 0;
  const goalHtml = hasGoals
    ? ` <span class="goal">(目標 ${fmtKcal(goals.kcal)} kcal)</span>`
    : ` <span class="goal">目標未設定</span>`;
  const extrasHtml = extras && extras.length > 0
    ? `\n    <div class="extras"><b>固有栄養素:</b> ${extras.map((e) => `${esc(e.name)} ${fmtG(e.amount)} ${esc(e.unit)}`).join(' ／ ')}</div>`
    : '';
  const barsHtml = hasGoals ? `\n    ${renderBars(totals, goals)}` : '';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet" data-date="${esc(date)}">
  <h1>${esc(title)}</h1>
  <div class="meta">カロリー計算アプリの記録から</div>

  <div class="summary">
    <div class="total"><span>1日の合計</span><span>${fmtKcal(totals.kcal)} kcal${goalHtml}</span></div>${extrasHtml}${barsHtml}
  </div>

${meals.map(renderMeal).join('\n\n')}
</div>
</body>
</html>
`;
}
