"use client";

import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  primary: "bg-brand-purple text-white hover:bg-brand-purple-light border-transparent shadow-sm hover:shadow-md hover:shadow-brand-purple/20",
  secondary: "bg-brand-grey text-white hover:bg-brand-grey-dark border-transparent",
  outline: "bg-transparent text-brand-purple border-2 border-brand-purple hover:bg-brand-purple/10",
  ghost: "bg-transparent text-brand-grey-dark hover:bg-brand-grey-light/60 border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent shadow-sm",
};

const sizes = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-[0.9375rem]",
  lg: "px-7 py-3 text-brand-button",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-semibold rounded-xl border transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
