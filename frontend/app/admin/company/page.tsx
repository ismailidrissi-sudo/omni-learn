"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { apiFetch, apiUploadTenantLogo, apiDeleteTenantStoredLogo, apiAbsoluteMediaUrl } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { bulkInviteFeedback } from "@/lib/bulk-invite-feedback";
import { TIER_CONFIG, type SubscriptionPlan } from "@/lib/subscription";
import {
  Trash2,
  Building2,
  GraduationCap,
  Users,
  Crown,
  Palette,
  Upload,
  Loader2,
  ExternalLink,
  ImageIcon,
  Copy,
  Check,
  UserPlus,
} from "lucide-react";

type AccountType = "company" | "branded_academy";

type DetailTab = "organization" | "branding" | "profile" | "plan" | "members";

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
  joinCode?: string | null;
  industryId?: string;
  linkedinProfileUrl?: string;
  companyProfileComplete?: boolean;
  logoUrl?: string | null;
  language?: string | null;
  status?: string | null;
  internalErp?: string | null;
  settings?: TenantSettings | null;
  branding?: { logoUrl?: string; primaryColor?: string; hasStoredLogo?: boolean } | null;
};

type Branding = {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  appName?: string | null;
  tagline?: string | null;
  loginBgUrl?: string | null;
  emailLogoUrl?: string | null;
  fontFamily?: string | null;
  navStyle?: string | null;
  customCss?: string | null;
  hasStoredLogo?: boolean;
  updatedAt?: string;
};

type Option = { id: string; name: string };

const PLAN_OPTIONS: { value: SubscriptionPlan; label: string; description: string }[] = [
  { value: "EXPLORER", label: TIER_CONFIG.EXPLORER.name, description: TIER_CONFIG.EXPLORER.tagline },
  { value: "SPECIALIST", label: TIER_CONFIG.SPECIALIST.name, description: TIER_CONFIG.SPECIALIST.tagline },
  { value: "VISIONARY", label: TIER_CONFIG.VISIONARY.name, description: TIER_CONFIG.VISIONARY.tagline },
  { value: "NEXUS", label: TIER_CONFIG.NEXUS.name, description: TIER_CONFIG.NEXUS.tagline },
];

function jsonArrayToCsv(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join(", ");
  return "";
}

