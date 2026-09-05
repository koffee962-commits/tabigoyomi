# 旅ごよみ

世界の旅先、いちばんいい季節がひと目でわかる海外旅行ベストシーズン検索サイトです。
20都市の月別の快適度・航空券の料金感・見どころ・予算のめやすを、東京発基準でまとめています。

**公開URL:** https://tabigoyomi.com/

## 開発コマンド

```bash
npm install        # 依存パッケージのインストール
npm run dev        # 開発サーバー起動 (http://localhost:5173/)
npm run build      # 本番ビルド (vite build + scripts/postbuild.mjs)
npm run preview    # ビルド結果のプレビュー
```

`npm run build` はビルド後に `scripts/postbuild.mjs` を実行し、
都市ごとのSEO用HTML(`dist/city/<id>/index.html`)・`sitemap.xml`・`robots.txt`・`404.html` を生成します。

## ページ構成

| URL | 内容 |
| --- | --- |
| `/` | 行き先から探す(一覧・地図) |
| `/month` | 月から探す |
| `/my` | マイページ(お気に入り・旅行計画) |
| `/city/:id` | 都市詳細(例: `/city/dps` = バリ島) |

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
npx wrangler deploy    # Cloudflare へ公開
```

`wrangler.jsonc` の `assets.not_found_handling` は `404-page` です。
実在するルート(`/`・`/month`・`/my`・`/city/<id>`)はビルド時にHTMLを生成済みのため、
それ以外のURLは 404 を返します(存在しないURLを200にしないため)。

### GitHub Pages(旧URL)

`main` に push すると GitHub Actions が `scripts/build-redirect.mjs` を実行し、
旧URL `koffee962-commits.github.io/tabigoyomi/*` から新ドメインへ転送するページだけを公開します。
サイト本体はここでは配信していません。
