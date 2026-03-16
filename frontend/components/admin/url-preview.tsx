"use client";

import { useMemo } from "react";
import {
  detectProvider,
  isExternalProvider,
  getProviderLabel,
} from "@/lib/video-provider";

interface UrlPreviewProps {
  url: string;
  type?: "video" | "audio" | "document" | "any";
}

export function UrlPreview({ url, type = "video" }: UrlPreviewProps) {
  const detected = useMemo(
    () => (url.trim() ? detectProvider(url.trim()) : null),
    [url],
  );

  if (!detected || !url.trim()) return null;

  if (isExternalProvider(detected.provider)) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            ✓ {getProviderLabel(detected.provider)} detected
          </span>
        </div>
        {detected.thumbnailUrl && (
          <div className="relative w-full max-w-xs overflow-hidden rounded-lg border border-brand-grey-light">
            <img
              src={detected.thumbnailUrl}
              alt="Video thumbnail"
              className="w-full aspect-video object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <span className="text-white text-lg ml-0.5">▶</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === "video" && url.trim()) {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Direct video URL
        </span>
      </div>
    );
  }

  return null;
}
