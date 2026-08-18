# Marche Booth Map v1.10

複数のマルシェ・イベントを1つの静的Webサイトで公開できる、会場ブースマップです。GitHub Pagesなどの静的ホスティングで公開できます。

> 本アプリは有志が作成した非商用アプリです。掲載しているお店情報・リンク等には、誤りや変更が含まれる場合があります。最新・正確な情報は、各出店者およびイベント主催者の公式情報をご確認ください。

## v1.10 の主な変更

- Viewのイベント一覧にイベント名・会場・地域のキーワード検索を追加
- 都道府県フィルターを追加
- 開催日範囲フィルターを追加
- 過去イベントを含む状態別表示を維持し、「日付から状態を自動更新」をEvent Managerへ追加
- `event.json / events.json` に `prefecture` と `city` を追加
- 会場テンプレート機能を追加
- 新規イベントを「空 / テンプレート / 既存イベント複製」から作成可能
- 現在のイベント会場を新しい会場テンプレートとして保存可能
- 会場テンプレートを既存イベントへ適用可能
- `data/venue_templates.json` と `data/venue_templates/` を追加
- 標準ホール / 横長ホール / 小規模スペースのサンプルテンプレートを付属
- v1.9までのEvent Manager、複数イベントView、共有URL、タグ、地図回転、お気に入り、Editor機能を維持

## フォルダ構成

```text
marche_booth_map_v1_10/
├─ index.html
├─ event_manager.html
├─ editor.html
├─ data/
│  ├─ events.json
│  ├─ venue_templates.json
│  ├─ venue_templates/
│  │  ├─ standard_hall.json
│  │  ├─ wide_hall.json
│  │  └─ compact_space.json
│  └─ events/
│     ├─ sample_flower_marche_2026/
│     │  ├─ event.json
│     │  ├─ venue.json
│     │  └─ exhibitors.json
│     └─ sample_craft_marche_2026/
│        ├─ event.json
│        ├─ venue.json
│        └─ exhibitors.json
├─ css/
│  ├─ style.css
│  ├─ editor.css
│  └─ event_manager.css
├─ js/
│  ├─ config.js
│  ├─ app.js
│  ├─ editor.js
│  └─ event_manager.js
├─ manual/
│  ├─ editor_manual.html
│  └─ viewer_manual.html
├─ start_local_server.bat
└─ start_editor.bat
```

## 推奨編集方法

1. `start_editor.bat` をダブルクリックします。
2. `http://localhost:8000/event_manager.html` が開きます。
3. Chrome / Edgeで「プロジェクトフォルダを接続」を押します。
4. 展開した `marche_booth_map_v1_10` フォルダそのものを選択します。
5. イベントの作成・複製・削除・情報編集を行います。
6. 「会場レイアウト編集」から対象イベントのEditorを開きます。
7. GitHubへcommit / pushして公開ページを更新します。

### フォルダ直接編集を使わない場合

イベント管理画面は公開中のJSONを読み込めます。編集後に `events.json`、`event.json`、`venue.json`、`exhibitors.json` をダウンロードし、対応するフォルダへ手動配置してください。

## 会場テンプレート

`data/venue_templates.json` がテンプレート一覧、`data/venue_templates/*.json` が実際の会場レイアウトです。Event Managerから新規イベントへ適用したり、現在の会場を新しいテンプレートとして保存できます。

## Viewのイベント検索

イベント一覧では状態に加えて、イベント名・会場・地域の検索、都道府県、開始日・終了日で絞り込めます。地域検索のため、イベント情報には `prefecture` と `city` の登録を推奨します。

## イベントデータ

イベントごとに以下の3ファイルを使用します。

- `event.json`: イベント名、開催日、会場名、状態、説明、公式URLなど
- `venue.json`: 会場サイズ、ブース、設備、通路
- `exhibitors.json`: 出店者情報、タグ、Instagram URL等

イベント一覧は `data/events.json` で管理します。

## イベント状態

- `upcoming`: 開催予定
- `ongoing`: 開催中
- `past`: 過去イベント

## URL

イベントだけを開く:

```text
?event=sample_flower_marche_2026
```

特定ブースを直接開く:

```text
?event=sample_flower_marche_2026&booth=A01
```

Editorでイベントを指定:

```text
editor.html?event=sample_flower_marche_2026
```

## ローカル起動

- View: `start_local_server.bat`
- Event Manager / Editor: `start_editor.bat`

HTMLを直接ダブルクリックするとブラウザのセキュリティ制限でJSONを読めない場合があります。必ずHTTPサーバー経由で開いてください。

## GitHub Pages

リポジトリ直下に `index.html` が来るようにアップロードし、GitHubの `Settings > Pages` で `main / (root)` を公開元に設定します。

イベント管理画面やEditorは認証機能を持たないため、GitHub Pagesへ含める場合はURLを知っている人が開けます。ただし静的Web上のEditorからGitHub上のファイルを直接変更することはできません。ローカルコピーを編集してからGitHubへpushしてください。

## Change Log

### v1.10
- Viewにイベント検索・都道府県・開催日範囲フィルターを追加
- イベントの都道府県・市区町村情報に対応
- 日付からイベント状態を自動更新する機能を追加
- 会場テンプレート一覧・テンプレートファイル構造を追加
- 新規イベントをテンプレートから作成可能
- 既存会場のテンプレート保存・イベントへの適用に対応

### v1.8
- 複数イベントデータ構造
- イベント選択View
- イベント別共有URL、お気に入り・訪問済み保存
