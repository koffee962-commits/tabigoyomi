# 旅ごよみ

世界の旅先、いちばんいい季節がひと目でわかる海外旅行ベストシーズン検索サイトです。
20都市の月別の快適度・航空券の料金感・見どころ・予算のめやすを、東京発基準でまとめています。

**公開URL:** https://koffee962-commits.github.io/tabigoyomi/

## 開発コマンド

```bash
npm install        # 依存パッケージのインストール
npm run dev        # 開発サーバー起動 (http://localhost:5173/tabigoyomi/)
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

## 写真の追加方法

都市カード・詳細ページのビジュアルは、写真が未設定の間はSVGイラストで表示されます。
写真に差し替えるには:

1. `public/photos/` に写真を置く(例: `dps.jpg`)
2. `src/data.js` の該当都市に `photo` フィールドを追加する

```js
{ id:"dps", name:"バリ島", photo:"dps.jpg", ... },
```

読み込みに失敗した場合は自動でSVGイラストにフォールバックします。

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

`main` ブランチに push すると GitHub Actions (`.github/workflows/deploy.yml`) が
自動でビルドして GitHub Pages に公開します。
