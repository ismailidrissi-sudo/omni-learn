const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Same-tab auth updates (e.g. Google One Tap) do not fire `storage`; hooks listen for this. */
export const OMNILEARN_AUTH_CHANGED_EVENT = "omnilearn-auth-changed";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omnilearn_token");
}

const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days — align with middleware so cookie outlives token refresh

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OMNILEARN_AUTH_CHANGED_EVENT));
}

/** Pass `{ notifyListeners: false }` for silent JWT rotation so hooks do not refetch `/auth/me`. */
function setToken(token: string, options?: { notifyListeners?: boolean }) {
  localStorage.setItem("omnilearn_token", token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `omnilearn_token=${token}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  if (options?.notifyListeners !== false) notifyAuthChanged();
}

function clearAuth() {
  localStorage.removeItem("omnilearn_token");
  localStorage.removeItem("omnilearn_user");
  document.cookie = "omnilearn_token=; path=/; max-age=0";
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

async function refreshTokenQuiet(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      setToken(data.accessToken, { notifyListeners: false });
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function tryRefreshToken(): Promise<string | null> {
  const result = await refreshTokenQuiet();
  if (!result) clearAuth();
  return result;
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

  if (res.status === 403 && getToken() && !path.startsWith("/auth/")) {
    const newToken = await refreshTokenQuiet();
    if (newToken) {
      return fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers as Record<string, string>),
        },
      });
    }
  }

  if (res.status === 401 && getToken() && !path.startsWith("/auth/")) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      return fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers as Record<string, string>),
        },
      });
    }

    if (typeof window !== "undefined") {
      window.location.href = `/signin?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return res;
}

export { API_URL, setToken, clearAuth, tryRefreshToken, refreshTokenQuiet };
