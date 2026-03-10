"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Tenant = { id: string; name: string; slug: string; industryId?: string; linkedinProfileUrl?: string; companyProfileComplete?: boolean; branding?: { logoUrl?: string; primaryColor?: string } | null };
type Branding = { logoUrl?: string; faviconUrl?: string; primaryColor?: string; secondaryColor?: string };
type Option = { id: string; name: string };

export default function CompanyAdminPage() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [branding, setBranding] = useState<Branding>({});
  const [industries, setIndustries] = useState<Option[]>([]);
  const [companyProfile, setCompanyProfile] = useState({ industryId: "", linkedinProfileUrl: "", targetMarkets: "", productsServices: "", staffingLevel: "" });
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  useEffect(() => {
    fetch(`${API}/profile/options`).then((r) => r.json()).then((o) => setIndustries(o?.industries ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/company/tenants`)
      .then((r) => r.json())
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`${API}/company/tenants/${selected.id}/branding`)
      .then((r) => r.json())
      .then((b) => setBranding(b || {}))
      .catch(() => setBranding({}));
    fetch(`${API}/company/tenants/${selected.id}`)
      .then((r) => r.json())
      .then((t) => setCompanyProfile({
        industryId: t?.industryId ?? "",
        linkedinProfileUrl: t?.linkedinProfileUrl ?? "",
        targetMarkets: Array.isArray(t?.targetMarkets) ? t.targetMarkets.join(", ") : "",
        productsServices: Array.isArray(t?.productsServices) ? t.productsServices.join(", ") : "",
        staffingLevel: t?.staffingLevel ?? "",
      }))
      .catch(() => {});
  }, [selected?.id]);

  const saveCompanyProfile = () => {
    if (!selected) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_token") : null;
    fetch(`${API}/profile/tenant/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({
        industryId: companyProfile.industryId || undefined,
        linkedinProfileUrl: companyProfile.linkedinProfileUrl || undefined,
        targetMarkets: companyProfile.targetMarkets ? companyProfile.targetMarkets.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        productsServices: companyProfile.productsServices ? companyProfile.productsServices.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        staffingLevel: companyProfile.staffingLevel || undefined,
      }),
    }).then(() => fetch(`${API}/company/tenants`).then((r) => r.json()).then(setTenants));
  };

  const saveBranding = () => {
    if (!selected) return;
    fetch(`${API}/company/tenants/${selected.id}/branding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
    }).then(() => fetch(`${API}/company/tenants`).then((r) => r.json()).then(setTenants));
  };

  const createTenant = () => {
    if (!newName.trim() || !newSlug.trim()) return;
    fetch(`${API}/company/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    })
      .then((r) => r.json())
      .then(() => {
        setNewName("");
        setNewSlug("");
        fetch(`${API}/company/tenants`).then((r) => r.json()).then(setTenants);
      });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/company"><Button variant="primary" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">{t("admin.companyAdmin")}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("admin.tenants")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-0 flex-1" placeholder={t("admin.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input className="min-w-0 flex-1" placeholder={t("forum.slug")} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
                <Button size="sm" onClick={createTenant} className="shrink-0">{t("common.add")}</Button>
              </div>
              <div className="space-y-2">
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`w-full text-left px-3 py-2 rounded-lg ${selected?.id === t.id ? "bg-brand-purple/10 text-brand-purple" : "hover:bg-brand-grey-light/50"}`}
                  >
                    {t.name} ({t.slug})
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden min-h-[200px]">
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

        {selected && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Company profile (for recommendations)</CardTitle>
              <p className="text-sm text-gray-500">Industry, LinkedIn, markets — used to optimize LightFM recommendations</p>
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
    </div>
  );
}
