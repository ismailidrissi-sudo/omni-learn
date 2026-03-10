"use client";

import * as React from "react";

/**
 * Badge — Blueprint-style badge with color variants
 */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "pulsar" | "nova" | "solar" | "comet" | "stardust";
  color?: string; // Custom hex for blueprint color mapping
}

const variantStyles: Record<string, string> = {
  default: "text-brand-grey-dark bg-brand-grey-light border-brand-grey/30",
  pulsar: "text-brand-purple bg-brand-purple/10 border-brand-purple/30",
  nova: "text-brand-purple bg-brand-purple/10 border-brand-purple/30",
  solar: "text-brand-grey-dark bg-brand-grey-light border-brand-grey/30",
  comet: "text-brand-purple bg-brand-purple/10 border-brand-purple/30",
  stardust: "text-brand-grey bg-brand-grey-light border-brand-grey/30",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", color, style, ...props }, ref) => {
    const customStyle = color
      ? {
          color,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          ...style,
        }
      : style;

    return (
      <span
        ref={ref}
        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border transition-colors ${
          !color ? variantStyles[variant] : ""
        } ${className}`}
        style={customStyle}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
