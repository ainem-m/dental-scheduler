歯科予約表アプリ設計書 (TDD 対応)

Version: 0.1 — 2025-07-14
Author: ChatGPT (based on user discussions)

⸻

🎯 目的 (Scope & Goals)
	•	LAN 内 Web アプリ として動作し、インターネット接続不要。
	•	iPad 複数台 (Safari) から同時アクセス可能。
	•	Apple Pencil 手書き または テキスト入力で予約を登録。
	•	日単位で予約表を管理し、可変列 × 可変時間枠 (例: 10 列 × 5 分刻み) に対応。
	•	すべての端末間で 200 ms 以内にリアルタイム同期。
	•	TDD (ユニット / 統合 / E2E) で開発・保守。

⸻

💻 技術スタック概要

レイヤ	採用技術	理由
フロントエンド	Vue 3 (Composition API) + ViteCanvas: HTML5 <canvas>	iPad/Safari で高パフォーマンス。
サーバ/API	Node.js 20 + Express 5	軽量・JavaScript 統一言語。
双方向通信	Socket.IO (WebSocket)	<200 ms のリアルタイム同期。
データ永続化	SQLite 3 via Knex.js (better-sqlite3)	LAN 単体で運用・簡易バックアップ。
認証	Basic 認証 + bcrypt	シンプル・オフラインで完結。
手書き画像保存	PNG ファイル (client→server upload) - Multer, uuid	Apple Pencil 描画を忠実に保存。
配布	Docker + docker-compose	ワンコマンド導入・アップデート。
テスト	Vitest / Vue Test Utils (ユニット)Supertest (統合)Playwright (E2E)	CI 上で全自動実行。


⸻

📐 アーキテクチャ図 (概要)

┌───────────┐     WebSocket + REST     ┌─────────────┐  WAL
│ iPad A    │ ───────────────────────► │  Node/Express│ ──► SQLite
│ (Vue App) │ ◄─────────────────────── │  Socket.IO   │
└───────────┘     (≤200 ms Sync)       └─────────────┘   ▲
   ▲      ▲                                               │ Volumes
   │      └────── POST /api/handwriting  (PNG Upload) ────┘
   │
┌───────────┐
│ iPad B    │   同期   (Playwright でマルチコンテキスト E2E テスト)
└───────────┘


⸻

📄 SQLite スキーマ v1

-- 予約テーブル
CREATE TABLE reservations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT    NOT NULL,           -- '2025-12-07'
  time_min     INTEGER NOT NULL,           -- 9:00 → 540 (分)
  column_index INTEGER NOT NULL,           -- 0-based
  patient_name TEXT,                       -- テキスト予約の場合
  handwriting  TEXT,                       -- PNG ファイル名（手書き予約の場合）
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ユーザーテーブル (Basic 認証用)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'staff'       -- 'admin' も想定
);

マイグレーション: Knex.js を使用し npm run migrate / rollback。

⸻

🔑 認証フロー (Basic Auth)
	1.	HTTPS (自己署名 or リバースプロキシ) 越しにアクセス。
	2.	Authorization: Basic ヘッダーを Express basic-auth ミドルウェアで検証。
	3.	bcrypt でハッシュ比較し、失敗時 401。

Roles:
	•	staff: 予約 CRUD。
	•	admin: ユーザー管理 & ログ閲覧。

⸻

✍️ 手書き PNG 取り扱い

ステップ	処理
① Canvas 描画完了	canvas.toBlob('image/png') で Blob 生成
② アップロード	FormData → POST /api/handwriting
③ サーバ保存	/data/png/{UUID}.png に書込 (Multer)
④ 予約登録	/api/reservations で handwriting にファイル名を紐付け
⑤ クリーンアップ	予約削除イベントで対応 PNG も削除 (Vitest で保証)


⸻

🧪 テスト戦略

1. レイヤ別ツール

レイヤ	ツール / ライブラリ	カバー率目標
ユニット	Vitest + Vue Test Utils	≥80 %
統合	Supertest (API) / Vitest (Socket)	主要フロー全網羅
E2E	Playwright (WebKit, Chromium)	代表シナリオ 3-5 本

2. 代表テストケース

<details>
<summary>ユニット (ReservationGrid)</summary>


it('拒否: 同一時間・同一列に重複登録できない', () => {
  const grid = new ReservationGrid({ slotsPerDay: 96, columns: 10 });
  grid.add('田中', 540, 2);
  expect(() => grid.add('鈴木', 540, 2)).toThrow(/duplicate/);
});

