"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { LinkedInSignInButton } from "@/components/auth/LinkedInSignIn";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

export default function TenantSignUpPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, tenantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Sign up failed");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--color-bg-primary)]" />;
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[var(--color-accent)]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">{t("auth.checkEmail")}</h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {t("auth.checkEmailBody", { email })}
          </p>
          <Link
            href={`/${slug}/signin`}
            className="inline-block px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {t("auth.goToSignIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-landing flex flex-col bg-[var(--color-bg-primary)]">
      <header className="p-4 md:p-6 flex justify-between items-center">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[var(--color-accent)]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg dark:shadow-none"
        >
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("auth.joinAcademy", { name: academyName })}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-[var(--color-text-secondary)]">
            {t("auth.createYourAccount")}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <GoogleSignInButton useOneTap={false} />
            <LinkedInSignInButton />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}30` }} />
            <span className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">{t("auth.or")}</span>
            <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}30` }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">{t("auth.fullName")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-accent)]/30 bg-gray-50 dark:bg-[var(--color-bg-primary)]/50 px-4 py-3 text-[var(--color-text-primary)] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">{t("auth.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-accent)]/30 bg-gray-50 dark:bg-[var(--color-bg-primary)]/50 px-4 py-3 text-[var(--color-text-primary)] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">{t("auth.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.minCharacters")}
                className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-accent)]/30 bg-gray-50 dark:bg-[var(--color-bg-primary)]/50 px-4 py-3 text-[var(--color-text-primary)] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
            >
              {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">
            {t("auth.hasAccount")}{" "}
            <Link href={`/${slug}/signin`} className="font-medium hover:underline" style={{ color: primaryColor }}>
              {t("auth.signIn")}
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
