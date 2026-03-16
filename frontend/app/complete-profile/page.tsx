"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

type Option = { id: string; name: string; code?: string };
type Options = {
  industries: Option[];
  departments: Option[];
  positions: Option[];
  tenants: { id: string; name: string; slug: string }[];
};

const STEPS = [
  { key: "company", label: "Organization" },
  { key: "role", label: "Your Role" },
  { key: "interests", label: "Interests" },
] as const;

export default function CompleteProfilePage() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [step, setStep] = useState(0);

  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [sectorFocus, setSectorFocus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setTokenValue] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("omnilearn_token");
    setTokenValue(stored);
    setMounted(true);

    if (!stored) {
      router.push("/signin?redirect=/complete-profile");
      return;
    }
    apiFetch("/profile/options")
      .then((r) => r.json())
      .then(setOptions)
      .catch(() =>
        setOptions({ industries: [], departments: [], positions: [], tenants: [] })
      );
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!industryId) {
      setError("Please select your industry so we can recommend the right content.");
      return;
    }
    if (!departmentId) {
      setError("Please select your department to personalize your learning path.");
      return;
    }
    if (!positionId) {
      setError("Please select your position so we match content to your level.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/profile/complete", {
        method: "POST",
        body: JSON.stringify({
          tenantId: tenantId || undefined,
          companyName: companyName || undefined,
          companyLogoUrl: companyLogoUrl || undefined,
          industryId: industryId || undefined,
          departmentId: departmentId || undefined,
          positionId: positionId || undefined,
          linkedinProfileUrl: linkedinProfileUrl || undefined,
          sectorFocus: sectorFocus || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to save profile");
        return;
      }
      router.push("/learn");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !token) return null;

  const canAdvance = (s: number) => {
    if (s === 0) return !!(tenantId || companyName) && !!industryId;
    if (s === 1) return !!departmentId && !!positionId;
    return true;
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669] transition-colors";

  const selectCls = inputCls;

  const labelCls =
    "mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight";

  return (
    <div className="min-h-screen font-landing flex flex-col bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="p-4 md:p-6 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="auto" />
        </Link>
        <NavToggles />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg"
        >
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">
            Complete your profile
          </h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            Help us match the best learning content to your role, industry, and
            goals.
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                    i <= step
                      ? "text-[#059669] dark:text-[#10b981]"
                      : "text-gray-400 dark:text-gray-600"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      i < step
                        ? "bg-[#059669] text-white"
                        : i === step
                        ? "bg-[#059669]/20 text-[#059669] dark:bg-[#059669]/30 dark:text-[#10b981]"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-px flex-1 transition-colors ${
                      i < step
                        ? "bg-[#059669]"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}

            <AnimatePresence mode="wait">
              {/* Step 1: Organization */}
              {step === 0 && (
                <motion.div
                  key="company"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <label className={labelCls}>
                      Your organization <span className="text-[#059669]">*</span>
                    </label>
                    <select
                      value={tenantId}
                      onChange={(e) => {
                        setTenantId(e.target.value);
                        if (e.target.value) setCompanyName("");
                      }}
                      className={selectCls}
                    >
                      <option value="">
                        Select existing company or enter new below
                      </option>
                      {options?.tenants?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!tenantId && (
                    <>
                      <div>
                        <label className={labelCls}>
                          Company name (if new){" "}
                          <span className="text-[#059669]">*</span>
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Inc."
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Company logo URL</label>
                        <input
                          type="url"
                          value={companyLogoUrl}
                          onChange={(e) => setCompanyLogoUrl(e.target.value)}
                          placeholder="https://yourcompany.com/logo.png"
                          className={inputCls}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Your logo will appear on our trusted companies wall
                        </p>
                        {companyLogoUrl && (
                          <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-[#059669]/30 p-3">
                            <img
                              src={companyLogoUrl}
                              alt="Logo preview"
                              className="h-8 w-auto max-w-[120px] object-contain"
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display =
                                  "none")
                              }
                            />
                            <span className="text-xs text-gray-500">
                              Preview
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className={labelCls}>
                      Industry / Sector{" "}
                      <span className="text-[#059669]">*</span>
                    </label>
                    <select
                      value={industryId}
                      onChange={(e) => setIndustryId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select industry</option>
                      {options?.industries?.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      We use this to recommend industry-specific content
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Role */}
              {step === 1 && (
                <motion.div
                  key="role"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <label className={labelCls}>
                      Department <span className="text-[#059669]">*</span>
                    </label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select department</option>
                      {options?.departments?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>
                      Position <span className="text-[#059669]">*</span>
                    </label>
                    <select
                      value={positionId}
                      onChange={(e) => setPositionId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select position</option>
                      {options?.positions?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Helps us tailor content difficulty and scope to your level
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>LinkedIn profile URL</label>
                    <input
                      type="url"
                      value={linkedinProfileUrl}
                      onChange={(e) => setLinkedinProfileUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/yourprofile"
                      className={inputCls}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Helps us optimize recommendations based on your expertise
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Interests */}
              {step === 2 && (
                <motion.div
                  key="interests"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <label className={labelCls}>Sector focus</label>
                    <input
                      type="text"
                      value={sectorFocus}
                      onChange={(e) => setSectorFocus(e.target.value)}
                      placeholder="e.g. Biotech, Food Safety, AI, ESG"
                      className={inputCls}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      We&apos;ll prioritize content in your focus areas
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#059669]/20 bg-[#059669]/5 dark:bg-[#059669]/10 p-4">
                    <h3 className="text-sm font-semibold text-[#059669] dark:text-[#10b981]">
                      What happens next?
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-[#059669]">&#10003;</span>
                        AI-powered content matched to your industry &amp; role
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-[#059669]">&#10003;</span>
                        Personalized learning paths tailored to your goals
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-[#059669]">&#10003;</span>
                        Your company joins our trusted organizations wall
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="mt-8 flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="rounded-lg border border-gray-200 dark:border-[#059669]/30 px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    if (!canAdvance(step)) {
                      setError(
                        step === 0
                          ? "Please select or enter your company and industry."
                          : "Please select your department and position."
                      );
                      return;
                    }
                    setStep(step + 1);
                  }}
                  className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 bg-gradient-to-br from-[#059669] to-[#10b981]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 bg-gradient-to-br from-[#059669] to-[#10b981]"
                >
                  {loading ? "Saving..." : "Complete profile"}
                </button>
              )}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-brand-stardustLight">
            <Link href="/learn" className="text-[#059669] hover:underline">
              Skip for now
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
