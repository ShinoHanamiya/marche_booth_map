# Marche Booth Map v1.7

1つのマルシェ会場内の出店者を、SVG会場マップと一覧から探せる静的Webアプリです。GitHub Pagesなどの静的ホスティングへそのまま公開できます。

## v1.7 追加機能
### View
- ブース共有URLを生成（`?booth=A01` 形式）
- 共有URLから対象ブースを直接表示
- URLで開いたブースへ自動フォーカスし、詳細を自動表示
- 出店者ごとの `tags` 配列に対応
- タグ絞り込み（複数選択・OR条件）
- キーワード検索対象にタグを追加
- 地図方向を 0° / 90° / 180° / 270° の4段階で変更
- 回転後も「マップで見る」とURL直接表示のフォーカス位置を追従

### Edit
- 出店者編集フォームへ「タグ（カンマ区切り）」を追加
- `tags` 配列を `exhibitors.json` へ保存
- v1.6のUndo/Redo、コピー＆ペースト、範囲選択、背景画像、レイヤー、Delete削除を維持

## 出店者データ例
```json
{
  "booth_id": "A01",
  "shop_name": "Dolly Ribbon",
  "categories": ["ドール", "アクセサリー"],
  "keywords": ["リボン", "MDD"],
  "tags": ["限定品あり", "ドール撮影OK"],
  "instagram_urls": [
    "https://www.instagram.com/dolly_ribbon_main/",
    "https://www.instagram.com/dolly_ribbon_sub/"
  ]
}
```

## 共有URL
公開URLが以下の場合:

`https://example.github.io/marche_booth_map/`

A01の共有URLは次の形式です:

`https://example.github.io/marche_booth_map/?booth=A01`

詳細画面または一覧の「共有」から生成できます。対応ブラウザではOSの共有画面を開き、それ以外はURLをクリップボードへコピーします。

## タグとカテゴリの使い分け
- カテゴリ: 「ドール」「フード」など、何のお店かを表す大分類
- タグ: 「限定品あり」「キャッシュレス」「ぬい撮りOK」など、お店の特徴

タグを複数選択した場合は、選択したタグの**いずれか**を持つ出店者を表示します。

## 地図方向
Viewの地図ツールバーから 0° / 90° / 180° / 270° を選択できます。これは表示だけを変更し、`venue.json` のブース座標は変更しません。

## 起動方法
### 閲覧画面
`start_local_server.bat` をダブルクリックし、`http://localhost:8000/` を開きます。

### 編集画面
`start_editor.bat` をダブルクリックし、`http://localhost:8000/editor.html` を開きます。

JSONをfetchするため、HTMLファイルの直接ダブルクリックではなくHTTPサーバーを利用してください。

## GitHub Pages
`index.html` がリポジトリの公開ルートに来るようにアップロードし、Settings → Pages → Deploy from a branch → `main` / `/ (root)` を指定します。

## 個人状態
「行きたい」「行った」は各閲覧者のブラウザのlocalStorageへ保存し、公開JSONには書き込みません。

## マニュアル
- `manual/editor_manual.html`: 編集者向け
- `manual/viewer_manual.html`: 閲覧者向け

## 変更履歴
- v1.7: ブース共有URL、URL直接表示、タグ・タグ絞り込み、地図4方向回転、Editのタグ入力を追加。
- v1.6: Undo/Redo、コピー＆ペースト、ドラッグ範囲選択、背景画像、レイヤー表示/ロック、Delete削除。
- v1.5.2: 1ブースの複数Instagram URLに対応。
- v1.5.1: PCブラウザでブースクリックがマップ操作に横取りされる問題を修正。
- v1.5: 「行きたい / 行った」、未訪問表示、件数表示、localStorage保存。
- v1.4: 会場サイズGUI編集、プリセット、自動フィット、自動拡張、可変viewBox対応。
- v1.3: 直接リサイズ、複数選択、整列、等間隔、サイズ統一、行列生成。
- v1.2: 設備・通路のGUI編集。
- v1.1: GUI編集画面、JSON入出力、自動保存、検証。
- v1: SVGマップ、検索、カテゴリ、一覧連動、お気に入り、レスポンシブ対応。
