/**
 * Video.js central configuration for OmniLearn.space
 * Single source of truth for all player instances.
 * omnilearn.space | Afflatus Consulting Group
 */

export const VIDEOJS_DEFAULT_OPTIONS: Record<string, any> = {
  controls: true,
  responsive: true,
  fluid: true,
  preload: 'metadata',
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
  controlBar: {
    children: [
      'playToggle',
      'volumePanel',
      'currentTimeDisplay',
      'timeDivider',
      'durationDisplay',
      'progressControl',
      'playbackRateMenuButton',
      'pictureInPictureToggle',
      'fullscreenToggle',
    ],
    pictureInPictureToggle: true,
  },
  html5: {
    vhs: {
      overrideNative: true,
    },
    nativeAudioTracks: false,
    nativeVideoTracks: false,
  },
  techOrder: ['html5'],
  sources: [],
};

export const QUALITY_LEVELS = {
  '1080p': { width: 1920, height: 1080, bitrate: 5000000 },
  '720p': { width: 1280, height: 720, bitrate: 2500000 },
  '480p': { width: 854, height: 480, bitrate: 1000000 },
  '360p': { width: 640, height: 360, bitrate: 600000 },
} as const;

export const COMPLETION_CONFIG = {
  COMPLETION_THRESHOLD: 0.90,
  MICRO_COMPLETION_THRESHOLD: 0.80,
  SYNC_INTERVAL_SECONDS: 10,
  HEARTBEAT_INTERVAL_MS: 30000,
  MIN_WATCH_SECONDS: 5,
  SEEK_TOLERANCE: 0.05,
};
