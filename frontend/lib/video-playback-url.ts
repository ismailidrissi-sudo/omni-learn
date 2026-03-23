import { API_URL } from '@/lib/api';

/** Backend stream paths like `/video/stream/:id` must hit the API origin, not the Next.js site. */
export function absolutePlaybackUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith('/') && !u.startsWith('//')) {
    return `${API_URL}${u}`;
  }
  return u;
}
