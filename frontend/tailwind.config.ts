import type { Config } from "tailwindcss";

/**
 * Omni Learn — Brand Design Tokens
 * Visual & Brand Identity | Afflatus Consulting Group
 * Green & Beige palette only
 */
const brandColors = {
  green: "#059669",       // Primary green
  greenLight: "#10b981",  // Lighter green
  beige: "#D4B896",       // Warm beige
  beigeLight: "#F5F5DC",  // Light beige
  beigeDark: "#C4A574",   // Dark beige
  white: "#F5F5DC",
  black: "#1a1212",
  // Legacy aliases
  purple: "#059669",
  purpleLight: "#10b981",
  grey: "#C4A574",
  greyDark: "#C4A574",
  greyLight: "#D4B896",
  pulsar: "#059669",
  solar: "#D4B896",
  stardust: "#C4A574",
  cosmos: "#0f1510",
  nebula: "#1a1e18",
  stardustLight: "#D4B896",
  heading: "#F5F5DC",
  nova: "#059669",
  pulsarGreen: "#10b981",
};

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        trainer: {
          primary: "#1D9E75",
          secondary: "#6B2D8B",
          amber: "#BA7517",
          linkedin: "#0A66C2",
        },
        brand: brandColors,
      },
      fontFamily: {
        sans: ["var(--font-futura)", "Futura", "Futura PT", "Jost", "Century Gothic", "sans-serif"],
        display: ["var(--font-futura)", "Futura", "Futura PT", "Jost", "Century Gothic", "sans-serif"],
        landing: ["var(--font-futura)", "Futura", "Futura PT", "Jost", "Century Gothic", "sans-serif"],
      },
      fontSize: {
        "brand-title": ["2.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "brand-subheading": ["1.4375rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "brand-paragraph": ["0.9375rem", { lineHeight: "1.6" }],
        "brand-button": ["1rem", { lineHeight: "1", letterSpacing: "0.01em" }],
        "brand-link": ["0.875rem", { lineHeight: "1.5" }],
        "brand-caption": ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0.01em" }],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 25s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
