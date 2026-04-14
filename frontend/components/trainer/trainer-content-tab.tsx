"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ContentAddForm, type ContentType } from "@/components/admin/content-add-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useUser } from "@/lib/use-user";

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
};

/** My content list + create flows (used under /trainer/content). */
export function TrainerContentTab() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [view, setView] = useState<"list" | "create" | "courseBuilder">("list");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [formType, setFormType] = useState("COURSE");
  const [formDomainId, setFormDomainId] = useState("");
  const [domains, setDomains] = useState<
    { id: string; name: string; slug: string; tenant?: { id: string; name: string } }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isApprovedTrainer = !!user?.isAdmin || !!user?.trainerApprovedAt;

  const loadContent = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ admin: "true" });
    if (filterType) params.set("type", filterType);
    apiFetch(`/content?${params}`)
      .then((r) => r.json())
      .then((data) => setContent(Array.isArray(data) ? data : []))
      .catch(() => setError(t("trainer.contentLoadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isApprovedTrainer) loadContent();
    else setLoading(false);
  }, [filterType, isApprovedTrainer]);

  useEffect(() => {
    if (isApprovedTrainer) {
      apiFetch("/domains")
        .then((r) => r.json())
        .then((d) => setDomains(Array.isArray(d) ? d : []))
        .catch(() => setDomains([]));
    }
  }, [isApprovedTrainer]);

  const filteredContent = content.filter(
    (c) =>
      (!search || c.title.toLowerCase().includes(search.toLowerCase())) &&
      (!filterType || c.type === filterType)
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
    setEditing({ ...course, type: "COURSE", title: course.title } as ContentItem);
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

  if (userLoading || !user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-[#6B7280]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!isApprovedTrainer) {
    return (
      <Card className="p-8 text-center border border-black/[0.08] rounded-xl shadow-none mt-6">
        <p className="text-[#6B7280]">{t("trainer.contentTrainerOnly")}</p>
        <Link href="/trainer" className="mt-4 inline-block text-[#1D9E75] font-medium">
          {t("trainer.backToProfile")}
        </Link>
      </Card>
    );
  }

  if (view === "courseBuilder" && editing) {
    return (
      <main className="max-w-4xl mx-auto py-6">
        <CourseBuilder
          courseId={editing.id}
          courseTitle={editing.title}
          onBack={() => {
            setView("list");
            setEditing(null);
          }}
        />
      </main>
    );
  }

  if (view === "create") {
    return (
      <main className="max-w-2xl mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-[#1A1A1A]">{t("trainer.addContent")}</h1>
          <Button variant="ghost" onClick={() => { setView("list"); setEditing(null); }}>
            {t("common.back")}
          </Button>
        </div>

        <p className="text-sm text-[#6B7280] mb-4">{t("trainer.publicContent")}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1">{t("admin.contentType")}</label>
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-black/[0.08] bg-white"
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.type} value={ct.type}>
                {ct.icon} {ct.label}
              </option>
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
            setEditing({ id: cid, title: cTitle, type: "COURSE" } as ContentItem);
            setView("courseBuilder");
          }}
        />
      </main>
    );
  }

  return (
    <main className="py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1A1A1A]">{t("trainer.title")}</h1>
        <p className="text-[#6B7280] text-sm mt-1">{t("trainer.subtitle")}</p>
        <p className="text-[#9CA3AF] text-xs mt-2">{t("trainer.academyHint")}</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <p className="text-[#6B7280]">{t("common.loading")}</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">{t("trainer.myContent")}</h2>
            <Button className="bg-[#1D9E75] hover:bg-[#178f68] text-white" onClick={openCreate}>
              {t("trainer.addContent")}
            </Button>
          </div>

          <div className="flex gap-4 mb-6 flex-wrap">
            <Input
              placeholder={t("admin.searchContent")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] border-black/[0.08]"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-black/[0.08] bg-white"
            >
              <option value="">{t("admin.allTypes")}</option>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.type} value={ct.type}>
                  {ct.icon} {ct.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {filteredContent.length === 0 && (
              <Card className="p-8 text-center text-[#6B7280] border border-black/[0.08] rounded-xl shadow-none">
                <p className="mb-4">{t("trainer.noContentYet")}</p>
                <p className="text-sm mb-4">{t("trainer.contentHint")}</p>
                <Button className="bg-[#1D9E75] hover:bg-[#178f68] text-white" onClick={openCreate}>
                  {t("trainer.addContent")}
                </Button>
              </Card>
            )}
            {filteredContent.map((item) => {
              const ct = CONTENT_TYPES.find((c) => c.type === item.type);
              return (
                <Card
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border border-black/[0.08] rounded-xl shadow-none"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-2xl shrink-0">{ct?.icon ?? "📄"}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#1A1A1A] truncate">{item.title}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="pulsar">{item.type.replace("_", " ")}</Badge>
                        <Badge variant="default">{t("trainer.statusPublic")}</Badge>
                        {item.durationMinutes && (
                          <span className="text-[#6B7280] text-sm">{item.durationMinutes} min</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {item.type === "COURSE" && (
                      <Button variant="outline" size="sm" onClick={() => openCourseBuilder(item)}>
                        {t("admin.courseBuildCurriculum")}
                      </Button>
                    )}
                    <Link href={`/admin/content?edit=${item.id}`}>
                      <Button variant="outline" size="sm">
                        {t("common.edit")}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteContent(item.id)}
                      className="text-red-600"
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
