"use client";

import { useI18n } from "@/lib/i18n/context";
import { VideoPlayer } from "./video-player";

/**
 * Ad-Injected Player — Wraps VideoPlayer with ad slots for Free (Explorer) tier
 * omnilearn.space | ads_enabled: true for Tier 0
 */

interface AdInjectedPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  className?: string;
  adsEnabled: boolean;
  onTimeUpdate?: (currentTime: number) => void;
}

/** Mock ad banner — replace with real ad network integration */
function AdBanner() {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-center py-3 px-4 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700"
      style={{ minHeight: 50 }}
    >
      <span className="opacity-75">{t("media.advertisement")}</span>
      <span className="mx-2">·</span>
      <span className="opacity-75">{t("media.upgradeToRemoveAds")}</span>
    </div>
  );
}

export function AdInjectedPlayer({
  src,
  hlsUrl,
  poster,
  className = "",
  adsEnabled,
  onTimeUpdate,
}: AdInjectedPlayerProps) {
  return (
    <div className={`overflow-hidden rounded-lg bg-black ${className}`}>
      <VideoPlayer
        src={src}
        hlsUrl={hlsUrl}
        poster={poster}
        onTimeUpdate={onTimeUpdate}
      />
      {adsEnabled && <AdBanner />}
    </div>
  );
}
