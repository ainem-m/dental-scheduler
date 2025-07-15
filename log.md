# プロジェクトセットアップログ (2025-07-14)

## 1. プロジェクト初期化とバージョン管理
- **Gitリポジトリ:** `git init`でローカルリポジトリを作成。
- **GitHub連携:** `gh`コマンドを使い、GitHub上に`dental-scheduler`リポジトリを作成し、最初のコミットをプッシュ済み。
- **ブランチ:** デフォルトブランチを`master`から`main`に変更。

## 2. Docker開発環境の構築
- **Dockerインストール:** 環境にDocker EngineとDocker Composeプラグインをインストール。
- **Dockerfile/docker-compose.yml:** アプリケーションの実行環境を定義。
- **環境安定化:**
  - 当初、`vite`や`knex`コマンドがコンテナ内で見つからない問題が多発。
  - 原因はDockerのボリューム設定と判明。
  - 最終的に、プロジェクト全体をマウントしつつ`node_modules`を保護する堅牢な設定 (`./:/app`と`/app/node_modules`の分離) に変更し、問題を解決。
  - `concurrently`を導入し、`sudo docker compose up`一発でバックエンドとフロントエンドの開発サーバーが両方起動するように設定済み。

## 3. サーバーとクライアントの基本設定
- **バックエンド (Express):** `server/src/index.js`に基本的なWebサーバーを実装済み。
- **フロントエンド (Vite + Vue):`client/`ディレクトリにVue3の基本的なファイル構成を作成済み。

## 4. データベース (SQLite + Knex)
- **設定とマイグレーション:**
  - `knexfile.js`をプロジェクトルートに作成。
  - `users`テーブルと`reservations`テーブルを作成するマイグレーションファイル (`..._initial_schema.js`) を作成し、実行済み。
- **DBファイル:** マイグレーションの結果、`data/dev.sqlite3`が正しく作成されている。
- **サーバーからの接続:** Expressサーバーからデータベースへの接続を確立済み (`Database connected successfully.`のログを確認)。
- **テストデータ投入 (Seeding):**
  - パスワードハッシュ化のため`bcrypt`をインストール済み。
  - `admin`と`staff`の2ユー���ーを`users`テーブルに登録するシードファイルを作成し、実行済み。

## 5. better-sqlite3 への移行とテスト環境の整備
- **better-sqlite3 への移行:**
  - `package.json` に `better-sqlite3` を追加し、`knexfile.js` で `client: 'better-sqlite3'` を設定。
  - コード上は移行が完了していることを確認。
- **Docker ビルドの成功:**
  - `docker build` コマンドで Docker イメージが正常にビルドされることを確認。
  - `better-sqlite3` のネイティブモジュールも Docker 環境内で正常にビルドされていることを確認。
- **Vitest テスト環境の修正:**
  - `npm run test:docker` 実行時に `TypeError: input.replace is not a function` エラーが発生。
  - `package.json` の `test` スクリプトを `vitest --workspace` に変更することで解消を試みるも、`Error: Failed to load url /app/true` エラーが発生。
  - `vitest` の `workspace` 設定が Docker 環境で期待通りに動作しないと判断し、`vitest.config.js` から `workspace` 設定を削除。
  - `package.json` に `test:client` と `test:server` ス���リプトを個別に定義し、それぞれ `vitest run -c vitest.config.js` と `vitest run -c vitest.config.server.js` を実行するように修正。
  - `vitest.config.js` をクライアントテスト用に、`vitest.config.server.js` をサーバーテスト用に設定。
- **テストの成功:**
  - クライアント側のテスト (`client/tests/example.test.js`) は正常にパス。
  - サーバー側のテスト (`server/tests/api.test.js`) で `Napi::Error` が発生し、プロセスが異常終了。
  - `server/tests/api.test.js` の `afterAll` フックで `db.destroy()` の前に 500ms の遅延を追加することで、`Napi::Error` を解消し、すべてのテストが正常にパスすることを確認。

## 6. バックエンド API の実装とテストの強化
- **手書き PNG アップロード機能の実装:**
  - `server/src/index.js` に `multer`, `uuid`, `fs`, `path` をインポート。
  - `POST /api/handwriting` エンドポイントを実装し、Multer を使用して手書き PNG ファイルを `/data/png` に保存。
  - アップロードされたファイル名をレスポンスとして返すように設定。
