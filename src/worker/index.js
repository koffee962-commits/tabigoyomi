/* ── 旅ごよみ API Worker ───────────────────────────────────────────────
   役割は /api/* のみ。それ以外のURLは静的アセット(プリレンダー済みHTML・
   sitemap.xml など)がそのまま配信される。

   ルーティングの前提 (wrangler.jsonc):
     assets.run_worker_first = ["/api/*"]   → /api/* だけ先にこのWorkerへ
     assets.not_found_handling = "404-page" → それ以外で実在しないURLは404
   run_worker_first に該当しないリクエストがまれにここへ届いた場合
   (ナビゲーション以外で実在しないURLを叩いたときなど)は、ASSETS へ委ねて
   これまで通り 404.html を404ステータスで返す。

   シークレット (リポジトリには置かない。wrangler secret で設定):
     GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   任意:
     OAUTH_REDIRECT_URI … 未設定ならリクエストのオリジンから自動生成
──────────────────────────────────────────────────────────────────────── */

const SESSION_COOKIE = "tg_session";
const STATE_COOKIE = "tg_oauth_state";
const SESSION_TTL = 60 * 60 * 24 * 30; // セッションの有効期間: 30日
const STATE_TTL = 60 * 10; // OAuth stateの有効期間: 10分
const MAX_BODY = 128 * 1024; // /api/data の受け入れ上限

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/* ── 小道具 ───────────────────────────────────────────────────────── */

const now = () => Math.floor(Date.now() / 1000);

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

/** ログイン導線はブラウザのアドレスバー上で起きるので、失敗時はJSONではなく
    サイトのトーンに合わせたHTMLを返す */
