"use client";

import Link from "next/link";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="border-b border-gray-200 dark:border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="light" />
        </Link>
        <NavToggles />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-brand-heading">
          {t("landing.footer.privacy")}
        </h1>
        <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">
          {t("pages.privacy.intro")}
        </p>
        <div className="mt-8 space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading">
              {t("pages.privacy.section1Title")}
            </h2>
            <p className="mt-2">{t("pages.privacy.section1Content")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading">
              {t("pages.privacy.section2Title")}
            </h2>
            <p className="mt-2">{t("pages.privacy.section2Content")}</p>
          </section>
        </div>
        <Link href="/" className="mt-12 inline-block text-brand-nova hover:underline">
          ← {t("pages.backToHome")}
        </Link>
      </main>
    </div>
  );
}
