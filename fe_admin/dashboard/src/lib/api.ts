/**
 * Single place where the dashboard talks to the API.
 *
 * The backend signs access tokens with a short lifetime
 * (AUTH_JWT_TOKEN_EXPIRES_IN, 15m by default) while the session cookie used by
 * `middleware.ts` lives much longer. Without a refresh step the UI keeps
 * rendering as "logged in" while every request answers 401, which is why
 * `apiFetch` below refreshes the access token and replays the request once.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const TOKEN_EXPIRES_KEY = "tokenExpires";
const USER_KEY = "user";

// Mirrors the access token lifetime of the refresh token (30d) so the cookie
// disappears at the same time the session really dies.
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type Session = {
  token: string;
  refreshToken?: string;
  tokenExpires?: number;
  user?: unknown;
};

const isBrowser = () => typeof window !== "undefined";

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;

  const prefix = `${name}=`;
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));

  // A JWT is base64url encoded, so it never contains "=" padding, but slicing
  // by prefix length is still safer than splitting on "=".
  return raw ? decodeURIComponent(raw.slice(prefix.length)) : null;
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY) ?? readCookie(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveSession(session: Session): void {
  if (!isBrowser()) return;

  localStorage.setItem(TOKEN_KEY, session.token);

  if (session.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  if (session.tokenExpires) {
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(session.tokenExpires));
  }
  if (session.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  // `middleware.ts` only sees cookies, so the token is mirrored there to keep
  // route protection working.
  document.cookie = `token=${encodeURIComponent(session.token)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`;
}

export function clearSession(): void {
  if (!isBrowser()) return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function redirectToSignIn(): void {
  if (!isBrowser()) return;
  if (window.location.pathname === "/signin") return;

  window.location.href = "/signin";
}

// Concurrent 401s must not fire several refresh calls: the backend rotates the
// session hash on every refresh, so the second call would invalidate the first.
let refreshInFlight: Promise<string | null> | null = null;

async function requestNewToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Session;
    if (!data?.token) return null;

    saveSession(data);
    return data.token;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

function withAuthHeaders(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return { ...init, headers };
}

/**
 * `fetch` for API calls: resolves relative paths against `API_BASE_URL`,
 * attaches the bearer token and, on 401, refreshes the token once and replays
 * the request. When the refresh fails the local session is dropped and the user
 * is sent back to /signin instead of being left on a page full of 401s.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;

  const token = getToken();
  let response = await fetch(url, withAuthHeaders(init, token));

  if (response.status !== 401) {
    return response;
  }

  const freshToken = await refreshAccessToken();

  if (!freshToken) {
    clearSession();
    redirectToSignIn();
    return response;
  }

  response = await fetch(url, withAuthHeaders(init, freshToken));

  if (response.status === 401) {
    clearSession();
    redirectToSignIn();
  }

  return response;
}

/** Reads the error message the NestJS backend returns, for use in alerts. */
export async function readApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.message === "string") return data.message;
    if (data?.errors) return JSON.stringify(data.errors);

    return JSON.stringify(data);
  } catch {
    return `Lỗi ${response.status}`;
  }
}
