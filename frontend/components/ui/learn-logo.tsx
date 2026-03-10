"use client";

import Image from "next/image";

/**
 * LearnLogo — Omni Learn Brand Identity
 * Visual & Brand Identity | Afflatus Consulting Group
 * Red and beige palette
 */

type LogoSize = "sm" | "md" | "lg";

interface LearnLogoProps {
  size?: LogoSize;
  variant?: "purple" | "white" | "black";
  className?: string;
}

const sizeConfig: Record<LogoSize, { height: number }> = {
  lg: { height: 40 },
  md: { height: 28 },
  sm: { height: 18 },
};

export function LearnLogo({ size = "md", variant = "purple", className = "" }: LearnLogoProps) {
  const { height } = sizeConfig[size];
  const w = Math.round(height * (182.54 / 25.19));
  const logoSrc = variant === "white" ? "/omni-learn-logo-light.svg" : "/omni-learn-logo.svg";

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
