"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Option = { id: string; name: string; code?: string };
type Options = { industries: Option[]; departments: Option[]; positions: Option[]; tenants: { id: string; name: string; slug: string }[] };

export default function CompleteProfilePage() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [sectorFocus, setSectorFocus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null;

  useEffect(() => {
    if (!token) {
      router.push("/signin?redirect=/complete-profile");
      return;
    }
    fetch(`${API}/profile/options`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => setOptions({ industries: [], departments: [], positions: [], tenants: [] }));
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/profile/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: tenantId || undefined,
          companyName: companyName || undefined,
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

  if (!token) return null;

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
          <h1 className="text-2xl font-bold text-[#1a1212] dark:text-brand-heading">Complete your profile</h1>
          <p className="mt-2 text-gray-600 dark:text-brand-stardustLight">
            Help us personalize your learning recommendations with your company and role.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <p className="rounded-lg bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Company
              </label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] focus:border-[#059669] focus:outline-none"
              >
                <option value="">Select existing company or enter new below</option>
                {options?.tenants?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Company name (if new)
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Industry / Sector
              </label>
              <select
                value={industryId}
                onChange={(e) => setIndustryId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] focus:border-[#059669] focus:outline-none"
              >
                <option value="">Select industry</option>
                {options?.industries?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] focus:border-[#059669] focus:outline-none"
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
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Position
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] focus:border-[#059669] focus:outline-none"
              >
                <option value="">Select position</option>
                {options?.positions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                LinkedIn profile URL
              </label>
              <input
                type="url"
                value={linkedinProfileUrl}
                onChange={(e) => setLinkedinProfileUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Helps us tailor content to your expertise</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-brand-stardustLight">
                Sector focus (optional)
              </label>
              <input
                type="text"
                value={sectorFocus}
                onChange={(e) => setSectorFocus(e.target.value)}
                placeholder="e.g. Biotech, Food Safety, AI"
                className="w-full rounded-lg border border-gray-200 dark:border-[#059669]/30 bg-gray-50 dark:bg-[#F5F5DC]/5 px-4 py-3 text-[#1a1212] dark:text-[#F5F5DC] placeholder:text-gray-500 focus:border-[#059669] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 bg-gradient-to-br from-[#059669] to-[#10b981]"
            >
              {loading ? "Saving..." : "Complete profile"}
            </button>
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
