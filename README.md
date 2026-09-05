# 旅ごよみ

世界の旅先、いちばんいい季節がひと目でわかる海外旅行ベストシーズン検索サイトです。
20都市の月別の快適度・航空券の料金感・見どころ・予算のめやすを、東京発基準でまとめています。

**公開URL:** https://tabigoyomi.com/

## 開発コマンド

```bash
npm install        # 依存パッケージのインストール
npm run dev        # フロントの開発サーバー (http://localhost:5173/)
npm run dev:api    # APIの開発サーバー (wrangler dev, http://127.0.0.1:8787/)
npm run build      # 本番ビルド (vite build + scripts/postbuild.mjs)
npm run preview    # ビルド結果のプレビュー
```

マイページを触るときは `npm run dev` と `npm run dev:api` を**両方**起動してください。
Viteの `server.proxy` が `/api/*` を wrangler dev(8787番)へ転送するので、
ブラウザは http://localhost:5173/ だけを見ていれば済みます。

`npm run build` はビルド後に `scripts/postbuild.mjs` を実行し、
都市ごとのSEO用HTML(`dist/city/<id>/index.html`)・`sitemap.xml`・`robots.txt`・`404.html` を生成します。
`npm run dev:api` は `dist/` を静的アセットとして配信するため、先に一度 `npm run build` が必要です。

## ページ構成

| URL | 内容 |
| --- | --- |
| `/` | 行き先から探す(一覧・地図) |
| `/month` | 月から探す |
| `/my` | マイページ(ログイン必須。お気に入り・メモ・旅行計画) |
| `/city/:id` | 都市詳細(例: `/city/dps` = バリ島) |

## マイページ(ログインとデータ保存)

マイページのお気に入り・メモ・旅行計画は、Googleアカウントでログインした
ユーザーごとに **Cloudflare D1** へ保存されます(以前はブラウザの localStorage でした)。
以前この端末に保存されていた内容は、**初回ログイン時に自動でサーバーへ引き継ぎ**、
取り込みが済んだら localStorage のキー(`tabigoyomi:v1`)を削除します。

### 構成

| ファイル | 役割 |
| --- | --- |
| `src/worker/index.js` | `/api/*` を処理するWorker(OAuth・セッション・データ入出力) |
| `src/api.js` | フロントからAPIを呼ぶための薄いラッパー |
| `migrations/0001_init.sql` | D1のスキーマ(`users` / `sessions` / `user_data`) |

`wrangler.jsonc` の `assets.run_worker_first` を `["/api/*"]` にしているため、
**Workerが動くのは `/api/*` だけ**です。それ以外のURLはこれまで通り静的アセットが優先され、
実在しないURLは `not_found_handling: "404-page"` により404を返します。

