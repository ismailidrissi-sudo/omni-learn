/**
 * Video.js / VHS need the correct MIME type so HLS is handled by VHS rather than as progressive MP4.
 */
export function inferVideoJsMimeType(src: string): string {
  if (!src || typeof src !== 'string') return 'video/mp4';
  const path = src.split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.m3u8') || path.endsWith('.m3u')) {
    return 'application/x-mpegURL';
  }
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.ogg') || path.endsWith('.ogv')) return 'video/ogg';
  return 'video/mp4';
}
