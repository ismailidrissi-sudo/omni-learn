"use client";

import * as React from "react";

/**
 * Input — Learn! Design System
 * Brand: purple accent, grey borders
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-brand-grey-dark text-sm font-medium mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-4 py-2.5 rounded-lg border bg-white text-brand-black placeholder:text-brand-grey
          focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent
          disabled:bg-brand-grey-light disabled:cursor-not-allowed
          ${error ? "border-brand-grey-dark" : "border-brand-grey-light"}
          ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-brand-grey-dark">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";
