"use client";

import * as React from "react";

/**
 * Button — Learn! Design System
 * Brand hierarchy: Button 29pt per guidelines
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  primary: "bg-brand-purple text-white hover:bg-brand-purple-light border-transparent",
  secondary: "bg-brand-grey text-white hover:bg-brand-grey-dark border-transparent",
  outline: "bg-transparent text-brand-purple border-2 border-brand-purple hover:bg-brand-purple/10",
  ghost: "bg-transparent text-brand-grey-dark hover:bg-brand-grey-light border-transparent",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-6 py-3 text-brand-button",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
