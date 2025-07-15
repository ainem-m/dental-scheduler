# Dental Scheduler

歯科医院向けのリアルタイム予約管理アプリケーションです。
LAN内で動作し、複数のiPadから同時にアクセスして、手書きまたはテキストで予約を管理できます。

![Architecture Diagram](https://user-images.githubusercontent.com/12345/architecture.png)  
*アーキテクチャ図 (GEMINI.md より)*

---

## 🎯 主な機能

- **リアルタイム同期**: WebSocket (Socket.IO) を利用し、200ms以内での高速な端末間同期を実現。
- **手書き入力**: Apple Pencil等でキャンバスに直接書き込み、PNG画像として保存。
- **柔軟な予約表**: 日単位で、列数や時間枠を柔軟に設定可能。
- **オフライン動作**: インターネット接続が不要なLAN完結型アーキテクチャ。
- **Dockerによる簡単導入**: `docker-compose` コマンド一つでアプリケーションを起動可能。

---

## 💻 技術スタック

| レイヤ         | 採用技術                               |
| :------------- | :------------------------------------- |
| **フロントエンド** | Vue 3 (Composition API) + Vite         |
| **手書き機能**   | HTML5 Canvas API                       |
| **サーバ/API**   | Node.js + Express                      |
| **双方向通信**   | Socket.IO (WebSocket)                  |
| **データベース** | SQLite 3 (via Knex.js)                 |
| **認証**         | Basic認証 + bcrypt                     |
| **テスト**       | Vitest, Vue Test Utils, Supertest, Playwright |
| **コンテナ**     | Docker, Docker Compose                 |

---

## 🚀 セットアップと実行

### 1. 前提条件

- [Docker](https://www.docker.com/get-started) と [Docker Compose](https://docs.docker.com/compose/install/) がインストールされていること。

### 2. 開発環境の起動

リポジトリをクローンし、以下のコマンドを実行します。

```bash
# 依存パッケージのインストール（初回のみ）
npm install

# Dockerコンテナをバックグラウンドで起動
docker-compose up -d --build
```

起動後、以下のURLにアクセスしてください。

- **フロントエンド (Vite)**: `http://localhost:5173`
- **バックエンド (Express)**: `http://localhost:3000`

### 3. データベースのセットアップ

コンテナ内でマイグレーションと初期データの投入を実行します。

```bash
# マイグレーションの実行
docker-compose exec app npm run migrate

# 初期ユーザーデータの投入
docker-compose exec app npm run seed
```

---

## ✅ テストの実行

各種テストは以下のコマンドで実行できます。

```bash
# 全てのユニットテストと統合テストを実行
npm run test

# Docker環境でテストを実行
npm run test:docker

# E2Eテスト (Playwright) を実行
npm run test:e2e
```

---

## 📦 主なnpmスクリプト

| コマンド                  | 説明                                           |
| :------------------------ | :--------------------------------------------- |
| `npm install`             | 依存関係をインストールします。                 |
| `npm run dev:concurrently`| 開発用にフロントエン��とバックエンドを同時に起動します。 |
| `npm run build`           | 本番用にフロントエンドをビルドします。         |
| `npm run start`           | 本番用にビルドされたサーバーを起動します。     |
| `npm run migrate`         | データベースのマイグレーションを実行します。   |
| `npm run seed`            | データベースに初期データを投入します。         |
| `npm test`                | Vitestによるユニット/統合テストを実行します。  |
| `npm run test:e2e`        | PlaywrightによるE2Eテストを実行します。        |

---

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は `LICENSE` ファイルを参照してください。
