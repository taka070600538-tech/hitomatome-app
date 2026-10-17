// 印刷依頼JSONの組み立て(純粋関数)。sheet は Sheet オブジェクトをそのまま通す。
const pad = (n) => String(n).padStart(2, '0');

export function makeRequestId(now = new Date(), random = Math.random) {
  const ts =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  let suffix = '';
  while (suffix.length < 6) {
    suffix += Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0');
  }
  return `${ts}-${suffix.slice(0, 6)}`;
}

export function buildPrintRequest({ date, sheet, now = new Date(), requestId = makeRequestId(now) }) {
  return { version: 1, requestId, date, requestedAt: now.toISOString(), sheet };
}

export function requestPath(request) {
  return 'daily-summary/print-requests/' + request.date + '_' + request.requestId + '.json';
}
