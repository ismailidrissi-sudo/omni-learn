/**
 * Subscription tiers & pricing logic
 * omnilearn.space | 4-tier subscription system
 */

export type SubscriptionPlan = "EXPLORER" | "SPECIALIST" | "VISIONARY" | "NEXUS";
export type BillingCycle = "monthly" | "annual";

export const TIER_IDS = {
  EXPLORER: 0,
  SPECIALIST: 1,
  VISIONARY: 2,
  NEXUS: 3,
} as const;

export const TIER_CONFIG = {
  EXPLORER: {
    id: 0,
    name: "Explorer",
    tagline: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    priceAnnualPerMonth: 0,
    features: [
      "Limited content tagged as Foundational",
      "Ads enabled on video content",
      "Community access",
    ],
    cta: "Get Started Free",
    highlighted: false,
    adsEnabled: true,
  },
  SPECIALIST: {
    id: 1,
    name: "Specialist",
    tagline: "Pro Sector",
    priceMonthly: 6,
    priceAnnual: 60,
    priceAnnualPerMonth: 5,
    features: [
      "Full access to one sector (Biotech, Food Safety, AI, etc.)",
      "No ads",
      "Certificates & progress tracking",
      "Sector-specific learning paths",
    ],
    cta: "Choose Your Sector",
    highlighted: true,
    adsEnabled: false,
  },
  VISIONARY: {
    id: 2,
    name: "Visionary",
    tagline: "All-Access",
    priceMonthly: 12,
    priceAnnual: 120,
    priceAnnualPerMonth: 10,
    features: [
      "100% of platform library",
      "No ads",
      "All sectors unlocked",
      "Priority support",
    ],
    cta: "Start All-Access",
    highlighted: false,
    adsEnabled: false,
  },
  NEXUS: {
    id: 3,
    name: "Nexus",
    tagline: "Enterprise",
    priceMonthly: null,
    priceAnnual: null,
    priceAnnualPerMonth: null,
    features: [
      "All platform content",
      "Branded Company Academy",
      "Multi-tenant isolation",
      "Admin dashboard & employee analytics",
      "Private tenant content upload",
    ],
    cta: "Contact Sales",
    highlighted: false,
    adsEnabled: false,
  },
} as const;

export const SECTORS = [
  { id: "biotech", name: "Biotech", icon: "🧬" },
  { id: "food_safety", name: "Food Safety", icon: "🔬" },
  { id: "ai", name: "AI & Tech", icon: "🤖" },
  { id: "esg", name: "ESG & Sustainability", icon: "🌍" },
  { id: "pharma", name: "Pharma", icon: "💊" },
  { id: "manufacturing", name: "Manufacturing", icon: "🏭" },
] as const;
