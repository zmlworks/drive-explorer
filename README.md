# Drive Explorer (Win11 style) — v0.3.1 (prototype)

Google ドライブを Windows 11 のエクスプローラー風にする Chrome 拡張機能（Manifest V3）です。
A Chrome (Manifest V3) extension that makes Google Drive feel like Windows 11 File Explorer.

> ⚠️ **プロトタイプ / Prototype.** 実際の Google ドライブにログインせず、公開情報とローカルの模擬ページで開発・テストしています。実環境で動かない箇所があれば、下の「不具合の報告」の手順で診断情報を送ってください。
> Built and tested against a local mock of Drive's DOM, not the live site. See *Reporting issues* below.

---

## 日本語

### 機能
1. **中アイコン表示** — ドライブの「グリッド表示」を Win11 の「中アイコン」風に変更します（約 96×110px の小さなタイル、64px のサムネイル/アイコン、ファイル名はアイコンの**下**に中央揃えで 2 行まで、ホバー/選択時の半透明の青い枠）。ドライブ自身の DOM の見た目を変えるだけなので、並べ替え・選択・ダブルクリックで開く・ドラッグ＆ドロップはドライブ標準のまま動きます。
2. **Windows 11 風の右クリックメニュー** — ファイル/フォルダの右クリックで、角丸・アイコン・区切り線・ショートカット表示付きのメニューを表示します。項目：開く／新しいタブで開く／ダウンロード／名前の変更 (F2)／リンクをコピー／共有／移動／ショートカットを追加／スター／コピーを作成／ファイル情報／削除／ドライブのメニューを表示。各項目はドライブ**本来の機能**を実行します（ドライブ標準のメニューを見えない状態で開いて該当項目をクリック）。日本語・英語どちらの UI でも動作します。Esc・メニュー外クリック・スクロールで閉じます。**Shift + 右クリック**でいつでもドライブ標準メニューを表示できます。F2 で選択中の項目の名前を変更できます。
3. **ドライブの詳細パネルを表示しない**（0.2.0、既定でオン）— クリック/選択時に右側に開く「詳細（ファイル情報）」パネルを見えなくし、ファイル一覧の幅も元のままにします。パネル自体はドライブの中で動き続けるので、ドライブの他の機能には影響しません。ポップアップでオフにできます（オンの間は、ドライブ標準メニューの「ファイル情報 → 詳細」で開いたパネルも見えません）。
4. **プロパティ**（0.2.0）— 右クリックメニューの最後の項目「プロパティ」（または選択中に **Alt+Enter**）で、Windows 11 風のプロパティ ウィンドウ（「<名前> のプロパティ」）を表示します。全般タブ：大きなアイコンと名前、種類、場所、サイズ、使用容量、作成日時、更新日時、最終閲覧、所有者、アクセス（共有の概要）。詳細タブ：ドライブが表示したすべての項目。タイトルバーでドラッグでき、Esc・OK・キャンセル・× で閉じます。ライト/ダークに追従します。
   - 情報は、ドライブの詳細パネルを**見えない状態で**開いて読み取り（ファイル情報 → 詳細、または ⓘ「詳細を表示」ボタン）、読み終わったら閉じます（元から開いていた場合はそのまま）。未知のラベルもそのまま表示します。読み取れなかった場合はメッセージを表示します。
5. **エディタのダークモード** — ドキュメント／スプレッドシート／スライド（docs.google.com）を `invert(1) hue-rotate(180deg)` フィルタで暗くし、画像・動画・カラーパレットは元の色に戻します。アプリごとにオン/オフできます。
   - **ドライブ本体のダークモード**は、ドライブ標準の機能を使ってください：歯車アイコン → 設定 → 全般 → **デザイン（外観）→ ダーク**（または「デバイスのデフォルト」）。本拡張のタイルとメニューはドライブの背景色と `prefers-color-scheme` を見て自動でライト/ダークに切り替わります。
