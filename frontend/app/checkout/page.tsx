"use client";

import { Suspense, useMemo } from "react";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";

const PLANS: Record<string, { name: string; priceMonthly: number; priceAnnual: number; features: string[] }> = {
  specialist: {
    name: "Specialist",
    priceMonthly: 6,
    priceAnnual: 5,
    features: [
      "Full access to your chosen sector",
      "Ad-free experience",
      "Downloadable resources & templates",
      "Progress tracking & certificates",
      "Community forum access",
    ],
  },
  visionary: {
    name: "Visionary",
    priceMonthly: 12,
    priceAnnual: 10,
    features: [
      "Unlimited access to all sectors",
      "Ad-free experience",
      "All downloadable resources & templates",
      "Progress tracking & certificates",
      "Priority community support",
      "Advanced analytics & insights",
      "Early access to new content",
    ],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") || "specialist";
  const plan = PLANS[planId];
  const { user, loading } = useUser();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"><p className="text-brand-grey">Loading...</p></div>
    );
  }

  if (!plan) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-brand-heading">Plan not found</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">The selected plan does not exist.</p>
        <Link href="/#pricing" className="mt-6 inline-block text-[#059669] font-medium hover:underline">
          View all plans
        </Link>
      </main>
    );
  }

  const price = billing === "annual" ? plan.priceAnnual : plan.priceMonthly;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-brand-heading">
        Subscribe to {plan.name}
      </h1>

      {!user && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Please{" "}
            <Link href={`/signin?redirect=/checkout?plan=${planId}`} className="font-semibold underline">
              sign in
            </Link>{" "}
            or{" "}
            <Link href={`/signup?redirect=/checkout?plan=${planId}`} className="font-semibold underline">
              create an account
            </Link>{" "}
            first to subscribe.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Plan summary */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name} Plan</h2>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${billing === "monthly" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${billing === "annual" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}
            >
              Annual
            </button>
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">${price}</span>
            <span className="text-gray-500">/mo</span>
          </div>
          {billing === "annual" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
              Save ${plan.priceMonthly - plan.priceAnnual}/mo with annual billing
            </p>
          )}

          <ul className="mt-6 space-y-2">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-[#059669] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment form placeholder */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card Number</label>
              <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-sm text-gray-400">
                Stripe integration coming soon
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry</label>
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-sm text-gray-400">
                  MM / YY
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CVC</label>
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-sm text-gray-400">
                  123
                </div>
              </div>
            </div>

            <button
              disabled
              className="mt-4 w-full rounded-lg px-4 py-3 font-semibold text-white opacity-70 cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              Subscribe — ${price}/mo
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Payment processing will be enabled with Stripe integration. Cancel anytime.
            </p>
          </div>
        </div>
      </div>

      <Link href="/#pricing" className="mt-8 inline-block text-[#059669] hover:underline text-sm">
        &larr; Back to Plans
      </Link>
    </main>
  );
}

export default function CheckoutPage() {
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]">
      <AppBurgerHeader
        borderClassName="border-b border-gray-200 dark:border-white/10"
        headerClassName="px-4 py-4 md:px-8 flex justify-between items-center gap-3"
        logoHref="/"
        logo={<OmnilearnLogo size="md" variant="light" />}
        items={shellNav}
      />
      <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-12">Loading...</main>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
