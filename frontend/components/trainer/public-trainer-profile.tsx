"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { trainersDirectoryNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { SmartVideo } from "@/components/media/smart-video";
import { apiFetch } from "@/lib/api";
import { learnerContentHref } from "@/lib/learner-content-href";
import { apiAssetUrl } from "@/lib/asset-url";

interface ContentItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
}

export interface TrainerProfileData {
  id: string;
  slug: string;
  status: string;
  headline?: string;
  bio?: string;
  photoUrl?: string;
  bannerUrl?: string;
  resumeUrl?: string;
  specializations?: string[];
  certifications?: Array<{ name: string; issuer?: string; year?: number; url?: string }>;
  distinctions?: Array<{ title: string; issuer?: string; year?: number; description?: string }>;
  languages?: string[] | Array<{ langue?: string; language?: string; niveau?: string; level?: string }>;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    youtube?: string;
    website?: string;
    researchgate?: string;
  };
  education?: Array<{ institution: string; degree: string; field?: string; year?: number }>;
  experience?: Array<{ company: string; role: string; from?: string; to?: string; description?: string }>;
  websiteUrl?: string;
  location?: string;
  timezone?: string;
  yearsOfExperience?: number;
  hourlyRate?: number;
  currency?: string;
  availableForHire?: boolean;
  contactEmail?: string;
  featuredVideoUrl?: string;
  totalStudents: number;
  totalCourses: number;
  avgRating?: number;
  user: { id: string; name: string; linkedinProfileUrl?: string };
  content: ContentItem[];
}

const TYPE_ICONS: Record<string, string> = {
  COURSE: "📚",
  MICRO_LEARNING: "⚡",
  PODCAST: "🎧",
  DOCUMENT: "📄",
  IMPLEMENTATION_GUIDE: "🛠️",
  QUIZ_ASSESSMENT: "✅",
  GAME: "🎮",
  VIDEO: "🎬",
};

const PUBLIC_CONTENT_ANCHOR = "trainer-public-content";

