const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omnilearn_token");
}

function setToken(token: string) {
  localStorage.setItem("omnilearn_token", token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `omnilearn_token=${token}; path=/; max-age=${60 * 60}; SameSite=Lax${secure}`;
}

function clearAuth() {
  localStorage.removeItem("omnilearn_token");
  localStorage.removeItem("omnilearn_user");
  document.cookie = "omnilearn_token=; path=/; max-age=0";
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

async function tryRefreshToken(): Promise<string | null> {
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
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const data = await res.json();
    if (data.accessToken) {
      setToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    clearAuth();
    return null;
  }
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

  if (res.status === 401 && getToken() && !path.includes("/auth/refresh")) {
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

    if (typeof window !== "undefined" && !path.includes("/auth/")) {
      window.location.href = `/signin?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return res;
}

export { API_URL, setToken, clearAuth };
