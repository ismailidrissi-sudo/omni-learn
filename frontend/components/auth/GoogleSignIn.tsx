"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleSignInButton({ useOneTap = false }: { useOneTap?: boolean }) {
  const router = useRouter();

  const handleSuccess = useCallback(
    async (credentialResponse: { credential?: string }) => {
      const credential = credentialResponse.credential;
      if (!credential) return;
      try {
        const res = await fetch(`${API_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) throw new Error("Auth failed");
        const { accessToken, user } = await res.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("omnilearn_token", accessToken);
          localStorage.setItem("omnilearn_user", JSON.stringify(user));
        }
        router.push("/learn");
      } catch (err) {
        console.error("Google sign-in error:", err);
      }
    },
    [router]
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
