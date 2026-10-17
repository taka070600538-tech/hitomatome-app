# 1日まとめ

## 概要

カロリー計算アプリなど4つのスマホアプリの記録を1日分まとめて表示し、食事の記録を A4 の紙に印刷するための PWA。スマホ側で「印刷依頼」を作ると、GitHub の `app-data` リポジトリ(`daily-summary/print-requests/`)に依頼 JSON が保存される。PC 側のタスクがそれを定期的に取り込み、PDF にしてプリンターで印刷する。

## 使い方

スマホで PWA を開いて日付を選び、印刷ボタンから依頼を送る。PC が起動していれば、約10分以内に自動で印刷される。

### PC側の印刷タスク

登録(PowerShell。最初の1回だけ):

```powershell
powershell -ExecutionPolicy Bypass -File tools\register-task.ps1
# 間隔を変える場合: -IntervalMinutes 5
```

登録すると、まず `--init-ledger` で既存の依頼を「印刷済み扱い(skipped)」にしたうえで、タスク `DailySummaryPrintPoll` が10分おきに `tools\print-request-poll.ps1` を実行する。その中身は次の通り。

1. `app-data` に `.git\index.lock` があればスキップ
2. `git pull`(失敗しても手元の依頼は処理する)
3. 台帳 `tools\state\printed.json` にない依頼だけを、HTML → Edge で PDF → `print_pdf.py` で既定のプリンターへ印刷
4. 依頼ごとに台帳へ `printed` / `failed` を記録。古い PDF/HTML は新しい30件分を残して削除

手動実行(リポジトリ直下で):

```powershell
node tools\process-print-requests.mjs               # 通常実行
node tools\process-print-requests.mjs --dry-run     # 印刷せず PDF まで作る(台帳には printed と記録される)
node tools\process-print-requests.mjs --no-pull     # git pull をしない
node tools\process-print-requests.mjs --init-ledger # 台帳が無ければ既存の依頼を skipped で登録して終了
```

注意: `tools\state\printed.json` を消すと、次回実行時に既存の依頼がすべて `skipped` として登録される(印刷されない)。再印刷したいときは、台帳から該当 requestId の entry だけを消す。

### PDF とログの場所

- PDF / HTML: `tools\state\pdf\<日付>_<requestId>.pdf`(`.html`)
- ログ: `tools\state\print-log.txt`
- 台帳: `tools\state\printed.json`

`tools\state\` は git 管理外。

## 開発

```
node --test tests/*.test.js
```

`js/` や `sw.js` を変えたら `sw.js` の `CACHE_NAME` を上げる。
