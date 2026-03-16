"use client";

import Image from "next/image";

/**
 * LearnLogo — Omni Learn Brand Identity.
 */

type LogoSize = "sm" | "md" | "lg";

interface LearnLogoProps {
  size?: LogoSize;
  variant?: "purple" | "white" | "black";
  className?: string;
}

const sizeConfig: Record<LogoSize, { height: number }> = {
  lg: { height: 64 },
  md: { height: 48 },
  sm: { height: 36 },
};

export function LearnLogo({ size = "md", variant: _variant = "purple", className = "" }: LearnLogoProps) {
  const { height } = sizeConfig[size];
  const w = height;
  const logoSrc = "/omni-learn-logo.png";

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={logoSrc}
        alt="Omni Learn"
        width={w}
        height={height}
        className="object-contain object-left opacity-95"
        priority
        unoptimized
        style={{ width: w, height }}
      />
    </div>
  );
}
