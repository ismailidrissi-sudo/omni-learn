"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

interface ContactSalesModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactSalesModal({ open, onClose }: ContactSalesModalProps) {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await apiFetch("/company/leads", {
        method: "POST",
        body: JSON.stringify({ company, email }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleClose = () => {
    setCompany("");
    setEmail("");
    setSubmitted(false);
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Contact Sales — Nexus Enterprise
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Transform your workforce with a branded internal academy and custom content.
            </p>
            {submitted ? (
              <div className="py-8 text-center">
                <p className="text-brand-green font-medium mb-4">
                  Thank you! We&apos;ll be in touch soon.
                </p>
                <Button variant="primary" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                    placeholder="Acme Inc."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                    Work email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                    placeholder="you@company.com"
                    required
                  />
                </div>
                {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Request Demo
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
