"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { LinkedInSignInButton } from "@/components/auth/LinkedInSignIn";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch, setToken } from "@/lib/api";

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const redirect = searchParams.get("redirect") ?? "/learn";
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResendVerify, setShowResendVerify] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowResendVerify(false);
    if (!email || !password) {
      setError(t("auth.enterEmailPassword"));
      return;
    }
    setLoading(true);
    try {
      let res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const isDev = process.env.NODE_ENV === "development";
      if (isDev && (res.status === 401 || res.status === 404)) {
        res = await apiFetch("/auth/dev-login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "The API returned an unexpected response. Make sure the backend server is running."
        );
      }
      const data = await res.json();
      const errMsg = data.message ?? "Login failed";
      if (!res.ok) throw new Error(errMsg);
      if (typeof window !== "undefined") {
        setToken(data.accessToken);
        localStorage.setItem("omnilearn_user", JSON.stringify(data.user));
      }
      // Check if profile complete (regular users)
      const meRes = await apiFetch("/profile/me");
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
      if (msg === "Invalid credentials" || msg === "Invalid email or password") {
        setError(t("auth.invalidCredentials"));
      } else if (msg === "Please verify your email before signing in") {
        setError("Please verify your email first. Check your inbox for a verification link.");
        setShowResendVerify(true);
      } else if (msg.includes("uses Google")) {
        setError("This account uses Google. Please click the Google button above to sign in.");
      } else if (msg.includes("uses LinkedIn")) {
        setError("This account uses LinkedIn. Please click the LinkedIn button above to sign in.");
      } else if (msg.includes("uses social login")) {
        setError("This account was created with social login. Try signing in with Google or LinkedIn above.");
      } else if (msg === "Login failed") {
        setError(t("auth.loginFailed"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Enter your email address above, then click Resend.");
      return;
    }
    setResending(true);
    try {
      const res = await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setError(data.message || "Verification email sent. Check your inbox.");
      setShowResendVerify(false);
    } catch {
      setError("Could not resend verification email. Please try again later.");
    } finally {
      setResending(false);
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

          <div className="mt-8 flex flex-col items-center gap-3">
            <GoogleSignInButton useOneTap={false} />
            <LinkedInSignInButton />
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#059669]/30" />
            <span className="text-sm text-gray-600 dark:text-brand-stardustLight">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-[#059669]/30" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} onDismiss={() => { setError(""); setShowResendVerify(false); }} />}
            {showResendVerify && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full text-sm font-medium text-[#059669] hover:underline disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend verification email"}
              </button>
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

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]" />}>
      <SignInPageContent />
    </Suspense>
  );
}
