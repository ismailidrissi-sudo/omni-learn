"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import Link from "next/link";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";

function LinkedInCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(
        errorParam === "user_cancelled_login"
          ? "LinkedIn sign-in was cancelled."
          : `LinkedIn sign-in failed: ${searchParams.get("error_description") || errorParam}`,
      );
      return;
    }

    if (!code) {
      setError("No authorization code received from LinkedIn.");
      return;
    }

    let referralCode = "";
    let redirect = "/learn";
    try {
      const raw = stateRaw || "{}";
      const parsed = JSON.parse(raw.startsWith("{") ? raw : decodeURIComponent(raw)) as {
        ref?: string;
        redirect?: string;
      };
      referralCode = parsed.ref || "";
      redirect = parsed.redirect || "/learn";
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const res = await apiFetch("/auth/linkedin", {
          method: "POST",
          body: JSON.stringify({
            code,
            ...(referralCode ? { referralCode } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.message || "LinkedIn sign-in failed. Please try again.");
          return;
        }

        const { accessToken, linkedinAccessToken, user } = await res.json();

        if (typeof window !== "undefined") {
          setToken(accessToken);
          localStorage.setItem("omnilearn_user", JSON.stringify(user));
          if (linkedinAccessToken) {
            localStorage.setItem("omnilearn_linkedin_token", linkedinAccessToken);
          }
        }

        const needsProfile = user?.profileComplete === false || user?.needsProfileCompletion;
        router.push(needsProfile ? "/complete-profile" : redirect);
      } catch {
        setError("Something went wrong during LinkedIn sign-in. Please try again.");
      }
    })();
  }, [searchParams, router]);

  if (error) {
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
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg">
            <h1 className="text-xl font-bold text-[#1a1212] dark:text-brand-heading">
              Sign-in failed
            </h1>
            <p className="mt-3 text-gray-600 dark:text-brand-stardustLight">{error}</p>
            <div className="mt-6 flex gap-3">
              <Link
                href="/signin"
                className="rounded-lg bg-gradient-to-br from-[#059669] to-[#10b981] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Back to sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg border border-[#059669] px-4 py-2 text-sm font-semibold text-[#059669] hover:bg-[#059669]/10"
              >
                Create account
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-landing flex items-center justify-center bg-[#F5F5DC] dark:bg-[#0f1510]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#059669] border-t-transparent" />
        <p className="text-sm text-gray-600 dark:text-brand-stardustLight">
          Signing in with LinkedIn...
        </p>
      </div>
    </div>
  );
}

export default function LinkedInCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#059669] border-t-transparent" /></div>}>
      <LinkedInCallbackContent />
    </Suspense>
  );
}
