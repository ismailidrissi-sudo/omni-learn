"use client";

import * as React from "react";

/**
 * Card — Brand-styled card with blueprint effect
 * background: nebula, border: nova 8%
 */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent" | "glow" | "glow-pulsar" | "glow-solar";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variantClasses = {
      default: "card-brand",
      "accent": "card-brand-accent",
      glow: "bg-brand-purple/5 border border-brand-purple/20",
      "glow-pulsar": "bg-brand-purple/5 border border-brand-purple/20",
      "glow-solar": "bg-brand-grey-light/50 border border-brand-grey/30",
    };

    return (
      <div
        ref={ref}
        className={`rounded-xl ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1.5 p-4 ${className}`} {...props} />
));

CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-base font-semibold leading-none tracking-tight text-brand-black ${className}`}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`p-4 pt-0 ${className}`} {...props} />
));

CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`flex items-center p-4 pt-0 ${className}`} {...props} />
));

CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
