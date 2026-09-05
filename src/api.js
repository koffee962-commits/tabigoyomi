/* ── サーバーAPI(Cloudflare Worker)とのやりとり ──
   セッションはHttpOnly Cookieで管理されるため、JS側でトークンを扱うことはない。
   ここにシークレットは一切置かない。 */

export const LOGIN_URL = "/api/auth/google";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = 通信そのものに失敗
  }
}

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("通信できませんでした", 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* 本文がJSONでないことは通常ないが、落とさない */
  }

  if (!res.ok) {
    throw new ApiError((payload && payload.message) || "エラーが発生しました", res.status);
  }
  return payload;
}

/** ログイン中のユーザー。未ログインなら ApiError(status 401) */
export const getMe = () => request("/me");

/** マイページのデータ { favs, memos, plans } */
export const getData = async () => (await request("/data")).data;

/** マイページのデータを保存(ユーザー単位で全置換) */
export const putData = (data) => request("/data", { method: "PUT", body: { data } });

export const postLogout = () => request("/auth/logout", { method: "POST" });
