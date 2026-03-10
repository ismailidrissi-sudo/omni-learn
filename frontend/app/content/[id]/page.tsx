"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { CourseReviews } from "@/components/learning/course-reviews";
import { ScormViewer } from "@/components/media/scorm-viewer";
import { VideoPlayer } from "@/components/media/video-player";
import { AdInjectedPlayer } from "@/components/media/ad-injected-player";
import { PodcastPlayer } from "@/components/media/podcast-player";
import { AudioPlayer } from "@/components/media/audio-player";
import { DocumentViewer } from "@/components/media/document-viewer";
import { track } from "@/lib/analytics";
import { NavToggles } from "@/components/ui/nav-toggles";

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

export default function ContentPage() {
  const params = useParams();
  const { t } = useI18n();
  const id = params?.id as string;
  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/content/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setContent(c);
        if (c) track("CONTENT_VIEW", { contentId: id });
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
        if (scorm?.scormPackageUrl) {
          return (
            <ScormViewer
              scormPackageUrl={scorm.scormPackageUrl}
              xapiEndpoint={scorm.xapiEndpoint}
              onComplete={() => {}}
            />
          );
        }
        break;
      }
      case "VIDEO":
      case "MICRO_LEARNING": {
        const vid = meta as { hlsUrl?: string; videoUrl?: string; thumbnailUrl?: string };
        const src = content.mediaId || vid?.hlsUrl || vid?.videoUrl || "";
        if (src) {
          const adsEnabled = content.adsEnabled ?? false;
          return adsEnabled ? (
            <AdInjectedPlayer
              src={src}
              hlsUrl={vid?.hlsUrl || vid?.videoUrl}
              poster={vid?.thumbnailUrl}
              adsEnabled
            />
          ) : (
            <VideoPlayer src={src} hlsUrl={vid?.hlsUrl || vid?.videoUrl} poster={vid?.thumbnailUrl} />
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
            <VideoPlayer src={videoUrl} hlsUrl={videoUrl} poster={pod?.thumbnailUrl} />
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
                    <VideoPlayer src={item.url} hlsUrl={item.url} />
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
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/learn"><Button variant="ghost" size="sm">{t("nav.learn")}</Button></Link>
          <Link href="/forum"><Button variant="ghost" size="sm">{t("nav.forums")}</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <Link href="/learn" className="text-brand-purple text-sm mb-4 inline-block">{t("content.backToLearn")}</Link>
        {loading ? (
          <p className="text-brand-grey">{t("common.loading")}</p>
        ) : content ? (
          <>
            <h1 className="text-2xl font-bold text-brand-grey-dark mb-2">{content.title}</h1>
            <p className="text-brand-grey text-sm mb-6">{content.type} {content.durationMinutes && `· ${content.durationMinutes} min`}</p>
            <div className="mb-8">{renderMedia()}</div>
            <CourseReviews contentId={id} />
          </>
        ) : (
          <p className="text-brand-grey">{t("content.contentNotFound")}</p>
        )}
      </main>
    </div>
  );
}
