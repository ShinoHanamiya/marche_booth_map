# Marche Booth Map v1.8

複数のマルシェ・イベントを1つの静的Webサイトで公開できる、会場ブースマップです。
GitHub Pages等の静的ホスティングで公開できます。

> 本アプリは有志が作成した非商用アプリです。掲載しているお店情報・リンク等には、誤りや変更が含まれる場合があります。最新・正確な情報は、各出店者およびイベント主催者の公式情報をご確認ください。

## v1.8 の主な変更

- 複数イベント対応
- `data/events.json` によるイベント一覧管理
- イベント選択画面を追加
- イベント状態（すべて / 開催予定 / 開催中 / 過去）の表示切替
- イベントごとに `event.json / venue.json / exhibitors.json` を分離
- ブース共有URLを `?event=<event_id>&booth=<booth_id>` 形式へ変更
- URLからイベントとブースを直接表示
- 「行きたい」「行った」をイベントごとに分離保存
- v1.7.1までの単一イベントお気に入りは既定サンプルイベントへ移行
- v1.7.1のタグ、複数Instagram URL、4方向回転、View機能を維持
- v1.6までのEditor機能を維持

## フォルダ構成

```text
marche_booth_map_v1_8/
├─ index.html
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
├─ js/
├─ manual/
├─ start_local_server.bat
└─ start_editor.bat
```

## 新しいイベントを追加する方法

1. `data/events/` に半角英数字の新規フォルダを作成します。
2. そのフォルダへ `event.json`, `venue.json`, `exhibitors.json` を配置します。
3. `data/events.json` にイベント概要を1件追加します。
4. ローカルサーバーで表示を確認します。
5. GitHubへpushするとGitHub Pagesへ反映できます。

例:

```text
data/events/takasaki_autumn_2026/
├─ event.json
├─ venue.json
└─ exhibitors.json
```

`event.json` の例:

```json
{
  "event_id": "takasaki_autumn_2026",
  "name": "高崎 Autumn Marche 2026",
  "date_start": "2026-10-10",
  "date_end": "2026-10-10",
  "time": "10:00-16:00",
  "venue_name": "Sample Hall",
  "status": "upcoming",
  "description": "イベント説明"
}
```

`events.json` の `event_id` とイベントフォルダ名、`event.json` の `event_id` は同じ値にしてください。

## イベント状態

`events.json` の `status` は以下を使用します。

- `upcoming`: 開催予定
- `ongoing`: 開催中
- `past`: 終了 / 過去イベント

## 共有URL

イベントのみ:

```text
https://example.github.io/marche_booth_map/?event=sample_flower_marche_2026
```

特定ブース:

```text
https://example.github.io/marche_booth_map/?event=sample_flower_marche_2026&booth=A01
```

## Editorについて

v1.8のEditorは、複数イベント管理画面ではなく「1イベントを編集する従来型Editor」を維持しています。
初期状態では `sample_flower_marche_2026` を編集対象に設定しています。
別イベントをEditorで編集する場合は、`js/config.js` の以下を対象イベントへ変更してください。

- `venueFile`
- `dataFile`
- `editorDraftKey`

イベントの新規作成・複製・削除をGUIで行う機能は次段階の拡張対象です。

## ローカル起動

Windowsでは `start_local_server.bat` をダブルクリックしてください。
通常は `http://localhost:8000/` が開きます。

Editorは `start_editor.bat` から起動できます。

## GitHub Pages

リポジトリ直下に `index.html` が来るように全ファイルをアップロードし、Settings > Pages で `main` / `(root)` を公開元に設定してください。

## Change Log

### v1.8
- 複数イベントデータ構造を追加
- イベント選択Viewを追加
- イベント別共有URLに対応
- イベント別お気に入り・訪問済み保存に対応
- `event.json` を導入

### v1.7.1
- 有志制作・非商用・掲載情報に誤りの可能性がある旨をView/README/マニュアルへ追加
