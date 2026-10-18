# Drive Explorer (Win11 style) — v0.1.0 (prototype)

Google ドライブを Windows 11 のエクスプローラー風にする Chrome 拡張機能（Manifest V3）です。
A Chrome (Manifest V3) extension that makes Google Drive feel like Windows 11 File Explorer.

> ⚠️ **プロトタイプ / Prototype.** 実際の Google ドライブにログインせず、公開情報とローカルの模擬ページで開発・テストしています。実環境で動かない箇所があれば、下の「不具合の報告」の手順で診断情報を送ってください。
> Built and tested against a local mock of Drive's DOM, not the live site. See *Reporting issues* below.

---

## 日本語

### 機能
1. **中アイコン表示** — ドライブの「グリッド表示」を Win11 の「中アイコン」風に変更します（約 96×110px の小さなタイル、64px のサムネイル/アイコン、ファイル名はアイコンの**下**に中央揃えで 2 行まで、ホバー/選択時の半透明の青い枠）。ドライブ自身の DOM の見た目を変えるだけなので、並べ替え・選択・ダブルクリックで開く・ドラッグ＆ドロップはドライブ標準のまま動きます。
2. **Windows 11 風の右クリックメニュー** — ファイル/フォルダの右クリックで、角丸・アイコン・区切り線・ショートカット表示付きのメニューを表示します。項目：開く／新しいタブで開く／ダウンロード／名前の変更 (F2)／リンクをコピー／共有／移動／ショートカットを追加／スター／コピーを作成／ファイル情報／削除／ドライブのメニューを表示。各項目はドライブ**本来の機能**を実行します（ドライブ標準のメニューを見えない状態で開いて該当項目をクリック）。日本語・英語どちらの UI でも動作します。Esc・メニュー外クリック・スクロールで閉じます。**Shift + 右クリック**でいつでもドライブ標準メニューを表示できます。F2 で選択中の項目の名前を変更できます。
3. **エディタのダークモード** — ドキュメント／スプレッドシート／スライド（docs.google.com）を `invert(1) hue-rotate(180deg)` フィルタで暗くし、画像・動画・カラーパレットは元の色に戻します。アプリごとにオン/オフできます。
   - **ドライブ本体のダークモード**は、ドライブ標準の機能を使ってください：歯車アイコン → 設定 → 全般 → **デザイン（外観）→ ダーク**（または「デバイスのデフォルト」）。本拡張のタイルとメニューはドライブの背景色と `prefers-color-scheme` を見て自動でライト/ダークに切り替わります。

### インストール（パッケージ化されていない拡張機能として読み込む）
1. `drive-explorer-0.1.0.zip` を任意のフォルダに展開します（中に `manifest.json` があるフォルダ）。
2. Chrome で `chrome://extensions` を開きます。
3. 右上の **デベロッパー モード** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、展開したフォルダ（`manifest.json` があるフォルダ）を選択します。
5. 既に開いているドライブ / ドキュメントのタブは **再読み込み** してください。
6. ツールバーのパズルアイコンから Drive Explorer を固定すると、ポップアップで各機能を切り替えられます。

### 権限
`storage`（設定の保存、`chrome.storage.sync`）と、`https://drive.google.com/*`・`https://docs.google.com/*` へのアクセスのみ。外部への通信・OAuth・アカウント情報へのアクセスは一切ありません。

### 既知の制限
- 実際のドライブでは未検証です。ドライブのクラス名は難読化されて頻繁に変わるため、`role` / `aria-*` / `data-id` / `data-target` などの比較的安定した属性と、サイズ・テキストのヒューリスティックで要素を探しています。ドライブの更新で壊れる可能性があります（修正箇所は `src/drive/selectors.js` に集約）。
- 中アイコン表示はグリッド表示のみが対象です（リスト表示は変更しません）。ドライブの行（row）構造を 1 本の折り返しフローに並べ替えているため、**矢印キーでの移動**はドライブ内部の行の区切りに従い、見た目と一致しないことがあります。
- メニュー項目は「見えない状態でドライブ標準のメニューを開いてクリックする」方式です。ドライブが合成イベントを無視した場合は、選択時のツールバーのボタン → ドライブのキーボードショートカット → 代替処理（リンク生成など）の順に試します。それでも失敗した場合はトーストを表示するので「ドライブのメニューを表示」または Shift + 右クリックを使ってください。
- ショートカット表示（Z・S・. など）はドライブ自身の 1 キーショートカットです。F2（名前の変更）は本拡張が追加しています。
- 「スター」は付ける/外すを自動で切り替えます（ドライブのメニューにある方を実行）。
- 共有ドライブ・ゴミ箱・検索結果などではドライブのメニュー項目が異なり、一部の項目が実行できない場合があります（例：ゴミ箱の「復元」は「ドライブのメニューを表示」から）。
- 「新しいタブで開く」は `https://drive.google.com/open?id=…`（フォルダは `/drive/folders/…`）を開きます。`/u/N/` のアカウント番号は引き継ぎます。
- 「開く」はダブルクリックを合成して実行します。
- ダークモード（エディタ）：Chromium 版のドキュメントでは画像も `<canvas>` に描画されるため、**文書内の画像は反転したまま**になります（DocsAfterDark など他のフィルタ方式と同じ制限）。ツールバーなど UI 全体も反転し、背景は純黒になります。表示のちらつきを防ぐため、docs.google.com の localStorage に小さなフラグ（`dxe-dark-docs` など）を保存します。

