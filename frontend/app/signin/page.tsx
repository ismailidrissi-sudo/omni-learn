"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const redirect = searchParams.get("redirect") ?? "/learn";
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t("auth.enterEmailPassword"));
      return;
    }
    setLoading(true);
    try {
      // Try regular login first
      let res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // Fallback to dev-login for admin (or when /auth/login not available yet)
      if (res.status === 401 || res.status === 404) {
        res = await fetch(`${API_URL}/auth/dev-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      }
      const data = await res.json();
      const errMsg = data.message ?? "Login failed";
      if (!res.ok) throw new Error(errMsg);
      if (typeof window !== "undefined") {
        localStorage.setItem("omnilearn_token", data.accessToken);
        localStorage.setItem("omnilearn_user", JSON.stringify(data.user));
      }
      // Check if profile complete (regular users)
      const meRes = await fetch(`${API_URL}/profile/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      const me = meRes.ok ? await meRes.json() : null;
      if (me?.needsProfileCompletion && redirect === "/learn") {
        router.push("/complete-profile");
      } else if (redirect?.startsWith("/")) {
        router.push(redirect);
      } else {
        router.push("/learn");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(
        msg === "Invalid credentials" ? t("auth.invalidCredentials") :
        msg === "Please verify your email before signing in" ? "Please verify your email first. Check your inbox." :
        msg === "Login failed" ? t("auth.loginFailed") : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="p-4 md:p-6 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="auto" />
        </Link>
        <NavToggles />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg dark:shadow-none"
        >
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">{t("auth.signIn")}</h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            {verified ? "Email verified! Sign in to complete your profile." : t("auth.signInSubtitle")}
          </p>

          <div className="mt-8 flex justify-center">
            <GoogleSignInButton useOneTap={false} />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#059669]/30" />
            <span className="text-sm text-gray-600 dark:text-brand-stardustLight">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-[#059669]/30" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="rounded-lg bg-[#C4A574]/20 px-4 py-2 text-sm text-[#1a1212] dark:text-[#1a1212]">
                {error}
              </p>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                {t("auth.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 bg-gradient-to-br from-[#059669] to-[#10b981]"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-brand-stardustLight">
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="font-medium text-[#059669] dark:text-[#10b981] hover:underline">
              {t("auth.signUp")}
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
