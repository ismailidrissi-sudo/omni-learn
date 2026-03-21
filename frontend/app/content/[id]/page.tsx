"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { CourseReviews } from "@/components/learning/course-reviews";
import { ScormViewer } from "@/components/media/scorm-viewer";
import { SmartVideo } from "@/components/media/smart-video";
import { PodcastPlayer } from "@/components/media/podcast-player";
import { AudioPlayer } from "@/components/media/audio-player";
import { DocumentViewer } from "@/components/media/document-viewer";
import { track } from "@/lib/analytics";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { globalLearnerNavItems } from "@/lib/nav/burger-nav";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

type ContentItem = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  mediaId?: string;
  durationMinutes?: number;
  metadata?: string | Record<string, unknown>;
  adsEnabled?: boolean;
  domain?: { name: string } | null;
  createdBy?: { name?: string; email?: string } | null;
};

type CurriculumSection = {
  id: string;
  title: string;
  learningGoal?: string | null;
  items: { id: string; itemType: string; title: string; contentUrl?: string | null; metadata?: Record<string, unknown> | null }[];
};

function parseMeta(raw: ContentItem["metadata"]): Record<string, unknown> {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw || "{}") : (raw as Record<string, unknown>);
  } catch {
    return {};
  }
}

export default function ContentPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useUser();
  const id = params?.id as string;
  const [content, setContent] = useState<ContentItem | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<"none" | "enrolled" | "completed">("none");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/content/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((c) => {
        if (!c?.type) throw new Error("Invalid content");
        setContent(c);
        track("CONTENT_VIEW", { contentId: id });
        if (c.type === "COURSE") {
          apiFetch(`/curriculum/courses/${id}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data) => setCurriculum(Array.isArray(data) ? data : []))
            .catch(() => setCurriculum([]));
        }
      })
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user?.id || !id || content?.type !== "COURSE") return;
    apiFetch(`/course-enrollments/for-course?userId=${user.id}&courseId=${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setEnrollmentStatus(data.status === "COMPLETED" ? "completed" : "enrolled");
        }
      })
      .catch(() => {});
  }, [user?.id, id, content?.type]);

  const meta = useMemo(() => parseMeta(content?.metadata), [content?.metadata]);
  const landing = (meta.landingPage ?? {}) as Record<string, string>;
  const pricing = (meta.pricing ?? {}) as Record<string, unknown>;
  const targets = (meta.targets ?? {}) as Record<string, string>;
  const isFree = pricing.isFree !== false;
  const price = pricing.price as string | undefined;
  const currency = (pricing.currency as string) ?? "USD";

  const totalItems = curriculum.reduce((acc, s) => acc + s.items.length, 0);

  const handleEnroll = async () => {
    if (!user) {
      router.push("/signin");
      return;
    }
    if (enrollmentStatus !== "none") {
      router.push(`/course/${id}?fullscreen=true`);
      return;
    }

    if (!isFree && price && parseFloat(price) > 0) {
      router.push(`/checkout?courseId=${id}&price=${price}&currency=${currency}`);
      return;
    }

    setEnrolling(true);
    try {
      const res = await apiFetch(`/course-enrollments/${id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        setEnrollmentStatus("enrolled");
        router.push(`/course/${id}?fullscreen=true`);
      }
    } catch {
    } finally {
      setEnrolling(false);
    }
  };

  const isCourse = content?.type === "COURSE";

  const renderNonCourseMedia = () => {
    if (!content) return null;
    switch (content.type) {
      case "VIDEO":
      case "MICRO_LEARNING": {
        const vid = meta as { hlsUrl?: string; videoUrl?: string; thumbnailUrl?: string };
        const src = content.mediaId || vid?.hlsUrl || vid?.videoUrl || "";
        if (src) {
          return (
            <SmartVideo
              src={src}
              hlsUrl={vid?.hlsUrl || vid?.videoUrl}
              poster={vid?.thumbnailUrl}
              title={content.title}
              contentId={content.id}
              userId={user?.id}
              adsEnabled={content.adsEnabled ?? false}
            />
          );
        }
        break;
      }
      case "PODCAST": {
        const pod = meta as { audioUrl?: string; videoUrl?: string; transcriptUrl?: string; thumbnailUrl?: string };
        const audioUrl = content.mediaId || pod?.audioUrl || "";
        const videoUrl = pod?.videoUrl || "";
        if (videoUrl) {
          return <SmartVideo src={videoUrl} hlsUrl={videoUrl} poster={pod?.thumbnailUrl} title={content.title} contentId={content.id} userId={user?.id} />;
        }
        if (audioUrl) {
          return <PodcastPlayer audioUrl={audioUrl} title={content.title} transcriptUrl={pod?.transcriptUrl} thumbnailUrl={pod?.thumbnailUrl} />;
        }
        break;
      }
      case "DOCUMENT": {
        const doc = meta as { fileUrl?: string; documentUrl?: string; fileType?: string };
        const fileUrl = content.mediaId || doc?.fileUrl || doc?.documentUrl || "";
        if (fileUrl) return <DocumentViewer fileUrl={fileUrl} fileType={doc?.fileType} title={content.title} />;
        break;
      }
      case "IMPLEMENTATION_GUIDE": {
        const guide = meta as { items?: Array<{ format: string; url: string; description?: string }> };
        const items = guide?.items?.filter((i) => i.url?.trim()) || [];
        if (items.length === 0) break;
        return (
          <div className="space-y-6">
            {items.map((item, idx) => {
              const isVideo = ["video", "mp4", "m3u8", "webm"].some((f) => item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`));
              const isAudio = ["audio", "mp3", "wav", "ogg", "m4a"].some((f) => item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`));
              const isDoc = ["document", "pdf", "doc", "docx"].some((f) => item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`));
              return (
                <div key={idx} className="space-y-2">
                  {item.description && <p className="text-brand-grey-dark text-sm">{item.description}</p>}
                  {item.format === "video" || isVideo ? (
                    <SmartVideo src={item.url} hlsUrl={item.url} title={item.description} />
                  ) : item.format === "audio" || isAudio ? (
                    <AudioPlayer audioUrl={item.url} title={item.description} />
                  ) : item.format === "document" || isDoc ? (
                    <DocumentViewer fileUrl={item.url} title={item.description} />
                  ) : (
                    <div className="rounded-lg border border-brand-grey-light overflow-hidden min-h-[400px]">
                      <iframe src={item.url} title={item.description || `Resource ${idx + 1}`} className="w-full h-[500px] border-0" sandbox="allow-scripts allow-same-origin allow-forms" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      case "GAME": {
        const game = meta as { gameUrl?: string };
        const gameUrl = content.mediaId || game?.gameUrl || "";
        if (gameUrl) {
          return (
            <div className="rounded-lg border border-brand-grey-light overflow-hidden min-h-[500px]">
              <iframe src={gameUrl} title={content.title} className="w-full aspect-video min-h-[500px] border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </div>
          );
        }
        break;
      }
      case "QUIZ_ASSESSMENT": {
        const quiz = meta as { quizUrl?: string };
        const quizUrl = content.mediaId || quiz?.quizUrl || "";
        if (quizUrl) {
          return (
            <div className="rounded-lg border border-brand-grey-light overflow-hidden min-h-[400px]">
              <iframe src={quizUrl} title={content.title} className="w-full min-h-[500px] border-0" sandbox="allow-scripts allow-same-origin allow-forms" />
            </div>
          );
        }
        break;
      }
    }
    const scorm = meta as { scormPackageUrl?: string; xapiEndpoint?: string };
    if (scorm?.scormPackageUrl) {
      return <ScormViewer scormPackageUrl={scorm.scormPackageUrl} xapiEndpoint={scorm.xapiEndpoint} onComplete={() => {}} />;
    }
    return (
      <div className="rounded-lg border border-brand-grey-light p-8 text-center text-brand-grey">
        {t("content.noMedia", { type: content?.type ?? "" })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={globalLearnerNavItems(t, user)}
        headerClassName="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2"
      />

      <main className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
        <Link href="/discover" className="text-brand-purple text-sm mb-4 inline-block">{t("content.backToDiscover")}</Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
          </div>
        ) : content ? (
          isCourse ? (
            /* ========== COURSE LANDING PAGE ========== */
            <div className="space-y-8">
              {/* Hero */}
              <div className="relative rounded-2xl overflow-hidden">
                {landing.thumbnailUrl ? (
                  <img src={landing.thumbnailUrl} alt={content.title} className="w-full h-48 sm:h-64 md:h-80 object-cover" />
                ) : (
                  <div className="w-full h-48 sm:h-64 md:h-80 bg-gradient-to-br from-brand-purple/20 via-brand-green/10 to-brand-purple/5 flex items-center justify-center">
                    <span className="text-7xl">📚</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {landing.level && (
                      <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">{landing.level}</span>
                    )}
                    {landing.language && (
                      <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">{landing.language}</span>
                    )}
                    {landing.category && (
                      <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">{landing.category}</span>
                    )}
                    {content.domain && (
                      <span className="px-2.5 py-1 rounded-full bg-brand-purple/60 backdrop-blur-sm text-white text-xs font-medium">
                        {typeof content.domain === "string" ? content.domain : content.domain.name}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">{content.title}</h1>
                  {landing.subtitle && <p className="text-white/80 text-sm sm:text-base">{landing.subtitle}</p>}
                </div>
              </div>

              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-brand-grey-dark dark:text-gray-300">
                {curriculum.length > 0 && (
                  <span>{curriculum.length} {t("content.sections")} &middot; {totalItems} {t("content.lessons")}</span>
                )}
                {content.durationMinutes && <span>{content.durationMinutes} min</span>}
                {isFree ? (
                  <span className="px-3 py-1 rounded-full bg-brand-green/10 text-brand-green font-semibold text-xs">{t("content.free")}</span>
                ) : price ? (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-semibold text-xs">{price} {currency}</span>
                ) : null}
                {content.createdBy?.name && (
                  <span className="text-brand-grey">{content.createdBy.name}</span>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3">
                {enrollmentStatus !== "none" ? (
                  <>
                    <span className="inline-flex items-center gap-2 px-4 py-2 text-sm text-brand-green font-medium">
                      ✓ {t("content.alreadyEnrolled")}
                    </span>
                    <Link
                      href={`/course/${id}?fullscreen=true`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition-colors"
                    >
                      {t("content.continueLearning")}
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition-colors disabled:opacity-60"
                  >
                    {enrolling
                      ? t("content.enrolling")
                      : !user
                        ? t("content.signInToEnroll")
                        : isFree
                          ? t("content.enrollFree")
                          : `${t("content.enrollNow")} — ${price} ${currency}`}
                  </button>
                )}
              </div>

              {/* Promo Video */}
              {landing.promoVideoUrl && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-brand-grey-dark dark:text-white">{t("content.promoVideo")}</h2>
                  <div className="rounded-xl overflow-hidden border border-brand-grey-light dark:border-gray-700">
                    <SmartVideo src={landing.promoVideoUrl} title={content.title} />
                  </div>
                </div>
              )}

              {/* Description */}
              {content.description && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-brand-grey-dark dark:text-white">{t("content.aboutCourse")}</h2>
                  <div className="prose prose-sm max-w-none text-brand-grey-dark dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {content.description}
                  </div>
                </div>
              )}

              {/* What you'll learn */}
              {targets.whatYouLearn && (
                <div className="rounded-xl border border-brand-grey-light dark:border-gray-700 p-6 space-y-2">
                  <h3 className="font-semibold text-brand-grey-dark dark:text-white">{t("admin.targetsWhatYouLearn")}</h3>
                  <p className="text-sm text-brand-grey dark:text-gray-400 whitespace-pre-wrap">{targets.whatYouLearn}</p>
                </div>
              )}

              {/* Curriculum preview (locked) */}
              {curriculum.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-brand-grey-dark dark:text-white">
                    {t("content.curriculumOverview")} &middot; {curriculum.length} {t("content.sections")} &middot; {totalItems} {t("content.lessons")}
                  </h2>
                  <div className="rounded-xl border border-brand-grey-light dark:border-gray-700 overflow-hidden divide-y divide-brand-grey-light dark:divide-gray-700">
                    {curriculum.map((section, sIdx) => (
                      <div key={section.id} className="px-5 py-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-brand-grey-dark dark:text-white">
                            {t("admin.curriculumSection")} {sIdx + 1}: {section.title}
                          </p>
                          <span className="text-xs text-brand-grey dark:text-gray-400">{section.items.length} {t("content.lessons")}</span>
                        </div>
                        {section.learningGoal && (
                          <p className="text-xs text-brand-grey dark:text-gray-500 mt-1">{section.learningGoal}</p>
                        )}
                        {enrollmentStatus !== "none" ? (
                          <div className="mt-2 space-y-1">
                            {section.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-xs text-brand-grey-dark dark:text-gray-300 pl-2">
                                <span>{item.itemType === "VIDEO" ? "🎬" : item.itemType === "QUIZ" ? "✅" : item.itemType === "DOCUMENT" ? "📄" : item.itemType === "AUDIO" ? "🎧" : "📝"}</span>
                                <span>{item.title}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-grey dark:text-gray-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            {t("content.enrollFree")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites */}
              {targets.prerequisites && (
                <div className="rounded-xl border border-brand-grey-light dark:border-gray-700 p-6 space-y-2">
                  <h3 className="font-semibold text-brand-grey-dark dark:text-white">{t("admin.targetsPrerequisites")}</h3>
                  <p className="text-sm text-brand-grey dark:text-gray-400 whitespace-pre-wrap">{targets.prerequisites}</p>
                </div>
              )}

              {/* Who is this for */}
              {targets.whoIs && (
                <div className="rounded-xl border border-brand-grey-light dark:border-gray-700 p-6 space-y-2">
                  <h3 className="font-semibold text-brand-grey-dark dark:text-white">{t("admin.targetsWhoIs")}</h3>
                  <p className="text-sm text-brand-grey dark:text-gray-400 whitespace-pre-wrap">{targets.whoIs}</p>
                </div>
              )}

              {/* Bottom CTA */}
              {enrollmentStatus === "none" && (
                <div className="rounded-xl bg-brand-purple/5 dark:bg-brand-purple/10 border border-brand-purple/20 p-6 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-brand-grey-dark dark:text-white">{content.title}</h3>
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition-colors disabled:opacity-60"
                  >
                    {enrolling
                      ? t("content.enrolling")
                      : !user
                        ? t("content.signInToEnroll")
                        : isFree
                          ? t("content.enrollFree")
                          : `${t("content.enrollNow")} — ${price} ${currency}`}
                  </button>
                </div>
              )}

              <CourseReviews contentId={id} />
            </div>
          ) : (
            /* ========== NON-COURSE CONTENT ========== */
            <>
              <h1 className="text-xl sm:text-2xl font-bold text-brand-grey-dark dark:text-white mb-2">{content.title}</h1>
              <p className="text-brand-grey text-sm mb-4 sm:mb-6">{content.type} {content.durationMinutes && `· ${content.durationMinutes} min`}</p>
              {content.description && <p className="text-brand-grey-dark dark:text-gray-300 text-sm mb-6 whitespace-pre-wrap">{content.description}</p>}
              <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">{renderNonCourseMedia()}</div>
              <CourseReviews contentId={id} />
            </>
          )
        ) : (
          <p className="text-brand-grey py-20 text-center">{t("content.contentNotFound")}</p>
        )}
      </main>
    </div>
  );
}
