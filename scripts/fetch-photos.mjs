/* Wikipedia(Wikimedia Commons)から各都市の代表写真を取得し、
   public/photos/<id>.jpg と src/photoCredits.js (撮影者・ライセンス表記) を生成する。
   実行: node scripts/fetch-photos.mjs  (再実行すると上書き更新) */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CITIES } from "../src/data.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "tabigoyomi-build/1.0 (https://github.com/koffee962-commits/tabigoyomi; koffee962@gmail.com)" };
const WIDTH = 1600;

/* 記事の代表画像が地図等で不適切な都市は、風景写真を持つ記事名で上書き */
const TITLE_OVERRIDES = {
  dps: "Tanah Lot",          // バリ島(記事の代表画像が地図SVGのため寺院の海景に)
  hnl: "Waikiki",
  ceb: "Cebu City",
  nyc: "New York City",
  hkg: "Victoria Harbour",   // 香港(記事の代表画像が旗のため夜景に)
  sin: "Marina Bay Sands",   // シンガポール(記事の代表画像が旗のため湾岸の夜景に)
};

const BAD = /(map|locator|marker|flag|montage|collage|seal|logo|coat_of_arms)/i;

async function api(host, params) {
  const url = `https://${host}/w/api.php?format=json&${params}`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function pageImageName(title) {
  const j = await api("en.wikipedia.org", `action=query&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}`);
  const page = Object.values(j.query.pages)[0];
  return page?.pageimage || null;
}

async function imageInfo(fileName) {
  const j = await api("en.wikipedia.org", `action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=${encodeURIComponent("File:" + fileName)}`);
  const page = Object.values(j.query.pages)[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const strip = (html) => (html || "").replace(/<[^>]+>/g, "").trim();
  return {
    thumbUrl: ii.thumburl || ii.url,
    filePage: ii.descriptionurl,
    author: strip(meta.Artist?.value) || "不明",
    license: strip(meta.LicenseShortName?.value) || "",
    licenseUrl: meta.LicenseUrl?.value || "",
  };
}

const credits = {};
await mkdir(path.join(ROOT, "public", "photos"), { recursive: true });

for (const c of CITIES) {
  const candidates = [TITLE_OVERRIDES[c.id], c.en].filter(Boolean);
  let done = false;
  for (const title of candidates) {
    const file = await pageImageName(title);
    if (!file || BAD.test(file) || !/\.(jpe?g|png)$/i.test(file)) {
      console.warn(`  ${c.id}: "${title}" の代表画像は不適 (${file}) — 次候補へ`);
      continue;
    }
    const info = await imageInfo(file);
    if (!info) continue;
    const img = await fetch(info.thumbUrl, { headers: UA });
    if (!img.ok) throw new Error(`download ${img.status}: ${info.thumbUrl}`);
    const buf = Buffer.from(await img.arrayBuffer());
    await writeFile(path.join(ROOT, "public", "photos", `${c.id}.jpg`), buf);
    credits[c.id] = { author: info.author, license: info.license, licenseUrl: info.licenseUrl, filePage: info.filePage };
    console.log(`✓ ${c.id} (${c.name}) ← ${file} [${info.license}] ${(buf.length / 1024).toFixed(0)}KB`);
    done = true;
    break;
  }
  if (!done) console.error(`✗ ${c.id} (${c.name}): 画像を取得できませんでした`);
}

const header = `/* 自動生成: scripts/fetch-photos.mjs ─ 都市写真の出典(Wikimedia Commons)。手動編集しない */\n`;
await writeFile(
  path.join(ROOT, "src", "photoCredits.js"),
  header + `export const PHOTO_CREDITS = ${JSON.stringify(credits, null, 2)};\n`
);
console.log(`\nphotoCredits.js: ${Object.keys(credits).length}/${CITIES.length} 都市分を生成`);
