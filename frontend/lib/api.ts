const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Same-tab auth updates (e.g. Google One Tap) do not fire `storage`; hooks listen for this. */
export const OMNILEARN_AUTH_CHANGED_EVENT = "omnilearn-auth-changed";

const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days — align with middleware so cookie outlives token refresh

type RefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "unauthorized" | "transient" };

let refreshInflight: Promise<RefreshResult> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omnilearn_token");
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OMNILEARN_AUTH_CHANGED_EVENT));
}

function persistTokenToCookie(token: string) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `omnilearn_token=${token}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

/**
 * Re-apply cookie from localStorage (Safari / privacy tools sometimes drop cookies; middleware only sees the cookie).
 */
export function syncAuthCookieFromStorage() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("omnilearn_token");
  if (token) persistTokenToCookie(token);
  else document.cookie = "omnilearn_token=; path=/; max-age=0";
}

/** Pass `{ notifyListeners: false }` for silent JWT rotation so hooks do not refetch `/auth/me`. */
function setToken(token: string, options?: { notifyListeners?: boolean }) {
  localStorage.setItem("omnilearn_token", token);
  persistTokenToCookie(token);
  if (options?.notifyListeners !== false) notifyAuthChanged();
}

function clearAuth() {
  localStorage.removeItem("omnilearn_token");
  localStorage.removeItem("omnilearn_user");
  if (typeof window !== "undefined") {
    document.cookie = "omnilearn_token=; path=/; max-age=0";
  }
  notifyAuthChanged();
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function executeAuthRefresh(): Promise<RefreshResult> {
  const token = getToken();
  if (!token) {
    return { ok: false, reason: "unauthorized" };
  }

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      clearAuth();
      return { ok: false, reason: "unauthorized" };
    }

    if (!res.ok) {
      return { ok: false, reason: "transient" };
    }

    const data = await res.json();
    if (data.accessToken) {
      setToken(data.accessToken, { notifyListeners: false });
      return { ok: true, accessToken: data.accessToken };
    }
    return { ok: false, reason: "transient" };
  } catch {
    return { ok: false, reason: "transient" };
  }
}

/** Single in-flight refresh so parallel 401s share one rotation and transient errors do not clear the session. */
async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshInflight) {
    refreshInflight = executeAuthRefresh().finally(() => {
      refreshInflight = null;
    });
  }
  return refreshInflight;
}

export async function refreshTokenQuiet(): Promise<string | null> {
  const r = await refreshAccessToken();
  return r.ok ? r.accessToken : null;
}

/** Clears session only when the server rejects refresh (not on network / 5xx). */
export async function tryRefreshToken(): Promise<string | null> {
  const r = await refreshAccessToken();
  return r.ok ? r.accessToken : null;
}

/** Backend may return root-relative API paths (e.g. stored logos). Use for <img src>. */
export function apiAbsoluteMediaUrl(src: string | null | undefined): string | undefined {
  if (src == null || src === "") return undefined;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const base = API_URL.replace(/\/$/, "");
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${base}${path}`;
}

export async function apiUploadTenantLogo(tenantId: string, file: File): Promise<Response> {
  const form = new FormData();
  form.append("logo", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}/company/tenants/${tenantId}/branding/logo`, {
    method: "POST",
    headers,
    body: form,
  });
}

export async function apiUploadDocument(file: File): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/content/upload-document`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
  return res.json();
}

export async function apiUploadCourseThumbnail(file: File): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/content/upload-course-thumbnail`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
  return res.json();
}

export async function apiDeleteTenantStoredLogo(tenantId: string): Promise<Response> {
  return apiFetch(`/company/tenants/${tenantId}/branding/logo`, { method: "DELETE" });
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers as Record<string, string>),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network error";
    throw new Error(
      message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network")
        ? `Could not reach the API at ${API_URL}. Make sure the backend is running (e.g. \`npm run start:dev -w backend\`).`
        : message
    );
  }

  if (res.status === 403 && getToken() && path !== "/auth/refresh") {
    const refreshResult = await refreshAccessToken();
    if (refreshResult.ok) {
      return fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers as Record<string, string>),
        },
      });
    }
    if (refreshResult.reason === "unauthorized" && typeof window !== "undefined") {
      window.location.href = `/signin?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  if (res.status === 401 && getToken() && path !== "/auth/refresh") {
    const refreshResult = await refreshAccessToken();
    if (refreshResult.ok) {
      return fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers as Record<string, string>),
        },
      });
    }

    if (refreshResult.reason === "unauthorized" && typeof window !== "undefined") {
      window.location.href = `/signin?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return res;
}

export { API_URL, setToken, clearAuth };
