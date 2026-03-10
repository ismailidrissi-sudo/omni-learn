"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ContactSalesModal } from "./ContactSalesModal";

type BillingCycle = "monthly" | "annual";

type PricingCard = {
  id: string;
  name: string;
  copy: string;
  badge: string | null;
  style: string;
  cta: string;
  price?: number | null;
  priceMonthly?: number;
  priceAnnual?: number;
  planId?: string;
  href?: string;
  isContact?: boolean;
};

const CARDS: PricingCard[] = [
  {
    id: "explorer",
    name: "Explorer",
    price: 0,
    copy: "Dip your toes into new industries with ad-supported foundational courses.",
    badge: null,
    style: "minimalist",
    cta: "Get Started Free",
    href: "/signup",
  },
  {
    id: "specialist",
    name: "Specialist",
    priceMonthly: 6,
    priceAnnual: 5,
    copy: "Master your field. Unrestricted access to your specific sector.",
    badge: "Best for Professionals",
    style: "highlight",
    cta: "Get Specialist",
    planId: "specialist",
  },
  {
    id: "visionary",
    name: "Visionary",
    priceMonthly: 12,
    priceAnnual: 10,
    copy: "The ultimate library. Cross-train across all sectors and masterclasses.",
    badge: "Most Popular",
    style: "featured",
    cta: "Get Visionary",
    planId: "visionary",
  },
  {
    id: "nexus",
    name: "Nexus",
    price: null,
    copy: "Transform your workforce with a branded internal academy and custom content.",
    badge: "For Teams & Academies",
    style: "dark",
    cta: "Contact Sales",
    isContact: true,
  },
];

export function PricingSection() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const handleCta = (card: PricingCard) => {
    if (card.isContact) {
      setContactModalOpen(true);
      return;
    }
    if (card.planId) {
      router.push(`/checkout?plan=${card.planId}`);
      return;
    }
    if (card.href) {
      router.push(card.href);
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
            Start free or unlock full access. Save 20% when you bill annually.
          </p>

          {/* Monthly/Annual Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gray-100 dark:bg-gray-800 p-1.5">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
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
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Annual
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((card, i) => {
            const isAnnual = billingCycle === "annual";
            const price =
              card.price !== undefined && card.price !== null
                ? card.price
                : card.priceMonthly !== undefined
                  ? isAnnual
                    ? card.priceAnnual
                    : card.priceMonthly
                  : null;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`
                  relative rounded-2xl p-6 flex flex-col
                  ${card.style === "minimalist" ? "bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700" : ""}
                  ${card.style === "highlight" ? "bg-white dark:bg-gray-900/50 border-2 border-brand-green/50 dark:border-brand-green/50 shadow-md" : ""}
                  ${card.style === "featured" ? "bg-gradient-to-b from-brand-green/10 to-transparent dark:from-brand-green/20 dark:to-transparent border-2 border-brand-green dark:border-brand-green shadow-lg shadow-brand-green/20 scale-[1.02] z-10 ring-2 ring-brand-green/30" : ""}
                  ${card.style === "dark" ? "bg-gray-900 dark:bg-gray-950 border border-gray-700 text-white" : ""}
                `}
              >
                {/* Badge */}
                {card.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold ${
                      card.style === "featured"
                        ? "text-white"
                        : card.style === "dark"
                          ? "bg-gray-700 text-gray-200"
                          : "bg-brand-green/15 text-brand-green dark:bg-brand-green/25 dark:text-brand-green"
                    }`}
                    style={
                      card.style === "featured"
                        ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }
                        : undefined
                    }
                  >
                    {card.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h3
                    className={`text-lg font-bold ${
                      card.style === "dark"
                        ? "text-white"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {card.name}
                  </h3>
                </div>

                <div className="mb-6 flex-1">
                  {price === null ? (
                    <div
                      className={`text-2xl font-bold ${
                        card.style === "dark"
                          ? "text-white"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      Contact Sales
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-3xl font-bold ${
                          card.style === "dark"
                            ? "text-white"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        ${price}
                      </span>
                      {price != null && price > 0 && (
                        <span
                          className={
                            card.style === "dark"
                              ? "text-gray-400"
                              : "text-gray-500 dark:text-gray-400"
                          }
                        >
                          /mo
                        </span>
                      )}
                    </div>
                  )}
                  {card.priceMonthly !== undefined &&
                    card.priceAnnual !== undefined &&
                    isAnnual && (
                      <p
                        className={`mt-1 text-xs ${
                          card.style === "dark"
                            ? "text-green-400"
                            : "text-green-600 dark:text-green-400"
                        } font-medium`}
                      >
                        Save ${card.priceMonthly - card.priceAnnual}/mo
                      </p>
                    )}
                </div>

                <p
                  className={`mb-6 text-sm leading-relaxed ${
                    card.style === "dark"
                      ? "text-gray-300"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {card.copy}
                </p>

                <Button
                  variant={
                    card.style === "featured" || card.style === "dark"
                      ? "primary"
                      : "outline"
                  }
                  size="lg"
                  className={`w-full ${
                    card.style === "dark"
                      ? "bg-white text-gray-900 hover:bg-gray-100"
                      : ""
                  }`}
                  onClick={() => handleCta(card)}
                >
                  {card.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <ContactSalesModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />
    </section>
  );
}
