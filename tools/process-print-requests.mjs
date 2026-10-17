// PC側の印刷キュー: app-data の印刷依頼を PDF 化して印刷する
// 使い方: node tools/process-print-requests.mjs [--dry-run] [--no-pull] [--init-ledger]
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderSheetHtml } from '../js/sheet.js';
import { parseLedger, planRun, markEntry, prunePdfList, requestIdFromFile } from './printQueue.mjs';

const APP_DATA = 'D:\\Obsidian Vault for Claude Code\\Git\\app-data';
const REQ_DIR = APP_DATA + '\\daily-summary\\print-requests';
const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(TOOLS_DIR, 'state');
const PDF_DIR = join(STATE_DIR, 'pdf');
const LEDGER_PATH = join(STATE_DIR, 'printed.json');
const LOG_PATH = join(STATE_DIR, 'print-log.txt');
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const NO_PULL = args.has('--no-pull');
const INIT_LEDGER = args.has('--init-ledger');

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(msg) {
  const line = `[${stamp()}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_PATH, line + '\n', 'utf8'); } catch { /* ログ不可でも処理は続ける */ }
}

function pullAppData() {
  const r = spawnSync('git', ['-C', APP_DATA, 'pull'], { encoding: 'utf8' });
  if (r.status !== 0) log(`git pull 失敗(続行): ${(r.stderr || r.error || '').toString().trim()}`);
  else log('git pull 完了');
}

// 台帳が無い・壊れている場合は null(壊れた台帳は退避して初期化パスへ)
function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return null;
  const ledger = parseLedger(readFileSync(LEDGER_PATH, 'utf8'));
  if (ledger) return ledger;
  if (DRY_RUN) { log('台帳が壊れています(dry-run のため退避しません)'); return null; }
  const t = new Date();
  const ts = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  const backup = join(STATE_DIR, `printed.corrupt-${ts}.json`);
  renameSync(LEDGER_PATH, backup);
  log(`台帳が壊れていたため退避して再初期化します: ${backup}`);
  return null;
}

function saveLedger(ledger) {
  if (DRY_RUN) return;
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8');
}

function renderToPdf(request, base) {
  const edge = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!edge) throw new Error('Edge が見つかりません');
  const htmlPath = join(PDF_DIR, base + '.html');
  const pdfPath = join(PDF_DIR, base + '.pdf');
  writeFileSync(htmlPath, renderSheetHtml(request), 'utf8');
  if (existsSync(pdfPath)) unlinkSync(pdfPath);
  const r = spawnSync(edge, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { encoding: 'utf8', timeout: 120000 });
  if (!existsSync(pdfPath) || statSync(pdfPath).size === 0) {
    throw new Error(`PDF 生成に失敗: ${(r.stderr || r.error || '').toString().trim().slice(-200)}`);
  }
  return pdfPath;
}

function printPdf(pdfPath) {
  if (DRY_RUN) return '(dry-run)';
  const r = spawnSync('py', ['-3', join(TOOLS_DIR, 'print_pdf.py'), pdfPath], { encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) throw new Error(`印刷失敗: ${(r.stderr || r.error || '').toString().trim().slice(-200)}`);
  const m = /^Printer:\s*(.+)$/m.exec(r.stdout || '');
  return m ? m[1].trim() : '(不明)';
}

function prunePdfs() {
  const pdfs = readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf') && requestIdFromFile(f.replace(/\.pdf$/, '.json')));
  for (const f of prunePdfList(pdfs)) {
    for (const ext of ['.pdf', '.html']) {
      try { unlinkSync(join(PDF_DIR, f.replace(/\.pdf$/, ext))); } catch { /* なければ無視 */ }
    }
    log(`古い出力を削除: ${f}`);
  }
}

function main() {
  mkdirSync(PDF_DIR, { recursive: true });
  if (existsSync(join(APP_DATA, '.git', 'index.lock'))) {
    log('app-data がロック中、スキップ');
    return;
  }
  let ledger = loadLedger();
  if (INIT_LEDGER && ledger) { log('台帳は既にあります(何もしません)'); return; }
  if (!NO_PULL) pullAppData();
  const fileNames = existsSync(REQ_DIR) ? readdirSync(REQ_DIR) : [];
  const plan = planRun({ fileNames, ledger });

  if (plan.initializing) {
    ledger = { version: 1, entries: {} };
    for (const f of plan.toSkip) {
      ledger = markEntry(ledger, requestIdFromFile(f), { status: 'skipped', at: new Date().toISOString() });
    }
    saveLedger(ledger);
    log(DRY_RUN
      ? '台帳が無いため初期化が必要です(dry-run のため書き込みません)'
      : `台帳を初期化: 既存の依頼 ${plan.toSkip.length} 件を skipped として登録`);
    return;
  }
  if (INIT_LEDGER) return;

  for (const f of plan.toPrint) {
    const id = requestIdFromFile(f);
    const base = f.replace(/\.json$/, '');
    // 先に printing として確保(保存に失敗したら印刷せず全体を中止 = 再印刷ループ防止)
    ledger = markEntry(ledger, id, { status: 'printing', at: new Date().toISOString() });
    saveLedger(ledger);
    let result;
    try {
      const request = JSON.parse(readFileSync(join(REQ_DIR, f), 'utf8'));
      const pdf = renderToPdf(request, base);
      const printer = printPdf(pdf);
      result = { status: 'printed', at: new Date().toISOString(), pdf, printer };
      log(DRY_RUN ? `印刷完了(dry-run、台帳は更新しません): ${f}` : `印刷完了: ${f} -> ${printer}`);
    } catch (e) {
      result = { status: 'failed', at: new Date().toISOString(), error: String(e.message || e) };
      log(`失敗: ${f}: ${e.message || e}`);
    }
    ledger = markEntry(ledger, id, result);
    saveLedger(ledger); // 失敗時は throw → main の catch で中止(entry は printing のまま)
  }
  if (plan.toPrint.length === 0) log('新しい依頼なし');
  prunePdfs();
}

try { main(); } catch (e) { log(`致命的エラー: ${e.message || e}`); process.exitCode = 1; }
