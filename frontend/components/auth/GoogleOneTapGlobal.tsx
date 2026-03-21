"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGoogleOneTapLogin } from "@react-oauth/google";
import { apiFetch, setToken } from "@/lib/api";

function isSuppressed(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last === "signin" || last === "signup";
}

function OneTapInner() {
  const router = useRouter();
  const pathname = usePathname();

  const handleSuccess = useCallback(
    async (response: { credential?: string }) => {
      const credential = response.credential;
      if (!credential) return;
      try {
        const res = await apiFetch("/auth/google", {
          method: "POST",
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) throw new Error("Auth failed");
        const { accessToken, user } = await res.json();
        if (typeof window !== "undefined") {
          setToken(accessToken);
          localStorage.setItem("omnilearn_user", JSON.stringify(user));
        }
        const needsProfile =
          user?.profileComplete === false || user?.needsProfileCompletion;
        if (needsProfile) {
          router.push("/complete-profile");
        } else {
          router.refresh();
        }
      } catch (err) {
        console.error("Google One Tap sign-in error:", err);
      }
    },
    [router]
  );

  const handleError = useCallback(() => {
    console.error("Google One Tap failed");
  }, []);

  const isAuthenticated =
    typeof window !== "undefined" &&
    !!localStorage.getItem("omnilearn_token");

  const disabled = isAuthenticated || isSuppressed(pathname);

  useGoogleOneTapLogin({
    onSuccess: handleSuccess,
    onError: handleError,
    disabled,
    cancel_on_tap_outside: true,
  });

  return null;
}

export function GoogleOneTapGlobal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <OneTapInner />;
}