function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

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

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
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
  const [detailTab, setDetailTab] = useState<DetailTab>("organization");
  const [branding, setBranding] = useState<Branding>({});
  const [industries, setIndustries] = useState<Option[]>([]);
  const [orgForm, setOrgForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    language: "en",
    status: "ACTIVE",
    internalErp: "",
  });
  const [companyProfile, setCompanyProfile] = useState({
    industryId: "",
    linkedinProfileUrl: "",
    targetMarkets: "",
    productsServices: "",
    staffingLevel: "",
    certifications: "",
    companyProfileComplete: false,
  });
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState("");

  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [accountType, setAccountType] = useState<AccountType>("company");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("EXPLORER");
  const [maxUsers, setMaxUsers] = useState<number | "">(50);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [selectedJoinCode, setSelectedJoinCode] = useState("");
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [membersList, setMembersList] = useState<
    { id: string; name: string; email: string; orgApprovalStatus?: string | null }[]
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [allUsersPick, setAllUsersPick] = useState<{ id: string; name: string; email: string; tenantId?: string | null }[]>(
    [],
  );
  const [pickerQuery, setPickerQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [assignBusyId, setAssignBusyId] = useState<string | null>(null);

  const isSuperAdmin = !!user?.isAdmin;

  const reloadTenants = async () => {
    const r = await apiFetch("/company/tenants");
    const data = await r.json();
    setTenants(data);
    return data as Tenant[];
  };

  useEffect(() => {
    apiFetch("/profile/options")
      .then((r) => r.json())
      .then((o) => setIndustries(o?.industries ?? []))
      .catch(() => {});
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
    if (!selected || detailTab !== "members") return;
    setMembersLoading(true);
    apiFetch(`/company/users?tenantId=${selected.id}`)
      .then((r) => r.json())
      .then((d) => setMembersList(Array.isArray(d) ? d : []))
      .catch(() => setMembersList([]))
      .finally(() => setMembersLoading(false));
  }, [selected?.id, detailTab]);

  useEffect(() => {
    if (!selected || detailTab !== "members") return;
    apiFetch("/company/users")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setAllUsersPick(d) : setAllUsersPick([])))
      .catch(() => setAllUsersPick([]));
  }, [selected?.id, detailTab]);

  useEffect(() => {
    if (!selected) return;
    const id = selected.id;
    Promise.all([
      apiFetch(`/company/tenants/${id}/branding`).then((r) => r.json()),
      apiFetch(`/company/tenants/${id}`).then((r) => r.json()),
    ])
      .then(([b, tenantData]) => {
        setBranding(b || {});
        setLogoVersion((v) => v + 1);
        setSelectedJoinCode(tenantData?.joinCode ?? "");
        setJoinCodeCopied(false);
        setOrgForm({
          name: tenantData?.name ?? "",
          slug: tenantData?.slug ?? "",
          logoUrl: tenantData?.logoUrl ?? "",
          language: tenantData?.language ?? "en",
          status: tenantData?.status ?? "ACTIVE",
          internalErp: tenantData?.internalErp ?? "",
        });
        setCompanyProfile({
          industryId: tenantData?.industryId ?? "",
          linkedinProfileUrl: tenantData?.linkedinProfileUrl ?? "",
          targetMarkets: jsonArrayToCsv(tenantData?.targetMarkets),
          productsServices: jsonArrayToCsv(tenantData?.productsServices),
          staffingLevel: tenantData?.staffingLevel ?? "",
          certifications: jsonArrayToCsv(tenantData?.certifications),
          companyProfileComplete: !!tenantData?.companyProfileComplete,
        });
        const settings: TenantSettings =
          typeof tenantData?.settings === "object" && tenantData.settings ? tenantData.settings : {};
        setAccountType(settings.accountType ?? "company");
        setSelectedPlan(settings.plan ?? "EXPLORER");
        setMaxUsers(settings.maxUsers ?? 50);
      })
      .catch(() => {
        setBranding({});
      });
  }, [selected?.id]);

  const pickerFiltered = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!selected) return [];
    return allUsersPick
      .filter((u) => {
        if (u.tenantId === selected.id) return false;
        if (!q) return true;
        return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [allUsersPick, pickerQuery, selected]);

  const saveOrganization = async () => {
    if (!selected) return;
    if (!orgForm.name.trim() || !orgForm.slug.trim()) {
      toast("Name and slug are required", "error");
      return;
    }
    setOrgSaving(true);
    try {
      const res = await apiFetch(`/company/tenants/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: orgForm.name.trim(),
          slug: orgForm.slug.trim(),
          logoUrl: orgForm.logoUrl.trim() || null,
          language: orgForm.language.trim() || null,
          status: orgForm.status.trim() || null,
          internalErp: orgForm.internalErp.trim() || null,
        }),
      });
      if (res.ok) {
        toast("Organization saved", "success");
        const list = await reloadTenants();
        const updated = list.find((x) => x.id === selected.id);
        if (updated) setSelected(updated);
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Failed to save organization", "error");
      }
    } catch {
      toast("Failed to save organization", "error");
    } finally {
      setOrgSaving(false);
    }
  };

  const saveCompanyProfile = async () => {
    if (!selected) return;
    setProfileSaving(true);
    try {
      const res = await apiFetch(`/company/tenants/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          industryId: companyProfile.industryId || null,
          linkedinProfileUrl: companyProfile.linkedinProfileUrl.trim() || null,
          targetMarkets: splitCsv(companyProfile.targetMarkets),
          productsServices: splitCsv(companyProfile.productsServices),
          certifications: splitCsv(companyProfile.certifications),
          staffingLevel: companyProfile.staffingLevel || null,
          companyProfileComplete: companyProfile.companyProfileComplete,
        }),
      });
      if (res.ok) {
        toast("Company profile saved", "success");
        await reloadTenants();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Failed to save profile", "error");
      }
    } catch {
      toast("Failed to save profile", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveBranding = async () => {
    if (!selected) return;
    setBrandingSaving(true);
    try {
      const res = await apiFetch(`/company/tenants/${selected.id}/branding`, {
        method: "PUT",
        body: JSON.stringify({
          logoUrl: branding.logoUrl?.trim() || undefined,
          faviconUrl: branding.faviconUrl?.trim() || undefined,
          primaryColor: branding.primaryColor?.trim() || undefined,
          secondaryColor: branding.secondaryColor?.trim() || undefined,
          accentColor: branding.accentColor?.trim() || undefined,
          appName: branding.appName?.trim() || undefined,
          tagline: branding.tagline?.trim() || undefined,
          loginBgUrl: branding.loginBgUrl?.trim() || undefined,
          emailLogoUrl: branding.emailLogoUrl?.trim() || undefined,
          fontFamily: branding.fontFamily?.trim() || undefined,
          navStyle: branding.navStyle?.trim() || undefined,
          customCss: branding.customCss?.trim() || undefined,
        }),
      });
      if (res.ok) {
        const next = await res.json();
        setBranding(next || {});
        setLogoVersion((v) => v + 1);
        toast(t("admin.saveBranding") || "Branding saved", "success");
        await reloadTenants();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Failed to save branding", "error");
      }
    } catch {
      toast("Failed to save branding", "error");
    } finally {
      setBrandingSaving(false);
    }
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
      const existingSettings: TenantSettings =
        typeof selected.settings === "object" && selected.settings ? selected.settings : {};
      const newSettings: TenantSettings = {
        ...existingSettings,
        accountType,
        plan: selectedPlan,
        maxUsers: accountType === "branded_academy" ? maxUsers || 50 : undefined,
      };
      const res = await apiFetch(`/company/tenants/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ settings: newSettings }),
      });
      if (res.ok) {
        toast("Account settings saved", "success");
        setSelected((prev) => (prev ? { ...prev, settings: newSettings } : null));
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

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    setLogoBusy(true);
    try {
      const res = await apiUploadTenantLogo(selected.id, file);
      if (res.ok) {
        const b = await res.json();
        setBranding(b || {});
        setLogoVersion((v) => v + 1);
        toast("Logo uploaded", "success");
        await reloadTenants();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err?.message || "Logo upload failed", "error");
      }
    } catch {
      toast("Logo upload failed", "error");
    } finally {
      setLogoBusy(false);
    }
  };

  const removeStoredLogo = async () => {
    if (!selected) return;
    setLogoBusy(true);
    try {
      const res = await apiDeleteTenantStoredLogo(selected.id);
      if (res.ok) {
        const b = await res.json();
        setBranding(b || {});
        setLogoVersion((v) => v + 1);
        toast("Uploaded logo removed — URL or tenant fallback will show if set", "success");
        await reloadTenants();
      } else {
        toast("Could not remove uploaded logo", "error");
      }
    } catch {
      toast("Could not remove uploaded logo", "error");
    } finally {
      setLogoBusy(false);
    }
  };

  const displayLogoSrc = branding.logoUrl ? apiAbsoluteMediaUrl(branding.logoUrl) : undefined;

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
          Creating and managing clients (tenants) is restricted to super administrators. You don&apos;t have permission to
          access this page.
        </p>
        <Link href="/learn">
          <Button variant="primary">Back to Learn</Button>
        </Link>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string; icon: typeof Building2 }[] = [
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "branding", label: "Branding & logo", icon: Palette },
    { id: "profile", label: "Profile & recommendations", icon: Users },
    { id: "plan", label: "Plan & limits", icon: Crown },
    { id: "members", label: "Members", icon: UserPlus },
  ];

  const assignUserToSelectedAcademy = async (userId: string) => {
    if (!selected) return;
    setAssignBusyId(userId);
    try {
      const res = await apiFetch(`/company/users/${userId}/academy`, {
        method: "PATCH",
        body: JSON.stringify({ tenantId: selected.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Assign failed");
      toast("User assigned to this academy", "success");
      const list = await apiFetch(`/company/users?tenantId=${selected.id}`).then((r) => r.json());
      setMembersList(Array.isArray(list) ? list : []);
      const all = await apiFetch("/company/users").then((r) => r.json());
      setAllUsersPick(Array.isArray(all) ? all : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Assign failed", "error");
    } finally {
      setAssignBusyId(null);
    }
  };

  const inviteToSelectedAcademy = async () => {
    if (!selected) return;
    const emails = inviteEmail
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) {
      toast("Enter a valid email", "error");
      return;
    }
    setInviteBusy(true);
    try {
      const res = await apiFetch("/company/users/bulk-invite", {
        method: "POST",
        body: JSON.stringify({ tenantId: selected.id, emails }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Invite failed");
      const fb = bulkInviteFeedback(t, data);
      toast(fb.message, fb.type);
      setInviteEmail("");
      const list = await apiFetch(`/company/users?tenantId=${selected.id}`).then((r) => r.json());
      setMembersList(Array.isArray(list) ? list : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invite failed", "error");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

      <main className="max-w-6xl mx-auto p-6 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-grey-dark dark:text-white tracking-tight">{t("admin.companyAdmin")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">
            Create tenants, set organization details, upload logos, configure white-label branding, and tune recommendation
            profile data — all in one place.
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card className="lg:col-span-4 min-w-0 overflow-hidden shadow-sm border-gray-200/80 dark:border-white/10">
            <CardHeader className="pb-2">
              <CardTitle>{t("admin.tenants")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input placeholder={t("admin.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder={t("forum.slug")} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
                <Button size="sm" onClick={createTenant} className="w-full">
                  {t("common.add")}
                </Button>
              </div>

              <div className="border-t border-gray-100 dark:border-white/10 pt-3 space-y-1 max-h-[min(52vh,520px)] overflow-y-auto pr-1">
                {tenants.map((tenant) => {
                  const tenantSettings: TenantSettings =
                    typeof tenant.settings === "object" && tenant.settings ? tenant.settings : {};
                  const isAcademy = tenantSettings.accountType === "branded_academy";
                  const thumb = tenant.branding?.logoUrl ? apiAbsoluteMediaUrl(tenant.branding.logoUrl) : undefined;
                  return (
                    <div
                      key={tenant.id}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all cursor-pointer ${
                        selected?.id === tenant.id
                          ? "bg-brand-purple/10 ring-1 ring-brand-purple/25"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                      onClick={() => {
                        setSelected(tenant);
                        setDetailTab("organization");
                      }}
                    >
                      <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200/80 dark:border-white/10">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <Building2 size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium text-sm truncate ${
                              selected?.id === tenant.id ? "text-brand-purple" : "text-gray-900 dark:text-white"
                            }`}
                          >
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

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTenant(tenant);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title="Delete"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                {tenants.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No companies yet</p>}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-8 space-y-6 min-w-0">
            {!selected ? (
              <Card className="shadow-sm border-gray-200/80 dark:border-white/10">
                <CardContent className="py-16 text-center">
                  <Building2 className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
                  <p className="text-brand-grey">{t("admin.selectTenant")}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="shadow-sm border-gray-200/80 dark:border-white/10 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-gradient-to-r from-brand-purple/5 to-transparent dark:from-brand-purple/10 border-b border-gray-100 dark:border-white/10">
                      <div className="h-16 w-16 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {displayLogoSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${displayLogoSrc}?v=${logoVersion}`}
                            alt=""
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <ImageIcon className="text-gray-300 dark:text-gray-600" size={28} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{selected.name}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">/{selected.slug}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Link
                            href={`/${selected.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
                          >
                            <ExternalLink size={12} />
                            Open public academy / portal
                          </Link>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs text-gray-500">
                            ID <span className="font-mono text-gray-400">{selected.id.slice(0, 8)}…</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03]">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = detailTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDetailTab(tab.id)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? "bg-white dark:bg-gray-800 text-brand-purple shadow-sm ring-1 ring-gray-200/80 dark:ring-white/10"
                                : "text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5"
                            }`}
                          >
                            <Icon size={16} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-5 sm:p-6">
                      {detailTab === "organization" && (
                        <div className="space-y-5 max-w-xl">
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Company name</label>
                            <Input
                              value={orgForm.name}
                              onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          {selectedJoinCode && (
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Join code
                              </label>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 flex items-center rounded-lg border border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white tracking-wider">
                                    {selectedJoinCode}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedJoinCode);
                                    setJoinCodeCopied(true);
                                    setTimeout(() => setJoinCodeCopied(false), 2000);
                                  }}
                                  className="shrink-0"
                                >
                                  {joinCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                                  <span className="ml-1.5">{joinCodeCopied ? "Copied" : "Copy"}</span>
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Share this code with employees so they can join your organization during signup.
                              </p>
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">URL slug</label>
                            <Input
                              value={orgForm.slug}
                              onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))}
                              className="mt-1 font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">Used in paths such as /{orgForm.slug || "…"}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Tenant logo URL (fallback)
                            </label>
                            <Input
                              value={orgForm.logoUrl}
                              onChange={(e) => setOrgForm((f) => ({ ...f, logoUrl: e.target.value }))}
                              placeholder="https://…"
                              className="mt-1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Used when no uploaded logo is set in Branding. Stored logo in Branding takes priority.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                              <Input
                                value={orgForm.language}
                                onChange={(e) => setOrgForm((f) => ({ ...f, language: e.target.value }))}
                                placeholder="en"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                              <select
                                value={orgForm.status}
                                onChange={(e) => setOrgForm((f) => ({ ...f, status: e.target.value }))}
                                className="w-full mt-1 rounded-lg border border-gray-200 dark:border-white/15 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                                <option value="PENDING">PENDING</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Internal ERP</label>
                            <Input
                              value={orgForm.internalErp}
                              onChange={(e) => setOrgForm((f) => ({ ...f, internalErp: e.target.value }))}
                              placeholder="SAP, Dynamics, …"
                              className="mt-1"
                            />
                          </div>
                          <Button onClick={saveOrganization} disabled={orgSaving} className="min-w-[140px]">
                            {orgSaving ? (
                              <>
                                <Loader2 className="animate-spin mr-2" size={16} />
                                Saving…
                              </>
                            ) : (
                              "Save organization"
                            )}
                          </Button>
                        </div>
                      )}

                      {detailTab === "branding" && (
                        <div className="space-y-8">
                          <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-gray-50/50 dark:bg-white/[0.02]">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                              <Upload size={16} className="text-brand-purple" />
                              Logo file (upload)
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                              PNG, JPEG, WebP, GIF, or SVG — max 1.5 MB. Replaces any previous upload; public URL is served by
                              the API.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                className="hidden"
                                onChange={onLogoFile}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={logoBusy}
                                onClick={() => logoInputRef.current?.click()}
                              >
                                {logoBusy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                <span className="ml-2">{logoBusy ? "Working…" : "Choose file"}</span>
                              </Button>
                              {branding.hasStoredLogo && (
                                <Button type="button" variant="ghost" size="sm" disabled={logoBusy} onClick={removeStoredLogo}>
                                  Remove uploaded file
                                </Button>
                              )}
                            </div>
                            {branding.hasStoredLogo && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                                An uploaded file is active and overrides the logo URL below for display.
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t("admin.logoUrl")} (branding)
                              </label>
                              <Input
                                value={branding.logoUrl ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
                                placeholder="https://…"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Favicon URL</label>
                              <Input
                                value={branding.faviconUrl ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, faviconUrl: e.target.value }))}
                                placeholder="https://…"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">{t("admin.primaryColor")}</label>
                              <Input
                                value={branding.primaryColor ?? "#6B4E9A"}
                                onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">{t("admin.secondaryColor")}</label>
                              <Input
                                value={branding.secondaryColor ?? "#8D8D8D"}
                                onChange={(e) => setBranding((b) => ({ ...b, secondaryColor: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Accent color</label>
                              <Input
                                value={branding.accentColor ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                                placeholder="#…"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">App / academy name</label>
                              <Input
                                value={branding.appName ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, appName: e.target.value }))}
                                placeholder="Shown in header if set"
                                className="mt-1"
                              />
                            </div>
                            <div className="lg:col-span-2">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tagline</label>
                              <Input
                                value={branding.tagline ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, tagline: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Login background URL</label>
                              <Input
                                value={branding.loginBgUrl ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, loginBgUrl: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email header logo URL</label>
                              <Input
                                value={branding.emailLogoUrl ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, emailLogoUrl: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Font family</label>
                              <Input
                                value={branding.fontFamily ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, fontFamily: e.target.value }))}
                                placeholder="Inter, system-ui, …"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Navigation style</label>
                              <select
                                value={branding.navStyle ?? "topbar"}
                                onChange={(e) => setBranding((b) => ({ ...b, navStyle: e.target.value }))}
                                className="w-full mt-1 rounded-lg border border-gray-200 dark:border-white/15 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="topbar">Top bar</option>
                                <option value="sidebar">Sidebar</option>
                              </select>
                            </div>
                            <div className="lg:col-span-2">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom CSS</label>
                              <textarea
                                value={branding.customCss ?? ""}
                                onChange={(e) => setBranding((b) => ({ ...b, customCss: e.target.value }))}
                                rows={8}
                                placeholder="/* Optional overrides */"
                                className="w-full mt-1 rounded-lg border border-gray-200 dark:border-white/15 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono"
                              />
                            </div>
                          </div>

                          <Button onClick={saveBranding} disabled={brandingSaving}>
                            {brandingSaving ? (
                              <>
                                <Loader2 className="animate-spin mr-2" size={16} />
                                Saving…
                              </>
                            ) : (
                              t("admin.saveBranding")
                            )}
                          </Button>
                        </div>
                      )}

                      {detailTab === "profile" && (
                        <div className="space-y-4 max-w-xl">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Industry, LinkedIn, markets, and certifications — used to improve recommendations.
                          </p>
                          <div>
                            <label className="text-sm font-medium">Industry</label>
                            <select
                              value={companyProfile.industryId}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, industryId: e.target.value }))}
                              className="w-full mt-1 rounded-lg border border-gray-200 dark:border-white/15 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                            >
                              <option value="">Select industry</option>
                              {industries.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">LinkedIn company URL</label>
                            <Input
                              value={companyProfile.linkedinProfileUrl}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, linkedinProfileUrl: e.target.value }))}
                              placeholder="https://linkedin.com/company/..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Target markets (comma-separated)</label>
                            <Input
                              value={companyProfile.targetMarkets}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, targetMarkets: e.target.value }))}
                              placeholder="B2B, Enterprise, SMB"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Products / services (comma-separated)</label>
                            <Input
                              value={companyProfile.productsServices}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, productsServices: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Certifications (comma-separated)</label>
                            <Input
                              value={companyProfile.certifications}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, certifications: e.target.value }))}
                              placeholder="ISO 9001, SOC 2, …"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Staffing level</label>
                            <select
                              value={companyProfile.staffingLevel}
                              onChange={(e) => setCompanyProfile((p) => ({ ...p, staffingLevel: e.target.value }))}
                              className="w-full mt-1 rounded-lg border border-gray-200 dark:border-white/15 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                            >
                              <option value="">Select</option>
                              <option value="1-10">1-10</option>
                              <option value="11-50">11-50</option>
                              <option value="51-200">51-200</option>
                              <option value="201-500">201-500</option>
                              <option value="500+">500+</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={companyProfile.companyProfileComplete}
                              onChange={(e) =>
                                setCompanyProfile((p) => ({ ...p, companyProfileComplete: e.target.checked }))
                              }
                              className="rounded border-gray-300"
                            />
                            Mark company profile as complete
                          </label>
                          <Button onClick={saveCompanyProfile} disabled={profileSaving}>
                            {profileSaving ? (
                              <>
                                <Loader2 className="animate-spin mr-2" size={16} />
                                Saving…
                              </>
                            ) : (
                              "Save profile"
                            )}
                          </Button>
                        </div>
                      )}

                      {detailTab === "members" && (
                        <div className="space-y-8 max-w-2xl">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Invite new learner</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              Sends a magic-link email. The account is pre-approved for this academy.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Input
                                type="email"
                                placeholder="colleague@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="max-w-md flex-1 min-w-[200px]"
                              />
                              <Button type="button" onClick={inviteToSelectedAcademy} disabled={inviteBusy}>
                                {inviteBusy ? "Sending…" : "Send invite"}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              Add existing platform user
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              Search by name or email, then assign them to this academy (super admin).
                            </p>
                            <Input
                              placeholder="Search users…"
                              value={pickerQuery}
                              onChange={(e) => setPickerQuery(e.target.value)}
                              className="max-w-md mb-2"
                            />
                            <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10">
                              {pickerFiltered.map((u) => (
                                <li
                                  key={u.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium text-gray-900 dark:text-white block truncate">
                                      {u.name}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate block">{u.email}</span>
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={assignBusyId === u.id}
                                    onClick={() => void assignUserToSelectedAcademy(u.id)}
                                  >
                                    {assignBusyId === u.id ? "…" : "Add"}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                            {pickerFiltered.length === 0 && (
                              <p className="text-xs text-gray-500 mt-2">No matching users, or all are already in this academy.</p>
                            )}
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              Current members ({membersList.length})
                            </h3>
                            {membersLoading ? (
                              <p className="text-sm text-gray-500">Loading…</p>
                            ) : (
                              <ul className="rounded-lg border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10 max-h-64 overflow-y-auto">
                                {membersList.map((m) => (
                                  <li key={m.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                                    <span>
                                      <span className="font-medium text-gray-900 dark:text-white">{m.name}</span>
                                      <span className="text-gray-500 text-xs block">{m.email}</span>
                                    </span>
                                    {m.orgApprovalStatus && m.orgApprovalStatus !== "APPROVED" && (
                                      <span className="text-xs text-amber-600 shrink-0">{m.orgApprovalStatus}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}

                      {detailTab === "plan" && (
                        <div className="space-y-5 max-w-xl">
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Account Type
                            </label>
                            <AccountTypeToggle value={accountType} onChange={setAccountType} />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {accountType === "company"
                                ? "Standard company account with platform access for employees."
                                : "Fully customizable white-label academy with branding, plans, and user limits."}
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Subscription Plan
                            </label>
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
                                  <span
                                    className={`text-sm font-semibold ${
                                      selectedPlan === plan.value ? "text-brand-purple" : "text-gray-900 dark:text-white"
                                    }`}
                                  >
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
                              </div>
                            </div>
                          )}

                          <Button onClick={saveAccountSettings} disabled={settingsLoading} className="w-full sm:w-auto">
                            {settingsLoading ? "Saving…" : "Save Account Settings"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>

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
