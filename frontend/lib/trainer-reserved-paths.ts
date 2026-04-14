/**
 * Segments under /trainer/ that are app routes, not public profile slugs.
 * Used by middleware to allow unauthenticated access only to /trainer/:publicSlug.
 */
export const TRAINER_RESERVED_SEGMENTS = new Set([
  "content",
  "stats",
  "settings",
  "profile",
  "api",
]);

/** True for exactly `/trainer/:slug` where slug is not a reserved app segment. */
export function isPublicTrainerProfilePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const m = normalized.match(/^\/trainer\/([^/]+)$/);
  if (!m) return false;
  return !TRAINER_RESERVED_SEGMENTS.has(m[1].toLowerCase());
}
