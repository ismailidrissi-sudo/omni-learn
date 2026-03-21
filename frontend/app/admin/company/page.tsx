"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { TIER_CONFIG, type SubscriptionPlan } from "@/lib/subscription";
import { Pencil, Trash2, X, Building2, GraduationCap, Users, Crown } from "lucide-react";

type AccountType = "company" | "branded_academy";

interface TenantSettings {
  accountType?: AccountType;
  plan?: SubscriptionPlan;
  maxUsers?: number;
  [key: string]: unknown;
}

type Tenant = {
  id: string;
  name: string;
  slug: string;
  industryId?: string;
  linkedinProfileUrl?: string;
  companyProfileComplete?: boolean;
  settings?: TenantSettings | null;
  branding?: { logoUrl?: string; primaryColor?: string } | null;
};
type Branding = { logoUrl?: string; faviconUrl?: string; primaryColor?: string; secondaryColor?: string };
type Option = { id: string; name: string };

const PLAN_OPTIONS: { value: SubscriptionPlan; label: string; description: string }[] = [
  { value: "EXPLORER", label: TIER_CONFIG.EXPLORER.name, description: TIER_CONFIG.EXPLORER.tagline },
  { value: "SPECIALIST", label: TIER_CONFIG.SPECIALIST.name, description: TIER_CONFIG.SPECIALIST.tagline },
  { value: "VISIONARY", label: TIER_CONFIG.VISIONARY.name, description: TIER_CONFIG.VISIONARY.tagline },
  { value: "NEXUS", label: TIER_CONFIG.NEXUS.name, description: TIER_CONFIG.NEXUS.tagline },
];

