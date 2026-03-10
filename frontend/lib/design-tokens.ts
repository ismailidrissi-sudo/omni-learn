/**
 * Learn! Design Tokens
 * Visual & Brand Identity Guidelines | Afflatus Consulting Group
 */

export const tokens = {
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
  },
  typography: {
    title: { fontSize: 40, lineHeight: 1.2 },
    subheading: { fontSize: 23, lineHeight: 1.3 },
    paragraph: { fontSize: 13, lineHeight: 1.6 },
    button: { fontSize: 29, lineHeight: 1 },
    link: { fontSize: 13, lineHeight: 1.5 },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
} as const;
