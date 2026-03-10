"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }
    fetch(`${API}/profile/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage("Email verified! Redirecting to sign in...");
          setTimeout(() => router.push("/signin?verified=1&redirect=/complete-profile"), 2000);
        } else {
          setStatus("error");
          setMessage(data?.message || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed. The link may have expired.");
      });
  }, [token, router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg"
    >
      <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">
        {status === "loading" && "Verifying..."}
        {status === "success" && "Email verified!"}
        {status === "error" && "Verification failed"}
      </h1>
      <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">{message}</p>
      {status === "error" && (
        <Link href="/signup" className="mt-6 block text-center text-[#059669] hover:underline">
          Sign up again
        </Link>
      )}
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="p-4 md:p-6 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="auto" />
        </Link>
        <NavToggles />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-gray-600">Loading...</div>}>
          <VerifyContent />
        </Suspense>
      </main>
    </div>
  );
}
