"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { ContentAddForm, type ContentType } from "@/components/admin/content-add-form";
import { CourseBuilder } from "@/components/admin/course-builder";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

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

export default function TenantContentAddPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [formType, setFormType] = useState<ContentType>("COURSE");
  const [formDomainId, setFormDomainId] = useState("");
  const [formTenantIds, setFormTenantIds] = useState<string[]>([]);
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formAssignToAllCompanies, setFormAssignToAllCompanies] = useState(true);
  const [formAvailablePlans, setFormAvailablePlans] = useState<string[]>(["EXPLORER", "SPECIALIST", "VISIONARY", "NEXUS"]);
  const [formAvailableInEnterprise, setFormAvailableInEnterprise] = useState(false);

  const [view, setView] = useState<"form" | "courseBuilder">("form");
  const [courseBuilderCourse, setCourseBuilderCourse] = useState<{ id: string; title: string } | null>(null);

  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [domains, setDomains] = useState<{ id: string; name: string; slug: string; tenant?: { id: string; name: string } }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    apiFetch("/company/tenants").then((r) => r.json()).then((d) => setTenants(Array.isArray(d) ? d.filter((t: { settings?: { accountType?: string } | null }) => t.settings?.accountType === "branded_academy") : [])).catch(() => setTenants([]));
    apiFetch("/domains").then((r) => r.json()).then((d) => setDomains(Array.isArray(d) ? d : [])).catch(() => setDomains([]));
    apiFetch("/company/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([]));
  }, []);

  const domainOptionsForForm = domains.map((d) => ({
    id: d.id,
    name: d.tenant ? `${d.name} (${d.tenant.name})` : d.name,
  }));

  const handleSuccess = () => {
    router.push(`/${slug}/admin/content`);
  };

  const handleCancel = () => {
    router.push(`/${slug}/admin/content`);
  };

  const handleCourseCreated = (courseId: string, courseTitle: string) => {
    setCourseBuilderCourse({ id: courseId, title: courseTitle });
    setView("courseBuilder");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (view === "courseBuilder" && courseBuilderCourse) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <TenantAdminBurgerHeader
          slug={slug}
          academyName={academyName}
          logoUrl={tenant?.logoUrl}
          contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ Content / Add</span>}
        />
        <main className="max-w-4xl mx-auto p-6">
          <CourseBuilder
            courseId={courseBuilderCourse.id}
            courseTitle={courseBuilderCourse.title}
            onBack={() => {
              setView("form");
              setCourseBuilderCourse(null);
              router.push(`/${slug}/admin/content`);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        contextSlot={<span className="text-sm text-[var(--color-text-secondary)]">/ Content / Add</span>}
      />

      <main className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("admin.addContent")}
          </h1>
          <Link href={`/${slug}/admin/content`}>
            <Button variant="ghost">{t("common.back")}</Button>
          </Link>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("admin.contentType")}
          </label>
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as ContentType)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-bg-secondary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.type} value={ct.type}>
                {ct.icon} {ct.label}
              </option>
            ))}
          </select>
        </div>

        <ContentAddForm
          contentType={formType}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
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
          onCourseCreated={handleCourseCreated}
          publicOnly={false}
          availablePlans={formAvailablePlans}
          onAvailablePlansChange={setFormAvailablePlans}
          availableInEnterprise={formAvailableInEnterprise}
          onAvailableInEnterpriseChange={setFormAvailableInEnterprise}
        />
      </main>
    </div>
  );
}
