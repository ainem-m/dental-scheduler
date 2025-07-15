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
- **フロントエンド (Vite + Vue):** `client/`ディレクトリにVue3の基本的なファイル構成を作成済み。

## 4. データベース (SQLite + Knex)
- **設定とマイグレーション:**
  - `knexfile.js`をプロジェクトルートに作成。
  - `users`テーブルと`reservations`テーブルを作成するマイグレーションファイル (`..._initial_schema.js`) を作成し、実行済み。
- **DBファイル:** マイグレーションの結果、`data/dev.sqlite3`が正しく作成されている。
- **サーバーからの接続:** Expressサーバーからデータベースへの接続を確立済み (`Database connected successfully.`のログを確認)。
- **テストデータ投入 (Seeding):**
  - パスワードハッシュ化のため`bcrypt`をインストール済み。
  - `admin`と`staff`の2ユーザーを`users`テーブルに登録するシードファイルを作成し、実行済み。

## 現在の状態
- Dockerベースの安定した開発環境が稼働中。
- `sudo docker compose up -d`で全ての開発環境が起動する。
- SQLiteデータベースには、スキーマ定義済みの`users`, `reservations`テーブルが存在し、`users`テーブルにはテストデータが投入されている。
- **APIエンドポイントの実装に着手できる状態。**
