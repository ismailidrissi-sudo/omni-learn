"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { useI18n } from "@/lib/i18n/context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { tenantLearnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";
import { learnerContentHref } from "@/lib/learner-content-href";
import { SmartVideo } from "@/components/media/smart-video";
import { CourseReviews } from "@/components/learning/course-reviews";

type ContentDetail = {
  id: string;
  title: string;
  description?: string;
  type: string;
  durationMinutes?: number;
  metadata?: Record<string, unknown> | string;
  domain?: { name: string } | null;
  createdBy?: { name?: string } | null;
};

type CurriculumSection = {
  id: string;
  title: string;
  learningGoal?: string | null;
  items: { id: string; itemType: string; title: string }[];
};

export default function TenantContentPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const contentId = typeof params.id === "string" ? params.id : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const { user } = useUser();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<"none" | "enrolled" | "completed">("none");

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!contentId) return;
    setLoading(true);
    apiFetch(`/content/${contentId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((c) => {
        if (c?.type === "MICRO_LEARNING" && slug) {
          router.replace(learnerContentHref("MICRO_LEARNING", contentId, { tenantSlug: slug }));
          return;
        }
        setContent(c);
        if (c?.type === "COURSE") {
          apiFetch(`/curriculum/courses/${contentId}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data) => setCurriculum(Array.isArray(data) ? data : []))
            .catch(() => setCurriculum([]));
        }
      })
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [contentId]);

  useEffect(() => {
    if (!user?.id || !contentId || content?.type !== "COURSE") return;
    apiFetch(`/course-enrollments/for-course?userId=${user.id}&courseId=${contentId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setEnrollmentStatus(data.status === "COMPLETED" ? "completed" : "enrolled");
      })
      .catch(() => {});
  }, [user?.id, contentId, content?.type]);

  const rawMeta = content?.metadata;
  const meta: Record<string, unknown> = (() => {
    if (!rawMeta) return {};
    try {
      return typeof rawMeta === "string" ? JSON.parse(rawMeta || "{}") : (rawMeta as Record<string, unknown>);
    } catch { return {}; }
  })();
  const landing = (meta.landingPage ?? {}) as Record<string, string>;
  const pricing = (meta.pricing ?? {}) as Record<string, unknown>;
  const isFree = pricing.isFree !== false;
  const price = pricing.price as string | undefined;
  const currency = (pricing.currency as string) ?? "USD";
  const totalItems = curriculum.reduce((acc, s) => acc + s.items.length, 0);
  const tenantNav = useMemo(() => tenantLearnerNavItems(t, slug, user), [t, slug, user]);
  const isCourse = content?.type === "COURSE";

  const handleEnroll = async () => {
    if (!user) { router.push(`/${slug}/signin`); return; }
    if (enrollmentStatus !== "none") { router.push(`/course/${contentId}?fullscreen=true`); return; }
    if (!isFree && price && parseFloat(price) > 0) { router.push(`/checkout?courseId=${contentId}&price=${price}&currency=${currency}`); return; }
    setEnrolling(true);
    try {
      const res = await apiFetch(`/course-enrollments/${contentId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        setEnrollmentStatus("enrolled");
        router.push(`/course/${contentId}?fullscreen=true`);
      }
    } catch {} finally { setEnrolling(false); }
  };

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{t("content.contentNotFound")}</h1>
        <Link href={`/${slug}/discover`} className="text-[var(--color-accent)] hover:underline text-sm">{t("content.backToDiscover")}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppBurgerHeader
        borderClassName="border-b border-[var(--color-bg-secondary)]"
        logoHref={`/${slug}`}
        logo={<TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />}
        title={academyName}
        items={tenantNav}
      />

      <main className="max-w-5xl mx-auto p-6">
        <Link href={`/${slug}/discover`} className="text-sm text-[var(--color-accent)] hover:underline mb-4 inline-block">
          &larr; {t("content.backToDiscover")}
        </Link>

        {isCourse ? (
          <div className="space-y-8">
            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden">
              {landing.thumbnailUrl ? (
                <img src={landing.thumbnailUrl} alt={content.title} className="w-full h-48 sm:h-64 md:h-80 object-cover" />
              ) : (
                <div className="w-full h-48 sm:h-64 md:h-80 bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 flex items-center justify-center">
                  <span className="text-7xl">📚</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {landing.level && <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">{landing.level}</span>}
                  {landing.language && <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">{landing.language}</span>}
                  {content.domain && (
                    <span className="px-2.5 py-1 rounded-full bg-[var(--color-accent)]/60 backdrop-blur-sm text-white text-xs font-medium">
                      {typeof content.domain === "string" ? content.domain : content.domain.name}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">{content.title}</h1>
                {landing.subtitle && <p className="text-white/80 text-sm sm:text-base">{landing.subtitle}</p>}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
              {curriculum.length > 0 && <span>{curriculum.length} {t("content.sections")} &middot; {totalItems} {t("content.lessons")}</span>}
              {content.durationMinutes && <span>{content.durationMinutes} min</span>}
              {isFree ? (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs">{t("content.free")}</span>
              ) : price ? (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs">{price} {currency}</span>
              ) : null}
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-3">
              {enrollmentStatus !== "none" ? (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2 text-sm text-green-600 font-medium">✓ {t("content.alreadyEnrolled")}</span>
                  <Link href={`/course/${contentId}?fullscreen=true`} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:opacity-90 transition">
                    {t("content.continueLearning")}
                  </Link>
                </>
              ) : (
                <button onClick={handleEnroll} disabled={enrolling} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white font-semibold hover:opacity-90 transition disabled:opacity-60">
                  {enrolling ? t("content.enrolling") : !user ? t("content.signInToEnroll") : isFree ? t("content.enrollFree") : `${t("content.enrollNow")} — ${price} ${currency}`}
                </button>
              )}
            </div>

            {/* Promo */}
            {landing.promoVideoUrl && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("content.promoVideo")}</h2>
                <div className="rounded-xl overflow-hidden border border-[var(--color-bg-secondary)]">
                  <SmartVideo src={landing.promoVideoUrl} title={content.title} />
                </div>
              </div>
            )}

            {content.description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("content.aboutCourse")}</h2>
                <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{content.description}</p>
              </div>
            )}

            {/* Curriculum preview */}
            {curriculum.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("content.curriculumOverview")} &middot; {curriculum.length} {t("content.sections")} &middot; {totalItems} {t("content.lessons")}
                </h2>
                <div className="rounded-xl border border-[var(--color-bg-secondary)] overflow-hidden divide-y divide-[var(--color-bg-secondary)]">
                  {curriculum.map((section, sIdx) => (
                    <div key={section.id} className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("admin.curriculumSection")} {sIdx + 1}: {section.title}</p>
                        <span className="text-xs text-[var(--color-text-secondary)]">{section.items.length} {t("content.lessons")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CourseReviews contentId={contentId} />
          </div>
        ) : (
          <div className="card-brand p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium px-3 py-1 rounded-full text-white" style={{ backgroundColor: branding?.primaryColor || "#059669" }}>
                {content.type.replace(/_/g, " ")}
              </span>
              {content.durationMinutes && <span className="text-sm text-[var(--color-text-secondary)]">{content.durationMinutes} min</span>}
              {content.domain && <span className="text-sm text-[var(--color-text-secondary)]">{typeof content.domain === "string" ? content.domain : content.domain.name}</span>}
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">{content.title}</h1>
            {content.description && <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">{content.description}</p>}
            <div className="border-t border-[var(--color-bg-secondary)] pt-6 mt-6">
              <p className="text-sm text-[var(--color-text-secondary)]">{t("content.contentViewerHint")}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
