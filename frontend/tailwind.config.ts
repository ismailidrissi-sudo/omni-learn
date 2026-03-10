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
        brand: brandColors,
      },
      fontFamily: {
        sans: ["var(--font-avenir)", "Avenir", "Avenir Next", "Work Sans", "Segoe UI", "sans-serif"],
        display: ["var(--font-avenir)", "Avenir", "Avenir Next", "Work Sans", "Segoe UI", "sans-serif"],
        landing: ["var(--font-dm-sans)", "DM Sans", "Inter", "sans-serif"],
      },
      fontSize: {
        "brand-title": ["40px", { lineHeight: "1.2" }],
        "brand-subheading": ["23px", { lineHeight: "1.3" }],
        "brand-paragraph": ["13px", { lineHeight: "1.6" }],
        "brand-button": ["29px", { lineHeight: "1" }],
        "brand-link": ["13px", { lineHeight: "1.5" }],
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
