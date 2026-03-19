"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { LinkedInSignInButton } from "@/components/auth/LinkedInSignIn";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { tenantAuthShellNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch, setToken } from "@/lib/api";

function TenantSignInContent() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const redirect = searchParams.get("redirect") ?? `/${slug}/learn`;
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const academyName = branding?.appName || tenant?.name || "Academy";
  const primaryColor = branding?.primaryColor || "#059669";
  const shellNav = useMemo(() => tenantAuthShellNavItems(t, slug), [t, slug]);
  const ssoProviders = tenant?.ssoProviders ?? [];
  const hasSso = ssoProviders.length > 0;

  const handleSsoClick = () => {
    if (ssoProviders.includes("LINKEDIN_OIDC")) {
      const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
      if (!clientId) return;
      const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
      const state = JSON.stringify({ ref: "", redirect: `/${slug}/learn` });
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid profile email",
        state: encodeURIComponent(state),
      });
      window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    } else {
      setError("Enterprise SSO (SAML/OIDC) is being configured. Contact your administrator.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      if (!res.ok) throw new Error(data.message ?? "Login failed");
      if (typeof window !== "undefined") {
        setToken(data.accessToken);
        localStorage.setItem("omnilearn_user", JSON.stringify(data.user));
      }
      const meRes = await apiFetch("/profile/me");
      const me = meRes.ok ? await meRes.json() : null;
      if (me?.needsProfileCompletion) {
        router.push(`/${slug}/complete-profile`);
      } else if (redirect?.startsWith("/")) {
        router.push(redirect);
      } else {
        router.push(`/${slug}/learn`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(
        msg === "Invalid credentials" || msg === "Invalid email or password" ? t("auth.invalidCredentials") :
        msg === "Please verify your email before signing in" ? "Please verify your email first. Check your inbox." :
        msg === "Login failed" ? t("auth.loginFailed") : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--color-bg-primary)]" />;
  }

  return (
    <div
      className="min-h-screen font-landing flex flex-col bg-[var(--color-bg-primary)]"
      style={branding?.loginBgUrl ? {
        backgroundImage: `url(${branding.loginBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      <AppBurgerHeader
        borderClassName="border-0"
        headerClassName="p-4 md:p-6 flex justify-between items-center gap-3"
        logoHref={`/${slug}`}
        logo={<TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />}
        title={academyName}
        items={shellNav}
      />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[var(--color-accent)]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg dark:shadow-none"
        >
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Sign in to {academyName}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-[var(--color-text-secondary)]">
            {verified ? "Email verified! Sign in to continue." : `Access your ${academyName} learning portal.`}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <GoogleSignInButton useOneTap={false} />
            <LinkedInSignInButton />
            {hasSso && (
              <button
                type="button"
                onClick={handleSsoClick}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                {t("auth.signInWithSso")}
              </button>
            )}
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}30` }} />
            <span className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">{t("auth.or")}</span>
            <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}30` }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">
                {t("auth.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-accent)]/30 bg-gray-50 dark:bg-[var(--color-bg-primary)]/50 px-4 py-3 text-[var(--color-text-primary)] placeholder:text-gray-500 focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-accent)]/30 bg-gray-50 dark:bg-[var(--color-bg-primary)]/50 px-4 py-3 text-[var(--color-text-primary)] placeholder:text-gray-500 focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-[var(--color-text-secondary)]">
            {t("auth.noAccount")}{" "}
            <Link href={`/${slug}/signup`} className="font-medium hover:underline" style={{ color: primaryColor }}>
              {t("auth.signUp")}
            </Link>
          </p>
        </motion.div>
      </main>

      <footer className="py-4 text-center">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("portal.poweredBy")}{" "}
          <Link href="/" className="font-medium hover:underline" style={{ color: primaryColor }}>OmniLearn</Link>
        </p>
      </footer>
    </div>
  );
}

export default function TenantSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg-primary)]" />}>
      <TenantSignInContent />
    </Suspense>
  );
}
