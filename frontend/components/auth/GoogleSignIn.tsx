"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";
import { apiFetch, setToken } from "@/lib/api";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleSignInButton({
  useOneTap = false,
  referralCode,
}: {
  useOneTap?: boolean;
  /** From `?ref=` on signup/signin — attributed only when the Google account is new in OmniLearn. */
  referralCode?: string;
}) {
  const router = useRouter();

  const handleSuccess = useCallback(
    async (credentialResponse: { credential?: string }) => {
      const credential = credentialResponse.credential;
      if (!credential) return;
      try {
        const res = await apiFetch("/auth/google", {
          method: "POST",
          body: JSON.stringify({
            credential,
            ...(referralCode ? { referralCode } : {}),
          }),
        });
        if (!res.ok) throw new Error("Auth failed");
        const { accessToken, user } = await res.json();
        if (typeof window !== "undefined") {
          setToken(accessToken);
          localStorage.setItem("omnilearn_user", JSON.stringify(user));
        }
        const needsProfile = user?.profileComplete === false || user?.needsProfileCompletion;
        router.push(needsProfile ? "/complete-profile" : "/learn");
      } catch (err) {
        console.error("Google sign-in error:", err);
      }
    },
    [router, referralCode]
  );

  const handleError = useCallback(() => {
    console.error("Google Sign-In failed");
  }, []);

  useGoogleOneTapLogin({
    onSuccess: handleSuccess,
    onError: handleError,
    disabled: !useOneTap || !CLIENT_ID,
  });

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      useOneTap={useOneTap}
      theme="filled_black"
      size="large"
      text="continue_with"
      shape="rectangular"
    />
  );
}