export function PublicTrainerProfile({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { user } = useUser();
  const navItems = useMemo(() => trainersDirectoryNavItems(t, user), [t, user]);
  const [profile, setProfile] = useState<TrainerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiFetch(`/trainer-profiles/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1D9E75] border-t-transparent" />
          <p className="text-sm text-[#6B7280]">{t("trainer.public.loading")}</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Card className="p-8 text-center max-w-md border border-black/[0.08] rounded-xl shadow-none">
          <h1 className="text-xl font-semibold text-[#1A1A1A] mb-2">{t("trainer.public.notFoundTitle")}</h1>
          <p className="text-[#6B7280] text-sm mb-4">{t("trainer.public.notFoundBody")}</p>
          <Link href="/trainers">
            <Button>{t("trainer.public.browseTrainers")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const socialLinks = profile.socialLinks ?? {};
  const hasSocials = Object.values(socialLinks).some((v) => v);

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-[family-name:var(--font-trainer)]">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={navItems} />

      <div className="h-48 md:h-56 bg-gradient-to-r from-brand-purple/30 via-brand-purple/10 to-brand-purple/5 relative">
        {profile.bannerUrl && (
          <img
            src={apiAssetUrl(profile.bannerUrl) ?? profile.bannerUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <main className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-6 -mt-16 mb-6">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-[#F3F4F6] overflow-hidden shadow-lg flex-shrink-0 mx-auto md:mx-0">
            {profile.photoUrl ? (
              <img
                src={apiAssetUrl(profile.photoUrl) ?? profile.photoUrl}
                alt={profile.user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-[#6B7280]">
                {profile.user.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="pt-2 md:pt-16 text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold text-[#1A1A1A]">{profile.user.name}</h1>
            {profile.headline && <p className="text-lg text-[#6B7280] mt-1">{profile.headline}</p>}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-sm text-[#6B7280]">
              {profile.location && <span>{profile.location}</span>}
              {profile.yearsOfExperience != null && (
                <span>
                  {profile.yearsOfExperience}+ {t("trainer.public.yearsExperience")}
                </span>
              )}
              {profile.availableForHire && <Badge variant="pulsar">{t("trainer.public.availableForHire")}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {(profile.specializations ?? []).map((s, i) => (
                <Link key={i} href={`/discover?q=${encodeURIComponent(s)}`}>
                  <Badge variant="pulsar" className="cursor-pointer hover:opacity-90">
                    {s}
                  </Badge>
                </Link>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-4 justify-center md:justify-start">
              {profile.contactEmail && (
                <a href={`mailto:${profile.contactEmail}`} className="inline-block">
                  <Button className="bg-[#1D9E75] hover:bg-[#178f68] text-white w-full sm:w-auto">
                    {t("trainer.public.ctaContact")}
                  </Button>
                </a>
              )}
              {profile.content.length > 0 && (
                <a href={`#${PUBLIC_CONTENT_ANCHOR}`}>
                  <Button variant="outline" className="w-full sm:w-auto border-[#1D9E75] text-[#1D9E75]">
                    {t("trainer.public.ctaViewContent")}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center border border-black/[0.08] rounded-xl shadow-none">
            <p className="text-2xl font-bold text-[#6B2D8B]">{profile.totalCourses}</p>
            <p className="text-sm text-[#6B7280]">{t("trainer.public.statContents")}</p>
          </Card>
          <Card className="p-4 text-center border border-black/[0.08] rounded-xl shadow-none">
            <p className="text-2xl font-bold text-[#6B2D8B]">{profile.totalStudents}</p>
            <p className="text-sm text-[#6B7280]">{t("trainer.public.statLearners")}</p>
          </Card>
          <Card className="p-4 text-center border border-black/[0.08] rounded-xl shadow-none">
            <p className="text-2xl font-bold text-[#6B2D8B]">
              {profile.avgRating != null ? profile.avgRating.toFixed(1) : "—"}
            </p>
            <p className="text-sm text-[#6B7280]">{t("trainer.public.statRating")}</p>
          </Card>
          <Card className="p-4 text-center border border-black/[0.08] rounded-xl shadow-none">
            <p className="text-2xl font-bold text-[#6B2D8B]">
              {Array.isArray(profile.languages) ? profile.languages.length : "—"}
            </p>
            <p className="text-sm text-[#6B7280]">{t("trainer.public.statLanguages")}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 space-y-8">
            {profile.bio && (
              <Card className="p-6 border border-black/[0.08] rounded-xl shadow-none">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.about")}</h2>
                <p className="text-[#6B7280] whitespace-pre-line leading-relaxed">{profile.bio}</p>
              </Card>
            )}

            {profile.featuredVideoUrl && (
              <Card className="p-6 border border-black/[0.08] rounded-xl shadow-none">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.featuredVideo")}</h2>
                <SmartVideo src={profile.featuredVideoUrl} title="Featured Video" />
              </Card>
            )}

            {profile.content.length > 0 && (
              <Card id={PUBLIC_CONTENT_ANCHOR} className="p-6 border border-black/[0.08] rounded-xl shadow-none scroll-mt-24">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">
                  {t("trainer.public.contentHeading", { count: String(profile.content.length) })}
                </h2>
                <div className="space-y-3">
                  {profile.content.map((item) => (
                    <Link
                      key={item.id}
                      href={
                        item.type === "COURSE"
                          ? `/course/${item.id}`
                          : learnerContentHref(item.type, item.id)
                      }
                      className="flex items-center gap-3 p-3 rounded-lg border border-black/[0.08] hover:bg-black/[0.02] transition-colors"
                    >
                      <span className="text-xl">{TYPE_ICONS[item.type] ?? "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1A1A1A] truncate">{item.title}</p>
                        <div className="flex gap-2 mt-0.5">
                          <Badge variant="default">{item.type.replace(/_/g, " ")}</Badge>
                          {item.durationMinutes && (
                            <span className="text-xs text-[#6B7280]">{item.durationMinutes} min</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {(profile.experience ?? []).length > 0 && (
              <Card className="p-6 border border-black/[0.08] rounded-xl shadow-none">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">{t("trainer.public.experience")}</h2>
                <div className="space-y-4">
                  {(profile.experience ?? []).map((exp, i) => (
                    <div key={i} className="border-l-2 border-[#1D9E75]/40 pl-4">
                      <p className="font-medium text-[#1A1A1A]">{exp.role}</p>
                      <p className="text-sm text-[#6B7280]">{exp.company}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {exp.from}
                        {exp.to ? ` — ${exp.to}` : ""}
                      </p>
                      {exp.description && <p className="text-sm text-[#6B7280] mt-2">{exp.description}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(profile.education ?? []).length > 0 && (
              <Card className="p-6 border border-black/[0.08] rounded-xl shadow-none">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">{t("trainer.public.education")}</h2>
                <div className="space-y-3">
                  {(profile.education ?? []).map((edu, i) => (
                    <div key={i} className="border-l-2 border-[#BA7517]/50 pl-4">
                      <p className="font-medium text-[#1A1A1A]">
                        {edu.degree}
                        {edu.field ? ` in ${edu.field}` : ""}
                      </p>
                      <p className="text-sm text-[#6B7280]">{edu.institution}</p>
                      {edu.year && <p className="text-xs text-[#9CA3AF]">{edu.year}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {(profile.certifications ?? []).length > 0 && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.certifications")}</h3>
                <div className="space-y-3">
                  {(profile.certifications ?? []).map((cert, i) => (
                    <div key={i}>
                      <p className="font-medium text-sm text-[#1A1A1A]">{cert.name}</p>
                      {cert.issuer && <p className="text-xs text-[#6B7280]">{cert.issuer}</p>}
                      {cert.year && <p className="text-xs text-[#9CA3AF]">{cert.year}</p>}
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#6B2D8B] hover:underline"
                        >
                          {t("trainer.public.viewCredential")}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(profile.distinctions ?? []).length > 0 && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.distinctions")}</h3>
                <div className="space-y-3">
                  {(profile.distinctions ?? []).map((d, i) => (
                    <div key={i}>
                      <p className="font-medium text-sm text-[#1A1A1A]">{d.title}</p>
                      {d.issuer && <p className="text-xs text-[#6B7280]">{d.issuer}</p>}
                      {d.year && <p className="text-xs text-[#9CA3AF]">{d.year}</p>}
                      {d.description && <p className="text-xs text-[#6B7280] mt-1">{d.description}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(profile.languages ?? []).length > 0 && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.languages")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.languages ?? []).map((l, i) => (
                    <Badge key={i} variant="default">
                      {typeof l === "string" ? l : (l as { langue?: string; language?: string }).langue ?? (l as { language?: string }).language ?? ""}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {profile.resumeUrl && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.resume")}</h3>
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#6B2D8B] hover:underline"
                >
                  {t("trainer.public.viewResume")}
                </a>
              </Card>
            )}

            {(hasSocials || profile.websiteUrl) && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.connect")}</h3>
                <div className="space-y-2">
                  {socialLinks.linkedin && (
                    <a
                      href={socialLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#0A66C2] hover:underline"
                      aria-label={t("trainer.public.ariaLinkedin", { name: profile.user.name })}
                    >
                      LinkedIn
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#6B2D8B] hover:underline"
                    >
                      Twitter / X
                    </a>
                  )}
                  {socialLinks.github && (
                    <a
                      href={socialLinks.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#6B2D8B] hover:underline"
                    >
                      GitHub
                    </a>
                  )}
                  {socialLinks.youtube && (
                    <a
                      href={socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#6B2D8B] hover:underline"
                    >
                      YouTube
                    </a>
                  )}
                  {socialLinks.researchgate && (
                    <a
                      href={socialLinks.researchgate}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#6B2D8B] hover:underline"
                    >
                      ResearchGate
                    </a>
                  )}
                  {profile.websiteUrl && (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-[#6B2D8B] hover:underline"
                    >
                      {t("trainer.public.website")}
                    </a>
                  )}
                </div>
              </Card>
            )}

            {(profile.contactEmail || profile.availableForHire) && (
              <Card className="p-5 border border-black/[0.08] rounded-xl shadow-none">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">{t("trainer.public.contactCard")}</h3>
                {profile.availableForHire && profile.hourlyRate && (
                  <p className="text-sm text-[#6B7280] mb-2">
                    {t("trainer.public.rateLabel")}: {profile.currency ?? "USD"} {profile.hourlyRate}/hr
                  </p>
                )}
                {profile.contactEmail && (
                  <a href={`mailto:${profile.contactEmail}`} className="inline-block">
                    <Button variant="outline" size="sm">
                      {t("trainer.public.sendEmail")}
                    </Button>
                  </a>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
