import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate, matchPath, Navigate } from "react-router-dom";
import {
  RATING, PRICE, PRICES, GEO, TOKYO, LAND, SEAS, REGIONS, MONTH_NAMES, CITIES,
  bargainMonths, cheapPct, highPct, estimate,
  ROUTE_META, cityTitle, cityDescription,
} from "./data.js";
import { linksFor } from "./affiliates.js";

/* ── 旅ごよみ ─ 世界の旅先、いちばんいい季節がひと目でわかる ── */

/* ── 路線図風マップ ── */
const mx = (lng) => (lng + 180) / 360 * 1000;
const my = (lat) => (75 - lat) / 135 * 520;

const landD = (poly) =>
  "M " + poly.map(([la, ln]) => `${mx(ln).toFixed(1)} ${my(la).toFixed(1)}`).join(" L ") + " Z";

function MapView({ cities, month, onOpen }) {
  const tx = mx(TOKYO[1]), ty = my(TOKYO[0]);
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E2E8E9",
      padding:"12px 4px", overflowX:"auto" }}>
      <div style={{ fontSize:11, color:"#8AA0A8", padding:"0 12px 8px" }}>
        ● の色 = {month}月の快適度 / タップで詳細へ (横スクロールできます)
      </div>
      <svg viewBox="0 0 1000 520" style={{ minWidth:720, width:"100%", display:"block" }}>
        {/* 大陸 */}
        {LAND.map((poly, i) => (
          <path key={`land${i}`} d={landD(poly)} fill="#E3ECE9" stroke="#CFDEDA"
            strokeWidth={1} strokeLinejoin="round" />
        ))}
        {SEAS.map((poly, i) => (
          <path key={`sea${i}`} d={landD(poly)} fill="#FFFFFF" />
        ))}
        {/* 経緯線グリッド */}
        {[...Array(11)].map((_, i) => (
          <line key={`v${i}`} x1={(i+1)*1000/12} y1={0} x2={(i+1)*1000/12} y2={520}
            stroke="#E8EFF0" strokeWidth={1} strokeOpacity={0.8} />
        ))}
        {[...Array(5)].map((_, i) => (
          <line key={`h${i}`} x1={0} y1={(i+1)*520/6} x2={1000} y2={(i+1)*520/6}
            stroke="#E8EFF0" strokeWidth={1} strokeOpacity={0.8} />
        ))}
        <line x1={0} y1={my(0)} x2={1000} y2={my(0)} stroke="#DCE6E8" strokeWidth={1.2} strokeDasharray="4 4" />
        <text x={8} y={my(0)-6} fontSize={9} fill="#B4C4C9">赤道</text>

        {/* 東京からの路線 */}
        {cities.map(c => {
          const [lat, lng] = GEO[c.id];
          const x = mx(lng), y = my(lat);
          const cx = (tx + x) / 2, cy = Math.min(ty, y) - 36;
          return <path key={`r${c.id}`} d={`M ${tx} ${ty} Q ${cx} ${cy} ${x} ${y}`}
            fill="none" stroke="#CFDDE0" strokeWidth={1} strokeDasharray="3 3" />;
        })}

        {/* 東京(出発地) */}
        <circle cx={tx} cy={ty} r={5} fill="#17313B" />
        <text x={tx+8} y={ty+4} fontSize={11} fontWeight={700} fill="#17313B">東京</text>

        {/* 都市ドット */}
        {cities.map(c => {
          const [lat, lng, side] = GEO[c.id];
          const x = mx(lng), y = my(lat);
          const R = RATING[+c.months[month - 1]];
          const cheap = +PRICES[c.id][month - 1] === 1;
          return (
            <g key={c.id} onClick={() => onOpen(c)} style={{ cursor:"pointer" }}>
              <circle cx={x} cy={y} r={14} fill="transparent" />
              <circle cx={x} cy={y} r={7} fill={R.color} stroke="#fff" strokeWidth={2} />
              {cheap && <circle cx={x} cy={y} r={11} fill="none" stroke="#2E9E5B" strokeWidth={1.5} strokeDasharray="2 2" />}
              <text x={side === "r" ? x + 11 : x - 11} y={y + 4}
                textAnchor={side === "r" ? "start" : "end"}
                fontSize={11} fontWeight={600} fill="#33484F">
                {c.name}{cheap ? " ¥" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize:10, color:"#A9BCC2", padding:"6px 12px 0" }}>
        緑の点線リング+¥ = この月は航空券が安い都市
      </div>
    </div>
  );
}

/* ── 12ヶ月シーズンストリップ(このアプリの顔) ── */
function SeasonStrip({ months, prices, activeMonth, size = "s" }) {
  const large = size === "l";
  const h = large ? 34 : 20;
  return (
    <div>
      {large && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(12,1fr)", gap:2, marginBottom:3 }}>
          {MONTH_NAMES.map((m, i) => (
            <div key={i} style={{ textAlign:"center", fontSize:9,
              color: activeMonth === i + 1 ? "#17313B" : "#8AA0A8",
              fontWeight: activeMonth === i + 1 ? 700 : 500 }}>{i + 1}月</div>
          ))}
        </div>
      )}
      {/* 気候の段: アイコン+強コントラスト配色 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(12,1fr)", gap:2 }}>
        {months.split("").map((r, i) => {
          const R = RATING[+r];
          const active = activeMonth === i + 1;
          return (
            <div key={i} style={{
              height:h, borderRadius:4, background:R.color,
              outline: active ? "2px solid #17313B" : "none", outlineOffset:1,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize: large ? 13 : 10, fontWeight:800, color:R.text,
                lineHeight:1 }}>{R.icon}</span>
            </div>
          );
        })}
      </div>
      {/* 料金の段: ¥マーク (安=緑 / 高=赤) */}
      {prices && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(12,1fr)", gap:2, marginTop:3 }}>
          {prices.split("").map((p, i) => {
            const P = PRICE[+p];
            return (
              <div key={i} style={{
                textAlign:"center",
                fontSize: large ? 10 : 8,
                fontFamily:"'IBM Plex Mono', monospace",
                fontWeight: +p === 2 ? 500 : 700,
                color:P.color,
                letterSpacing:"-0.08em",
                background: large && +p === 1 ? "#EAF6EE" : large && +p === 3 ? "#FBEBEB" : "transparent",
                borderRadius:3, padding: large ? "3px 0" : 0,
              }}>{P.mark}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 都市ビジュアル(ポスター風 / 公開版では写真に差し替え) ── */
const SCENE = {
  tpe:{ type:"city",   sky:["#2E4A66","#E8896B"], deep:"#1E2F44", sun:"#F4B860" },
  sel:{ type:"city",   sky:["#8FB6D9","#F3D9E3"], deep:"#4A6785", sun:"#F7EFE6" },
  hkg:{ type:"city",   sky:["#141F33","#3D5A80"], deep:"#0C1524", sun:"#F4D06F" },
  bkk:{ type:"city",   sky:["#F2B36B","#F7E3C0"], deep:"#8A5A2B", sun:"#F2842B" },
  sin:{ type:"city",   sky:["#0F5E63","#79C6BC"], deep:"#0B3A3E", sun:"#F5E9CF" },
  dad:{ type:"sea",    sky:["#7FC3D8","#EAF5E6"], deep:"#3E97AE", sun:"#F7D57E" },
  ceb:{ type:"sea",    sky:["#5AB6CE","#D7F0EA"], deep:"#2493A8", sun:"#FCE7A8" },
  dps:{ type:"sea",    sky:["#F08A5D","#F9D8A6"], deep:"#2E6E75", sun:"#F4552F" },
  uln:{ type:"steppe", sky:["#9CC4E4","#EAF2F8"], deep:"#6FA96B", sun:"#FDFDF6" },
  dxb:{ type:"desert", sky:["#F5C97E","#FBE9C9"], deep:"#D99A4E", sun:"#F0812F" },
  ist:{ type:"city",   sky:["#C97B63","#F3D5B5"], deep:"#7A4438", sun:"#F2B950" },
  par:{ type:"city",   sky:["#9A8CC1","#F1D7D3"], deep:"#4F4668", sun:"#F6E3B4" },
  lon:{ type:"city",   sky:["#7C93A8","#DDE6EA"], deep:"#3E5265", sun:"#EEF2F4" },
  rom:{ type:"city",   sky:["#D9A05B","#F5E5C8"], deep:"#8A5A33", sun:"#F2C14E" },
  bcn:{ type:"sea",    sky:["#4FA3C7","#F5E1B8"], deep:"#2C7DA0", sun:"#F4A83B" },
  hnl:{ type:"sea",    sky:["#F2778D","#FBD9A0"], deep:"#2E6E8E", sun:"#F65E3B" },
  nyc:{ type:"city",   sky:["#1B2B4B","#5C6E9E"], deep:"#101A30", sun:"#EFD98B" },
  lax:{ type:"sea",    sky:["#F09A4B","#FBE3B9"], deep:"#3A7CA5", sun:"#F4552F" },
  syd:{ type:"sea",    sky:["#2E6FA3","#BFE0EE"], deep:"#1D4E79", sun:"#F7EFDD" },
  cns:{ type:"sea",    sky:["#3FA7A0","#D9F2E6"], deep:"#1F7A72", sun:"#FBE7A0" },
};

function Hero({ city, h = 88, fill }) {
  const s = SCENE[city.id];
  const seed = city.id.split("").map(c => c.charCodeAt(0));
  const rnd = (i) => (seed[i % seed.length] * (i * 7 + 13)) % 100 / 100;
  return (
    <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice"
      style={{ width:"100%", height: fill ? "100%" : h, display:"block" }}>
      <defs>
        <linearGradient id={`sky-${city.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.sky[0]} />
          <stop offset="100%" stopColor={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="140" fill={`url(#sky-${city.id})`} />
      <circle cx="308" cy="46" r="20" fill={s.sun} opacity="0.95" />
      {s.type === "sea" && (
        <g>
          <rect y="92" width="400" height="48" fill={s.deep} />
          <ellipse cx="308" cy="97" rx="26" ry="4" fill={s.sun} opacity="0.35" />
          <path d="M0 104 Q 50 100 100 104 T 200 104 T 300 104 T 400 104"
            stroke="#FFFFFF" strokeOpacity="0.25" fill="none" strokeWidth="2" />
          <path d="M0 118 Q 60 114 120 118 T 240 118 T 360 118 T 480 118"
            stroke="#FFFFFF" strokeOpacity="0.15" fill="none" strokeWidth="2" />
        </g>
      )}
      {s.type === "city" && (
        <g fill={s.deep}>
          {[...Array(13)].map((_, i) => {
            const bh = 26 + rnd(i) * 58;
            return <rect key={i} x={i * 31 - 4} y={140 - bh} width={26} height={bh} />;
          })}
        </g>
      )}
      {s.type === "desert" && (
        <g>
          <path d="M0 100 Q 120 70 240 102 T 400 96 L 400 140 L 0 140 Z" fill={s.deep} opacity="0.85" />
          <path d="M0 118 Q 150 92 300 120 T 400 112 L 400 140 L 0 140 Z" fill={s.deep} />
        </g>
      )}
      {s.type === "steppe" && (
        <g>
          <path d="M0 104 Q 130 78 260 106 T 400 100 L 400 140 L 0 140 Z" fill={s.deep} opacity="0.85" />
          <path d="M0 120 Q 160 98 320 124 T 400 118 L 400 140 L 0 140 Z" fill={s.deep} />
          <path d="M120 114 a 9 9 0 0 1 18 0 Z" fill="#FDFDFB" />
          <path d="M150 118 a 7 7 0 0 1 14 0 Z" fill="#FDFDFB" />
        </g>
      )}
    </svg>
  );
}

/* 都市ビジュアル: photo が設定されていれば写真、なければ(または読込失敗時は)SVGにフォールバック */
function CityVisual({ city, h = 88, fill }) {
  const [err, setErr] = useState(false);
  if (city.photo && !err) {
    return (
      <img src={import.meta.env.BASE_URL + "photos/" + city.photo} alt=""
        onError={() => setErr(true)}
        style={{ width:"100%", height: fill ? "100%" : h, objectFit:"cover", display:"block" }} />
    );
  }
  return <Hero city={city} h={h} fill={fill} />;
}

/* 透かし背景付きの情報パネル */
function Panel({ city, children, mt = 12 }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:16, marginTop:mt,
      border:"1px solid #E2E8E9", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, opacity:0.09, pointerEvents:"none" }}>
        <CityVisual city={city} fill />
      </div>
      <div style={{ position:"relative" }}>{children}</div>
    </div>
  );
}

const Tag = ({ children, tone }) => (
  <span style={{
    fontSize:11, padding:"3px 8px", borderRadius:999, fontWeight:600,
    background: tone === "amber" ? "#FBEED3" : tone === "green" ? "#E2F3E7" : tone === "red" ? "#FBE9E9" : "#E3F0EF",
    color: tone === "amber" ? "#9A6A14" : tone === "green" ? "#1E7A44" : tone === "red" ? "#B03A3A" : "#0F6566",
  }}>{children}</span>
);

/* ── 詳細画面 ── */
function Detail({ city, onBack, nowMonth, isFav, onToggleFav, memo, onSaveMemo, onAddPlan, loggedIn }) {
  const [memoText, setMemoText] = useState(memo || "");
  const [saved, setSaved] = useState(false);
  const nowYear = new Date().getFullYear();
  const [py, setPy] = useState(nowYear);
  const [pm, setPm] = useState(bargainMonths(city)[0] || (city.months.indexOf("3") + 1) || 1);
  const est = estimate(city, pm);

  return (
    <div style={{ animation:"fadeIn .25s ease" }}>
      <button onClick={onBack} style={{
        background:"none", border:"none", color:"#0F7B7C", fontWeight:700,
        fontSize:14, cursor:"pointer", padding:"4px 0", fontFamily:"inherit" }}>
        ← 一覧にもどる
      </button>

      <div style={{ borderRadius:14, overflow:"hidden", marginTop:10, border:"1px solid #E2E8E9", position:"relative" }}>
        <CityVisual city={city} h={190} />
        <div style={{ position:"absolute", inset:0, background:
          "linear-gradient(180deg, rgba(18,32,42,0) 42%, rgba(18,32,42,0.58) 100%)" }} />
        <button onClick={onToggleFav} aria-label="お気に入り" style={{
          position:"absolute", top:12, right:12,
          background:"rgba(255,255,255,0.92)", borderRadius:"50%", width:44, height:44,
          fontSize:21, cursor:"pointer", border:"none",
          color: isFav ? "#E0526E" : "#9AAAB0" }}>
          {isFav ? "♥" : "♡"}
        </button>
        <div style={{ position:"absolute", left:16, bottom:12, color:"#fff" }}>
          <div style={{ fontSize:11, letterSpacing:2, opacity:0.85 }}>{city.country} / {city.en}</div>
          <h2 style={{ fontFamily:"'Shippori Mincho', serif", fontSize:30, margin:"2px 0 0",
            textShadow:"0 1px 10px rgba(0,0,0,0.3)" }}>{city.name}</h2>
        </div>
      </div>
      <div style={{ marginTop:10 }}>
        <Tag tone="amber">ベストシーズン {city.best}</Tag>
      </div>

      <Panel city={city} mt={16}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:10, letterSpacing:1 }}>
          年間カレンダー <span style={{ fontWeight:500 }}>(上段: 気候 / 下段: 航空券の料金感)</span>
        </div>
        <SeasonStrip months={city.months} prices={PRICES[city.id]} size="l" activeMonth={nowMonth} />
        {bargainMonths(city).length > 0 && (
          <div style={{ marginTop:10, fontSize:12, fontWeight:700, color:"#1E7A44",
            background:"#E2F3E7", borderRadius:8, padding:"8px 10px" }}>
            狙い目: {bargainMonths(city).map(m=>`${m}月`).join("・")}
            <span style={{ fontWeight:500 }}> — 気候が良く、航空券は相場より最大約{cheapPct(city)}%安い時期です</span>
          </div>
        )}
        <p style={{ fontSize:13, lineHeight:1.8, color:"#33484F", margin:"14px 0 0" }}>{city.blurb}</p>
        <p style={{ fontSize:12, lineHeight:1.7, color:"#7A5A22", margin:"12px 0 0",
          borderLeft:"3px solid #D9A036", paddingLeft:10 }}>
          <b>注意</b> — {city.caution}</p>
      </Panel>

      <Panel city={city}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:10, letterSpacing:1 }}>予算のめやす(東京発・{city.d})</div>
        <div style={{ display:"flex", gap:20, alignItems:"baseline", flexWrap:"wrap" }}>
          <div>
            <div style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:26, fontWeight:600, color:"#17313B" }}>
              {city.t[0]}<span style={{ fontSize:14 }}>〜</span>{city.t[1]}<span style={{ fontSize:13, fontWeight:500 }}> 万円</span>
            </div>
            <div style={{ fontSize:11, color:"#8AA0A8" }}>総額(航空券+宿+現地費用)</div>
          </div>
          <div style={{ fontSize:13, color:"#33484F" }}>
            うち往復航空券 <b style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{city.f[0]}〜{city.f[1]}万円</b>
          </div>
        </div>
        <div style={{ fontSize:11, color:"#8AA0A8", marginTop:8 }}>
          ※ 下限は通常期・LCC/セール利用時、上限はGW・お盆・年末年始などのピーク時のめやす
        </div>
      </Panel>

      <Panel city={city}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:12, letterSpacing:1 }}>時期で選ぶ見どころ</div>
        {city.spots.map((s, i) => (
          <div key={i} style={{ display:"flex", gap:12, padding:"10px 0",
            borderTop: i ? "1px solid #EEF2F3" : "none" }}>
            <div style={{ minWidth:64, textAlign:"center" }}>
              {s.m.length
                ? <span style={{ fontSize:12, fontWeight:700, color:"#0F7B7C" }}>{s.m.map(m=>`${m}月`).join("・")}</span>
                : <span style={{ fontSize:12, fontWeight:700, color:"#8AA0A8" }}>通年</span>}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#17313B" }}>{s.n}</div>
              <div style={{ fontSize:12, color:"#5C7680", lineHeight:1.6 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </Panel>

      {/* 旅行計画に追加 */}
      <div style={{ background:"#fff", borderRadius:14, padding:16, marginTop:12, border:"1px solid #E2E8E9" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:10, letterSpacing:1 }}>旅行計画に追加</div>
        {loggedIn ? (
          <>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <select value={py} onChange={e=>setPy(+e.target.value)} style={{
                padding:"10px 12px", borderRadius:8, border:"1px solid #D7E0E2", fontFamily:"inherit", fontSize:13, background:"#fff" }}>
                {[nowYear, nowYear+1, nowYear+2].map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select value={pm} onChange={e=>setPm(+e.target.value)} style={{
                padding:"10px 12px", borderRadius:8, border:"1px solid #D7E0E2", fontFamily:"inherit", fontSize:13, background:"#fff" }}>
                {MONTH_NAMES.map((m,i)=>(
                  <option key={i} value={i+1}>
                    {m} {RATING[+city.months[i]].icon} {PRICE[+PRICES[city.id][i]].mark}
                  </option>
                ))}
              </select>
              <button onClick={() => onAddPlan({ cid: city.id, y: py, mo: pm })} style={{
                padding:"10px 16px", borderRadius:8, border:"none", cursor:"pointer",
                background:"#0F7B7C", color:"#fff", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>
                ＋ 追加
              </button>
            </div>
            <div style={{ fontSize:12, color:"#5C7680", marginTop:8 }}>
              {py}年{pm}月の見積: <b style={{ fontFamily:"'IBM Plex Mono', monospace", color:"#17313B" }}>{est[0]}〜{est[1]}万円</b>
              (この月の料金レベル: <b style={{ color:PRICE[+PRICES[city.id][pm-1]].color }}>{PRICE[+PRICES[city.id][pm-1]].label}</b>)
            </div>
          </>
        ) : (
          <div style={{ fontSize:12, color:"#8AA0A8" }}>マイページにログインすると、旅行計画に追加できます。</div>
        )}
      </div>

      {/* メモ */}
      <div style={{ background:"#fff", borderRadius:14, padding:16, marginTop:12, border:"1px solid #E2E8E9" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:10, letterSpacing:1 }}>自分用メモ</div>
        {loggedIn ? (
          <>
            <textarea value={memoText} onChange={e=>{setMemoText(e.target.value); setSaved(false);}}
              placeholder="例: 友人と行く候補。ナーダム祭に合わせて7月上旬に休みを取る"
              rows={3} style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D7E0E2",
                fontFamily:"inherit", fontSize:13, resize:"vertical", background:"#FAFCFC" }} />
            <button onClick={() => { onSaveMemo(memoText); setSaved(true); }} style={{
              marginTop:8, padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer",
              background: saved ? "#2E9E5B" : "#17313B", color:"#fff", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
              {saved ? "✓ 保存しました" : "メモを保存"}
            </button>
          </>
        ) : (
          <div style={{ fontSize:12, color:"#8AA0A8" }}>マイページにログインすると、メモを保存できます。</div>
        )}
      </div>

      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:8, letterSpacing:1 }}>予約・情報サイトへ</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {linksFor(city).map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="sponsored noopener" style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"13px 14px", borderRadius:10, background:"#fff",
              border:"1px solid #D7E0E2", color:"#17313B", fontSize:13, fontWeight:600,
              textDecoration:"none" }}>
              {l.label}
              <span style={{ color:"#8AA0A8", fontSize:12 }}>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── カード ── */
function Card({ city, nowMonth, onOpen, reason, isFav, onToggleFav }) {
  const lvl = +PRICES[city.id][nowMonth - 1];
  return (
    <div onClick={() => onOpen(city)} style={{
      background:"#fff", borderRadius:14, padding:0, cursor:"pointer",
      border:"1px solid #E2E8E9", overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", inset:0 }}>
        <CityVisual city={city} fill />
      </div>
      <div style={{ position:"absolute", inset:0, background:
        "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.9) 48%, rgba(255,255,255,0.95) 100%)" }} />
      <div style={{ position:"relative", padding:"66px 14px 14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <span style={{ fontFamily:"'Shippori Mincho', serif", fontSize:19, fontWeight:700, color:"#17313B" }}>{city.name}</span>
          <span style={{ fontSize:11, color:"#8AA0A8", marginLeft:8 }}>{city.country}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:13, fontWeight:600, color:"#33484F" }}>
            {city.t[0]}〜{city.t[1]}<span style={{ fontSize:10 }}>万円</span>
          </span>
          {onToggleFav && (
            <button onClick={(e) => { e.stopPropagation(); onToggleFav(city.id); }}
              aria-label="お気に入り" style={{
                border:"none", background:"transparent", fontSize:20, cursor:"pointer",
                padding:0, lineHeight:1, color: isFav ? "#E0526E" : "#C4CFD3" }}>
              {isFav ? "♥" : "♡"}
            </button>
          )}
        </div>
      </div>
      <div style={{ margin:"10px 0 8px" }}>
        <SeasonStrip months={city.months} prices={PRICES[city.id]} activeMonth={nowMonth} />
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        <Tag tone="amber">◎ {city.best}</Tag>
        {bargainMonths(city).length > 0 && (
          <Tag tone="green">狙い目 {bargainMonths(city).map(m=>`${m}月`).join("・")}</Tag>
        )}
        {reason && <Tag>{reason}</Tag>}
        {lvl === 1 && <Tag tone="green">{nowMonth}月は相場より約{cheapPct(city)}%安い</Tag>}
        {lvl === 3 && <Tag tone="red">{nowMonth}月は相場より約{highPct(city)}%高い</Tag>}
      </div>
      </div>
    </div>
  );
}

export default function App() {
  const nowMonth = new Date().getMonth() + 1;
  const location = useLocation();
  const navigate = useNavigate();

  /* URL ⇄ 画面の対応: / = 行き先 / /month = 月から / /my = マイページ / /city/:id = 詳細 */
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const cityMatch = matchPath("/city/:id", path);
  const selected = cityMatch ? CITIES.find(c => c.id === cityMatch.params.id) : null;
  const tab = path === "/month" ? "month" : path === "/my" ? "my" : "dest";

  const [region, setRegion] = useState("すべて");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(nowMonth);
  const [view, setView] = useState("list");          // list | map (行き先タブ)

  const openCity = (c) => navigate(`/city/${c.id}`, { state: { from: path } });
  const backToList = () => navigate(location.state?.from || "/");

  /* ルート変更時: スクロールを先頭へ + タイトル/meta descriptionを更新(SEO) */
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    const meta = selected
      ? { title: cityTitle(selected), description: cityDescription(selected) }
      : (ROUTE_META[path] || ROUTE_META["/"]);
    document.title = meta.title;
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute("content", meta.description);
  }, [path, selected]);

  /* マイページのデータ(お気に入り・メモ・計画)は localStorage に保存 */
  const [store, setStore] = useState({ user:null, favs:[], memos:{}, plans:[] });
  useEffect(() => {
    try {
      const r = localStorage.getItem("tabigoyomi:v1");
      if (r) setStore(s => ({ ...s, ...JSON.parse(r) }));
    } catch (e) { /* 初回はデータなし */ }
  }, []);
  const update = (patch) => {
    setStore(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("tabigoyomi:v1", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const toggleFav = (id) => {
    const adding = !store.favs.includes(id);
    update({ favs: adding ? [...store.favs, id] : store.favs.filter(x => x !== id) });
    showToast(adding ? "お気に入りに追加しました" : "お気に入りから外しました");
  };
  const addPlan = (p) => {
    update({ plans: [...store.plans, { ...p, id: Date.now() }] });
    const c = CITIES.find(x => x.id === p.cid);
    showToast(`${p.y}年${p.mo}月・${c.name}を計画に追加しました`);
  };
  const removePlan = (id) => update({ plans: store.plans.filter(p => p.id !== id) });

  /* トースト通知 */
  const [toast, setToast] = useState(null);
  const showToast = (msg) => setToast({ msg, key: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const sortedPlans = useMemo(() =>
    [...store.plans].sort((a, b) => (a.y - b.y) || (a.mo - b.mo)), [store.plans]);
  const planYears = useMemo(() => [...new Set(sortedPlans.map(p => p.y))], [sortedPlans]);

  const destList = useMemo(() => CITIES.filter(c =>
    (region === "すべて" || c.region === region) &&
    (!q || c.name.includes(q) || c.country.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()))
  ), [region, q]);

  const monthList = useMemo(() =>
    [...CITIES]
      .map(c => {
        const rating = +c.months[month - 1];
        const spot = c.spots.find(s => s.m.includes(month));
        return { c, rating, spot };
      })
      .filter(x => x.rating >= 2)
      .sort((a, b) => (b.rating - a.rating) || ((b.spot?1:0) - (a.spot?1:0)))
  , [month]);

  /* 存在しない都市ID・不明なURLはトップへリダイレクト */
  if ((cityMatch && !selected) || (!cityMatch && !["/", "/month", "/my"].includes(path))) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#F2F6F6", fontFamily:"'Noto Sans JP', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;700;800&family=Noto+Sans+JP:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:none;} }
        @keyframes toastIn { 0% { opacity:0; transform:translate(-50%, 12px);} 12% { opacity:1; transform:translate(-50%, 0);} 85% { opacity:1;} 100% { opacity:0; transform:translate(-50%, -4px);} }
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        input:focus { outline:2px solid #0F7B7C; }
      `}</style>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"20px 16px 48px" }}>
        {/* header */}
        <header style={{ marginBottom:18, paddingBottom:14, borderBottom:"1px solid #DCE4E5" }}>
          <h1 style={{ fontFamily:"'Shippori Mincho', serif", fontSize:26, margin:0, color:"#17313B", letterSpacing:2 }}>
            旅ごよみ
          </h1>
          <p style={{ fontSize:12, color:"#5C7680", margin:"4px 0 0", letterSpacing:0.5 }}>
            世界の旅先、いちばんいい季節がひと目でわかる。
          </p>
        </header>

        {selected ? (
          <Detail key={selected.id} city={selected} onBack={backToList} nowMonth={nowMonth}
            loggedIn={!!store.user}
            isFav={store.favs.includes(selected.id)}
            onToggleFav={() => toggleFav(selected.id)}
            memo={store.memos[selected.id]}
            onSaveMemo={(text) => { update({ memos: { ...store.memos, [selected.id]: text } }); showToast("メモを保存しました"); }}
            onAddPlan={addPlan} />
        ) : (
          <>
            {/* tabs */}
            <div style={{ display:"flex", background:"#E3EBEC", borderRadius:12, padding:4, marginBottom:16 }}>
              {[["dest","行き先から"],["month","月から探す"],["my","マイページ"]].map(([k, label]) => (
                <button key={k} onClick={() => navigate(k === "dest" ? "/" : `/${k}`)} style={{
                  flex:1, padding:"10px 0", border:"none", borderRadius:9, cursor:"pointer",
                  fontFamily:"inherit", fontSize:13, fontWeight:700,
                  background: tab === k ? "#17313B" : "transparent",
                  color: tab === k ? "#fff" : "#5C7680" }}>{label}</button>
              ))}
            </div>

            {tab === "dest" && (
              <div style={{ animation:"fadeIn .25s ease" }}>
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder="都市名・国名で検索(例: バリ)"
                  style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #D7E0E2",
                    fontSize:14, fontFamily:"inherit", marginBottom:10, background:"#fff" }} />
                <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:8 }}>
                  {REGIONS.map(r => (
                    <button key={r} onClick={() => setRegion(r)} style={{
                      whiteSpace:"nowrap", padding:"7px 13px", borderRadius:999, border:"none",
                      cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                      background: region === r ? "#0F7B7C" : "#fff",
                      color: region === r ? "#fff" : "#5C7680",
                      boxShadow:"0 1px 3px rgba(23,49,59,.08)" }}>{r}</button>
                  ))}
                  <span style={{ flex:1 }} />
                  <div style={{ display:"flex", background:"#fff", borderRadius:999, padding:2,
                    boxShadow:"0 1px 3px rgba(23,49,59,.08)" }}>
                    {[["list","リスト"],["map","地図"]].map(([k, label]) => (
                      <button key={k} onClick={() => setView(k)} style={{
                        whiteSpace:"nowrap", padding:"5px 11px", borderRadius:999, border:"none",
                        cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700,
                        background: view === k ? "#17313B" : "transparent",
                        color: view === k ? "#fff" : "#8AA0A8" }}>{label}</button>
                    ))}
                  </div>
                </div>
                {view === "map" ? (
                  <MapView cities={destList} month={nowMonth} onOpen={openCity} />
                ) : (
                <div style={{ display:"grid", gap:10 }}>
                  {destList.map(c => <Card key={c.id} city={c} nowMonth={nowMonth} onOpen={openCity}
                    isFav={store.favs.includes(c.id)} onToggleFav={store.user ? toggleFav : null} />)}
                  {!destList.length && (
                    <div style={{ textAlign:"center", padding:40, color:"#8AA0A8", fontSize:13 }}>
                      該当する旅先が見つかりません。条件を変えてみてください。
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {tab === "month" && (
              <div style={{ animation:"fadeIn .25s ease" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:6 }}>
                  {MONTH_NAMES.map((m, i) => (
                    <button key={i} onClick={() => setMonth(i + 1)} style={{
                      padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer",
                      fontFamily:"inherit", fontSize:13, fontWeight:700,
                      background: month === i + 1 ? "#0F7B7C" : "#fff",
                      color: month === i + 1 ? "#fff" : "#5C7680",
                      boxShadow:"0 1px 3px rgba(23,49,59,.08)" }}>
                      {m}{i + 1 === nowMonth && <span style={{ fontSize:8, display:"block" }}>今月</span>}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:12, color:"#5C7680", margin:"10px 2px 12px" }}>
                  <b style={{ color:"#17313B" }}>{month}月</b>に行くなら、この{monthList.length}都市。
                  ◎ベスト順に並んでいます。
                </p>
                <div style={{ display:"grid", gap:10 }}>
                  {monthList.map(({ c, rating, spot }) => (
                    <Card key={c.id} city={c} nowMonth={month} onOpen={openCity}
                      isFav={store.favs.includes(c.id)} onToggleFav={store.user ? toggleFav : null}
                      reason={spot ? `${month}月: ${spot.n}` : rating === 3 ? "気候ベスト" : "快適に過ごせる"} />
                  ))}
                </div>
              </div>
            )}

            {tab === "my" && (
              <div style={{ animation:"fadeIn .25s ease" }}>
                {!store.user ? (
                  <div style={{ background:"#fff", borderRadius:14, padding:"32px 24px", textAlign:"center",
                    border:"1px solid #E2E8E9" }}>
                    <h3 style={{ fontFamily:"'Shippori Mincho', serif", fontSize:18, color:"#17313B", margin:"0 0 8px" }}>
                      マイページ
                    </h3>
                    <p style={{ fontSize:13, color:"#5C7680", lineHeight:1.9, margin:"0 0 20px" }}>
                      お気に入りの保存・メモ・旅行計画と<br/>年間予算の管理ができます。
                    </p>
                    <button onClick={() => update({ user: { name: "デモユーザー" } })} style={{
                      padding:"12px 28px", borderRadius:8, border:"1px solid #D7E0E2", cursor:"pointer",
                      background:"#fff", fontFamily:"inherit", fontSize:14, fontWeight:600, color:"#33484F",
                      display:"inline-flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontWeight:600, fontSize:15,
                        color:"#4285F4" }}>G</span>
                      Google でログイン
                    </button>
                    <p style={{ fontSize:10, color:"#A9BCC2", marginTop:14 }}>
                      プロトタイプではデモログインです。公開版でGoogle認証に置き換えます。
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#17313B" }}>{store.user.name}</div>
                      <button onClick={() => update({ user:null })} style={{
                        background:"none", border:"none", color:"#8AA0A8", fontSize:12,
                        cursor:"pointer", fontFamily:"inherit" }}>ログアウト</button>
                    </div>

                    {/* 旅行計画と年間予算 */}
                    <div style={{ background:"#fff", borderRadius:14, padding:16, marginBottom:12,
                      border:"1px solid #E2E8E9" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", marginBottom:10, letterSpacing:1 }}>旅行計画</div>
                      {sortedPlans.length === 0 && (
                        <div style={{ fontSize:12, color:"#8AA0A8", lineHeight:1.8 }}>
                          まだ計画がありません。各都市の詳細ページから「旅行計画に追加」できます。
                        </div>
                      )}
                      {planYears.map(y => {
                        const plans = sortedPlans.filter(p => p.y === y);
                        const total = plans.reduce((acc, p) => {
                          const c = CITIES.find(x => x.id === p.cid);
                          const e = estimate(c, p.mo);
                          return [acc[0] + e[0], acc[1] + e[1]];
                        }, [0, 0]);
                        return (
                          <div key={y} style={{ marginBottom:14 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
                              paddingBottom:6, borderBottom:"2px solid #17313B", marginBottom:8 }}>
                              <span style={{ fontFamily:"'Shippori Mincho', serif", fontSize:16, fontWeight:700, color:"#17313B" }}>{y}年</span>
                              <span style={{ fontSize:12, color:"#5C7680" }}>
                                合計 <b style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:16, color:"#0F7B7C" }}>{total[0]}〜{total[1]}</b> 万円
                              </span>
                            </div>
                            {plans.map(p => {
                              const c = CITIES.find(x => x.id === p.cid);
                              const e = estimate(c, p.mo);
                              const lvl = +PRICES[c.id][p.mo - 1];
                              return (
                                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                                  borderBottom:"1px solid #EEF2F3" }}>
                                  <span style={{ minWidth:38, fontSize:13, fontWeight:700, color:"#0F7B7C" }}>{p.mo}月</span>
                                  <span onClick={() => openCity(c)} style={{ flex:1, fontSize:14, fontWeight:600,
                                    color:"#17313B", cursor:"pointer" }}>
                                    {c.name} <span style={{ fontSize:10, color:"#8AA0A8" }}>{c.country}</span>
                                  </span>
                                  {lvl !== 2 && (
                                    <span style={{ fontSize:10, fontWeight:700, color:PRICE[lvl].color }}>
                                      {lvl === 1 ? `相場-${cheapPct(c)}%` : `相場+${highPct(c)}%`}
                                    </span>
                                  )}
                                  <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:13, color:"#33484F" }}>
                                    {e[0]}〜{e[1]}<span style={{ fontSize:9 }}>万</span>
                                  </span>
                                  <button onClick={() => removePlan(p.id)} style={{
                                    border:"none", background:"none", color:"#C4CFD3", cursor:"pointer",
                                    fontSize:14, padding:"0 2px" }}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* お気に入り */}
                    <div style={{ fontSize:12, fontWeight:700, color:"#5C7680", margin:"16px 2px 8px", letterSpacing:1 }}>
                      お気に入り({store.favs.length})
                    </div>
                    <div style={{ display:"grid", gap:10 }}>
                      {store.favs.length === 0 && (
                        <div style={{ textAlign:"center", padding:24, color:"#8AA0A8", fontSize:12,
                          background:"#fff", borderRadius:14 }}>
                          カードの ♡ をタップすると、ここに保存されます。
                        </div>
                      )}
                      {store.favs.map(id => {
                        const c = CITIES.find(x => x.id === id);
                        return (
                          <div key={id}>
                            <Card city={c} nowMonth={nowMonth} onOpen={openCity}
                              isFav={true} onToggleFav={toggleFav} />
                            {store.memos[id] && (
                              <div style={{ fontSize:11, color:"#5C7680", background:"#FDF9EC",
                                borderRadius:"0 0 10px 10px", padding:"8px 12px", margin:"0 6px" }}>
                                メモ — {store.memos[id]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* legend */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:24, flexWrap:"wrap" }}>
              {[3,2,1,0].map(r => (
                <span key={r} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#5C7680" }}>
                  <span style={{ width:16, height:16, borderRadius:4, background:RATING[r].color,
                    display:"inline-flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontWeight:800, color:RATING[r].text }}>{RATING[r].icon}</span>
                  {RATING[r].label}
                </span>
              ))}
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:8, flexWrap:"wrap" }}>
              {[1,2,3].map(p => (
                <span key={p} style={{ fontSize:11, color:"#5C7680" }}>
                  <b style={{ color:PRICE[p].color, fontFamily:"'IBM Plex Mono', monospace" }}>{PRICE[p].mark}</b> {PRICE[p].label}
                </span>
              ))}
            </div>
            <p style={{ textAlign:"center", fontSize:10, color:"#A9BCC2", marginTop:10 }}>
              ※ 予算・気候は東京発のめやすです。渡航前に最新情報をご確認ください。
            </p>
          </>
        )}
      </div>

      {/* トースト通知 */}
      {toast && (
        <div key={toast.key} style={{
          position:"fixed", bottom:28, left:"50%", transform:"translate(-50%, 0)",
          background:"#17313B", color:"#fff", fontSize:13, fontWeight:600,
          padding:"12px 20px", borderRadius:999, boxShadow:"0 4px 16px rgba(23,49,59,.25)",
          zIndex:100, whiteSpace:"nowrap", animation:"toastIn 2.2s ease forwards" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
