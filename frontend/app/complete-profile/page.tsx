"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type Option = { id: string; name: string; code?: string };
type Options = {
  industries: Option[];
  departments: Option[];
  positions: Option[];
};

type ReferralCompany = {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl: string | null;
} | null;

const STEPS = [
  { key: "company", label: "Organization" },
  { key: "role", label: "Your Role" },
  { key: "interests", label: "Interests" },
] as const;

export default function CompleteProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const [options, setOptions] = useState<Options | null>(null);
  const [step, setStep] = useState(0);

  const [userType, setUserType] = useState<"TRAINEE" | "TRAINER" | "COMPANY_ADMIN" | "">("");
  const [orgMode, setOrgMode] = useState<"join" | "new" | "">("");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeVerified, setJoinCodeVerified] = useState(false);
  const [resolvedTenantId, setResolvedTenantId] = useState("");
  const [resolvedCompanyName, setResolvedCompanyName] = useState("");
  const [resolvedCompanyLogo, setResolvedCompanyLogo] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

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

  const [referralCompany, setReferralCompany] = useState<ReferralCompany>(null);
  const [referralChecked, setReferralChecked] = useState(false);

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
        setOptions({ industries: [], departments: [], positions: [] })
      );

    apiFetch("/profile/referral-company")
      .then((r) => r.json())
      .then((data) => {
        if (data?.tenantId) setReferralCompany(data);
        setReferralChecked(true);
      })
      .catch(() => setReferralChecked(true));
  }, [router]);

  const handleVerifyCode = useCallback(async () => {
    if (!joinCode.trim()) return;
    setVerifyingCode(true);
    setError("");
    try {
      const res = await apiFetch(`/profile/resolve-join-code/${encodeURIComponent(joinCode.trim())}`);
      const data = await res.json();
      if (data?.valid) {
        setResolvedTenantId(data.tenantId);
        setResolvedCompanyName(data.tenantName);
        setResolvedCompanyLogo(data.tenantLogoUrl || "");
        setJoinCodeVerified(true);
      } else {
        setJoinCodeVerified(false);
        setResolvedTenantId("");
        setResolvedCompanyName("");
        setError("Invalid company code. Please check with your company admin.");
      }
    } catch {
      setError("Could not verify company code. Please try again.");
    } finally {
      setVerifyingCode(false);
    }
  }, [joinCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!industryId) {
      setError(t("completeProfile.errors.selectIndustry") || "Please select your industry so we can recommend the right content.");
      return;
    }
    if (!departmentId) {
      setError(t("completeProfile.errors.selectDepartment") || "Please select your department to personalize your learning path.");
      return;
    }
    if (!positionId) {
      setError(t("completeProfile.errors.selectPosition") || "Please select your position so we match content to your level.");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string | undefined> = {
        industryId: industryId || undefined,
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
        linkedinProfileUrl: linkedinProfileUrl || undefined,
        sectorFocus: sectorFocus || undefined,
        userType: userType || undefined,
      };

      if (referralCompany) {
        payload.tenantId = referralCompany.tenantId;
      } else if (orgMode === "join" && joinCodeVerified && resolvedTenantId) {
        payload.joinCode = joinCode.trim().toUpperCase();
      } else if (orgMode === "new" && companyName) {
        payload.companyName = companyName;
        payload.companyLogoUrl = companyLogoUrl || undefined;
      }

      const res = await apiFetch("/profile/complete", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || t("completeProfile.errors.saveFailed") || "Failed to save profile");
        return;
      }
      router.push("/learn");
    } catch {
      setError(t("completeProfile.errors.somethingWrong") || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !token) return null;

  const canAdvance = (s: number) => {
    if (s === 0) return !!userType && !!industryId;
    if (s === 1) return !!departmentId && !!positionId;
    return true;
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669] transition-colors";

  const selectCls = inputCls;

  const labelCls =
    "mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight";

  const radioCls = (active: boolean) =>
    `flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium cursor-pointer transition-all ${
      active
        ? "border-[#059669] bg-[#059669]/10 text-[#059669] dark:border-[#10b981] dark:bg-[#10b981]/10 dark:text-[#10b981]"
        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
    }`;

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#059669]/30 bg-white dark:bg-[#1a1e18] p-8 shadow-lg"
        >
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">
            {t("completeProfile.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            {t("completeProfile.subtitle")}
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center gap-1">
            {STEPS.map((s, i) => {
              const stepLabels: Record<string, string> = {
                company: t("completeProfile.steps.organization"),
                role: t("completeProfile.steps.role"),
                interests: t("completeProfile.steps.interests"),
              };
              return (
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
                      {i < step ? "\u2713" : i + 1}
                    </span>
                    <span className="hidden sm:inline">{stepLabels[s.key]}</span>
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
              );
            })}
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
                      {t("completeProfile.iAmA")} <span className="text-[#059669]">*</span>
                    </label>
                    <select
                      value={userType}
                      onChange={(e) => {
                        setUserType(e.target.value as typeof userType);
                      }}
                      className={selectCls}
                    >
                      <option value="">{t("completeProfile.selectRole")}</option>
                      <option value="TRAINEE">{t("completeProfile.trainee")}</option>
                      <option value="TRAINER">{t("completeProfile.trainer")}</option>
                      <option value="COMPANY_ADMIN">{t("completeProfile.companyAdmin")}</option>
                    </select>
                    {userType === "TRAINER" && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        {t("completeProfile.trainerApproval")}
                      </p>
                    )}
                    {userType === "COMPANY_ADMIN" && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        {t("completeProfile.companyAdminApproval")}
                      </p>
                    )}
                  </div>

                  {/* Organization section */}
                  <div>
                    <label className={labelCls}>{t("completeProfile.yourOrganization")}</label>

                    {referralCompany && referralChecked ? (
                      <div className="rounded-lg border border-[#059669]/30 bg-[#059669]/5 dark:bg-[#059669]/10 p-4">
                        <div className="flex items-center gap-3">
                          {referralCompany.tenantLogoUrl && (
                            <img
                              src={referralCompany.tenantLogoUrl}
                              alt=""
                              className="h-8 w-auto max-w-[80px] object-contain"
                            />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#059669] dark:text-[#10b981]">
                              {referralCompany.tenantName}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              You were invited by this company. You&apos;ll be added automatically.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOrgMode("join");
                              setCompanyName("");
                              setCompanyLogoUrl("");
                            }}
                            className={radioCls(orgMode === "join")}
                          >
                            Join existing company
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOrgMode("new");
                              setJoinCode("");
                              setJoinCodeVerified(false);
                              setResolvedTenantId("");
                              setResolvedCompanyName("");
                            }}
                            className={radioCls(orgMode === "new")}
                          >
                            Register a new company
                          </button>
                        </div>

                        {orgMode === "join" && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className={labelCls}>Company join code</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={joinCode}
                                  onChange={(e) => {
                                    setJoinCode(e.target.value.toUpperCase());
                                    setJoinCodeVerified(false);
                                    setResolvedTenantId("");
                                    setResolvedCompanyName("");
                                  }}
                                  placeholder="e.g. ACME4F2B"
                                  className={inputCls}
                                  maxLength={12}
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyCode}
                                  disabled={!joinCode.trim() || verifyingCode}
                                  className="shrink-0 rounded-lg px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 bg-gradient-to-br from-[#059669] to-[#10b981]"
                                >
                                  {verifyingCode ? "..." : "Verify"}
                                </button>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                Ask your company admin for the join code
                              </p>
                            </div>

                            {joinCodeVerified && resolvedCompanyName && (
                              <div className="flex items-center gap-3 rounded-lg border border-[#059669]/30 bg-[#059669]/5 dark:bg-[#059669]/10 p-3">
                                {resolvedCompanyLogo && (
                                  <img
                                    src={resolvedCompanyLogo}
                                    alt=""
                                    className="h-8 w-auto max-w-[80px] object-contain"
                                  />
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-[#059669] dark:text-[#10b981]">
                                    {resolvedCompanyName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Company verified. Your affiliation will be reviewed by the company admin.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {orgMode === "new" && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className={labelCls}>Company name</label>
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
                                      ((e.target as HTMLImageElement).style.display = "none")
                                    }
                                  />
                                  <span className="text-xs text-gray-500">Preview</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

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
                          {(i.code && t(`industries.${i.code}`)) !== `industries.${i.code}` ? t(`industries.${i.code}`) : i.name}
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
                          {(d.code && t(`departments.${d.code}`)) !== `departments.${d.code}` ? t(`departments.${d.code}`) : d.name}
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
                          {(p.code && t(`positions.${p.code}`)) !== `positions.${p.code}` ? t(`positions.${p.code}`) : p.name}
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
                  {t("common.back")}
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
                          ? t("completeProfile.errors.selectRoleAndIndustry")
                          : t("completeProfile.errors.selectDeptAndPosition")
                      );
                      return;
                    }
                    setStep(step + 1);
                  }}
                  className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 bg-gradient-to-br from-[#059669] to-[#10b981]"
                >
                  {t("completeProfile.continue")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 bg-gradient-to-br from-[#059669] to-[#10b981]"
                >
                  {loading ? t("common.saving") : t("completeProfile.completeProfileBtn")}
                </button>
              )}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-brand-stardustLight">
            <Link href="/learn" className="text-[#059669] hover:underline">
              {t("completeProfile.skipForNow")}
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