6. **詳細パネル非表示の強化**（0.3.0）— 「詳細」タブが無い構造にも対応するため、(a) 既知のラベル（「詳細」「ファイル情報」「Details」など）を持つ `complementary`/`region` を CSS で非表示、(b) 選択直後に画面右側（左端が画面幅の 60% より右、幅 250〜500px、ほぼ全高）に現れ、タブ・見出し・閉じるボタンのいずれかを含み、同時にファイル一覧が 120px 以上狭くなった列を「詳細パネル」と判定して非表示にします。ファイル一覧・`role=main`・Google カレンダー/Keep/ToDo/Gemini などのサイドパネル・iframe は対象外です。
7. **エクスプローラー風ツールバー**（0.3.0）— 一覧の上に ← 戻る／→ 進む／↑ 1 つ上へ／⟳ 更新、アドレス バー、表示切り替え（中アイコン / 一覧）を表示します。アドレス バーはドライブのパンくずリストから作った `/フォルダ/サブフォルダ` 形式（マイドライブ = `/`）で、各区切りをクリックするとその階層へ移動します。↑・**Alt+↑**・**Backspace**（入力中は除く）で 1 つ上へ。マイドライブでは ↑ は無効です。
8. **ステータス バー**（0.3.0）— 画面下に「15 個の項目 | 2 個の項目を選択」を表示します。
9. **Windows 11 のファイル アイコン**（0.3.0）— 中アイコン表示で、黄色いフォルダと Fluent 風の種類アイコン（ドキュメント・スプレッドシート・スライド・PDF・画像・動画・音声・ZIP・テキスト）を独自 SVG で表示します。画像などのサムネイルはそのまま表示します。
10. **おすすめを非表示**（0.3.0、既定でオン）— ホームとマイドライブの「おすすめのフォルダ / ファイル」、クイック アクセス、Gemini のチップを隠します（見出し・aria-label の表は `selectors.js` の `SUGGEST`）。
11. **ファイルを新しいタブで開く**（0.3.0）— ダブルクリック / Enter / メニューの「開く」で、フォルダ以外は新しいタブ（または新しいウィンドウ、ドライブの既定）で開きます。フォルダは同じ画面のまま移動します。タブ/ウィンドウの作成はバックグラウンドの Service Worker が `chrome.tabs.create` / `chrome.windows.create` で行います（追加の権限は不要）。アプリ ウィンドウから開いた場合は通常のウィンドウに開きます。
12. **ごみ箱**（0.3.0）— 一覧の右下に Windows のデスクトップ風「ごみ箱」を表示します。ダブルクリック（または Enter）でドライブのゴミ箱を開きます。項目をドラッグしてドロップすると、ドライブ標準の「ゴミ箱に移動」を実行します（Ctrl+Z またはドライブの「元に戻す」で戻せます）。アイコンの空/満杯は拡張内のおおよそのカウンター（`chrome.storage.local`）で、ゴミ箱ページを開くと実際の件数に合わせます。右クリック メニューの「ごみ箱を空にする」は**ゴミ箱ページを開くだけ**で、自動では何も削除しません。
13. **マイドライブから開始**（0.3.0）— インストールしたドライブのアプリ ウィンドウ（`display-mode: standalone` / `window-controls-overlay` / `minimal-ui`）でホームを開いたとき、1 回だけ `drive/u/N/my-drive` に移動します（既定でオン）。通常のタブ用のオプションもあります（既定でオフ）。
14. **キーボード**（0.3.0）— **Ctrl+C** で選択項目のリンクをコピー（オプション、既定でオン。文字を選択中や入力中は通常のコピー）、**Enter** で開く、**F2** で名前の変更、**Alt+Enter** でプロパティ、**Delete** はドライブ標準のゴミ箱移動、**Ctrl+A** はドライブ標準の全選択のままです。
15. **ページ構造をコピー**（0.3.0）— ポップアップのボタンで、現在のドライブ ページの DOM の骨格（タグ・role・aria-* 属性名・UI の aria-label・data-* 属性名・クラス名・位置とサイズ・子要素数、深さ 12・約 200KB まで）をコピーします。ファイル名・フォルダ名・ID・メールアドレスは除去し、文字は本拡張のラベル表にある UI の文言（タブ・ボタン・メニュー・見出し）だけを残します。右側パネルが開いていればその骨格を先頭に出力します。
16. **実際のドライブの構造に合わせた調整**（0.3.1）— ユーザーから頂いた 2 つの「ページ構造」をもとに：詳細パネルは `role=complementary aria-label="詳細ウィンドウ"`（閉じるボタン `data-target=hideDetails`）で検出、パネル本体が iframe の中にある場合も読み取り（同一オリジンは直接、drive/docs.google.com の別オリジンは全フレームで動く小さな補助スクリプトが `postMessage` で返答）、読み取れない場合はパネル見出しから名前と種類だけを表示。パンくずはファイル一覧の**上**にあるヘッダー（タイトル行＋`role=toolbar` 行）から検出。ツールバーはそのヘッダーの末尾に入れ、一覧の下端が画面外に押し出されないようにしました。選択時のボタンは `role=toolbar` 内のものを優先。表示切り替えボタンが見つからない場合はドライブのショートカット **v** を使います。
17. **ページ構造の記録の改善**（0.3.1）— 詳細パネル（**ラベルの文字は残し、値は除去**）、一覧の上のヘッダー、`role=main` から最初の項目までの経路と最初の数項目、開いているメニュー、本拡張が裏で開いたドライブのメニューの記録、検出結果の要約を、深さ 25〜40 で先頭に出力します。iframe（ホスト名・パスと同一オリジンかどうか）も出力し、同一オリジンなら中身も辿ります。メニューやパネルを開いたままで記録できるよう、**Ctrl+Alt+Shift+S** またはポップアップの「5 秒後に記録」で保存し、「最後の記録をコピー」でコピーします。