function AccountTypeToggle({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  return (
    <div className="flex rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("company")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
          value === "company"
            ? "bg-brand-purple text-white shadow-inner"
            : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
        }`}
      >
        <Building2 size={16} />
        Company Account
      </button>
      <button
        type="button"
        onClick={() => onChange("branded_academy")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
          value === "branded_academy"
            ? "bg-brand-purple text-white shadow-inner"
            : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
        }`}
      >
        <GraduationCap size={16} />
        Branded Academy
      </button>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditTenantModal({ open, tenant, onSave, onClose, loading }: {
  open: boolean; tenant: Tenant | null; onSave: (name: string, slug: string) => void; onClose: () => void; loading?: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setSlug(tenant.slug);
    }
  }, [tenant]);

  if (!open || !tenant) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Company</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="company-slug" className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(name, slug)} disabled={loading || !name.trim() || !slug.trim()}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyAdminPage() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [branding, setBranding] = useState<Branding>({});
  const [industries, setIndustries] = useState<Option[]>([]);
  const [companyProfile, setCompanyProfile] = useState({ industryId: "", linkedinProfileUrl: "", targetMarkets: "", productsServices: "", staffingLevel: "" });
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState("");

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [accountType, setAccountType] = useState<AccountType>("company");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("EXPLORER");
  const [maxUsers, setMaxUsers] = useState<number | "">(50);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const isSuperAdmin = !!user?.isAdmin;

  const reloadTenants = () => apiFetch("/company/tenants").then((r) => r.json()).then(setTenants);

  useEffect(() => {
    apiFetch("/profile/options").then((r) => r.json()).then((o) => setIndustries(o?.industries ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setError("");
    apiFetch("/company/tenants")
      .then((r) => {
        if (r.status === 403) {
          setError("You don't have permission to view company data. Super admin access is required.");
          return [];
        }
        return r.json();
      })
      .then(setTenants)
      .catch(() => setError("Failed to load company data. Please try again later."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiFetch(`/company/tenants/${selected.id}/branding`)
      .then((r) => r.json())
      .then((b) => setBranding(b || {}))
      .catch(() => setBranding({}));
    apiFetch(`/company/tenants/${selected.id}`)
      .then((r) => r.json())
      .then((tenantData) => {
        setCompanyProfile({
          industryId: tenantData?.industryId ?? "",
          linkedinProfileUrl: tenantData?.linkedinProfileUrl ?? "",
          targetMarkets: Array.isArray(tenantData?.targetMarkets) ? tenantData.targetMarkets.join(", ") : "",
          productsServices: Array.isArray(tenantData?.productsServices) ? tenantData.productsServices.join(", ") : "",
          staffingLevel: tenantData?.staffingLevel ?? "",
        });
        const settings: TenantSettings = (typeof tenantData?.settings === "object" && tenantData.settings) || {};
        setAccountType(settings.accountType ?? "company");
        setSelectedPlan(settings.plan ?? "EXPLORER");
        setMaxUsers(settings.maxUsers ?? 50);
      })
      .catch(() => {});
  }, [selected?.id]);

  const saveCompanyProfile = () => {
    if (!selected) return;
    apiFetch(`/profile/tenant/${selected.id}`, {
      method: "POST",
      body: JSON.stringify({
        industryId: companyProfile.industryId || undefined,
        linkedinProfileUrl: companyProfile.linkedinProfileUrl || undefined,
        targetMarkets: companyProfile.targetMarkets ? companyProfile.targetMarkets.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        productsServices: companyProfile.productsServices ? companyProfile.productsServices.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        staffingLevel: companyProfile.staffingLevel || undefined,
      }),
    }).then(() => reloadTenants());
  };

  const saveBranding = () => {
    if (!selected) return;
    apiFetch(`/company/tenants/${selected.id}/branding`, {
      method: "PUT",
      body: JSON.stringify(branding),
    }).then(() => reloadTenants());
  };

  const createTenant = () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setError("");
    apiFetch("/company/tenants", {
      method: "POST",
      body: JSON.stringify({ name: newName, slug: newSlug }),
    })
      .then((r) => {
        if (r.status === 403) {
          setError("You don't have permission to create clients. Super admin access is required.");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data != null) {
          setNewName("");
          setNewSlug("");
          toast("Company created successfully", "success");
          reloadTenants();
        }
      })
      .catch(() => setError("Failed to create client. Please try again later."));
  };

  const handleEditSave = async (name: string, slug: string) => {
    if (!editingTenant) return;
    setEditLoading(true);
    try {
      const res = await apiFetch(`/company/tenants/${editingTenant.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, slug }),
      });
      if (res.ok) {
        toast("Company updated successfully", "success");
        setEditingTenant(null);
        await reloadTenants();
        if (selected?.id === editingTenant.id) {
          setSelected((prev) => prev ? { ...prev, name, slug } : null);
        }
      } else {
        toast("Failed to update company", "error");
      }
    } catch {
      toast("Failed to update company", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/company/tenants/${deletingTenant.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Company deleted successfully", "success");
        if (selected?.id === deletingTenant.id) setSelected(null);
        setDeletingTenant(null);
        await reloadTenants();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Failed to delete company", "error");
      }
    } catch {
      toast("Failed to delete company", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const saveAccountSettings = async () => {
    if (!selected) return;
    setSettingsLoading(true);
    try {
      const existingSettings: TenantSettings = (typeof selected.settings === "object" && selected.settings) || {};
      const newSettings: TenantSettings = {
        ...existingSettings,
        accountType,
        plan: selectedPlan,
        maxUsers: accountType === "branded_academy" ? (maxUsers || 50) : undefined,
      };
      const res = await apiFetch(`/company/tenants/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ settings: newSettings }),
      });
      if (res.ok) {
        toast("Account settings saved", "success");
        setSelected((prev) => prev ? { ...prev, settings: newSettings } : null);
        await reloadTenants();
      } else {
        toast("Failed to save account settings", "error");
      }
    } catch {
      toast("Failed to save account settings", "error");
    } finally {
      setSettingsLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">{t("common.loading")}</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-4">Super admin access required</h1>
        <p className="text-brand-grey mb-6 text-center max-w-md">
          Creating and managing clients (tenants) is restricted to super administrators.
          You don&apos;t have permission to access this page.
        </p>
        <Link href="/learn">
          <Button variant="primary">Back to Learn</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">{t("admin.companyAdmin")}</h1>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* ── Tenant List ── */}
          <Card className="lg:col-span-2 min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("admin.tenants")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input placeholder={t("admin.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder={t("forum.slug")} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
                <Button size="sm" onClick={createTenant} className="w-full">{t("common.add")}</Button>
              </div>

              <div className="border-t border-gray-100 dark:border-white/10 pt-3 space-y-1">
                {tenants.map((tenant) => {
                  const tenantSettings: TenantSettings = (typeof tenant.settings === "object" && tenant.settings) || {};
                  const isAcademy = tenantSettings.accountType === "branded_academy";
                  return (
                    <div
                      key={tenant.id}
                      className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all cursor-pointer ${
                        selected?.id === tenant.id
                          ? "bg-brand-purple/10 ring-1 ring-brand-purple/20"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                      onClick={() => setSelected(tenant)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm truncate ${selected?.id === tenant.id ? "text-brand-purple" : "text-gray-900 dark:text-white"}`}>
                            {tenant.name}
                          </span>
                          {isAcademy && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <GraduationCap size={10} />
                              Academy
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">/{tenant.slug}</p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTenant(tenant); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingTenant(tenant); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {tenants.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No companies yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Right Panel ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown size={18} className="text-brand-purple" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <p className="text-brand-grey text-sm">{t("admin.selectTenant")}</p>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Account Type</label>
                      <AccountTypeToggle value={accountType} onChange={setAccountType} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {accountType === "company"
                          ? "Standard company account with platform access for employees."
                          : "Fully customizable white-label academy with branding, plans, and user limits."}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Subscription Plan</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PLAN_OPTIONS.map((plan) => (
                          <button
                            key={plan.value}
                            type="button"
                            onClick={() => setSelectedPlan(plan.value)}
                            className={`relative text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                              selectedPlan === plan.value
                                ? "border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10"
                                : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                            }`}
                          >
                            <span className={`text-sm font-semibold ${selectedPlan === plan.value ? "text-brand-purple" : "text-gray-900 dark:text-white"}`}>
                              {plan.label}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
                            {selectedPlan === plan.value && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-purple" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {accountType === "branded_academy" && (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 space-y-4">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <GraduationCap size={16} />
                          <span className="text-sm font-semibold">Branded Academy Settings</span>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Users size={14} />
                            Maximum Users
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={maxUsers}
                            onChange={(e) => setMaxUsers(e.target.value ? parseInt(e.target.value, 10) : "")}
                            placeholder="50"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Maximum number of user accounts allowed in this branded academy.
                          </p>
                        </div>
                      </div>
                    )}

                    <Button onClick={saveAccountSettings} disabled={settingsLoading} className="w-full">
                      {settingsLoading ? "Saving..." : "Save Account Settings"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.branding")}</CardTitle>
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <p className="text-brand-grey text-sm">{t("admin.selectTenant")}</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">{t("admin.logoUrl")}</label>
                      <Input
                        value={branding.logoUrl ?? ""}
                        onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t("admin.primaryColor")}</label>
                      <Input
                        value={branding.primaryColor ?? "#059669"}
                        onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                        placeholder="#059669"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t("admin.secondaryColor")}</label>
                      <Input
                        value={branding.secondaryColor ?? "#D4B896"}
                        onChange={(e) => setBranding((b) => ({ ...b, secondaryColor: e.target.value }))}
                        placeholder="#D4B896"
                      />
                    </div>
                    <Button onClick={saveBranding}>{t("admin.saveBranding")}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Company Profile */}
        {selected && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Company profile (for recommendations)</CardTitle>
              <p className="text-sm text-gray-500">Industry, professional profile, markets — used to optimize recommendations using machine learning algorithms</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Industry</label>
                <select
                  value={companyProfile.industryId}
                  onChange={(e) => setCompanyProfile((p) => ({ ...p, industryId: e.target.value }))}
                  className="w-full mt-1 rounded border px-3 py-2"
                >
                  <option value="">Select industry</option>
                  {industries.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">LinkedIn company URL</label>
                <Input
                  value={companyProfile.linkedinProfileUrl}
                  onChange={(e) => setCompanyProfile((p) => ({ ...p, linkedinProfileUrl: e.target.value }))}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Target markets (comma-separated)</label>
                <Input
                  value={companyProfile.targetMarkets}
                  onChange={(e) => setCompanyProfile((p) => ({ ...p, targetMarkets: e.target.value }))}
                  placeholder="B2B, Enterprise, SMB"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Products/Services (comma-separated)</label>
                <Input
                  value={companyProfile.productsServices}
                  onChange={(e) => setCompanyProfile((p) => ({ ...p, productsServices: e.target.value }))}
                  placeholder="LMS, Corporate Training"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Staffing level</label>
                <select
                  value={companyProfile.staffingLevel}
                  onChange={(e) => setCompanyProfile((p) => ({ ...p, staffingLevel: e.target.value }))}
                  className="w-full mt-1 rounded border px-3 py-2"
                >
                  <option value="">Select</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>
              <Button onClick={saveCompanyProfile}>Save company profile</Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Modals */}
      <EditTenantModal
        open={!!editingTenant}
        tenant={editingTenant}
        onSave={handleEditSave}
        onClose={() => setEditingTenant(null)}
        loading={editLoading}
      />
      <ConfirmDialog
        open={!!deletingTenant}
        title="Delete Company"
        message={`Are you sure you want to delete "${deletingTenant?.name}"? This action cannot be undone and will remove all associated data.`}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTenant(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
