export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'dailymotion'
  | 'wistia'
  | 'direct';

export interface VideoProviderResult {
  provider: VideoProvider;
  embedUrl: string;
  videoId: string;
  thumbnailUrl?: string;
  valid: boolean;
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERNS = [
  /vimeo\.com\/(?:video\/)?(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
];

const DAILYMOTION_PATTERNS = [
  /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
  /dai\.ly\/([a-zA-Z0-9]+)/,
];

const WISTIA_PATTERNS = [
  /wistia\.com\/medias\/([a-zA-Z0-9]+)/,
  /wi\.st\/medias\/([a-zA-Z0-9]+)/,
];

export function detectProvider(url: string): VideoProviderResult {
  if (!url || !url.trim()) {
    return { provider: 'direct', embedUrl: '', videoId: '', valid: false };
  }

  const trimmed = url.trim();

  try {
    new URL(trimmed);
  } catch {
    return { provider: 'direct', embedUrl: trimmed, videoId: '', valid: false };
  }

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: 'youtube',
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        valid: true,
      };
    }
  }

  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: 'vimeo',
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
        valid: true,
      };
    }
  }

  for (const pattern of DAILYMOTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: 'dailymotion',
        videoId,
        embedUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
        thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${videoId}`,
        valid: true,
      };
    }
  }

  for (const pattern of WISTIA_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: 'wistia',
        videoId,
        embedUrl: `https://fast.wistia.net/embed/iframe/${videoId}`,
        valid: true,
      };
    }
  }

  return { provider: 'direct', embedUrl: trimmed, videoId: '', valid: true };
}
