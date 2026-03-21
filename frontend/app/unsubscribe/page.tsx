"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const evt = searchParams.get("evt");
  const sig = searchParams.get("sig");
  const exp = searchParams.get("exp");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!uid || !evt || !sig || !exp) {
      setStatus("error");
      setMessage("This unsubscribe link is incomplete or invalid.");
      return;
    }
    const expNum = Number(exp);
    if (!Number.isFinite(expNum)) {
      setStatus("error");
      setMessage("This unsubscribe link is invalid.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ uid, evt, sig, exp: expNum }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.success) {
          setStatus("success");
          setMessage("You've been unsubscribed from these emails.");
        } else {
          setStatus("error");
          setMessage(
            typeof data?.message === "string" ? data.message : "We could not complete unsubscribe.",
          );
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong. Please try again later.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, evt, sig, exp]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg"
    >
      <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">
        {status === "loading" && "Unsubscribing..."}
        {status === "success" && "Unsubscribed"}
        {status === "error" && "Could not unsubscribe"}
      </h1>
      <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">{message}</p>
      {status !== "loading" && (
        <div className="mt-8 flex flex-col gap-3 text-center text-sm">
          <Link href="/" className="text-[#059669] hover:underline">
            Back to home
          </Link>
          <Link href="/signin" className="text-[#059669] hover:underline">
            Email preferences (sign in)
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export default function UnsubscribePage() {
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
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
        <Suspense fallback={<div className="text-gray-600 dark:text-brand-stardustLight">Loading...</div>}>
          <UnsubscribeContent />
        </Suspense>
      </main>
    </div>
  );
}
