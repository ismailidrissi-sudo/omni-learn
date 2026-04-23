"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ContentAddForm, type ContentType } from "@/components/admin/content-add-form";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch, apiUploadDocument, apiUploadCourseThumbnail } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useUser } from "@/lib/use-user";
import { usePermissions } from "@/hooks/use-permissions";

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
  createdById?: string | null;
  availablePlans?: unknown;
  availableInEnterprise?: boolean;
  isFoundational?: boolean;
  language?: string;
  tenantAssignments?: { tenantId: string; tenant: { id: string; name: string } }[];
  userAssignments?: { userId: string; user: { id: string; name: string; email: string } }[];
  _count?: { tenantAssignments: number };
};

type VisibilityFilter = "" | "explorer_free" | "paid_only" | "enterprise_all" | "enterprise_selected";

function parseContentPlans(availablePlans: unknown): string[] {
  if (Array.isArray(availablePlans)) {
    return availablePlans.filter((p): p is string => typeof p === "string").map((p) => p.trim().toUpperCase());
  }
  if (typeof availablePlans === "string") {
    try {
      const parsed = JSON.parse(availablePlans) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((p): p is string => typeof p === "string").map((p) => p.trim().toUpperCase())
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function matchesVisibilityFilter(item: ContentItem, filter: VisibilityFilter): boolean {
  if (!filter) return true;
  const plans = parseContentPlans(item.availablePlans);
  const hasExplorer = plans.includes("EXPLORER");
  const hasPaidPlan = plans.some((p) => p !== "EXPLORER");
  const enterprise = !!item.availableInEnterprise;
  const tenantCount = item._count?.tenantAssignments ?? 0;

  switch (filter) {
    case "explorer_free":
      return hasExplorer;
    case "paid_only":
      return !hasExplorer && hasPaidPlan;
    case "enterprise_all":
      return enterprise && tenantCount === 0;
    case "enterprise_selected":
      return enterprise && tenantCount > 0;
    default:
      return true;
  }
}

const PLAN_OPTIONS = [
  { id: "EXPLORER", label: "Explorer (Free)", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { id: "SPECIALIST", label: "Specialist", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { id: "VISIONARY", label: "Visionary", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { id: "NEXUS", label: "Nexus (Enterprise)", color: "bg-amber-100 text-amber-700 border-amber-300" },
] as const;

function AdminContentPageContent() {
  const { t } = useI18n();
  const { user } = useUser();
  const { can } = usePermissions();
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [view, setView] = useState<"list" | "create" | "edit" | "courseBuilder">("list");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [filterVisibility, setFilterVisibility] = useState<VisibilityFilter>("");
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
  const [formPodcastMediaType, setFormPodcastMediaType] = useState<"audio" | "video">("audio");
  const [formPodcastVideoUrl, setFormPodcastVideoUrl] = useState("");
  const [formPodcastThumbMode, setFormPodcastThumbMode] = useState<"url" | "file">("url");
  const [formPodcastThumbUploading, setFormPodcastThumbUploading] = useState(false);
  const [formMediaId, setFormMediaId] = useState("");
  const [formDomainId, setFormDomainId] = useState("");
  const [formAssignToAllCompanies, setFormAssignToAllCompanies] = useState(true);
  const [formTenantIds, setFormTenantIds] = useState<string[]>([]);
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formIsFoundational, setFormIsFoundational] = useState(true);
  const [formAvailablePlans, setFormAvailablePlans] = useState<string[]>(["EXPLORER", "SPECIALIST", "VISIONARY", "NEXUS"]);
  const [formNeedsExplicitPlanSave, setFormNeedsExplicitPlanSave] = useState(false);
  const [formAvailableInEnterprise, setFormAvailableInEnterprise] = useState(false);
  const [formLanguage, setFormLanguage] = useState("en");
  const [editDocInputMode, setEditDocInputMode] = useState<"url" | "file">("url");
  const [editDocFileName, setEditDocFileName] = useState("");
  const [editUploading, setEditUploading] = useState(false);

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
      (!filterType || c.type === filterType) &&
      matchesVisibilityFilter(c, filterVisibility)
  );

  function canMutateCourse(item: ContentItem): boolean {
    if (item.type !== "COURSE") return true;
    if (can("courses:edit_any")) return true;
    if (item.createdById && user?.id === item.createdById) return true;
    return false;
  }

  function creatorLabel(createdById: string | null | undefined): string {
    if (!createdById) return "—";
    const u = users.find((x) => x.id === createdById);
    return u ? `${u.name}` : `${createdById.slice(0, 8)}…`;
  }

  const resetForm = () => {
    setFormType("COURSE");
    setFormTitle("");
    setFormDescription("");
    setFormDuration("");
    setFormScormUrl("");
    setFormXapiEndpoint("");
    setFormHlsUrl("");
    setFormAudioUrl("");
    setFormThumbnailUrl("");
    setFormPodcastMediaType("audio");
    setFormPodcastVideoUrl("");
    setFormPodcastThumbMode("url");
    setFormPodcastThumbUploading(false);
    setFormMediaId("");
    setFormDomainId("");
    setFormAssignToAllCompanies(true);
    setFormTenantIds([]);
    setFormUserIds([]);
    setFormIsFoundational(true);
    setFormAvailablePlans(["EXPLORER", "SPECIALIST", "VISIONARY", "NEXUS"]);
    setFormNeedsExplicitPlanSave(false);
    setFormAvailableInEnterprise(false);
    setFormLanguage("en");
    setEditDocInputMode("url");
    setEditDocFileName("");
    setEditUploading(false);
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
    const podVideo = (meta.videoUrl as string) ?? "";
    const podAudio = (meta.audioUrl as string) ?? "";
    const isPodVideo = item.type === "PODCAST" && !!podVideo;
    setFormPodcastMediaType(item.type === "PODCAST" ? (isPodVideo ? "video" : "audio") : "audio");
    setFormPodcastVideoUrl(item.type === "PODCAST" ? podVideo : "");
    setFormAudioUrl(
      item.type === "PODCAST"
        ? (isPodVideo ? podAudio : podAudio || item.mediaId || "")
        : (meta.audioUrl as string) ?? item.mediaId ?? "",
    );
    setFormThumbnailUrl((meta.thumbnailUrl as string) ?? "");
    setFormPodcastThumbMode("url");
    setFormMediaId(item.mediaId ?? "");
    setFormDomainId(item.domainId ?? "");
    const full = await apiFetch(`/content/${item.id}?admin=true`).then((r) => r.json()).catch(() => ({}));
    setFormAssignToAllCompanies(!full.tenantAssignments?.length);
    setFormTenantIds((full.tenantAssignments ?? []).map((a: { tenantId: string }) => a.tenantId));
    setFormUserIds((full.userAssignments ?? []).map((a: { userId: string }) => a.userId));
    setFormIsFoundational(full.isFoundational ?? false);
    const plansIsArray = Array.isArray(full.availablePlans);
    setFormAvailablePlans(
      plansIsArray
        ? full.availablePlans
        : ["EXPLORER", "SPECIALIST", "VISIONARY", "NEXUS"]
    );
    setFormNeedsExplicitPlanSave(!plansIsArray);
    setFormAvailableInEnterprise(full.availableInEnterprise ?? false);
    setFormLanguage(full.language ?? "en");
    setView("edit");
  };

  const openCourseBuilder = (course: { id: string; title: string }) => {
    setView("courseBuilder");
    setEditing({ ...course, type: "COURSE", title: course.title } as ContentItem);
  };

  const saveContent = () => {
    if (!formTitle.trim()) return;

    const prevMeta: Record<string, unknown> = (() => {
      if (!editing?.metadata) return {};
      try {
        return typeof editing.metadata === "string"
          ? JSON.parse(editing.metadata || "{}")
          : ({ ...(editing.metadata as Record<string, unknown>) });
      } catch {
        return {};
      }
    })();

    const metadata: Record<string, unknown> = editing ? { ...prevMeta } : {};
    if (formType === "COURSE") {
      if (formScormUrl) metadata.scormPackageUrl = formScormUrl;
      if (formXapiEndpoint) metadata.xapiEndpoint = formXapiEndpoint;
    } else if (formType === "VIDEO") {
      if (formHlsUrl) {
        metadata.hlsUrl = formHlsUrl;
        metadata.videoUrl = formHlsUrl;
      }
    } else if (formType === "PODCAST") {
      delete metadata.audioUrl;
      delete metadata.videoUrl;
      if (formPodcastMediaType === "audio") {
        if (formAudioUrl.trim()) metadata.audioUrl = formAudioUrl.trim();
      } else if (formPodcastVideoUrl.trim()) {
        metadata.videoUrl = formPodcastVideoUrl.trim();
      }
      if (formThumbnailUrl.trim()) metadata.thumbnailUrl = formThumbnailUrl.trim();
      else delete metadata.thumbnailUrl;
    }

    const duration = formDuration ? parseInt(formDuration, 10) : undefined;
    const podcastPrimary =
      formType === "PODCAST"
        ? (formPodcastMediaType === "audio" ? formAudioUrl.trim() : formPodcastVideoUrl.trim()) || formMediaId.trim()
        : undefined;
    const mediaId =
      formMediaId.trim() ||
      (formType === "VIDEO" ? formHlsUrl : undefined) ||
      (formType === "PODCAST" ? podcastPrimary : undefined);
    const tenantIds = formAvailableInEnterprise ? (formAssignToAllCompanies ? [] : formTenantIds) : [];
    const userIds = formUserIds;

    const payload = {
      type: formType,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      domainId: formDomainId || undefined,
      durationMinutes: duration,
      mediaId: mediaId || undefined,
      metadata:
        editing || Object.keys(metadata).length > 0
          ? metadata
          : undefined,
      tenantIds,
      userIds,
      isFoundational: formAvailablePlans.includes("EXPLORER"),
      availablePlans: formAvailablePlans,
      availableInEnterprise: formAvailableInEnterprise,
      language: formLanguage,
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
          isFoundational: formAvailablePlans.includes("EXPLORER"),
          availablePlans: formAvailablePlans,
          availableInEnterprise: formAvailableInEnterprise,
          language: formLanguage,
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
      .then(() => {
        toast(t("admin.contentDeleted"), "success");
        loadContent();
      })
      .catch(() => toast(t("admin.contentDeleteFailed"), "error"));
  };

  const domainOptionsForForm = domains.map((d) => ({
    id: d.id,
    name: d.tenant ? `${d.name} (${d.tenant.name})` : d.name,
  }));

  if (view === "courseBuilder" && editing) {
    return (
      <div className="min-h-screen bg-white">
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />
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
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

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
            availablePlans={formAvailablePlans}
            onAvailablePlansChange={setFormAvailablePlans}
            availableInEnterprise={formAvailableInEnterprise}
            onAvailableInEnterpriseChange={setFormAvailableInEnterprise}
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
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

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
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Media type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editPodcastMedia"
                        checked={formPodcastMediaType === "audio"}
                        onChange={() => setFormPodcastMediaType("audio")}
                      />
                      Audio
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editPodcastMedia"
                        checked={formPodcastMediaType === "video"}
                        onChange={() => setFormPodcastMediaType("video")}
                      />
                      Video
                    </label>
                  </div>
                </div>
                {formPodcastMediaType === "audio" ? (
                  <Input
                    label="Audio URL"
                    value={formAudioUrl}
                    onChange={(e) => { setFormAudioUrl(e.target.value); setFormMediaId(e.target.value); }}
                    placeholder="https://...mp3 or audio URL"
                  />
                ) : (
                  <Input
                    label="Video URL"
                    value={formPodcastVideoUrl || formMediaId}
                    onChange={(e) => {
                      setFormPodcastVideoUrl(e.target.value);
                      setFormMediaId(e.target.value);
                    }}
                    placeholder="https://youtube.com/watch?v=... or direct video URL"
                  />
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Thumbnail / cover image</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editPodcastThumb"
                        checked={formPodcastThumbMode === "url"}
                        onChange={() => setFormPodcastThumbMode("url")}
                      />
                      Image URL
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editPodcastThumb"
                        checked={formPodcastThumbMode === "file"}
                        onChange={() => setFormPodcastThumbMode("file")}
                      />
                      Upload image
                    </label>
                  </div>
                  {formPodcastThumbMode === "url" ? (
                    <Input
                      label="Thumbnail URL"
                      value={formThumbnailUrl}
                      onChange={(e) => setFormThumbnailUrl(e.target.value)}
                      placeholder="https://...jpg (optional)"
                    />
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setFormPodcastThumbUploading(true);
                          try {
                            const result = await apiUploadCourseThumbnail(file);
                            setFormThumbnailUrl(result.url);
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Thumbnail upload failed", "error");
                          } finally {
                            setFormPodcastThumbUploading(false);
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        disabled={formPodcastThumbUploading}
                      />
                      {formPodcastThumbUploading && (
                        <p className="text-sm text-purple-600 animate-pulse">Uploading thumbnail...</p>
                      )}
                      {formThumbnailUrl && !formPodcastThumbUploading && (
                        <p className="text-xs text-brand-grey truncate">Current: {formThumbnailUrl}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {formType === "DOCUMENT" && (
              <div className="space-y-3">
                <label className="block text-sm font-medium">Document (PDF, DOC, or DOCX)</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="editDocMode" checked={editDocInputMode === "file"} onChange={() => setEditDocInputMode("file")} />
                    Upload File
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="editDocMode" checked={editDocInputMode === "url"} onChange={() => setEditDocInputMode("url")} />
                    Paste URL
                  </label>
                </div>
                {editDocInputMode === "file" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditUploading(true);
                        try {
                          const result = await apiUploadDocument(file);
                          setFormMediaId(result.url);
                          setEditDocFileName(file.name);
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Upload failed", "error");
                        } finally {
                          setEditUploading(false);
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      disabled={editUploading}
                    />
                    {editUploading && <p className="text-sm text-purple-600 animate-pulse">Uploading document...</p>}
                    {editDocFileName && !editUploading && <p className="text-sm text-green-700">Uploaded: {editDocFileName}</p>}
                    {formMediaId && !editDocFileName && !editUploading && (
                      <p className="text-xs text-brand-grey truncate">Current: {formMediaId}</p>
                    )}
                  </div>
                ) : (
                  <Input
                    label="Document URL"
                    value={formMediaId}
                    onChange={(e) => { setFormMediaId(e.target.value); setEditDocFileName(""); }}
                    placeholder="https://...pdf or https://...docx"
                  />
                )}
              </div>
            )}
            {!["COURSE", "VIDEO", "PODCAST", "DOCUMENT"].includes(formType) && (
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
              <label className="block text-sm font-medium mb-1">{t("admin.language")}</label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            {/* Plan availability */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Available in Plans</label>
              <p className="text-xs text-brand-grey -mt-2">
                Select which subscription plans can access this content.
              </p>
              {formNeedsExplicitPlanSave && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This item was saved before plan-based access existed. The
                  default (all plans) is pre-selected — click Save to persist
                  it explicitly.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {PLAN_OPTIONS.map((plan) => {
                  const checked = formAvailablePlans.includes(plan.id);
                  return (
                    <label
                      key={plan.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked
                          ? plan.color + " border-current"
                          : "bg-white border-brand-grey-light hover:border-brand-grey"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formAvailablePlans.filter((p) => p !== plan.id)
                            : [...formAvailablePlans, plan.id];
                          setFormAvailablePlans(next);
                          setFormIsFoundational(next.includes("EXPLORER"));
                        }}
                        className="accent-current"
                      />
                      <span className="text-sm font-medium">{plan.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Enterprise / white-label academy availability */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAvailableInEnterprise}
                  onChange={(e) => setFormAvailableInEnterprise(e.target.checked)}
                />
                <span className="text-sm font-medium">Available for Enterprise (Company Academies)</span>
              </label>
              <p className="text-xs text-brand-grey ml-6 -mt-2">
                When enabled, companies can include this content in their white-label academies.
              </p>

              {formAvailableInEnterprise && (
                <div className="ml-6 space-y-2 p-3 rounded-lg border border-brand-grey-light bg-gray-50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAssignToAllCompanies}
                      onChange={(e) => setFormAssignToAllCompanies(e.target.checked)}
                    />
                    <span className="text-sm font-medium">Available to all companies</span>
                  </label>
                  {!formAssignToAllCompanies && (
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {tenants.length === 0 && (
                        <p className="text-xs text-brand-grey italic">No companies found.</p>
                      )}
                      {tenants.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-white transition-colors">
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
              )}
            </div>
            <div className="flex gap-2 pt-4">
              {formType === "COURSE" && (
                <Button onClick={() => openCourseBuilder(editing)}>
                  {t("admin.courseBuildCurriculum")}
                </Button>
              )}
              <Button onClick={saveContent} disabled={editUploading || formPodcastThumbUploading}>{t("common.save")}</Button>
              <Button variant="ghost" onClick={() => { setView("list"); resetForm(); }}>{t("common.back")}</Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

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
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value as VisibilityFilter)}
            className="px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white min-w-[200px]"
            title="Filter by access / visibility (plans & company academies)"
          >
            <option value="">All visibility</option>
            <option value="explorer_free">Free (Explorer)</option>
            <option value="paid_only">Paid plans only</option>
            <option value="enterprise_all">Company academies — all tenants</option>
            <option value="enterprise_selected">Company academies — selected tenants</option>
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
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <Badge variant="pulsar">{item.type.replace("_", " ")}</Badge>
                      {item.durationMinutes && (
                        <span className="text-brand-grey text-sm">{item.durationMinutes} min</span>
                      )}
                      {item.type === "COURSE" && (
                        <span className="text-brand-grey text-xs">
                          Created by: {creatorLabel(item.createdById)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.type === "COURSE" && canMutateCourse(item) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCourseBuilder(item)}
                    >
                      {t("admin.courseBuildCurriculum")}
                    </Button>
                  )}
                  {canMutateCourse(item) && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      {t("common.edit")}
                    </Button>
                  )}
                  {canMutateCourse(item) && (
                    <Button variant="ghost" size="sm" onClick={() => deleteContent(item.id)} className="text-red-600">
                      {t("common.delete")}
                    </Button>
                  )}
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