### インストール（パッケージ化されていない拡張機能として読み込む）
1. `drive-explorer-0.3.1.zip` を任意のフォルダに展開します（中に `manifest.json` があるフォルダ）。
2. Chrome で `chrome://extensions` を開きます。
3. 右上の **デベロッパー モード** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、展開したフォルダ（`manifest.json` があるフォルダ）を選択します。
5. 既に開いているドライブ / ドキュメントのタブは **再読み込み** してください。
6. ツールバーのパズルアイコンから Drive Explorer を固定すると、ポップアップで各機能を切り替えられます。

### 権限
`storage`（設定の保存、`chrome.storage.sync`／ごみ箱のカウンター `chrome.storage.local`）と、`https://drive.google.com/*`・`https://docs.google.com/*` へのアクセスのみ。外部への通信・OAuth・アカウント情報へのアクセスは一切ありません。

### 既知の制限
- 実際のドライブでは未検証です。ドライブのクラス名は難読化されて頻繁に変わるため、`role` / `aria-*` / `data-id` / `data-target` などの比較的安定した属性と、サイズ・テキストのヒューリスティックで要素を探しています。ドライブの更新で壊れる可能性があります（修正箇所は `src/drive/selectors.js` に集約）。
- 中アイコン表示はグリッド表示のみが対象です（リスト表示は変更しません）。ドライブの行（row）構造を 1 本の折り返しフローに並べ替えているため、**矢印キーでの移動**はドライブ内部の行の区切りに従い、見た目と一致しないことがあります。
- メニュー項目は「見えない状態でドライブ標準のメニューを開いてクリックする」方式です。ドライブが合成イベントを無視した場合は、選択時のツールバーのボタン → ドライブのキーボードショートカット → 代替処理（リンク生成など）の順に試します。それでも失敗した場合はトーストを表示するので「ドライブのメニューを表示」または Shift + 右クリックを使ってください。
- ショートカット表示（Z・S・. など）はドライブ自身の 1 キーショートカットです。F2（名前の変更）は本拡張が追加しています。
- 「スター」は付ける/外すを自動で切り替えます（ドライブのメニューにある方を実行）。
- 共有ドライブ・ゴミ箱・検索結果などではドライブのメニュー項目が異なり、一部の項目が実行できない場合があります（例：ゴミ箱の「復元」は「ドライブのメニューを表示」から）。
- 「新しいタブで開く」は `https://drive.google.com/open?id=…`（フォルダは `/drive/folders/…`）を開きます。`/u/N/` のアカウント番号は引き継ぎます。
- 「開く」はダブルクリックを合成して実行します。
- 詳細パネルの検出は「詳細」「アクティビティ」タブ（または role=complementary）と、画面右側の細い列であることを手がかりにしています。ドライブの構造が違うと検出できず、その場合パネルは通常どおり表示され、プロパティは「取得できませんでした」になります。パネルがドライブにより一瞬描画されてから非表示になる（ちらつく）可能性があります。
- プロパティの日付などの書式はドライブの表示そのままです（Windows のような「サイズ（バイト数）」は出ません）。名前欄は読み取り専用です（名前の変更は F2）。複数選択時のプロパティには未対応です。
- ドライブ本体が暗くならない場合：本拡張はドライブ自体を暗くしません。ドライブの歯車 → 設定 → 全般 → デザイン（外観）で「ダーク」を選んでください（この設定がまだ提供されていないアカウントもあります）。
- ダークモード（エディタ）：Chromium 版のドキュメントでは画像も `<canvas>` に描画されるため、**文書内の画像は反転したまま**になります（DocsAfterDark など他のフィルタ方式と同じ制限）。ツールバーなど UI 全体も反転し、背景は純黒になります。表示のちらつきを防ぐため、docs.google.com の localStorage に小さなフラグ（`dxe-dark-docs` など）を保存します。
- **0.3.1 で実際のドライブの構造（2 つのダンプ）に合わせたのは、詳細パネル・ヘッダー（パンくず/ツールバーの位置）・右側のサイドパネル/文字起こしの除外です。** 詳細パネル本体の中身（iframe かどうか、ラベルの文字）、ファイル項目の内部構造、パンくずのボタンの種類、表示切り替えボタンのラベル、ドライブのメニュー項目、「おすすめ」の見出しはダンプに含まれておらず、まだ推測です。パネル本体が drive/docs.google.com 以外のオリジンの iframe の場合は読み取れず、名前と種類だけになります（権限を増やさない方針のため）。
- **0.3.0 の新機能は模擬ページでのみ確認済み**で、実際のドライブではヒューリスティックです：パンくずリストの検出（マイドライブ等のボタンから同じ行のボタンを並べる）、ドライブのレイアウト切り替えボタンのラベル、「おすすめ」の見出し、Gemini チップの aria-label、右側パネルの位置と幅、ファイル種類の判定（aria-label・アイコン・拡張子）。
- アドレス バー：パンくずが見つからない場合は、このセッションで開いたフォルダの記録 → ページタイトルの順で表示します（共有アイテムなどでは `…/フォルダ` になることがあります）。↑ で親が分からない場合はマイドライブへ移動します。
- 「新しいタブで開く」はダブルクリックの 2 回目の mousedown/click を止めてドライブ自身が開かないようにしています。ファイルかどうか確信が持てない項目（種類が判定できないもの）はドライブ標準の動作のままです。ショートカット（フォルダへのショートカット）はファイル扱いになる場合があります。
- ごみ箱へのドロップ：ドライブは独自のマウス操作でドラッグを実装しているため、マウスを離した位置が ごみ箱 の上かで判定し、ドロップした項目（選択中ならその選択全体）にドライブの「ゴミ箱に移動」を実行します。カウンターは概算です（他の端末での削除・完全削除・復元は、ゴミ箱ページを開くまで反映されません）。
- Ctrl+C をリンクのコピーにすると、ドライブ標準の「Ctrl+C / Ctrl+V で項目をコピー」は使えなくなります（ポップアップでオフにできます）。
- **範囲選択（ラバーバンド選択）は未実装**です。ドライブ自身の範囲選択（空白部分からのドラッグ）が使える場所ではそのまま使えます。
- ステータス バーは一覧の下に重ねて表示します。ドライブの構造によっては一覧の最下行の一部に重なることがあります。ツールバーは一覧の上のヘッダーに入れます（入らない場合は一覧の直前に入れて一覧の高さを調整します）。
- ルートへの移動はセッションごとに 1 回だけ（`sessionStorage`）です。アプリ ウィンドウの判定は `display-mode` メディア クエリによります。

