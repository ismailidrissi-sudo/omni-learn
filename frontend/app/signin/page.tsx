"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { LinkedInSignInButton } from "@/components/auth/LinkedInSignIn";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch, setToken } from "@/lib/api";

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const passwordResetDone = searchParams.get("passwordReset") === "1";
  const resetToken = searchParams.get("resetToken");
  const redirect = searchParams.get("redirect") ?? "/learn";
  const referralCode = searchParams.get("ref") ?? "";
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResendVerify, setShowResendVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

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

  const handlePasswordResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!resetToken) {
      setError("Reset link is invalid or expired.");
      return;
    }
    if (!email || !newPassword) {
      setError("Enter your email and new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ email, token: resetToken, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Could not reset password");
      }
      router.replace("/signin?passwordReset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSending(true);
    setForgotMessage("");
    try {
      const res = await apiFetch("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setForgotMessage(data.message || t("auth.resetEmailSent"));
    } catch {
      setForgotMessage(t("auth.resetEmailSent"));
    } finally {
      setForgotSending(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">
            {resetToken ? "Set new password" : t("auth.signIn")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            {passwordResetDone
              ? "Your password was updated. You can sign in below."
              : resetToken
                ? "Enter the email this reset was sent to, then choose a new password."
                : verified
                  ? "Email verified! Sign in to complete your profile."
                  : t("auth.signInSubtitle")}
          </p>

          {resetToken ? (
            <form onSubmit={handlePasswordResetConfirm} className="mt-8 space-y-5">
              {error && (
                <ErrorBanner message={error} onDismiss={() => setError("")} />
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                  {t("auth.email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 dark:placeholder:text-[#D4B896]/60 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 bg-gradient-to-br from-[#059669] to-[#10b981]"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : (
            <>
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
              <button
                type="button"
                onClick={() => { setShowForgot(!showForgot); setForgotEmail(email); }}
                className="mt-1.5 text-xs text-[#059669] dark:text-[#10b981] hover:underline"
              >
                {t("auth.forgotPassword")}
              </button>
            </div>

            {showForgot && (
              <div className="rounded-lg border border-[#059669]/20 bg-[#059669]/5 dark:bg-[#059669]/10 p-4 space-y-3">
                <p className="text-sm text-gray-700 dark:text-brand-stardustLight">
                  {t("auth.forgotPasswordHint")}
                </p>
                <form onSubmit={handleForgotPassword} className="flex gap-2">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#F5F5DC]/5 px-3 py-2 text-sm text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]"
                  />
                  <button
                    type="submit"
                    disabled={forgotSending || !forgotEmail}
                    className="rounded-lg bg-[#059669] px-4 py-2 text-sm font-medium text-white hover:bg-[#059669]/90 disabled:opacity-60"
                  >
                    {forgotSending ? "Sending…" : "Send"}
                  </button>
                </form>
                {forgotMessage && (
                  <p className="text-xs text-[#059669] dark:text-[#10b981]">{forgotMessage}</p>
                )}
              </div>
            )}

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
            </>
          )}
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