</details>


<details>
<summary>統合 (API & DB)</summary>


test('POST /api/reservations → 201 & DB 挿入', async () => {
  const res = await request(app)
    .post('/api/reservations')
    .send({ date: '2025-07-15', patient_name: '田中', time_min: 540, column_index: 1 });
  expect(res.status).toBe(201);
  const row = await db('reservations').where({ time_min: 540 }).first();
  expect(row.patient_name).toBe('田中');
});

</details>


<details>
<summary>E2E (マルチ端末同期)</summary>


// playwright/e2e-sync.spec.ts
const APP_URL = process.env.APP_URL ?? 'https://localhost:3000';

test('複数端末リアルタイム同期', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(APP_URL);
  await b.goto(APP_URL);

  await a.click('[data-cell="09:05-0"]');
  await a.fill('input[name="patient"]', '田中');
  await a.click('text=保存');

  await expect.poll(async () => {
    return b.locator('[data-cell="09:05-0"]').innerText();
  }, { timeout: 500 }).toBe('田中');
});

test('予約の編集が複数端末で同期される', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(APP_URL);
  await b.goto(APP_URL);

  // 端末Aで予約を作成
  await a.click('[data-cell="10:00-0"]');
  await a.fill('input[name="patient"]', '編集前患者');
  await a.click('text=保存');

  // 端末Bで同期されるのを待つ
  await expect.poll(async () => {
    return b.locator('[data-cell="10:00-0"]').innerText();
  }, { timeout: 500 }).toBe('編集前患者');

  // 端末Aで予約を編集
  await a.click('[data-cell="10:00-0"]'); // 既存の予約をクリックしてモーダルを開く
  await a.fill('input[name="patient"]', '編集後患者');
  await a.click('text=保存');

  // 端末Bで編集が同期されるのを待つ
  await expect.poll(async () => {
    return b.locator('[data-cell="10:00-0"]').innerText();
  }, { timeout: 500 }).toBe('編集後患者');
});

test('予約の削除が複数端末で同期される', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(APP_URL);
  await b.goto(APP_URL);

  // 端末Aで予約を作成
  await a.click('[data-cell="11:00-0"]');
  await a.fill('input[name="patient"]', '削除対象患者');
  await a.click('text=保存');

  // 端末Bで同期されるのを待つ
  await expect.poll(async () => {
    return b.locator('[data-cell="11:00-0"]').innerText();
  }, { timeout: 500 }).toBe('削除対象患者');

  // 端末Aで予約を削除
  await a.click('[data-cell="11:00-0"]'); // 既存の予約をクリックしてモーダルを開く
  await a.click('text=削除'); // 削除ボタンをクリック

  // 端末Bで削除が同期されるのを待つ
  await expect.poll(async () => {
    return b.locator('[data-cell="11:00-0"]').innerText();
  }, { timeout: 500 }).toBe(''); // 予約が消えていることを確認
});

</details>



⸻

📦 ファイル/ディレクトリ構成

/dental-scheduler/
├── client/
│   ├── src/
│   │   ├── components/
│   │   └── store/
│   └── tests/            # Vue ユニット
├── server/
│   ├── src/
│   └── tests/            # API & Socket 統合テスト
├── e2e/
│   └── playwright/       # E2E シナリオ
├── data/                 # SQLite & PNG 永続化 (Docker Volume)
├── Dockerfile
├── docker-compose.yml
└── README.md


⸻

🐳 Docker デプロイ

Dockerfile (抜粋)

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "server/index.js"]

docker-compose.yml

version: "3.9"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data  # SQLite & PNG
    environment:
      - NODE_ENV=production
    restart: unless-stopped


⸻

🔄 CI/CD ワークフロー (GitHub Actions 例)

name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      xvfb:
        image: zenika/alpine-chrome:124
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test && npm run test:e2e
      - run: docker build -t dental-scheduler:${{ github.sha }} .


⸻

🔮 今後の拡張 (Backlog)
	•	予約入力の簡略化（ドロップダウンリスト）
	•	予約リマインダー通知 (メール / LINE)
	•	PDF / 印刷レイアウト最適化


⸻

📜 運用ルール
	•	進捗が出たら `log.md` に追記し、GitHub に push すること。

⸻

© 2025 Dental Scheduler Project
