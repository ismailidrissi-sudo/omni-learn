export type VideoProvider =
  | "youtube"
  | "vimeo"
  | "dailymotion"
  | "wistia"
  | "direct";

export interface VideoProviderResult {
  provider: VideoProvider;
  embedUrl: string;
  videoId: string;
  thumbnailUrl?: string;
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
  if (!url) return { provider: "direct", embedUrl: url, videoId: "" };

  const trimmed = url.trim();

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "youtube",
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1&modestbranding=1`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    }
  }

  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "vimeo",
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  }

  for (const pattern of DAILYMOTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "dailymotion",
        videoId,
        embedUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
        thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${videoId}`,
      };
    }
  }

  for (const pattern of WISTIA_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "wistia",
        videoId,
        embedUrl: `https://fast.wistia.net/embed/iframe/${videoId}`,
      };
    }
  }

  return { provider: "direct", embedUrl: trimmed, videoId: "" };
}

export function isExternalProvider(provider: VideoProvider): boolean {
  return provider !== "direct";
}

export function getProviderLabel(provider: VideoProvider): string {
  const labels: Record<VideoProvider, string> = {
    youtube: "YouTube",
    vimeo: "Vimeo",
    dailymotion: "Dailymotion",
    wistia: "Wistia",
    direct: "Direct URL",
  };
  return labels[provider];
}