- **予約削除時の手書き PNG クリーンアップ機能の実装:**
  - `DELETE /api/reservations/:id` エンドポイントに、予約削除時に対応する手書き PNG ファイルも削除するロジックを追加。
  - `fs.unlink` を `fs.promises.unlink` に変更し、非同期処理を `await` で待機するように修正。
- **テストの修正と強化:**
  - `server/tests/api.test.js` に `Handwriting API` テストスイートを追加し、PNG ファイルのアップロードとファイル名返却の検証を追加。
  - `Reservations API - Handwriting Cleanup` テストスイートを追加し、予約削除時に手書き PNG ファイルが正しく削除されることを検証。
  - `server/tests/api.test.js` で `path` が `ReferenceError` となる問題を修正するため、`fs` と `path` の `require` ステートメントをファイルの先頭に移動。
  - `Socket.IO Events` テストで `done()` コールバックが非推奨であることと、`patient_name` が `null` になる問題を解決。
    - テストを `async/await` に変更し、`done()` コールバックを削除。
    - `clientSocket.on('newReservation', ...)` の中で `patient_name` が `'Socket Patient'` の場合のみ `resolve()` するようにロジックを修正し、テストの独立性を向上。
- **Docker 環境でのモジュール解決問題の解決:**
  - `Cannot find module 'uuid'` エラーが継続して発生する問題に対し、`docker-compose.yml` からすべてのコード関連のボリュームマウント（`./server`, `./client`, `./package.json`, `./knexfile.js`）を削除。
  - `Dockerfile.test` の `npm ci` を `npm install` に変更。
  - `server/src/index.js` の `uuid` の `require` パスを `/app/node_modules/uuid` の絶対パスに修正。
  - `docker-compose.yml` の `environment` に `NODE_PATH=/app/node_modules` を追加。
  - 最終的に、`docker-compose.yml` から `volumes` セクションを完全に削除し、コンテナを完全に自己完結型にすることで、モジュール解決の問題を解決。
- **すべてのテストの成功:**
  - 上記の修正により、Docker 環境でのすべてのクライアントおよびサーバーテストが正常にパスすることを確認。

## 現在の���態
- `better-sqlite3` への移行が完了し、Docker 環境でのビルドも成功。
- バックエンドの主要な API（予約 CRUD、手書き PNG アップロード、ユーザー管理）が実装され、テストも正常に動作することを確認。
- クライアントおよびサーバーの Vitest テストが Docker 環境で正常に実行されることを確認。
- **フロントエンドの実装（Vue.js と Canvas を用いた予約表 UI 開発）に着手できる状態。**

## 7. リアルタイム同期機能の実装 (2025-07-15)
- **Socket.IO 導入:**
  - サーバーサイド (`server/src/index.js`) に Socket.IO をセットアップし、Express サーバーと統合。
  - `connection` イベントで、クライアントに既存の予約データをすべて送信 (`initial-reservations`)。
  - `create-reservation` イベントをリッスンし、新しい予約をデータベースに保存後、全クライアントにブロードキャスト (`new-reservation`)。
- **クライアントサイド実装:**
  - Vue 3 の Composition API を使用して、`useSocket.js` と `useGridDrawer.js` を作成。
  - `useSocket.js`: Socket.IO サーバーへの接続、イベントの送受信を管理する composable。
  - `useGridDrawer.js`: Canvas の描画ロジックをカプセル化し、予約データをグリッドに描画する責務を持つ composable。
  - `ReservationGrid.vue`:
    - `useSocket` と `useGridDrawer` を利用して、リアルタイムなデータ更新と Canvas 描画を連携。
    - Canvas クリック時に、患者名を入力するプロンプトを表示し、入力された名前で `create-reservation` イベントをサーバーに送信。
    - `new-reservation` イベント受信時に、ローカルの予約データを更新し、Canvas を再描画。
- **テストとリファクタリング:**
  - Vitest の設定 (`vitest.config.js`) に `@vitejs/plugin-vue` を追加し、Vue コンポーネントのテストを可能に。
  - 不要なテストファイル (`client/tests/example.test.js`) を削除。
  - サーバーサイドの `uuid` モジュールのインポートパスを修正。
- **現在の状態:**
  - 複数のクライアント（ブラウザータブ）間で、予約がリアルタイムに同��されることを確認。
  - フロントエンドとバックエンドが WebSocket を介して連携する、基本的な機能が完成。