### 不具合の報告
1. ポップアップで **「デバッグ：セレクタの一致状況をコンソールに出力」** をオンにし、ドライブのタブを開いたまま DevTools（F12）→ Console の `[DriveExplorer]` ログを確認します。
2. ポップアップの **「現在のドライブタブの診断情報をコピー」** で、ファイル名や ID を含まない構造情報（JSON）がクリップボードにコピーされます。これを報告に貼り付けてください。

---

## English

### Features
1. **Medium icons view** — restyles Drive's own *Grid view* like Win11 Explorer's "Medium icons": compact ~96×110px tiles, 64px thumbnail/icon, file name centred **below** the icon wrapping to 2 lines (Drive moved names above thumbnails in Feb 2026), hover highlight and translucent blue selection box. Drive's DOM is only restyled, never replaced, so native sorting, selection, double-click-to-open and drag & drop keep working.
2. **Windows 11 style context menu** — right-clicking a file/folder shows a rounded Win11-looking menu with icons, separators and shortcut hints: Open, Open in new tab, Download, Rename (F2), Copy link, Share, Move, Add shortcut, Star, Make a copy, File information, Delete, plus **Show Drive menu** (like Win11's "Show more options"). Each item triggers Drive's **real** action by opening Drive's native menu invisibly and clicking the matching item (labels matched in English and Japanese). Esc, outside click or scroll closes it. **Shift + right-click** always shows Drive's own menu. **F2** renames the selected item.
3. **Dark mode for Docs / Sheets / Slides** (docs.google.com) — the editors are canvas-rendered, so a filter is used: `invert(1) hue-rotate(180deg)` on the page, with images, video and colour palettes inverted back. Per-app toggles in the popup.
   - For **Drive itself**, use Drive's built-in theme: gear icon → Settings → General → **Appearance → Dark** (or "Device default"). Our tiles and menu follow Drive's light/dark automatically (Drive's background colour, then `prefers-color-scheme`).

### Install (Load unpacked)
1. Unzip `drive-explorer-0.1.0.zip` somewhere (you need the folder that contains `manifest.json`).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).
5. **Reload** any Drive / Docs tabs that were already open.
6. Pin Drive Explorer from the puzzle-piece menu; the popup has all toggles.

### Permissions
Only `storage` (settings in `chrome.storage.sync`) and host access to `https://drive.google.com/*` and `https://docs.google.com/*`. No network requests, no OAuth, no access to your account data.

### Known limitations
- **Not yet verified on the live Drive.** Drive's class names are obfuscated and change often, so the code relies on comparatively stable hooks (`role`, `aria-*`, `data-id`, `data-target`) plus size/text heuristics. A Drive update can break it; all DOM knowledge lives in `src/drive/selectors.js`.
- Medium icons applies to Grid view only (List view is unchanged). Drive's rows are flattened into one wrapping flow, so **arrow-key navigation** still follows Drive's internal rows and may not match what you see.
- Menu actions work by driving Drive's native menu with synthetic events. If Drive ignores them, the extension falls back to the selection toolbar button, then Drive's keyboard shortcut, then a custom fallback (e.g. building the link for Copy link). If everything fails a toast appears — use **Show Drive menu** or Shift + right-click.
- The shortcut hints (Z, S, ".") are Drive's own single-key shortcuts; F2 (rename) is added by this extension.
- "Star" toggles (it runs whichever of Add to / Remove from Starred Drive offers).
- Shared drives, Trash, search results etc. have different native menus; some items may not be available there (e.g. use "Show Drive menu" for Restore in Trash).
- "Open in new tab" opens `https://drive.google.com/open?id=…` (folders: `/drive/folders/…`), keeping the `/u/N/` account index.
- "Open" works by synthesising a double-click.
- Editor dark mode: in Chromium, Docs paints document **images into the canvas, so they stay inverted** (same limitation as DocsAfterDark's invert mode). The whole UI including toolbars is inverted and the page background becomes pure black. To avoid a white flash, a tiny flag (`dxe-dark-docs`, …) is cached in docs.google.com's localStorage.

### Reporting issues
1. In the popup turn on **Debug: log selector matches to the console**, then check `[DriveExplorer]` lines in DevTools (F12) → Console on the Drive tab.
2. Click **Copy diagnostics from current Drive tab** in the popup: a JSON with the DOM *structure* only (no file names, no ids) is copied to the clipboard — paste it into your report.

---

## Development

```
manifest.json
src/common/settings.js     settings (chrome.storage.sync) + debug logger
src/drive/early.js         document_start capture listeners (run before Drive's)
src/drive/selectors.js     ★ ALL Drive DOM knowledge: selectors, EN/JA labels, action table
src/drive/theme.js         light/dark detection for our UI
src/drive/tiles.js         Medium icons: tags Drive's grid with data-dxe-* (MutationObserver)
src/drive/drive.css        Medium icons styles (scoped to html.dxe-medium)
src/drive/native-actions.js drives Drive's real menu / toolbar / shortcuts
src/drive/context-menu.js  Win11 menu UI (shadow DOM)
src/drive/main.js          wiring, F2, diagnostics
src/docs/docs-dark.{js,css} editor dark mode
popup/                     settings popup
test/                      mock Drive/Docs pages + headless tests (not shipped)
scripts/build-zip.sh       builds ../out/drive-explorer-<ver>.zip
```

Tests (need Chrome + playwright-core): `node test/run-screenshots.mjs <outDir>` (scripts injected into the mocks) and `node test/run-real-extension.mjs <outDir>` (the real unpacked extension, with drive/docs.google.com answered locally by the mocks).

## License
MIT © 2026 zmlworks — see [LICENSE](LICENSE).
