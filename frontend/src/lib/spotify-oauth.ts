const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:3000/spotify/callback";

const ACCESS_TOKEN_KEY = "mdv_spotify_access_token";
const REFRESH_TOKEN_KEY = "mdv_spotify_refresh_token";
const EXPIRES_AT_KEY = "mdv_spotify_expires_at";
const VERIFIER_KEY = "mdv_spotify_code_verifier";
const STATE_KEY = "mdv_spotify_oauth_state";
const RETURN_TO_KEY = "mdv_spotify_return_to";

export const SPOTIFY_AUTH_CHANGED_EVENT = "mdv:spotify-auth-changed";

export function spotifyClientConfigured() {
  return CLIENT_ID.trim().length > 0;
}

export function getSpotifyRedirectUri() {
  return REDIRECT_URI;
}

function randomString(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function base64UrlEncode(bytes: ArrayBuffer) {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join("");
  return window.btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createCodeChallenge(verifier: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

export async function startSpotifyAuthorization(returnTo = "/search") {
  if (!spotifyClientConfigured()) {
    throw new Error("Chưa cấu hình NEXT_PUBLIC_SPOTIFY_CLIENT_ID trong frontend/.env.local.");
  }

  const verifier = randomString(96);
  const state = randomString(32);
  const challenge = await createCodeChallenge(verifier);
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/search";

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-modify-playback-state",
    ].join(" "),
  });

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function saveTokens(tokens: SpotifyTokenResponse, keepExistingRefreshToken = true) {
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) {
    throw new Error("Spotify không trả về access token hợp lệ.");
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  sessionStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + tokens.expires_in * 1000));
  if (tokens.refresh_token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  } else if (!keepExistingRefreshToken) {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export async function completeSpotifyAuthorization(search: string) {
  const params = new URLSearchParams(search);
  const oauthError = params.get("error_description") ?? params.get("error");
  if (oauthError) throw new Error(`Spotify từ chối kết nối: ${oauthError}`);

  const code = params.get("code");
  const returnedState = params.get("state");
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!code) throw new Error("Không nhận được authorization code từ Spotify.");
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    throw new Error("Trạng thái OAuth không hợp lệ. Hãy thử kết nối Spotify lại.");
  }
  if (!verifier) throw new Error("Không tìm thấy PKCE verifier. Hãy bắt đầu kết nối từ cùng trình duyệt và địa chỉ website.");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as SpotifyTokenResponse;
  if (!response.ok) {
    throw new Error(body.error_description ?? body.error ?? "Không đổi được mã đăng nhập Spotify thành access token.");
  }

  saveTokens(body, false);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  window.dispatchEvent(new Event(SPOTIFY_AUTH_CHANGED_EVENT));

  const returnTo = sessionStorage.getItem(RETURN_TO_KEY) ?? "/search";
  sessionStorage.removeItem(RETURN_TO_KEY);
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/search";
}

export async function getValidSpotifyAccessToken() {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_AT_KEY) ?? "0");
  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;

  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken || !spotifyClientConfigured()) return null;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as SpotifyTokenResponse;
  if (!response.ok) {
    clearSpotifyAuthorization();
    return null;
  }
  saveTokens(body, true);
  return body.access_token;
}

export function clearSpotifyAuthorization() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_AT_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  window.dispatchEvent(new Event(SPOTIFY_AUTH_CHANGED_EVENT));
}

/** Spotify requires a loopback IP literal rather than localhost for local OAuth redirects. */
export function startSpotifyAuthorizationFromCurrentHost(returnTo = "/search") {
  if (!spotifyClientConfigured()) {
    throw new Error("Chưa cấu hình NEXT_PUBLIC_SPOTIFY_CLIENT_ID trong frontend/.env.local.");
  }
  const redirect = new URL(REDIRECT_URI);
  if (window.location.hostname === "localhost" && redirect.hostname === "127.0.0.1") {
    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/search";
    window.location.assign(`${redirect.origin}/spotify/connect?returnTo=${encodeURIComponent(safeReturnTo)}`);
    return;
  }
  void startSpotifyAuthorization(returnTo).catch((error: unknown) => {
    window.alert(error instanceof Error ? error.message : "Không thể kết nối Spotify.");
  });
}
