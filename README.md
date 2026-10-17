# 1日まとめ

## 概要

カロリー計算アプリなど4つのスマホアプリの記録を1日分まとめて表示し、食事の記録を A4 の紙に印刷するための PWA。スマホ側で「印刷依頼」を作ると、GitHub の `app-data` リポジトリ(`daily-summary/print-requests/`)に依頼 JSON が保存される。PC 側のタスクがそれを定期的に取り込み、PDF にしてプリンターで印刷する。

- 公開URL: https://taka070600538-tech.github.io/daily-summary-app/
- 設計書: `Git\docs\superpowers\specs\2026-10-17-daily-summary-app-design.md`、実装計画: `Git\docs\superpowers\plans\2026-10-17-daily-summary-app.md`

## 使い方

1. Android の Chrome で公開URLを開き、メニューの「アプリをインストール」で入れる(同じ端末で4つの記録アプリを一度開いていれば、そのデータがそのまま見える)。
2. 「タイムライン」タブで日付を選ぶ(◀ ▶、または中央の日付をタップして日付入力)。時間管理ダイアリーの時刻を軸に、血圧・ジョギング・筋トレ・食事が1本の時系列に並ぶ。時刻が未入力の出来事は既定時刻の位置に灰色の「スキップ」行で出る。
3. 「この日の食事を印刷(PCへ送る)」で紙のプレビューを確認し「送信」。PC が起動していれば約10分以内に自動で印刷される。GitHub 連携(PAT)は他の記録アプリと共通で、どれか1つで設定済みなら追加設定は不要。
4. 「設定」タブの「タイムラインの結びつけ」で、各出来事をダイアリーのどの項目の時刻に置くか、時刻が無い日の既定時刻を変えられる(設定だけが GitHub にバックアップされる)。

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
4. 依頼ごとに、印刷前に台帳へ `printing` を書いて確保し(保存に失敗したら印刷せず中止)、結果を `printed` / `failed` で上書きする。古い PDF/HTML は新しい30件分を残して削除

手動実行(リポジトリ直下で):

```powershell
node tools\process-print-requests.mjs               # 通常実行
node tools\process-print-requests.mjs --dry-run     # 印刷せず PDF まで作る(台帳は一切更新しないので依頼は消費されない)
node tools\process-print-requests.mjs --no-pull     # git pull をしない
node tools\process-print-requests.mjs --init-ledger # 台帳が無ければ既存の依頼を skipped で登録して終了
```

注意: `tools\state\printed.json` を消すと、次回実行時に既存の依頼がすべて `skipped` として登録される(印刷されない)。台帳が壊れていた場合は `printed.corrupt-<日時>.json` に退避して再初期化する(既存の依頼は skipped 扱い)。再印刷したいときは、台帳から該当 requestId の entry だけを消す。

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
