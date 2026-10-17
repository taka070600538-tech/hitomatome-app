// 同一オリジンの他アプリのIndexedDBを「読むだけ」で開く。DB・ストアは絶対に作成・変更しない。
// ブラウザ専用(indexedDBが必要)のためNodeの単体テスト対象外。薄く保ち、実機で確認する。
// 参考: カロリー計算アプリ js/exerciseSync.js の readExerciseRecords。
//
// 戻り値は reject せず必ず { available, data: { [store]: any[] } }。
// DBが無い・ストアが無い・エラー・blocked のときは { available:false, data:{} }。
export function readStores(dbName, storeNames) {
  const fail = { available: false, data: {} };
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      let notFound = false;
      const request = indexedDB.open(dbName); // バージョン未指定=既存版を開く
      request.onupgradeneeded = (event) => {
        // 発火するのはDBが未作成の場合のみ。作成を中止する。
        notFound = true;
        try { event.target.transaction.abort(); } catch { /* 無視 */ }
      };
      request.onsuccess = () => {
        if (notFound) { try { request.result.close(); } catch { /* 無視 */ } done(fail); return; }
        const db = request.result;
        try {
          if (!storeNames.every((n) => db.objectStoreNames.contains(n))) {
            db.close(); done(fail); return;
          }
          const tx = db.transaction(storeNames, 'readonly');
          const data = {};
          const reqs = storeNames.map((name) => {
            const r = tx.objectStore(name).getAll();
            r.onsuccess = () => { data[name] = r.result; };
            return r;
          });
          tx.oncomplete = () => { db.close(); done(reqs.length ? { available: true, data } : fail); };
          tx.onerror = () => { db.close(); done(fail); };
          tx.onabort = () => { db.close(); done(fail); };
        } catch {
          try { db.close(); } catch { /* 無視 */ }
          done(fail);
        }
      };
      request.onerror = () => done(fail);
      request.onblocked = () => done(fail);
    } catch {
      done(fail);
    }
  });
}
