import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// sw.jsのASSETS配列を文字列として抜き出す(sw.jsはself前提でimportできないため)
function swAssets() {
  const m = swSource.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.jsにASSETS配列がある');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].replace(/^\.\//, ''));
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('manifest: PNGアイコン3種(192/512/maskable)が宣言されている', () => {
  const srcs = manifest.icons.map((i) => i.src);
  assert.ok(srcs.includes('icons/icon-192.png'));
  assert.ok(srcs.includes('icons/icon-512.png'));
  assert.ok(srcs.includes('icons/icon-maskable-512.png'));
  const maskable = manifest.icons.find((i) => i.src === 'icons/icon-maskable-512.png');
  assert.equal(maskable.purpose, 'maskable');
});

test('manifest: 宣言された全アイコンファイルが実在する', () => {
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src + ' が存在する');
  }
});

test('manifest: PNGアイコンの実寸がsizes宣言と一致する', () => {
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(fs.readFileSync(path.join(root, icon.src)));
    assert.deepEqual(actual, { width: w, height: h }, icon.src);
  }
});

// WebAPK生成サーバーは厳密にPNGを再処理するため、ブラウザで表示できても
// チャンク構造が壊れたPNGはインストール失敗(SERVER_ERROR)の原因になる。
test('PNGアイコンのチャンク構造が完全である(IEND終端・CRC一致)', () => {
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    const buf = fs.readFileSync(path.join(root, icon.src));
    assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${icon.src}: PNGシグネチャ`);
    let pos = 8;
    let sawEnd = false;
    while (pos + 12 <= buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString('ascii', pos + 4, pos + 8);
      assert.ok(/^[A-Za-z]{4}$/.test(type), `${icon.src}: チャンク名が不正(${JSON.stringify(type)})`);
      assert.ok(pos + 12 + len <= buf.length, `${icon.src}: ${type}チャンクがファイル末尾を越える`);
      const crc = buf.readUInt32BE(pos + 8 + len);
      const actual = zlib.crc32(buf.subarray(pos + 4, pos + 8 + len));
      assert.equal(actual >>> 0, crc, `${icon.src}: ${type}チャンクのCRC不一致`);
      if (type === 'IEND') { sawEnd = true; pos += 12 + len; break; }
      pos += 12 + len;
    }
    assert.ok(sawEnd, `${icon.src}: IENDチャンクが無い`);
    assert.equal(pos, buf.length, `${icon.src}: IEND後に余分なデータがある`);
  }
});

test('sw.js: manifestの全アイコンがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const icon of manifest.icons) {
    assert.ok(assets.includes(icon.src), icon.src + ' がASSETSにある');
  }
});

test('sw.js: 共有モジュールgithub.io/app-syncをキャッシュしない', () => {
  assert.ok(!swSource.includes('github.io/app-sync'), 'sw.jsのASSETSにapp-syncを含めない');
});

test('sw.js: プリキャッシュ取得はHTTPキャッシュを迂回する(cache: reload)', () => {
  // GitHub Pagesはmax-age=600で配信するため、通常のfetchだとCACHE_NAMEを上げても
  // ブラウザのHTTPキャッシュから古いJSを取り込んでしまうことがある。
  assert.match(swSource, /cache:\s*['"]reload['"]/);
});

test('sw.js: manifest.jsonをキャッシュしない', () => {
  assert.ok(!swAssets().includes('manifest.json'), 'manifest.jsonはASSETSに含めない');
});

test('sw.js: js/配下の全ファイルがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const f of fs.readdirSync(path.join(root, 'js')).filter((n) => n.endsWith('.js'))) {
    assert.ok(assets.includes('js/' + f), 'js/' + f + ' がASSETSにある');
  }
});
