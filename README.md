# Marche Booth Map v1.9

複数のマルシェ・イベントを1つの静的Webサイトで公開できる、会場ブースマップです。GitHub Pagesなどの静的ホスティングで公開できます。

> 本アプリは有志が作成した非商用アプリです。掲載しているお店情報・リンク等には、誤りや変更が含まれる場合があります。最新・正確な情報は、各出店者およびイベント主催者の公式情報をご確認ください。

## v1.9 の主な変更

- `event_manager.html` を新設
- イベント一覧をGUIで管理
- 新規イベント作成
- 選択イベントの複製
- イベント削除
- `event.json` のGUI編集
- `events.json` の一覧情報を同期
- `editor.html?event=<event_id>` で任意イベントを編集
- Editorで `event.json / venue.json / exhibitors.json` の3ファイルを読込・保存
- Chrome / Edge の File System Access API に対応し、ローカルプロジェクトフォルダへイベントファイルを直接作成・更新・削除可能
- フォルダ接続を使用しない場合もJSONダウンロード方式で運用可能
- v1.8までの複数イベントView、共有URL、タグ、複数Instagram URL、4方向回転、お気に入り機能を維持
- v1.6までのEditor操作（Undo / Redo、コピー＆ペースト、範囲選択、背景、レイヤー、Delete等）を維持

## フォルダ構成

```text
marche_booth_map_v1_9/
├─ index.html
├─ event_manager.html
├─ editor.html
├─ data/
│  ├─ events.json
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
4. 展開した `marche_booth_map_v1_9` フォルダそのものを選択します。
5. イベントの作成・複製・削除・情報編集を行います。
6. 「会場レイアウト編集」から対象イベントのEditorを開きます。
7. GitHubへcommit / pushして公開ページを更新します。

### フォルダ直接編集を使わない場合

イベント管理画面は公開中のJSONを読み込めます。編集後に `events.json`、`event.json`、`venue.json`、`exhibitors.json` をダウンロードし、対応するフォルダへ手動配置してください。

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

### v1.9
- Event Managerを追加
- 新規イベント / 複製 / 削除をGUI化
- event.json編集をGUI化
- events.json同期機能を追加
- File System Access APIによるローカルプロジェクト直接編集に対応
- Editorを `?event=` によるイベント切替へ変更
- Editorでevent.jsonを含む3ファイルの保存に対応

### v1.8
- 複数イベントデータ構造
- イベント選択View
- イベント別共有URL、お気に入り・訪問済み保存
