/** Resolve API-relative paths (e.g. trainer avatar uploads) to absolute URLs for <img src>. */
export function apiAssetUrl(path: string | undefined | null): string | undefined {
  if (path == null || path === "") return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
