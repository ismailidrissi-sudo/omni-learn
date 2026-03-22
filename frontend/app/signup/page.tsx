"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { LinkedInSignInButton } from "@/components/auth/LinkedInSignIn";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

function SignUpContent() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trainerRequested, setTrainerRequested] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  /** Read on each render — `ref` must not be snapshotted in `useState` or it can stay empty when params hydrate. */
  const referralCode = searchParams.get("ref") ?? "";
  const [referrerValid, setReferrerValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!referralCode) return;
    apiFetch(`/referral/resolve/${referralCode}`)
      .then((r) => r.json())
      .then((d) => setReferrerValid(d.valid === true))
      .catch(() => setReferrerValid(false));
  }, [referralCode]);

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
    try {
      const res = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name, trainerRequested, ...(referralCode ? { referralCode } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Signup failed. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
        <AppBurgerHeader
          borderClassName="border-0"
          headerClassName="p-4 md:p-6 flex justify-between items-center gap-3"
          logoHref="/"
          logo={<OmnilearnLogo size="md" variant="auto" />}
          items={shellNav}
        />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg"
          >
            <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">Check your email</h1>
            <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">
              We sent a confirmation link to <strong>{email}</strong>. Click the link to verify your account, then complete your profile.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Didn&apos;t receive it? Check spam or{" "}
              <button type="button" onClick={() => setSuccess(false)} className="text-[#059669] hover:underline">
                try again
              </button>
            </p>
            <Link href="/signin" className="mt-6 block text-center text-[#059669] hover:underline">
              Back to sign in
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
      <AppBurgerHeader
        borderClassName="border-0"
        headerClassName="p-4 md:p-6 flex justify-between items-center gap-3"
        logoHref="/"
        logo={<OmnilearnLogo size="md" variant="auto" />}
        items={shellNav}
      />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg dark:shadow-none"
        >
          {referralCode && referrerValid && (
            <div className="mb-4 rounded-lg bg-[#059669]/10 dark:bg-[#059669]/20 border border-[#059669]/30 px-4 py-3">
              <p className="text-sm font-medium text-[#059669] dark:text-[#10b981]">
                You&apos;ve been invited! Sign up to unlock special benefits.
              </p>
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">{t("auth.signUp")}</h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            {t("auth.signUpSubtitle")}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <GoogleSignInButton useOneTap={false} referralCode={referralCode} />
            <LinkedInSignInButton referralCode={referralCode} />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#059669]/30" />
            <span className="text-sm text-gray-600 dark:text-brand-stardustLight">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-[#059669]/30" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50/50 dark:bg-[#F5F5DC]/5 px-4 py-3">
              <input
                type="checkbox"
                checked={trainerRequested}
                onChange={(e) => setTrainerRequested(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#059669] focus:ring-[#059669]"
              />
              <span className="text-sm text-gray-700 dark:text-brand-stardustLight">
                I want to create content as a trainer (subject to admin approval)
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 bg-gradient-to-br from-[#059669] to-[#10b981]"
            >
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-brand-stardustLight">
            {t("auth.hasAccount")}{" "}
            <Link href="/signin" className="font-medium text-[#059669] dark:text-[#10b981] hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 rounded-full border-4 border-[#059669] border-t-transparent animate-spin" /></div>}>
      <SignUpContent />
    </Suspense>
  );
}