### 不具合の報告
1. ポップアップで **「デバッグ：セレクタの一致状況をコンソールに出力」** をオンにし、ドライブのタブを開いたまま DevTools（F12）→ Console の `[DriveExplorer]` ログを確認します。
2. ポップアップの **「現在のドライブタブの診断情報をコピー」** で、ファイル名や ID を含まない構造情報（JSON）がクリップボードにコピーされます。これを報告に貼り付けてください。
3. 詳細パネルが隠れない・プロパティが読めない・アドレス バーが違うなどの場合は、該当の状態（例：ファイルを選択して詳細パネルが開いた状態）で **「ページ構造をコピー」** を押し、その内容も貼り付けてください。
4. メニューやパネルを開いたままの状態が必要な場合は、その状態で **Ctrl+Alt+Shift+S**（またはポップアップの「5 秒後に記録」→ 5 秒以内にメニューを開く）→ ポップアップの **「最後の記録をコピー」**。

---

## English

### Features
1. **Medium icons view** — restyles Drive's own *Grid view* like Win11 Explorer's "Medium icons": compact ~96×110px tiles, 64px thumbnail/icon, file name centred **below** the icon wrapping to 2 lines (Drive moved names above thumbnails in Feb 2026), hover highlight and translucent blue selection box. Drive's DOM is only restyled, never replaced, so native sorting, selection, double-click-to-open and drag & drop keep working.
2. **Windows 11 style context menu** — right-clicking a file/folder shows a rounded Win11-looking menu with icons, separators and shortcut hints: Open, Open in new tab, Download, Rename (F2), Copy link, Share, Move, Add shortcut, Star, Make a copy, File information, Delete, plus **Show Drive menu** (like Win11's "Show more options"). Each item triggers Drive's **real** action by opening Drive's native menu invisibly and clicking the matching item (labels matched in English and Japanese). Esc, outside click or scroll closes it. **Shift + right-click** always shows Drive's own menu. **F2** renames the selected item.
3. **Hide Drive's details side panel** (0.2.0, default on) — the right-hand "Details" pane that opens on click/selection is kept invisible and the file list keeps its full width. The pane still lives inside Drive (it's only taken out of the layout and made transparent), so nothing else in Drive breaks. Toggle in the popup (while on, a pane opened via Drive's own File information → Details is hidden too).
4. **Properties** (0.2.0) — last item of the context menu, or **Alt+Enter** on the selection: a Windows 11 style "<name> Properties" window. General tab: big icon + name, Type, Location, Size, Storage used, Created, Modified, Opened, Owner, Access (sharing summary). Details tab: every field Drive showed. Draggable by the title bar; Esc / OK / Cancel / × close it; follows light/dark.
   - Data comes from Drive's own details pane, opened **invisibly** (File information → Details, or the ⓘ "View details" button), scraped, then closed again (left open if it was already open). Unknown labels are shown as-is; if nothing can be read, a message explains how to see the details in Drive.
5. **Dark mode for Docs / Sheets / Slides** (docs.google.com) — the editors are canvas-rendered, so a filter is used: `invert(1) hue-rotate(180deg)` on the page, with images, video and colour palettes inverted back. Per-app toggles in the popup.
   - For **Drive itself**, use Drive's built-in theme: gear icon → Settings → General → **Appearance → Dark** (or "Device default"). Our tiles and menu follow Drive's light/dark automatically (Drive's background colour, then `prefers-color-scheme`).
6. **More aggressive details-pane hiding** (0.3.0) — for Drive builds without Details/Activity tabs: (a) any `complementary`/`region` whose aria-label is a known pane label (Details, File information, 詳細, ファイル情報 …) is hidden by CSS; (b) a geometry heuristic: a column that appears on the right after you select something (left edge > 60% of the viewport, 250–500px wide, nearly full height), contains a tab, heading or close button, **and** the file list shrank by ≥120px at the same time. The main list, anything containing `role=main` or grid items, iframes and Workspace side panels (Calendar, Keep, Tasks, Contacts, Gemini, add-ons) are never touched.
7. **Explorer toolbar** (0.3.0) — above the list: ← Back, → Forward, ↑ Up, ⟳ Refresh, an address bar and a view switch (Medium icons / Drive list). The address bar shows `/folder/sub` built from Drive's breadcrumbs (My Drive = `/`); every segment is clickable. ↑, **Alt+↑** and **Backspace** (not while typing) go up to the parent; ↑ is disabled at My Drive.
8. **Status bar** (0.3.0) — "15 items | 2 items selected" at the bottom.
9. **Windows 11 file icons** (0.3.0) — in Medium icons view, our own Fluent-style SVGs (yellow folder, doc, sheet, slide, PDF, image, video, audio, zip, text) replace Drive's small type icons; real thumbnails are kept.
10. **Hide suggestions** (0.3.0, default on) — Suggested folders/files, quick access and Gemini/Workspace chips on Home and My Drive (label table `SUGGEST` in `selectors.js`).
11. **Open files in a new tab** (0.3.0) — double-click / Enter / menu Open on a non-folder opens it in a new tab (or new window, or Drive's default). Folders still navigate in place. A background service worker uses `chrome.tabs.create` / `chrome.windows.create` (no extra permission); from an installed-app window it opens a normal browser window.
12. **Recycle Bin** (0.3.0) — a desktop-style bin tile at the bottom-right of the list. Double-click (or Enter) opens Drive's Trash. Drop items on it to run Drive's own "Move to trash" (Ctrl+Z or Drive's Undo restores). The empty/full icon comes from an approximate local counter (`chrome.storage.local`) that resyncs when you visit Trash. Its context menu has Open and **Empty Recycle Bin, which only opens the Trash page**; it never deletes anything by itself.
13. **Start in My Drive** (0.3.0) — in an installed Drive app window (`display-mode` standalone / window-controls-overlay / minimal-ui), landing on Home redirects once per session to `drive/u/N/my-drive` (default on); optional for normal tabs (default off).
14. **Keyboard** (0.3.0) — **Ctrl+C** copies the selected items' link (option, default on; normal copy while text is selected or you're typing), **Enter** opens, **F2** renames, **Alt+Enter** = Properties. **Delete** (Drive's own move to trash) and **Ctrl+A** (Drive's select all) are left native.
15. **Copy page structure** (0.3.0) — popup button that copies a sanitized DOM skeleton of the current Drive page: tags, roles, aria-* names, aria-labels of UI chrome, data-* names, class names, rects and child counts, depth ≤ 12, ≤ ~200 KB. File/folder names, IDs and e-mail addresses are removed; text is kept only for known UI labels (tabs, buttons, menu items, headings). The right-hand panel, if open, is dumped first.
16. **Matched to the real Drive DOM** (0.3.1) — based on two real "page structure" dumps: the details pane is found by `role=complementary aria-label="詳細ウィンドウ"/"Details window"` plus its close hook `data-target=hideDetails`; its body is also read when it sits in an iframe (same-origin directly; a cross-origin drive/docs.google.com frame answers through a tiny all-frames helper via `postMessage`), and if it can't be read, Properties still shows name + type from the pane header (with a note). Breadcrumbs are found in the header block **above** the list (title row + `role=toolbar` row). The Explorer toolbar is inserted at the end of that header so the list's bottom isn't pushed off-screen. Selection-toolbar buttons inside `role=toolbar` are preferred. If no list/grid button is found, the view switch uses Drive's **v** shortcut.
17. **Better page-structure capture** (0.3.1) — focused sections first, 25–40 levels deep: the details pane (**label texts kept, values stripped**), the header above the list, the path from `role=main` to the first item plus the first items, open menus, the native menus Drive Explorer opened invisibly, and a detection summary. Iframes are listed (host/path, same-origin or not) and same-origin ones are walked. To capture while a menu or the pane is open, press **Ctrl+Alt+Shift+S** or use the popup's **Capture in 5 s**, then **Copy last capture**.

### Install (Load unpacked)
1. Unzip `drive-explorer-0.3.1.zip` somewhere (you need the folder that contains `manifest.json`).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).
5. **Reload** any Drive / Docs tabs that were already open.
6. Pin Drive Explorer from the puzzle-piece menu; the popup has all toggles.

### Permissions
Only `storage` (settings in `chrome.storage.sync`, the bin counter in `chrome.storage.local`) and host access to `https://drive.google.com/*` and `https://docs.google.com/*`. No network requests, no OAuth, no access to your account data.

### Known limitations
- **Not yet verified on the live Drive.** Drive's class names are obfuscated and change often, so the code relies on comparatively stable hooks (`role`, `aria-*`, `data-id`, `data-target`) plus size/text heuristics. A Drive update can break it; all DOM knowledge lives in `src/drive/selectors.js`.
- Medium icons applies to Grid view only (List view is unchanged). Drive's rows are flattened into one wrapping flow, so **arrow-key navigation** still follows Drive's internal rows and may not match what you see.
- Menu actions work by driving Drive's native menu with synthetic events. If Drive ignores them, the extension falls back to the selection toolbar button, then Drive's keyboard shortcut, then a custom fallback (e.g. building the link for Copy link). If everything fails a toast appears — use **Show Drive menu** or Shift + right-click.
- The shortcut hints (Z, S, ".") are Drive's own single-key shortcuts; F2 (rename) is added by this extension.
- "Star" toggles (it runs whichever of Add to / Remove from Starred Drive offers).
- Shared drives, Trash, search results etc. have different native menus; some items may not be available there (e.g. use "Show Drive menu" for Restore in Trash).
- "Open in new tab" opens `https://drive.google.com/open?id=…` (folders: `/drive/folders/…`), keeping the `/u/N/` account index.
- "Open" works by synthesising a double-click.
- The details pane is recognised by its Details/Activity tabs (or a role=complementary landmark) plus geometry (a narrow column on the right that never contains the file list). If Drive's structure differs, the pane is simply shown as usual and Properties reports that it couldn't read the details. The pane may flash for a frame before it's hidden.
- Property values are shown exactly as Drive formats them (no byte counts like Windows). The name field is read-only (use F2 to rename). Properties for multiple selected items isn't supported.
- If Drive itself doesn't turn dark: this extension doesn't darken Drive. Use Drive's gear → Settings → General → Appearance → Dark (some accounts may not have this setting yet).
- Editor dark mode: in Chromium, Docs paints document **images into the canvas, so they stay inverted** (same limitation as DocsAfterDark's invert mode). The whole UI including toolbars is inverted and the page background becomes pure black. To avoid a white flash, a tiny flag (`dxe-dark-docs`, …) is cached in docs.google.com's localStorage.
- **0.3.1 matched the details pane, the header (breadcrumb/toolbar placement) and the exclusion of the right rail / transcript sidebar to the real DOM (two dumps).** Still guessed, because the dumps didn't contain them: the pane body's content (iframe or not, label texts), file items' inner structure, the breadcrumb element type, the list/grid button labels, Drive's native menu labels and the suggestion headings. If the pane body is an iframe from an origin other than drive/docs.google.com it can't be read (we don't add permissions), and Properties shows name + type only.
- **The 0.3.0 features were verified against the mock only**; on the live Drive these parts are heuristic: breadcrumb detection (a root button such as My Drive plus same-line buttons), Drive's layout toggle labels, suggestion headings, Gemini chip aria-labels, right-pane geometry, and file-type detection (aria-label, icon, extension).
- Address bar: when no breadcrumbs are found it falls back to folders learned in this session, then the page title (e.g. `…/folder` under Shared with me). If the parent is unknown, ↑ goes to My Drive.
- Open in new tab swallows the second mousedown/click of a double-click so Drive doesn't also open the file in place. Items whose type can't be determined confidently keep Drive's default behaviour. Shortcuts to folders may be treated as files.
- Drop on the bin: Drive implements dragging with its own mouse handling, so the drop is detected by where the mouse is released; Drive's "Move to trash" then runs for the dragged item (or the whole selection if it was selected). The counter is approximate: deletions on other devices, permanent deletes and restores show up only after you open Trash.
- With Ctrl+C = copy link, Drive's own Ctrl+C / Ctrl+V item copy is unavailable (turn it off in the popup).
- **Rubber-band selection is not implemented**; Drive's own drag-select (where Drive offers it) still works.
- The status bar is overlaid at the bottom and may cover part of the last row in some layouts. The toolbar goes into the header above the list (or, if that header has a fixed height, right before the list with the list's height reduced to fit).
- The root redirect happens once per browser session (`sessionStorage`); the app-window check uses the `display-mode` media query.

### Reporting issues
1. In the popup turn on **Debug: log selector matches to the console**, then check `[DriveExplorer]` lines in DevTools (F12) → Console on the Drive tab.
2. Click **Copy diagnostics from current Drive tab** in the popup: a JSON with the DOM *structure* only (no file names, no ids) is copied to the clipboard — paste it into your report.
3. If the details pane isn't hidden, Properties can't read, or the address bar is wrong: reproduce the state (e.g. select a file so the pane opens), click **Copy page structure** and paste that text too.
4. For states that need a menu or the pane open: press **Ctrl+Alt+Shift+S** in that state (or popup **Capture in 5 s**, then open the menu within 5 s), then popup **Copy last capture**.

---

## Development

```
manifest.json
src/common/settings.js     settings (chrome.storage.sync) + debug logger
src/drive/early.js         document_start capture listeners (run before Drive's)
src/drive/selectors.js     ★ ALL Drive DOM knowledge: selectors, EN/JA labels (menu + details pane), action table
src/drive/theme.js         light/dark detection for our UI
src/drive/tiles.js         Medium icons: tags Drive's grid with data-dxe-* (MutationObserver)
src/drive/drive.css        Medium icons styles (scoped to html.dxe-medium)
src/drive/native-actions.js drives Drive's real menu / toolbar / shortcuts
src/drive/context-menu.js  Win11 menu UI (shadow DOM)
src/drive/scrape-core.js   label/value scraping shared by details.js and frame-scrape.js
src/drive/frame-scrape.js  all_frames helper: answers scrape requests for a pane body in an iframe
src/drive/details.js       details side pane: detect/suppress, invisible open + scrape (pane + iframes)
src/drive/properties.js    Win11 Properties dialog (shadow DOM)
src/drive/root-redirect.js document_start: Home → My Drive once (app window / optional tabs)
src/drive/fluent-icons.js  Fluent-style SVG icons (folder, doc, sheet, …, bin)
src/drive/structure.js     "Copy page structure" sanitized DOM skeleton
src/drive/toolbar.js       Explorer toolbar: back/forward/up/refresh, /path address bar, view switch
src/drive/suggestions.js   hides Suggested / quick access / Gemini chips
src/drive/open-files.js    open non-folders in a new tab/window (dblclick / Enter / Open)
src/drive/recycle.js       Recycle Bin tile (drop to delete, open Trash)
src/drive/statusbar.js     "N items | M selected"
src/drive/main.js          wiring, F2, Alt+Enter, Ctrl+C, diagnostics
src/background.js          service worker: chrome.tabs/windows.create for open-files
src/docs/docs-dark.{js,css} editor dark mode
popup/                     settings popup
test/                      mock Drive/Docs pages + headless tests (not shipped)
scripts/build-zip.sh       builds ../out/drive-explorer-<ver>.zip
```

Tests (need Chrome + playwright-core): `node test/run-screenshots.mjs <outDir>` (scripts injected into the mocks) and `node test/run-real-extension.mjs <outDir>` (the real unpacked extension, with drive/docs.google.com answered locally by the mocks).

## Changelog
- **0.3.1** — Matched to the real Drive DOM from two user dumps: details pane via `aria-label="詳細ウィンドウ"` + `data-target=hideDetails`, pane open-state measured through our hiding CSS, header name/type, iframe-aware scraping (+ all-frames helper), partial Properties instead of failure; breadcrumbs from the header above `role=main`; toolbar placed in that header (main height compensation fallback); `role=toolbar` buttons preferred; `v` view-switch fallback; side rail / transcript sidebar / hidden viewer excluded. Page structure: focused deep sections, pane label texts, iframes, native-menu snapshots, summary, Ctrl+Alt+Shift+S and delayed capture. Mock rebuilt to the real structure.
- **0.3.0** — "Copy page structure"; aria-label + right-column heuristics for hiding the details pane; Explorer toolbar with /path address bar, Alt+↑/Backspace; status bar; Fluent file icons; hide suggestions; open files in new tab/window (service worker); Recycle Bin tile; start in My Drive (app window); Ctrl+C copies link.
- **0.2.0** — Hide Drive's details side panel (toggle, default on); Properties dialog (context menu + Alt+Enter) fed by Drive's details pane; details info in diagnostics.
- **0.1.0** — Medium icons view, Win11 context menu, editor dark mode.

## License
MIT © 2026 zmlworks — see [LICENSE](LICENSE).
