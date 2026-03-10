"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";

function EnterpriseLeadForm() {
  const { t } = useI18n();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production: POST to /api/leads or CRM
    setSubmitted(true);
  };

  return (
    <section className="mt-8 rounded-xl border border-brand-green/30 bg-white/50 dark:bg-gray-900/50 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading mb-4">
        Nexus Enterprise — Contact Sales
      </h2>
      {submitted ? (
        <p className="text-brand-green">Thank you! We&apos;ll be in touch soon.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            Request Demo
          </button>
        </form>
      )}
    </section>
  );
}

function ContactContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const isEnterprise = searchParams.get("interest") === "enterprise";

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-brand-heading">
          {t("landing.footer.contact")}
        </h1>
        <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">
          {t("pages.contact.intro")}
        </p>
        <div className="mt-8 space-y-6 text-gray-700 dark:text-gray-300">
          {isEnterprise && <EnterpriseLeadForm />}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading">
              {t("pages.contact.section1Title")}
            </h2>
            <p className="mt-2">{t("pages.contact.section1Content")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading">
              {t("pages.contact.section2Title")}
            </h2>
            <p className="mt-2">{t("pages.contact.section2Content")}</p>
          </section>
        </div>
        <Link href="/" className="mt-12 inline-block text-brand-nova hover:underline">
          ← {t("pages.backToHome")}
        </Link>
    </main>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="border-b border-gray-200 dark:border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="light" />
        </Link>
        <NavToggles />
      </header>
      <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">Loading...</main>}>
        <ContactContent />
      </Suspense>
    </div>
  );
}
