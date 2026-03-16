"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  TIER_CONFIG,
  SECTORS,
  type BillingCycle,
  type SubscriptionPlan,
} from "@/lib/subscription";
import { SectorSelectorModal } from "./SectorSelectorModal";

const TIER_ORDER: SubscriptionPlan[] = [
  "EXPLORER",
  "SPECIALIST",
  "VISIONARY",
  "NEXUS",
];

export function PricingTable() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [sectorModalOpen, setSectorModalOpen] = useState(false);

  const handleCta = (plan: SubscriptionPlan) => {
    if (plan === "SPECIALIST") {
      setSectorModalOpen(true);
      return;
    }
    if (plan === "NEXUS") {
      window.location.href = "/contact?interest=enterprise";
      return;
    }
    if (plan === "EXPLORER") {
      window.location.href = "/signup";
      return;
    }
    if (plan === "VISIONARY") {
      window.location.href = "/signup?plan=visionary";
      return;
    }
  };

  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-brand-heading md:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-gray-600 dark:text-brand-stardustLight max-w-2xl mx-auto">
            Start free or unlock full access. Save up to $2/month when you bill annually.
          </p>

          {/* Monthly/Annual Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gray-100 dark:bg-gray-800 p-1.5">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === "annual"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Annual
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIER_ORDER.map((plan, i) => {
            const config = TIER_CONFIG[plan];
            const isAnnual = billingCycle === "annual";
            const price =
              plan === "NEXUS"
                ? null
                : plan === "EXPLORER"
                  ? 0
                  : isAnnual
                    ? config.priceAnnualPerMonth
                    : config.priceMonthly;
            const annualNote =
              plan !== "NEXUS" &&
              plan !== "EXPLORER" &&
              isAnnual &&
              `Billed $${config.priceAnnual}/year`;

            return (
              <motion.div
                key={plan}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-2xl border bg-white dark:bg-gray-900/50 p-6 flex flex-col ${
                  config.highlighted
                    ? "border-brand-green dark:border-brand-green shadow-lg shadow-brand-green/10 scale-[1.02] z-10"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {config.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {config.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {config.tagline}
                  </p>
                </div>
                <div className="mb-6 flex-1">
                  {price === null ? (
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      Contact Sales
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        ${price}
                      </span>
                      {plan !== "EXPLORER" && (
                        <span className="text-gray-500 dark:text-gray-400">
                          /mo
                        </span>
                      )}
                    </div>
                  )}
                  {annualNote && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {annualNote}
                    </p>
                  )}
                  {plan !== "EXPLORER" && plan !== "NEXUS" && isAnnual && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      Save ${(config.priceMonthly ?? 0) - (config.priceAnnualPerMonth ?? 0)}/mo
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-6 text-sm text-gray-600 dark:text-gray-300">
                  {config.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={config.highlighted ? "primary" : "outline"}
                  size="lg"
                  className="w-full"
                  onClick={() => handleCta(plan)}
                >
                  {config.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <SectorSelectorModal
        open={sectorModalOpen}
        onClose={() => setSectorModalOpen(false)}
        sectors={SECTORS}
        onSelect={(sector) => {
          window.location.href = `/signup?plan=specialist&sector=${encodeURIComponent(sector)}`;
        }}
      />
    </section>
  );
}