function errorPage(heading, message, status = 400, retry = false, extraHeaders = {}) {
  const esc = (s) =>
    String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>${esc(heading)} | 旅ごよみ</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;700&family=Noto+Sans+JP:wght@400;600;700&display=swap');
  body { margin:0; background:#F2F6F6; font-family:'Noto Sans JP', sans-serif; color:#17313B; }
  .wrap { max-width:680px; margin:0 auto; padding:48px 16px; }
  .card { background:#fff; border:1px solid #E2E8E9; border-radius:14px; padding:24px; }
  h1 { font-family:'Shippori Mincho', serif; font-size:20px; margin:0 0 10px; letter-spacing:1px; }
  p { font-size:13px; line-height:1.9; color:#5C7680; margin:0 0 6px; }
  .actions { margin-top:18px; display:flex; gap:8px; flex-wrap:wrap; }
  a.btn { display:inline-block; padding:11px 18px; border-radius:8px; font-size:13px;
    font-weight:700; text-decoration:none; }
  a.primary { background:#0F7B7C; color:#fff; }
  a.ghost { background:#fff; color:#17313B; border:1px solid #D7E0E2; }
</style></head>
<body><div class="wrap"><div class="card">
  <h1>${esc(heading)}</h1>
  <p>${esc(message)}</p>
  <div class="actions">
    ${retry ? '<a class="btn primary" href="/api/auth/google">もう一度ログインする</a>' : ""}
    <a class="btn ghost" href="/my">マイページへ</a>
    <a class="btn ghost" href="/">トップへ</a>
  </div>
</div></div></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

const redirect = (location, extraHeaders = {}) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", ...extraHeaders },
  });

function getCookie(request, name) {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const setCookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const clearCookie = (name) => `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** stateの比較はタイミング差を作らない */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64urlToBytes(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

/* ── OAuth設定 ────────────────────────────────────────────────────── */

function oauthConfig(env, url) {
  return {
    clientId: env.GOOGLE_CLIENT_ID || "",
    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: env.OAUTH_REDIRECT_URI || `${url.origin}/api/auth/callback`,
  };
}

const NOT_CONFIGURED_MSG =
  "Googleログインの設定(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)がまだ行われていません。" +
  "設定が済むまでログインはご利用いただけません。";

/* ── IDトークンの検証 ─────────────────────────────────────────────── */

let jwksCache = { keys: null, at: 0 };

async function googleJwks(force = false) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 60 * 60 * 1000) {
    return jwksCache.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKSの取得に失敗しました (${res.status})`);
  const data = await res.json();
  jwksCache = { keys: data.keys || [], at: Date.now() };
  return jwksCache.keys;
}

class AuthError extends Error {}

/** 署名(RS256) + aud / iss / exp を検証してペイロードを返す */
async function verifyIdToken(idToken, clientId) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new AuthError("IDトークンの形式が不正です");

  let header, payload;
  try {
    header = b64urlToJson(parts[0]);
    payload = b64urlToJson(parts[1]);
  } catch {
    throw new AuthError("IDトークンを解析できませんでした");
  }
  if (header.alg !== "RS256") throw new AuthError("IDトークンの署名方式が想定と異なります");

  // 署名検証 (鍵のローテーション直後に備え、kidが見つからなければ一度だけ取り直す)
  let jwk = (await googleJwks()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleJwks(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError("IDトークンの署名鍵が見つかりません");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw new AuthError("IDトークンの署名を検証できませんでした");

  // aud: 自分のクライアントIDであること
  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
  if (!audOk) throw new AuthError("IDトークンの発行先(aud)が一致しません");
  // iss: Googleであること
  if (!GOOGLE_ISSUERS.includes(payload.iss)) {
    throw new AuthError("IDトークンの発行者(iss)が一致しません");
  }
  // exp: 期限内であること (時計ずれを60秒だけ許容)
  const t = now();
  if (typeof payload.exp !== "number" || payload.exp <= t - 60) {
    throw new AuthError("IDトークンの有効期限が切れています");
  }
  if (typeof payload.iat === "number" && payload.iat > t + 300) {
    throw new AuthError("IDトークンの発行時刻が不正です");
  }
  if (!payload.sub) throw new AuthError("IDトークンにユーザー識別子がありません");

  return payload;
}

/* ── セッション ───────────────────────────────────────────────────── */

async function getSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{16,128}$/.test(token)) return null;
  const sid = await sha256hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at AS expires_at,
            u.id AS user_id, u.email AS email, u.name AS name, u.picture AS picture
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
  )
    .bind(sid)
    .first();
  if (!row) return null;
  if (row.expires_at <= now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  return row;
}

/* ── データの正規化 ───────────────────────────────────────────────── */

const EMPTY_DATA = () => ({ favs: [], memos: {}, plans: [] });

/** クライアントから来たJSONは信用せず、形と量を必ず整えてから保存する */
function sanitizeData(input) {
  const out = EMPTY_DATA();
  if (!input || typeof input !== "object") return out;

  if (Array.isArray(input.favs)) {
    for (const v of input.favs.slice(0, 200)) {
      if (typeof v === "string" && v.length > 0 && v.length <= 32 && !out.favs.includes(v)) {
        out.favs.push(v);
      }
    }
  }

  if (input.memos && typeof input.memos === "object" && !Array.isArray(input.memos)) {
    for (const [k, v] of Object.entries(input.memos).slice(0, 200)) {
      if (k.length > 0 && k.length <= 32 && typeof v === "string") out.memos[k] = v.slice(0, 2000);
    }
  }

  if (Array.isArray(input.plans)) {
    for (const p of input.plans.slice(0, 500)) {
      if (!p || typeof p !== "object") continue;
      const cid = typeof p.cid === "string" ? p.cid.slice(0, 32) : "";
      const y = Number(p.y);
      const mo = Number(p.mo);
      if (!cid || !Number.isInteger(y) || !Number.isInteger(mo)) continue;
      if (y < 1970 || y > 3000 || mo < 1 || mo > 12) continue;
      const id = Number.isSafeInteger(Number(p.id)) ? Number(p.id) : Date.now() + out.plans.length;
      out.plans.push({ id, cid, y, mo });
    }
  }

  return out;
}

/* ── エンドポイント ───────────────────────────────────────────────── */

/* GET /api/auth/google — stateを発行してGoogleの認可画面へ */
function authStart(env, url) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(env, url);
  if (!clientId || !clientSecret) {
    return errorPage("ログインの準備中です", NOT_CONFIGURED_MSG, 503);
  }

  const state = randomToken(16);
  const auth = new URL(GOOGLE_AUTH_URL);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("access_type", "online");
  auth.searchParams.set("prompt", "select_account");

  return redirect(auth.toString(), { "Set-Cookie": setCookie(STATE_COOKIE, state, STATE_TTL) });
}

/* GET /api/auth/callback — stateを照合し、トークン交換 → IDトークン検証 → セッション作成 */
async function authCallback(request, env, url, ctx) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(env, url);
  if (!clientId || !clientSecret) {
    return errorPage("ログインの準備中です", NOT_CONFIGURED_MSG, 503);
  }

  const dropState = { "Set-Cookie": clearCookie(STATE_COOKIE) };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    if (oauthError === "access_denied") return redirect("/my", dropState);
    return errorPage(
      "ログインできませんでした",
      `Googleから「${oauthError}」が返されました。`,
      400,
      true,
      dropState
    );
  }

  // CSRF対策: 送り出したときのstateと戻ってきたstateが一致することを確認する
  const state = url.searchParams.get("state");
  const cookieState = getCookie(request, STATE_COOKIE);
  if (!state || !cookieState || !safeEqual(state, cookieState)) {
    return errorPage(
      "ログインの確認ができませんでした",
      "ログイン手続きの確認に失敗しました。時間をおいて、もう一度お試しください。",
      400,
      true,
      dropState
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return errorPage("ログインできませんでした", "認可コードが受け取れませんでした。", 400, true, dropState);
  }

  // 認可コード → トークン
  let tokens;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new AuthError(`トークンの取得に失敗しました (${res.status})`);
    tokens = await res.json();
  } catch (e) {
    console.error("token exchange failed", e);
    return errorPage("ログインできませんでした", "Googleとの通信に失敗しました。", 502, true, dropState);
  }

  let claims;
  try {
    claims = await verifyIdToken(tokens.id_token, clientId);
  } catch (e) {
    console.error("id_token verification failed", e);
    return errorPage(
      "ログインできませんでした",
      e instanceof AuthError ? e.message : "ログイン情報を確認できませんでした。",
      401,
      true,
      dropState
    );
  }

  // ユーザーの作成 / 更新
  const t = now();
  const sub = String(claims.sub);
  const email = claims.email ? String(claims.email).slice(0, 320) : null;
  const name = String(claims.name || claims.given_name || (email ? email.split("@")[0] : "旅人")).slice(0, 120);
  const picture = claims.picture ? String(claims.picture).slice(0, 512) : null;

  const existing = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?").bind(sub).first();
  let userId;
  if (existing) {
    userId = existing.id;
    await env.DB.prepare("UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?")
      .bind(email, name, picture, userId)
      .run();
  } else {
    userId = randomToken(16);
    await env.DB.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(userId, sub, email, name, picture, t)
      .run();
  }

  // セッション発行 (Cookieには生トークン、DBにはそのハッシュだけを置く)
  const token = randomToken(32);
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(await sha256hex(token), userId, t, t + SESSION_TTL)
    .run();

  // 期限切れセッションの掃除はレスポンスを待たせずに行う
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(t).run());
  }

  const headers = new Headers({ Location: "/my", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  headers.append("Set-Cookie", setCookie(SESSION_COOKIE, token, SESSION_TTL));
  return new Response(null, { status: 302, headers });
}

/* POST /api/auth/logout */
async function authLogout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256hex(token)).run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
}

