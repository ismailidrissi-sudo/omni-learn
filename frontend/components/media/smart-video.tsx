"use client";

import { useMemo } from "react";
import { detectProvider, isExternalProvider } from "@/lib/video-provider";
import { useI18n } from "@/lib/i18n/context";
import { ExternalEmbed } from "./external-embed";
import { VideoPlayer } from "./video-player";

interface SmartVideoProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  title?: string;
  className?: string;
  adsEnabled?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
}

function AdBanner() {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-center py-3 px-4 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700"
      style={{ minHeight: 50 }}
    >
      <span className="opacity-75">{t("media.advertisement")}</span>
      <span className="mx-2">&middot;</span>
      <span className="opacity-75">{t("media.upgradeToRemoveAds")}</span>
    </div>
  );
}

export function SmartVideo({
  src,
  hlsUrl,
  poster,
  title,
  className = "",
  adsEnabled = false,
  onTimeUpdate,
}: SmartVideoProps) {
  const detected = useMemo(() => detectProvider(src), [src]);

  if (isExternalProvider(detected.provider)) {
    return (
      <div>
        <ExternalEmbed
          src={detected.embedUrl}
          provider={detected.provider}
          title={title}
          className={className}
        />
        {adsEnabled && <AdBanner />}
      </div>
    );
  }

  return (
    <div>
      <VideoPlayer
        src={src}
        hlsUrl={hlsUrl}
        poster={poster}
        className={className}
        onTimeUpdate={onTimeUpdate}
      />
      {adsEnabled && <AdBanner />}
    </div>
  );
}
