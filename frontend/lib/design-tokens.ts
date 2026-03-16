/**
 * Omni Learn Design Tokens
 * Visual & Brand Identity Guidelines | Afflatus Consulting Group
 * Font: Futura (Jost web fallback)
 */

export const tokens = {
  font: {
    family: "'Futura', 'Futura PT', 'Jost', 'Century Gothic', sans-serif",
    weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  },
  colors: {
    green: "#059669",
    greenLight: "#10b981",
    beige: "#D4B896",
    beigeLight: "#F5F5DC",
    beigeDark: "#C4A574",
    purple: "#059669",
    purpleLight: "#10b981",
    grey: "#C4A574",
    greyDark: "#C4A574",
    greyLight: "#D4B896",
    white: "#F5F5DC",
    black: "#1a1212",
    error: "#dc2626",
    success: "#059669",
    warning: "#d97706",
    info: "#2563eb",
  },
  typography: {
    title: { fontSize: 40, lineHeight: 1.2, letterSpacing: "-0.02em" },
    subheading: { fontSize: 23, lineHeight: 1.3, letterSpacing: "-0.01em" },
    paragraph: { fontSize: 15, lineHeight: 1.6, letterSpacing: "0" },
    button: { fontSize: 16, lineHeight: 1, letterSpacing: "0.01em" },
    link: { fontSize: 14, lineHeight: 1.5, letterSpacing: "0" },
    caption: { fontSize: 13, lineHeight: 1.4, letterSpacing: "0.01em" },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
  },
} as const;
