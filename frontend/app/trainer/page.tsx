"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ContentAddForm, type ContentType } from "@/components/admin/content-add-form";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { trainerNavItemsApproved, trainerNavItemsGuest } from "@/lib/nav/burger-nav";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useUser } from "@/lib/use-user";

type TrainerContentItem = {
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
  availablePlans?: unknown;
  availableInEnterprise?: boolean;
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

function matchesVisibilityFilter(item: TrainerContentItem, filter: VisibilityFilter): boolean {
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

export default function TrainerPage() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const trainerNavApproved = useMemo(() => trainerNavItemsApproved(t), [t]);
  const trainerNavGuest = useMemo(() => trainerNavItemsGuest(t), [t]);
  const [view, setView] = useState<"list" | "create" | "courseBuilder">("list");
  const [content, setContent] = useState<TrainerContentItem[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [filterVisibility, setFilterVisibility] = useState<VisibilityFilter>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TrainerContentItem | null>(null);
  const [formType, setFormType] = useState("COURSE");
  const [formDomainId, setFormDomainId] = useState("");
  const [domains, setDomains] = useState<{ id: string; name: string; slug: string; tenant?: { id: string; name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestingTrainer, setRequestingTrainer] = useState(false);

  const isApprovedTrainer = !!user?.isAdmin || !!user?.trainerApprovedAt;
  const trainerPending = !user?.isAdmin && !!user?.trainerRequested && !user?.trainerApprovedAt;

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
    if (isApprovedTrainer) loadContent();
    else setLoading(false);
  }, [filterType, isApprovedTrainer]);

  useEffect(() => {
    if (isApprovedTrainer) {
      apiFetch("/domains").then((r) => r.json()).then((d) => setDomains(Array.isArray(d) ? d : [])).catch(() => setDomains([]));
    }
  }, [isApprovedTrainer]);

  const filteredContent = content.filter(
    (c) =>
      (!search || c.title.toLowerCase().includes(search.toLowerCase())) &&
      (!filterType || c.type === filterType) &&
      matchesVisibilityFilter(c, filterVisibility)
  );

  const domainOptionsForForm = domains.map((d) => ({
    id: d.id,
    name: d.tenant ? `${d.name} (${d.tenant.name})` : d.name,
  }));

  const openCreate = () => {
    setFormType("COURSE");
    setFormDomainId("");
    setEditing(null);
    setView("create");
  };

  const openCourseBuilder = (course: { id: string; title: string }) => {
    setView("courseBuilder");
    setEditing({ ...course, type: "COURSE", title: course.title } as TrainerContentItem);
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

  const handleRequestTrainer = () => {
    setRequestingTrainer(true);
    apiFetch("/profile/request-trainer", { method: "POST" })
      .then((r) => r.json())
      .then(() => window.location.reload())
      .catch(() => setError("Failed to submit request"))
      .finally(() => setRequestingTrainer(false));
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">Loading...</p>
      </div>
    );
  }

  if (!isApprovedTrainer) {
    return (
      <div className="min-h-screen bg-white">
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={trainerNavGuest} />
        <main className="max-w-xl mx-auto p-8">
          <Card className="p-8 text-center">
            {trainerPending ? (
              <>
                <h1 className="text-xl font-semibold text-brand-grey-dark mb-2">Trainer request pending</h1>
                <p className="text-brand-grey text-sm">
                  You requested access to create content. An admin will review your request and you will get access once approved.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-brand-grey-dark mb-2">Create content as a trainer</h1>
                <p className="text-brand-grey text-sm mb-6">
                  Request trainer access to create courses and other content. An admin will approve your request.
                </p>
                {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
                <Button onClick={handleRequestTrainer} disabled={requestingTrainer}>
                  {requestingTrainer ? "Submitting..." : "Request trainer access"}
                </Button>
              </>
            )}
          </Card>
        </main>
      </div>
    );
  }

  if (view === "courseBuilder" && editing) {
    return (
      <div className="min-h-screen bg-white">
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={trainerNavApproved} />
        <main className="max-w-4xl mx-auto p-6">
          <CourseBuilder
            courseId={editing.id}
            courseTitle={editing.title}
            onBack={() => {
              setView("list");
              setEditing(null);
            }}
          />
        </main>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="min-h-screen bg-white">
        <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={trainerNavApproved} />

        <main className="max-w-2xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-brand-title text-brand-grey-dark font-bold">
              {t("trainer.addContent")}
            </h1>
            <Button variant="ghost" onClick={() => { setView("list"); setEditing(null); }}>
              {t("common.back")}
            </Button>
          </div>

          <p className="text-sm text-brand-grey mb-4">{t("trainer.publicContent")}</p>

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
            onSuccess={() => { loadContent(); setView("list"); setEditing(null); }}
            onCancel={() => { setView("list"); setEditing(null); }}
            domainId={formDomainId}
            onDomainChange={setFormDomainId}
            domainOptions={domainOptionsForForm}
            tenantIds={[]}
            userIds={[]}
            assignToAllCompanies={true}
            onTenantChange={() => {}}
            onUserChange={() => {}}
            onAssignToAllChange={() => {}}
            tenants={[]}
            users={[]}
            publicOnly={true}
            onCourseCreated={(cid, cTitle) => {
              loadContent();
              setEditing({ id: cid, title: cTitle, type: "COURSE" } as TrainerContentItem);
              setView("courseBuilder");
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={trainerNavApproved} />

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-brand-title text-brand-grey-dark font-bold">
            {t("trainer.title")}
          </h1>
          <p className="text-brand-grey text-sm mt-1">{t("trainer.subtitle")}</p>
          <p className="text-brand-grey text-xs mt-2">{t("trainer.academyHint")}</p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {loading ? (
          <div className="min-h-[200px] flex items-center justify-center"><p className="text-brand-grey">Loading...</p></div>
        ) : (<>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-brand-grey-dark">
            {t("trainer.myContent")}
          </h2>
          <Button variant="primary" onClick={openCreate}>
            {t("trainer.addContent")}
          </Button>
        </div>

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
            title="Filter by access / visibility"
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
              <p className="mb-4">{t("trainer.noContentYet")}</p>
              <p className="text-sm mb-4">{t("trainer.contentHint")}</p>
              <Button onClick={openCreate}>{t("trainer.addContent")}</Button>
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
                      <Badge variant="default">Public</Badge>
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
                  <Link href={`/admin/content?edit=${item.id}`}>
                    <Button variant="outline" size="sm">{t("common.edit")}</Button>
                  </Link>
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
