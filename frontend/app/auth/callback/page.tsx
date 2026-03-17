"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import Link from "next/link";

/**
 * Handles server-side OAuth redirects (e.g. LinkedIn Passport flow).
 * Backend redirects here with ?token=JWT&linkedinToken=LI_ACCESS_TOKEN
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const linkedinToken = searchParams.get("linkedinToken");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!token) {
      setError("No authentication token received. Please try again.");
      return;
    }

    (async () => {
      try {
        setToken(token);
        if (linkedinToken) {
          localStorage.setItem("omnilearn_linkedin_token", linkedinToken);
        }

        const meRes = await apiFetch("/auth/me");
        if (meRes.ok) {
          const user = await meRes.json();
          localStorage.setItem("omnilearn_user", JSON.stringify(user));
          const needsProfile = user?.profileComplete === false;
          router.push(needsProfile ? "/complete-profile" : "/learn");
        } else {
          router.push("/learn");
        }
      } catch {
        router.push("/learn");
      }
    })();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
        <header className="p-4 md:p-6">
          <Link href="/">
            <OmnilearnLogo size="md" variant="auto" />
          </Link>
        </header>
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
          Completing sign-in...
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#059669] border-t-transparent" /></div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