/* GET /api/me */
async function apiMe(request, env) {
  const s = await getSession(request, env);
  if (!s) return json({ error: "unauthorized", message: "ログインが必要です" }, 401);
  return json({ user: { name: s.name, email: s.email, picture: s.picture } });
}

/* GET /api/data */
async function apiGetData(request, env) {
  const s = await getSession(request, env);
  if (!s) return json({ error: "unauthorized", message: "ログインが必要です" }, 401);

  const row = await env.DB.prepare("SELECT json FROM user_data WHERE user_id = ?")
    .bind(s.user_id)
    .first();
  if (!row) return json({ data: EMPTY_DATA() });
  try {
    return json({ data: sanitizeData(JSON.parse(row.json)) });
  } catch {
    return json({ data: EMPTY_DATA() });
  }
}

/* PUT /api/data — 保存先は必ずセッションのユーザー。本文のuser_idは一切見ない */
async function apiPutData(request, env) {
  const s = await getSession(request, env);
  if (!s) return json({ error: "unauthorized", message: "ログインが必要です" }, 401);

  const text = await request.text();
  if (text.length > MAX_BODY) {
    return json({ error: "payload_too_large", message: "保存できるデータの上限を超えています" }, 413);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "bad_request", message: "データの形式が正しくありません" }, 400);
  }

  const data = sanitizeData(body && body.data ? body.data : body);
  await env.DB.prepare(
    `INSERT INTO user_data (user_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
  )
    .bind(s.user_id, JSON.stringify(data), now())
    .run();

  return json({ ok: true, data });
}

/* ── ルーティング ─────────────────────────────────────────────────── */

const ROUTES = {
  "/api/auth/google": { GET: (c) => authStart(c.env, c.url) },
  "/api/auth/callback": { GET: (c) => authCallback(c.request, c.env, c.url, c.ctx) },
  "/api/auth/logout": { POST: (c) => authLogout(c.request, c.env) },
  "/api/me": { GET: (c) => apiMe(c.request, c.env) },
  "/api/data": {
    GET: (c) => apiGetData(c.request, c.env),
    PUT: (c) => apiPutData(c.request, c.env),
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // /api/* 以外は静的アセットへ。既存の配信挙動(404-page)をそのまま保つ
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not Found", { status: 404 });
    }

    const method = request.method === "HEAD" ? "GET" : request.method;

    // 状態を変えるリクエストは同一オリジンからのものだけ受け付ける
    if (method !== "GET" && method !== "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return json({ error: "forbidden", message: "リクエスト元を確認できません" }, 403);
      }
    }

    const handlers = ROUTES[url.pathname.replace(/\/+$/, "") || url.pathname];
    if (!handlers) return json({ error: "not_found", message: "エンドポイントが見つかりません" }, 404);
    const handler = handlers[method];
    if (!handler) {
      return json({ error: "method_not_allowed", message: "許可されていないメソッドです" }, 405, {
        Allow: Object.keys(handlers).join(", "),
      });
    }

    if (!env.DB) {
      console.error("D1 binding (DB) is not configured");
      return json({ error: "server_error", message: "データベースに接続できません" }, 500);
    }

    try {
      return await handler({ request, env, url, ctx });
    } catch (err) {
      console.error("api error", (err && err.stack) || err);
      return json({ error: "server_error", message: "サーバー側で問題が発生しました" }, 500);
    }
  },
};
