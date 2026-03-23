/**
 * Canonical learner navigation: micro-learning always opens the reels / social-first player.
 */
export function learnerContentHref(
  type: string | undefined,
  id: string,
  opts?: { tenantSlug?: string },
): string {
  const slug = opts?.tenantSlug?.trim();
  if (type === "MICRO_LEARNING") {
    return slug ? `/${slug}/micro/${id}` : `/micro/${id}`;
  }
  return slug ? `/${slug}/content/${id}` : `/content/${id}`;
}
