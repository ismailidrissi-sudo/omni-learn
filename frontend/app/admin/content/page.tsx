"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ContentAddForm, type ContentType } from "@/components/admin/content-add-form";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

const CONTENT_TYPES = [
  { type: "COURSE", icon: "📚", label: "Course" },
  { type: "MICRO_LEARNING", icon: "⚡", label: "Micro-learning" },
  { type: "PODCAST", icon: "🎧", label: "Podcast" },
  { type: "DOCUMENT", icon: "📄", label: "Document" },
  { type: "IMPLEMENTATION_GUIDE", icon: "🛠️", label: "Implementation Guide" },
  { type: "QUIZ_ASSESSMENT", icon: "✅", label: "Quiz / Assessment" },
  { type: "GAME", icon: "🎮", label: "Game" },
  { type: "VIDEO", icon: "🎬", label: "Video" },
];

type ContentItem = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  domainId?: string | null;
  mediaId?: string | null;
  durationMinutes?: number | null;
  metadata?: string | Record<string, unknown> | null;
  createdAt?: string;
  tenantAssignments?: { tenantId: string; tenant: { id: string; name: string } }[];
  userAssignments?: { userId: string; user: { id: string; name: string; email: string } }[];
};

function AdminContentPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [view, setView] = useState<"list" | "create" | "edit" | "courseBuilder">("list");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [formType, setFormType] = useState("COURSE");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formScormUrl, setFormScormUrl] = useState("");
  const [formXapiEndpoint, setFormXapiEndpoint] = useState("");
  const [formHlsUrl, setFormHlsUrl] = useState("");
  const [formAudioUrl, setFormAudioUrl] = useState("");
  const [formThumbnailUrl, setFormThumbnailUrl] = useState("");
  const [formMediaId, setFormMediaId] = useState("");
  const [formDomainId, setFormDomainId] = useState("");
  const [formAssignToAllCompanies, setFormAssignToAllCompanies] = useState(true);
  const [formTenantIds, setFormTenantIds] = useState<string[]>([]);
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formIsFoundational, setFormIsFoundational] = useState(true);

  // Lookup data
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [domains, setDomains] = useState<{ id: string; name: string; slug: string; tenant?: { id: string; name: string } }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const loadContent = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ admin: "true" });
    if (filterType) params.set("type", filterType);
    apiFetch(`/content?${params}`)
      .then((r) => r.json())
      .then((data) => setContent(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load content. Please try again later."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContent();
  }, [filterType]);

  useEffect(() => {
    if (!editId || content.length === 0) return;
    const item = content.find((c) => c.id === editId);
    if (item) openEdit(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openEdit is stable, editId/content trigger
  }, [editId, content]);

  useEffect(() => {
    apiFetch("/company/tenants").then((r) => r.json()).then((d) => setTenants(Array.isArray(d) ? d : [])).catch(() => setTenants([]));
    apiFetch("/domains").then((r) => r.json()).then((d) => setDomains(Array.isArray(d) ? d : [])).catch(() => setDomains([]));
    apiFetch("/company/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([]));
  }, []);

  const filteredContent = content.filter(
    (c) =>
      (!search || c.title.toLowerCase().includes(search.toLowerCase())) &&
      (!filterType || c.type === filterType)
  );

  const resetForm = () => {
    setFormType("COURSE");
    setFormTitle("");
    setFormDescription("");
    setFormDuration("");
    setFormScormUrl("");
    setFormXapiEndpoint("");
    setFormHlsUrl("");
    setFormAudioUrl("");
    setFormMediaId("");
    setFormDomainId("");
    setFormAssignToAllCompanies(true);
    setFormTenantIds([]);
    setFormUserIds([]);
    setFormIsFoundational(true);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setView("create");
  };

  const openEdit = async (item: ContentItem) => {
    setEditing(item);
    setFormType(item.type);
    setFormTitle(item.title);
    setFormDescription(item.description ?? "");
    setFormDuration(item.durationMinutes?.toString() ?? "");
    const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata || "{}") : (item.metadata || {}) as Record<string, unknown>;
    setFormScormUrl((meta.scormPackageUrl as string) ?? "");
    setFormXapiEndpoint((meta.xapiEndpoint as string) ?? "");
    setFormHlsUrl((meta.hlsUrl as string) ?? item.mediaId ?? "");
    setFormAudioUrl((meta.audioUrl as string) ?? item.mediaId ?? "");
    setFormThumbnailUrl((meta.thumbnailUrl as string) ?? "");
    setFormMediaId(item.mediaId ?? "");
    setFormDomainId(item.domainId ?? "");
    const full = await apiFetch(`/content/${item.id}?admin=true`).then((r) => r.json()).catch(() => ({}));
    setFormAssignToAllCompanies(!full.tenantAssignments?.length);
    setFormTenantIds((full.tenantAssignments ?? []).map((a: { tenantId: string }) => a.tenantId));
    setFormUserIds((full.userAssignments ?? []).map((a: { userId: string }) => a.userId));
    setFormIsFoundational(full.isFoundational ?? false);
    setView("edit");
  };

  const openCourseBuilder = (course: { id: string; title: string }) => {
    setView("courseBuilder");
    setEditing({ ...course, type: "COURSE", title: course.title } as ContentItem);
  };

  const saveContent = () => {
    if (!formTitle.trim()) return;

    const metadata: Record<string, unknown> = {};
    if (formType === "COURSE") {
      if (formScormUrl) metadata.scormPackageUrl = formScormUrl;
      if (formXapiEndpoint) metadata.xapiEndpoint = formXapiEndpoint;
    } else if (formType === "VIDEO") {
      if (formHlsUrl) metadata.hlsUrl = formHlsUrl;
    } else if (formType === "PODCAST") {
      if (formAudioUrl) metadata.audioUrl = formAudioUrl;
    }

    const duration = formDuration ? parseInt(formDuration, 10) : undefined;
    const mediaId = formMediaId || (formType === "VIDEO" ? formHlsUrl : formType === "PODCAST" ? formAudioUrl : undefined);
    const tenantIds = formAssignToAllCompanies ? [] : formTenantIds;
    const userIds = formUserIds;

    const payload = {
      type: formType,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      domainId: formDomainId || undefined,
      durationMinutes: duration,
      mediaId: mediaId || undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      tenantIds,
      userIds,
      isFoundational: formIsFoundational,
    };

    if (editing) {
      apiFetch(`/content/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
        .then(() => {
          loadContent();
          setView("list");
          resetForm();
        })
        .catch(console.error);
    } else if (formType === "COURSE") {
      apiFetch("/content/courses", {
        method: "POST",
        body: JSON.stringify({
          title: formTitle.trim(),
          durationMinutes: duration,
          description: formDescription.trim() || undefined,
          domainId: formDomainId || undefined,
          tenantIds,
          userIds,
          isFoundational: formIsFoundational,
          scormMetadata: {},
        }),
      })
        .then((r) => r.json())
        .then((created) => {
          loadContent();
          openCourseBuilder({ id: created.id, title: created.title });
        })
        .catch(console.error);
    } else {
      apiFetch("/content", {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then(() => {
          loadContent();
          setView("list");
          resetForm();
        })
        .catch(console.error);
    }
  };

  const deleteContent = (id: string) => {
    if (!confirm(t("admin.contentDeleteConfirm"))) return;
    apiFetch(`/content/${id}`, { method: "DELETE" })
      .then(loadContent)
      .catch(console.error);
  };

  const navLinks = (
    <nav className="flex items-center gap-4">
      <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
      <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
      <Link href="/admin/domains"><Button variant="ghost" size="sm">Domains</Button></Link>
      <Link href="/admin/content"><Button variant="primary" size="sm">{t("nav.content")}</Button></Link>
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
  );

  const domainOptionsForForm = domains.map((d) => ({
    id: d.id,
    name: d.tenant ? `${d.name} (${d.tenant.name})` : d.name,
  }));

  if (view === "courseBuilder" && editing) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
          <Link href="/"><LearnLogo size="md" variant="purple" /></Link>
          {navLinks}
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <CourseBuilder
            courseId={editing.id}
            courseTitle={editing.title}
            onBack={() => {
              setView("list");
              resetForm();
            }}
          />
        </main>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
          <Link href="/"><LearnLogo size="md" variant="purple" /></Link>
          {navLinks}
        </header>

        <main className="max-w-2xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-brand-title text-brand-grey-dark font-bold">
              {t("admin.addContent")}
            </h1>
            <Button variant="ghost" onClick={() => { setView("list"); resetForm(); }}>
              {t("common.back")}
            </Button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-brand-grey-dark mb-1">{t("admin.contentType")}</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.type} value={ct.type}>{ct.icon} {ct.label}</option>
              ))}
            </select>
          </div>

          <ContentAddForm
            contentType={formType as ContentType}
            onSuccess={() => { loadContent(); setView("list"); resetForm(); }}
            onCancel={() => { setView("list"); resetForm(); }}
            domainId={formDomainId}
            onDomainChange={setFormDomainId}
            domainOptions={domainOptionsForForm}
            tenantIds={formTenantIds}
            userIds={formUserIds}
            assignToAllCompanies={formAssignToAllCompanies}
            onTenantChange={setFormTenantIds}
            onUserChange={setFormUserIds}
            onAssignToAllChange={setFormAssignToAllCompanies}
            tenants={tenants}
            users={users}
            isFoundational={formIsFoundational}
            onIsFoundationalChange={setFormIsFoundational}
            onCourseCreated={(cid, cTitle) => {
              loadContent();
              setEditing({ id: cid, title: cTitle, type: "COURSE" } as ContentItem);
              setView("courseBuilder");
            }}
          />
        </main>
      </div>
    );
  }

  if (view === "edit" && editing) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
          <Link href="/"><LearnLogo size="md" variant="purple" /></Link>
          {navLinks}
        </header>

        <main className="max-w-2xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-brand-title text-brand-grey-dark font-bold">
              {t("admin.editContent")}
            </h1>
            <Button variant="ghost" onClick={() => { setView("list"); resetForm(); }}>
              {t("common.back")}
            </Button>
          </div>

          <Card className="p-6 space-y-4">
            <Input
              label={t("admin.name")}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t("admin.contentTitlePlaceholder")}
            />
            <div>
              <label className="block text-sm font-medium text-brand-grey-dark mb-1.5">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what learners will gain..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
              />
            </div>
            <Input
              label={t("admin.durationMinutes")}
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              placeholder="e.g. 60"
            />
            {formType === "VIDEO" && (
              <Input
                label="Video URL"
                value={formHlsUrl || formMediaId}
                onChange={(e) => { setFormHlsUrl(e.target.value); setFormMediaId(e.target.value); }}
                placeholder="https://...m3u8 or video URL"
              />
            )}
            {formType === "PODCAST" && (
              <>
                <Input
                  label="Audio / Video URL"
                  value={formAudioUrl || formMediaId}
                  onChange={(e) => { setFormAudioUrl(e.target.value); setFormMediaId(e.target.value); }}
                  placeholder="https://...mp3"
                />
                <Input
                  label="Thumbnail / Cover image URL"
                  value={formThumbnailUrl}
                  onChange={(e) => setFormThumbnailUrl(e.target.value)}
                  placeholder="https://...jpg (optional)"
                />
              </>
            )}
            {!["COURSE", "VIDEO", "PODCAST"].includes(formType) && (
              <Input
                label="Media / Resource URL"
                value={formMediaId}
                onChange={(e) => setFormMediaId(e.target.value)}
                placeholder="https://..."
              />
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Domain</label>
              <select
                value={formDomainId}
                onChange={(e) => setFormDomainId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border"
              >
                <option value="">— Select domain —</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAssignToAllCompanies}
                  onChange={(e) => setFormAssignToAllCompanies(e.target.checked)}
                />
                <span className="text-sm font-medium">Available to all companies</span>
              </label>
              {!formAssignToAllCompanies && (
                <div className="mt-2 space-y-2">
                  {tenants.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formTenantIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) setFormTenantIds((prev) => [...prev, t.id]);
                          else setFormTenantIds((prev) => prev.filter((id) => id !== t.id));
                        }}
                      />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsFoundational}
                  onChange={(e) => setFormIsFoundational(e.target.checked)}
                />
                <span className="text-sm font-medium">Visible to free-tier users</span>
              </label>
              <p className="text-xs text-brand-grey mt-1 ml-6">
                When enabled, Explorer (free) users can access this content. Disable to restrict to paid tiers only.
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              {formType === "COURSE" && (
                <Button onClick={() => openCourseBuilder(editing)}>
                  {t("admin.courseBuildCurriculum")}
                </Button>
              )}
              <Button onClick={saveContent}>{t("common.save")}</Button>
              <Button variant="ghost" onClick={() => { setView("list"); resetForm(); }}>{t("common.back")}</Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/"><LearnLogo size="md" variant="purple" /></Link>
        {navLinks}
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-brand-title text-brand-grey-dark font-bold">
            {t("admin.academyContent")}
          </h1>
          <Button variant="primary" onClick={openCreate}>
            {t("admin.addContent")}
          </Button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {loading ? (
          <div className="min-h-[200px] flex items-center justify-center"><p className="text-brand-grey">Loading...</p></div>
        ) : (<>
        <div className="flex gap-4 mb-6 flex-wrap">
          <Input
            placeholder={t("admin.searchContent")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
          >
            <option value="">{t("admin.allTypes")}</option>
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.type} value={ct.type}>{ct.icon} {ct.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filteredContent.length === 0 && (
            <Card className="p-8 text-center text-brand-grey">
              <p className="mb-4">{t("admin.noContentYet")}</p>
              <p className="text-sm mb-4">{t("admin.contentHint")}</p>
              <Button onClick={openCreate}>{t("admin.addContent")}</Button>
            </Card>
          )}
          {filteredContent.map((item) => {
            const ct = CONTENT_TYPES.find((c) => c.type === item.type);
            return (
              <Card key={item.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{ct?.icon ?? "📄"}</span>
                  <div>
                    <h3 className="font-semibold text-brand-grey-dark">{item.title}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="pulsar">{item.type.replace("_", " ")}</Badge>
                      {item.durationMinutes && (
                        <span className="text-brand-grey text-sm">{item.durationMinutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.type === "COURSE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCourseBuilder(item)}
                    >
                      {t("admin.courseBuildCurriculum")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    {t("common.edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteContent(item.id)} className="text-red-600">
                    {t("common.delete")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        </>)}
      </main>
    </div>
  );
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6">Loading content...</div>}>
      <AdminContentPageContent />
    </Suspense>
  );
}
