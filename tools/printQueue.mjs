// 印刷キューの純粋ロジック(fsなし)
const FILE_RE = /^(.+)_(\d{8}T\d{6}Z-[0-9a-z]{6})\.json$/;

export function parseLedger(text) {
  if (text == null) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const e = obj.entries;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  return { version: 1, entries: e };
}

export function requestIdFromFile(fileName) {
  const m = FILE_RE.exec(fileName);
  return m ? m[2] : null;
}

// 台帳に既にあるキー(printed / failed / skipped / printing のどれでも)は toPrint から除外する
export function planRun({ fileNames, ledger }) {
  const valid = [...new Set(fileNames)].filter((f) => requestIdFromFile(f)).sort();
  if (!ledger) return { initializing: true, toPrint: [], toSkip: valid };
  const toPrint = valid.filter((f) => !(requestIdFromFile(f) in ledger.entries));
  return { initializing: false, toPrint, toSkip: [] };
}

export function markEntry(ledger, requestId, entry) {
  return { version: 1, entries: { ...ledger.entries, [requestId]: { ...entry } } };
}

export function prunePdfList(fileNames, keep = 30) {
  const sorted = [...fileNames].sort();
  return sorted.length > keep ? sorted.slice(0, sorted.length - keep) : [];
}
