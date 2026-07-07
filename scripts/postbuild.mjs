/* ── ビルド後処理: プリレンダリング(SEO用HTML生成)・sitemap・robots・SPAフォールバック ──
   package.json の "build": "vite build && node scripts/postbuild.mjs" から実行される */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CITIES, ROUTE_META, SITE_ORIGIN, cityTitle, cityDescription,
} from "../src/data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const template = readFileSync(join(dist, "index.html"), "utf8");

const esc = (s) => s
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/* テンプレート内の <title>・meta description・canonical・OG タグを差し替え、
   必要なら JSON-LD を </head> 直前に挿入する */
function renderPage({ title, description, url, ogType = "website", ogImage = null, jsonLd = null }) {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + esc(description) + b);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + url + b);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => a + esc(title) + b);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => a + esc(description) + b);
  html = html.replace(/(<meta property="og:type" content=")[^"]*(")/, (_, a, b) => a + ogType + b);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + url + b);
  if (ogImage) {
    html = html.replace("</head>", () =>
      `  <meta property="og:image" content="${ogImage}" />\n  </head>`);
  }
  if (jsonLd) {
    html = html.replace("</head>", () =>
      `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`);
  }
  return html;
}

const writePage = (relDir, html) => {
  const dir = join(dist, relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
};

/* トップページ: index.html にハードコードされた canonical/og:url を SITE_ORIGIN に合わせる
   (ドメイン変更時は src/data.js の SITE_ORIGIN を直すだけでよい) */
{
  let html = template;
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + SITE_ORIGIN + b);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + SITE_ORIGIN + b);
  html = html.replace("</head>", () =>
    `  <meta property="og:image" content="${SITE_ORIGIN}photos/dps.jpg" />\n  </head>`);
  writeFileSync(join(dist, "index.html"), html);
}

/* 一覧ページ(/month, /my) */
for (const route of ["/month", "/my"]) {
  const meta = ROUTE_META[route];
  writePage(route.slice(1), renderPage({
    title: meta.title,
    description: meta.description,
    url: `${SITE_ORIGIN}${route.slice(1)}/`,
  }));
}

/* 都市詳細ページ(/city/:id) */
for (const c of CITIES) {
  const title = cityTitle(c);
  const description = cityDescription(c);
  const url = `${SITE_ORIGIN}city/${c.id}/`;
  const ogImage = `${SITE_ORIGIN}photos/${c.id}.jpg`;
  writePage(`city/${c.id}`, renderPage({
    title, description, url, ogType: "article", ogImage,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: c.name,
      alternateName: c.en,
      description,
      url,
      image: ogImage,
    },
  }));
}

/* sitemap.xml (全ルート) */
const urls = [
  SITE_ORIGIN,
  `${SITE_ORIGIN}month/`,
  `${SITE_ORIGIN}my/`,
  ...CITIES.map(c => `${SITE_ORIGIN}city/${c.id}/`),
];
writeFileSync(join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n") +
  `\n</urlset>\n`);

/* robots.txt */
writeFileSync(join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}sitemap.xml\n`);

/* GitHub Pages の SPA フォールバック */
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));

console.log(`postbuild: ${CITIES.length} city pages + month/my + sitemap(${urls.length} URLs) + robots.txt + 404.html`);
