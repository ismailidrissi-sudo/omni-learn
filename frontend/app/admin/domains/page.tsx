"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { learningPaths: number; contentItems: number };
}

interface DomainForm {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

const EMPTY_FORM: DomainForm = { name: "", slug: "", description: "", icon: "📚", color: "#059669", sortOrder: 0 };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminDomainsPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const tenantId = user?.tenantId;

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DomainForm>(EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDomains = useCallback(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`/domains?tenantId=${tenantId}&activeOnly=false`)
      .then((r) => r.json())
      .then((d: Domain[]) => setDomains(Array.isArray(d) ? d : []))
      .catch(() => setError("Failed to load domains"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setAutoSlug(true);
    setEditId(null);
    setView("create");
    setError("");
    setSuccess("");
  }

  function openEdit(d: Domain) {
    setForm({
      name: d.name,
      slug: d.slug,
      description: d.description || "",
      icon: d.icon || "📚",
      color: d.color,
      sortOrder: d.sortOrder,
    });
    setAutoSlug(false);
    setEditId(d.id);
    setView("edit");
    setError("");
    setSuccess("");
  }

  function updateField(key: keyof DomainForm, value: string | number) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && autoSlug) next.slug = slugify(value as string);
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Domain name is required"); return; }
    if (!tenantId) { setError("No tenant associated with your account. Please contact support."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/domains/${editId}` : "/domains";
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { name: form.name, slug: form.slug, description: form.description || undefined, icon: form.icon, color: form.color, sortOrder: form.sortOrder }
        : { tenantId, name: form.name, slug: form.slug || undefined, description: form.description || undefined, icon: form.icon, color: form.color };
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || "Failed to save domain");
        return;
      }
      setSuccess(editId ? "Domain updated" : "Domain created");
      setView("list");
      loadDomains();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Domain) {
    try {
      const res = await apiFetch(`/domains/${d.id}/toggle`, {
        method: "PUT",
        body: JSON.stringify({ active: !d.isActive }),
      });
      if (res.ok) loadDomains();
    } catch { /* ignore */ }
  }

  async function deleteDomain(d: Domain) {
    if (!confirm(`Delete "${d.name}"? This will remove all associated certificate templates.`)) return;
    try {
      const res = await apiFetch(`/domains/${d.id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess(`"${d.name}" deleted`);
        loadDomains();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || "Failed to delete domain");
      }
    } catch {
      setError("Failed to delete domain");
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <LearnLogo size="md" variant="purple" />
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/domains"><Button variant="primary" size="sm">Domains</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/certificates"><Button variant="ghost" size="sm">Certificates</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/pages"><Button variant="ghost" size="sm">Pages</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <Link href="/admin/trainers"><Button variant="ghost" size="sm">Trainer requests</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}
        {success && <ErrorBanner message={success} variant="success" onDismiss={() => setSuccess("")} className="mb-4" />}

        {view === "list" ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-brand-title text-brand-grey-dark font-bold">Learning Domains</h1>
                <p className="text-brand-grey text-sm mt-1">Organize content into thematic domains — each gets its own certificate template</p>
              </div>
              <Button onClick={openCreate}>+ New Domain</Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-5 animate-pulse">
                    <div className="h-5 bg-brand-grey-light rounded w-1/3 mb-2" />
                    <div className="h-4 bg-brand-grey-light rounded w-1/5" />
                  </Card>
                ))}
              </div>
            ) : domains.length === 0 ? (
              <Card className="p-12 text-center text-brand-grey">
                <div className="text-4xl mb-4">🗂️</div>
                <p className="font-medium">No domains yet</p>
                <p className="text-sm mt-1">Create your first learning domain to start organizing content</p>
                <Button className="mt-4" onClick={openCreate}>Create Domain</Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {domains.map((d) => (
                  <Card key={d.id} className="p-0 overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl flex-shrink-0">{d.icon || "📚"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-brand-grey-dark truncate">{d.name}</h3>
                              {!d.isActive && <Badge variant="stardust">Inactive</Badge>}
                            </div>
                            <p className="text-xs text-brand-grey mt-0.5">
                              /{d.slug}
                              {d._count && (
                                <span className="ml-3">
                                  {d._count.learningPaths} path{d._count.learningPaths !== 1 ? "s" : ""}
                                  {" · "}
                                  {d._count.contentItems} item{d._count.contentItems !== 1 ? "s" : ""}
                                </span>
                              )}
                            </p>
                            {d.description && (
                              <p className="text-xs text-brand-grey mt-1 truncate max-w-md">{d.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: d.color }} title={d.color} />
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(d)}>
                            {d.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(d)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDomain(d)} className="text-red-500 hover:text-red-600">
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── CREATE / EDIT FORM ── */
          <div>
            <button
              type="button"
              onClick={() => { setView("list"); setError(""); setSuccess(""); }}
              className="flex items-center gap-1 text-sm text-brand-grey hover:text-brand-grey-dark transition-colors mb-4"
            >
              &larr; Back to domains
            </button>

            <h1 className="text-brand-title text-brand-grey-dark font-bold mb-6">
              {view === "create" ? "New Domain" : `Edit: ${form.name}`}
            </h1>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-5 space-y-4">
                  <h2 className="font-semibold text-brand-grey-dark">Identity</h2>
                  <Input
                    label="Domain Name *"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Food Safety"
                  />
                  <Input
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => { setAutoSlug(false); updateField("slug", e.target.value); }}
                    placeholder="auto-generated"
                    hint="URL-friendly identifier"
                  />
                  <Input
                    label="Description"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Optional description of this domain"
                  />
                </Card>

                <Card className="p-5 space-y-4">
                  <h2 className="font-semibold text-brand-grey-dark">Appearance</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-brand-grey-dark mb-1.5">Icon (emoji)</label>
                      <Input
                        value={form.icon}
                        onChange={(e) => updateField("icon", e.target.value)}
                        placeholder="📚"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-grey-dark mb-1.5">Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.color}
                          onChange={(e) => updateField("color", e.target.value)}
                          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                        />
                        <Input
                          value={form.color}
                          onChange={(e) => updateField("color", e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  {view === "edit" && (
                    <div>
                      <label className="block text-sm font-medium text-brand-grey-dark mb-1.5">Sort Order</label>
                      <Input
                        type="number"
                        value={String(form.sortOrder)}
                        onChange={(e) => updateField("sortOrder", parseInt(e.target.value) || 0)}
                        hint="Lower numbers appear first"
                      />
                    </div>
                  )}
                </Card>
              </div>

              {/* Preview */}
              <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-4">
                  <Card className="p-0 overflow-hidden">
                    <div className="px-4 py-3 bg-brand-grey-light/40 border-b border-brand-grey-light">
                      <h3 className="text-sm font-semibold text-brand-grey-dark">Preview</h3>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: form.color + "20" }}
                        >
                          {form.icon || "📚"}
                        </div>
                        <div>
                          <h4 className="font-semibold text-brand-grey-dark">{form.name || "Domain Name"}</h4>
                          <p className="text-xs text-brand-grey">/{form.slug || "slug"}</p>
                        </div>
                      </div>
                      {form.description && (
                        <p className="text-sm text-brand-grey mb-3">{form.description}</p>
                      )}
                      <div className="flex gap-2 items-center">
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: form.color }} />
                      </div>
                      <p className="text-xs text-brand-grey mt-3">
                        A certificate template will be {view === "create" ? "auto-created" : "associated"} with this domain.
                      </p>
                    </div>
                  </Card>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setView("list")} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? "Saving..." : view === "create" ? "Create Domain" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
