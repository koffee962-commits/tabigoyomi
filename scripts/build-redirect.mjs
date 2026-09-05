/* 旧GitHub Pages(koffee962-commits.github.io/tabigoyomi/)から
   新ドメイン(tabigoyomi.com)へ転送する静的ページを生成する。
   本体はCloudflare Workersで配信しているため、Pagesは転送専用。 */
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN } from "../src/data.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "redirect-dist");
mkdirSync(out, { recursive: true });

const origin = SITE_ORIGIN.replace(/\/$/, "");

const page = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>旅ごよみは ${origin} に移転しました</title>
    <link rel="canonical" href="${origin}/" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${origin}/" />
    <script>
      (function () {
        var p = location.pathname.replace(/^\\/tabigoyomi/, "");
        if (p.charAt(0) !== "/") p = "/" + p;
        location.replace("${origin}" + p + location.search + location.hash);
      })();
    </script>
  </head>
  <body>
    <p>旅ごよみは <a href="${origin}/">${origin}</a> に移転しました。自動で移動しない場合はリンクをクリックしてください。</p>
  </body>
</html>
`;

/* index.html はトップ、404.html は配下の全URL(旧都市ページなど)を受ける */
for (const name of ["index.html", "404.html"]) writeFileSync(join(out, name), page);

/* 旧プロパティのSearch Console所有権を維持するため、確認ファイルは残す */
const verify = "googlee0ee15063dcf696c.html";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
copyFileSync(join(root, "public", verify), join(out, verify));

console.log(`build-redirect: redirect-dist/{index,404}.html + ${verify} -> ${origin}`);
