"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
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
  mediaId?: string;
  durationMinutes?: number;
  metadata?: string | Record<string, unknown>;
  adsEnabled?: boolean;
};

type CurriculumSection = {
  id: string;
  title: string;
  items: { id: string; itemType: string; title: string; contentUrl?: string | null; metadata?: Record<string, unknown> | null }[];
};

export default function ContentPage() {
  const params = useParams();
  const { t } = useI18n();
  const { user } = useUser();
  const id = params?.id as string;
  const [content, setContent] = useState<ContentItem | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/content/${id}?admin=true`)
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

  let meta: Record<string, unknown> = {};
  try {
    meta = content?.metadata
      ? (typeof content.metadata === "string" ? JSON.parse(content.metadata || "{}") : (content.metadata as Record<string, unknown>))
      : {};
  } catch {
    meta = {};
  }

  const renderMedia = () => {
    if (!content) return null;
    switch (content.type) {
      case "COURSE": {
        const scorm = meta as { scormPackageUrl?: string; xapiEndpoint?: string };
        const totalItems = curriculum.reduce((acc, s) => acc + s.items.length, 0);
        const firstVideoItem = curriculum
          .flatMap((s) => s.items)
          .find((i) => i.itemType === "VIDEO" && i.contentUrl);

        return (
          <div className="space-y-6">
            {firstVideoItem?.contentUrl && (
              <SmartVideo
                src={firstVideoItem.contentUrl}
                title={firstVideoItem.title}
                contentId={firstVideoItem.id}
                userId={user?.id}
              />
            )}

            <Link
              href={`/course/${content.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition-colors"
            >
              {t("content.startCourse")}
            </Link>

            {curriculum.length > 0 && (
              <div className="rounded-lg border border-brand-grey-light overflow-hidden">
                <div className="px-4 py-3 bg-brand-grey-light/30 border-b border-brand-grey-light">
                  <h3 className="font-semibold text-brand-grey-dark text-sm">
                    {t("content.courseContents")} &middot; {curriculum.length} sections &middot; {totalItems} lessons
                  </h3>
                </div>
                <div className="divide-y divide-brand-grey-light">
                  {curriculum.map((section, sIdx) => (
                    <div key={section.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-brand-grey-dark">
                        Section {sIdx + 1}: {section.title}
                      </p>
                      <p className="text-xs text-brand-grey mt-0.5">
                        {section.items.length} lessons
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scorm?.scormPackageUrl && (
              <ScormViewer
                scormPackageUrl={scorm.scormPackageUrl}
                xapiEndpoint={scorm.xapiEndpoint}
                onComplete={() => {}}
              />
            )}
          </div>
        );
      }
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
          return (
            <SmartVideo
              src={videoUrl}
              hlsUrl={videoUrl}
              poster={pod?.thumbnailUrl}
              title={content.title}
              contentId={content.id}
              userId={user?.id}
            />
          );
        }
        if (audioUrl) {
          return (
            <PodcastPlayer
              audioUrl={audioUrl}
              title={content.title}
              transcriptUrl={pod?.transcriptUrl}
              thumbnailUrl={pod?.thumbnailUrl}
            />
          );
        }
        break;
      }
      case "DOCUMENT": {
        const doc = meta as { fileUrl?: string; documentUrl?: string; fileType?: string };
        const fileUrl = content.mediaId || doc?.fileUrl || doc?.documentUrl || "";
        if (fileUrl) {
          return (
            <DocumentViewer
              fileUrl={fileUrl}
              fileType={doc?.fileType}
              title={content.title}
            />
          );
        }
        break;
      }
      case "IMPLEMENTATION_GUIDE": {
        const guide = meta as { items?: Array<{ format: string; url: string; description?: string }> };
        const items = guide?.items?.filter((i) => i.url?.trim()) || [];
        if (items.length === 0) break;
        return (
          <div className="space-y-6">
            {items.map((item, idx) => {
              const isVideo = ["video", "mp4", "m3u8", "webm"].some((f) =>
                item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`)
              );
              const isAudio = ["audio", "mp3", "wav", "ogg", "m4a"].some((f) =>
                item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`)
              );
              const isDoc = ["document", "pdf", "doc", "docx"].some((f) =>
                item.format?.toLowerCase().includes(f) || item.url?.toLowerCase().includes(`.${f}`)
              );
              return (
                <div key={idx} className="space-y-2">
                  {item.description && (
                    <p className="text-brand-grey-dark text-sm">{item.description}</p>
                  )}
                  {item.format === "video" || isVideo ? (
                    <SmartVideo src={item.url} hlsUrl={item.url} title={item.description} />
                  ) : item.format === "audio" || isAudio ? (
                    <AudioPlayer audioUrl={item.url} title={item.description} />
                  ) : item.format === "document" || isDoc ? (
                    <DocumentViewer fileUrl={item.url} title={item.description} />
                  ) : (
                    <div className="rounded-lg border border-brand-grey-light overflow-hidden min-h-[400px]">
                      <iframe
                        src={item.url}
                        title={item.description || `Resource ${idx + 1}`}
                        className="w-full h-[500px] border-0"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                      />
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
              <iframe
                src={gameUrl}
                title={content.title}
                className="w-full aspect-video min-h-[500px] border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
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
              <iframe
                src={quizUrl}
                title={content.title}
                className="w-full min-h-[500px] border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          );
        }
        break;
      }
    }
    return (
      <div className="rounded-lg border border-brand-grey-light p-8 text-center text-brand-grey">
        {t("content.noMedia", { type: content.type })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={globalLearnerNavItems(t, user)}
        headerClassName="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2"
      />

      <main className="max-w-3xl mx-auto px-4 py-4 sm:p-6">
        <Link href="/learn" className="text-brand-purple text-sm mb-4 inline-block">{t("content.backToLearn")}</Link>
        {loading ? (
          <p className="text-brand-grey">{t("common.loading")}</p>
        ) : content ? (
          <>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-grey-dark mb-2">{content.title}</h1>
            <p className="text-brand-grey text-sm mb-4 sm:mb-6">{content.type} {content.durationMinutes && `· ${content.durationMinutes} min`}</p>
            <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">{renderMedia()}</div>
            <CourseReviews contentId={id} />
          </>
        ) : (
          <p className="text-brand-grey">{t("content.contentNotFound")}</p>
        )}
      </main>
    </div>
  );
}
