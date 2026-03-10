"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

/**
 * OmnilearnLogo — Uses Omni Learn logo from assets
 * omnilearn.space | Afflatus Consulting Group
 * Brand colors: green and beige
 */

type LogoSize = "sm" | "md" | "lg";

interface OmnilearnLogoProps {
  size?: LogoSize;
  className?: string;
  /** Use "dark" for dark backgrounds, "light" for light, "auto" to follow theme */
  variant?: "light" | "dark" | "auto";
}

const sizeConfig: Record<LogoSize, { height: number; fontSize: number }> = {
  lg: { height: 48, fontSize: 22 },
  md: { height: 38, fontSize: 16 },
  sm: { height: 28, fontSize: 13 },
};

export function OmnilearnLogo({ size = "md", className = "", variant = "light" }: OmnilearnLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const { height, fontSize } = sizeConfig[size];
  useEffect(() => setMounted(true), []);
  const isDark =
    variant === "auto"
      ? mounted && resolvedTheme === "dark"
      : variant === "dark";
  const w = Math.round(height * (182.54 / 25.19));
  const textClass = isDark ? "text-[#F5F5DC]" : "text-[#1a1212]";

  if (imgError) {
    return (
      <div className={`flex items-center font-bold ${textClass} ${className}`} style={{ fontSize }}>
        omnilearn<span className={isDark ? "text-[#10b981]" : "text-[#059669]"}>.space</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center min-w-[100px] ${className}`}>
      <Image
        src="/omni-learn-logo.svg"
        alt="Omni Learn"
        width={w}
        height={height}
        className={`object-contain object-left ${isDark ? "opacity-95" : ""}`}
        priority
        unoptimized
        style={{ width: w, height }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
