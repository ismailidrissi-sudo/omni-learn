"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

const CLIENT_ID = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID ?? "";

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function LinkedInSignInButton({ referralCode }: { referralCode?: string }) {
  const searchParams = useSearchParams();

  const handleClick = useCallback(() => {
    if (!CLIENT_ID) {
      console.error("LinkedIn Client ID not configured (NEXT_PUBLIC_LINKEDIN_CLIENT_ID)");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
    const state = JSON.stringify({
      ref: referralCode || searchParams.get("ref") || "",
      redirect: searchParams.get("redirect") || "/learn",
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: encodeURIComponent(state),
    });

    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }, [referralCode, searchParams]);

  if (!CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-[#0A66C2] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      <LinkedInIcon />
      Continue with LinkedIn
    </button>
  );
}