### APIエンドポイント

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/auth/google` | stateを発行してGoogleの認可画面へリダイレクト |
| GET | `/api/auth/callback` | stateを照合 → トークン交換 → IDトークン検証 → セッション作成 → `/my` へ |
| POST | `/api/auth/logout` | セッション破棄 |
| GET | `/api/me` | ログイン中のユーザー(未ログインは401) |
| GET | `/api/data` | `{ favs, memos, plans }` の取得 |
| PUT | `/api/data` | `{ favs, memos, plans }` の保存(ユーザー単位で全置換) |

セッションはHttpOnly Cookie(`Secure; SameSite=Lax; Path=/`)で管理し、
DBにはCookie値そのものではなくSHA-256ハッシュだけを保存しています。
`/api/data` は必ずCookieのセッションからユーザーを特定するため、
リクエストの本文にユーザーIDを書いても無視されます。

## Google OAuth の設定

Google Cloud Console で「OAuth 2.0 クライアント ID」(種類: ウェブアプリケーション)を作成し、
**承認済みのリダイレクト URI** に次の2つを登録します。

```
https://tabigoyomi.com/api/auth/callback
http://localhost:5173/api/auth/callback
```

### 本番(Cloudflare)へのシークレット設定

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

シークレットはリポジトリに置きません。未設定のあいだもサイトはこれまで通り動き、
`/api/auth/google` は「ログインの準備中です」という案内ページを返します。

### ローカル開発用

`.dev.vars.example` を `.dev.vars` にコピーして値を入れてください(`.dev.vars` はGit管理外です)。

```ini
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OAUTH_REDIRECT_URI="http://localhost:5173/api/auth/callback"
```

`OAUTH_REDIRECT_URI` は任意です。未設定の場合はリクエストのオリジンから
`<オリジン>/api/auth/callback` を組み立てます(本番では設定不要)。

## D1 (データベース)

| 項目 | 値 |
| --- | --- |
| データベース名 | `tabigoyomi-db` |
| database_id | `bb7c07e2-337a-4aeb-9ef1-d9d57c0a68f1` |
| バインディング | `DB` |

新しく作り直す場合は `npx wrangler d1 create tabigoyomi-db` を実行し、
返ってきた `database_id` を `wrangler.jsonc` に書き写してください。

### マイグレーション

```bash
npm run db:migrate         # 本番(リモート)のD1へ適用
npm run db:migrate:local   # ローカル(wrangler dev用)のD1へ適用
```

中身は `npx wrangler d1 execute tabigoyomi-db --remote --file=./migrations/0001_init.sql` です。
スキーマは `CREATE TABLE IF NOT EXISTS` なので、何度実行しても安全です。

## 写真

都市の写真は Wikimedia Commons (Wikipedia の各都市記事の代表画像) から取得しています。

```bash
node scripts/fetch-photos.mjs   # public/photos/<id>.jpg と src/photoCredits.js を再生成
```

- 出典・ライセンス情報は `src/photoCredits.js` に自動生成され、詳細ページの写真右下にクレジット表示されます
- 代表画像が地図や旗などで不適切な都市は、`scripts/fetch-photos.mjs` の `TITLE_OVERRIDES` で記事名を指定します
- 手持ちの写真に差し替えたい場合は `public/photos/<id>.jpg` を上書きし、`src/photoCredits.js` から該当都市のエントリを削除(クレジット表示が消えます)
- 都市を追加したときは `src/data.js` に都市データを足してから上のスクリプトを再実行
- 写真がない・読み込みに失敗した都市は自動でSVGイラストにフォールバックします

## 本番URL(ドメイン)の変更

ドメインを変えるときは以下を変更します。

1. `src/data.js` の `SITE_ORIGIN` — canonical・OG・sitemap・robots・旧URLからの転送先がすべてここから生成されます
2. `vite.config.js` の `base` — ドメイン直下で配信するなら `"/"`
3. `wrangler.jsonc` の `routes` — 接続するカスタムドメイン

## アフィリエイトIDの設定

`src/affiliates.js` の先頭にある設定に、登録後に発行されたIDを貼り付けてください。

```js
export const AFFILIATES = {
  travelpayoutsMarker: "", // Travelpayouts の marker (Skyscannerリンクが成果計測付きになる)
  bookingAid: "",          // Booking.com アフィリエイトの aid
};
```

- **Travelpayouts** (https://www.travelpayouts.com/) — 登録してダッシュボードの marker を設定
- **Booking.com アフィリエイトパートナー** (https://www.booking.com/affiliate-program/) — 発行された aid を設定

未設定の間は通常リンクとして動作します。

## デプロイ

本体は **Cloudflare Workers** (`tabigoyomi.com` / `www.tabigoyomi.com`) で配信しています。

```bash
npm run build          # 先にビルドが必要(dist/ を配信するため)
npm run db:migrate     # 初回のみ: D1にテーブルを作成
npx wrangler deploy    # Cloudflare へ公開
```

`wrangler.jsonc` の `assets.not_found_handling` は `404-page` です。
実在するルート(`/`・`/month`・`/my`・`/city/<id>`)はビルド時にHTMLを生成済みのため、
それ以外のURLは 404 を返します(存在しないURLを200にしないため)。

### GitHub Pages(旧URL)

`main` に push すると GitHub Actions が `scripts/build-redirect.mjs` を実行し、
旧URL `koffee962-commits.github.io/tabigoyomi/*` から新ドメインへ転送するページだけを公開します。
サイト本体はここでは配信していません。
