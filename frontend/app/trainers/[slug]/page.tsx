"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";
import { SmartVideo } from "@/components/media/smart-video";
import { apiFetch } from "@/lib/api";

interface ContentItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
}

interface TrainerProfileData {
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
  languages?: string[];
  socialLinks?: { linkedin?: string; twitter?: string; github?: string; youtube?: string; website?: string };
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

export default function PublicTrainerProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-brand-grey">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-brand-grey-dark mb-2">Profile not found</h1>
          <p className="text-brand-grey text-sm mb-4">This trainer profile doesn&apos;t exist or hasn&apos;t been published yet.</p>
          <Link href="/trainers"><Button>Browse Trainers</Button></Link>
        </Card>
      </div>
    );
  }

  const socialLinks = profile.socialLinks ?? {};
  const hasSocials = Object.values(socialLinks).some((v) => v);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/"><LearnLogo size="md" variant="purple" /></Link>
        <nav className="flex items-center gap-4">
          <Link href="/learn"><Button variant="ghost" size="sm">Learn</Button></Link>
          <Link href="/trainers"><Button variant="ghost" size="sm">Trainers</Button></Link>
          <NavToggles />
        </nav>
      </header>

      {/* Banner */}
      <div className="h-48 md:h-56 bg-gradient-to-r from-brand-purple/30 via-brand-purple/10 to-brand-purple/5 relative">
        {profile.bannerUrl && (
          <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <main className="max-w-5xl mx-auto px-6">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-6 -mt-16 mb-8">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-brand-grey-light overflow-hidden shadow-lg flex-shrink-0">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-brand-grey">
                {profile.user.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="pt-2 md:pt-16">
            <h1 className="text-3xl font-bold text-brand-grey-dark">{profile.user.name}</h1>
            {profile.headline && (
              <p className="text-lg text-brand-grey mt-1">{profile.headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-brand-grey">
              {profile.location && <span>{profile.location}</span>}
              {profile.yearsOfExperience != null && (
                <span>{profile.yearsOfExperience}+ years experience</span>
              )}
              {profile.availableForHire && (
                <Badge variant="pulsar">Available for hire</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {(profile.specializations ?? []).map((s, i) => (
                <Badge key={i} variant="pulsar">{s}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-purple">{profile.totalCourses}</p>
            <p className="text-sm text-brand-grey">Courses</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-purple">{profile.totalStudents}</p>
            <p className="text-sm text-brand-grey">Students</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-purple">
              {profile.avgRating != null ? profile.avgRating.toFixed(1) : "—"}
            </p>
            <p className="text-sm text-brand-grey">Avg Rating</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-purple">
              {(profile.languages ?? []).length || "—"}
            </p>
            <p className="text-sm text-brand-grey">Languages</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio */}
            {profile.bio && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-brand-grey-dark mb-3">About</h2>
                <p className="text-brand-grey whitespace-pre-line leading-relaxed">{profile.bio}</p>
              </Card>
            )}

            {/* Featured video */}
            {profile.featuredVideoUrl && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-brand-grey-dark mb-3">Featured Video</h2>
                <SmartVideo src={profile.featuredVideoUrl} title="Featured Video" />
              </Card>
            )}

            {/* Content / Courses */}
            {profile.content.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">
                  Content ({profile.content.length})
                </h2>
                <div className="space-y-3">
                  {profile.content.map((item) => (
                    <Link
                      key={item.id}
                      href={item.type === "COURSE" ? `/course/${item.id}` : `/content/${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-brand-grey-light hover:bg-brand-grey-light/30 transition-colors"
                    >
                      <span className="text-xl">{TYPE_ICONS[item.type] ?? "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brand-grey-dark truncate">{item.title}</p>
                        <div className="flex gap-2 mt-0.5">
                          <Badge variant="default">{item.type.replace(/_/g, " ")}</Badge>
                          {item.durationMinutes && (
                            <span className="text-xs text-brand-grey">{item.durationMinutes} min</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Experience */}
            {(profile.experience ?? []).length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Experience</h2>
                <div className="space-y-4">
                  {(profile.experience ?? []).map((exp, i) => (
                    <div key={i} className="border-l-2 border-brand-purple/30 pl-4">
                      <p className="font-medium text-brand-grey-dark">{exp.role}</p>
                      <p className="text-sm text-brand-grey">{exp.company}</p>
                      <p className="text-xs text-brand-grey mt-0.5">
                        {exp.from}{exp.to ? ` — ${exp.to}` : ""}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-brand-grey mt-2">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Education */}
            {(profile.education ?? []).length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Education</h2>
                <div className="space-y-3">
                  {(profile.education ?? []).map((edu, i) => (
                    <div key={i} className="border-l-2 border-brand-purple/30 pl-4">
                      <p className="font-medium text-brand-grey-dark">
                        {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                      </p>
                      <p className="text-sm text-brand-grey">{edu.institution}</p>
                      {edu.year && <p className="text-xs text-brand-grey">{edu.year}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certifications */}
            {(profile.certifications ?? []).length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Certifications</h3>
                <div className="space-y-3">
                  {(profile.certifications ?? []).map((cert, i) => (
                    <div key={i}>
                      <p className="font-medium text-sm text-brand-grey-dark">{cert.name}</p>
                      {cert.issuer && <p className="text-xs text-brand-grey">{cert.issuer}</p>}
                      {cert.year && <p className="text-xs text-brand-grey">{cert.year}</p>}
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-purple hover:underline">
                          View credential
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Distinctions */}
            {(profile.distinctions ?? []).length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Distinctions & Awards</h3>
                <div className="space-y-3">
                  {(profile.distinctions ?? []).map((d, i) => (
                    <div key={i}>
                      <p className="font-medium text-sm text-brand-grey-dark">{d.title}</p>
                      {d.issuer && <p className="text-xs text-brand-grey">{d.issuer}</p>}
                      {d.year && <p className="text-xs text-brand-grey">{d.year}</p>}
                      {d.description && <p className="text-xs text-brand-grey mt-1">{d.description}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Languages */}
            {(profile.languages ?? []).length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Languages</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.languages ?? []).map((l, i) => (
                    <Badge key={i} variant="default">{l}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Resume */}
            {profile.resumeUrl && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Resume / CV</h3>
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-brand-purple hover:underline"
                >
                  View Resume
                </a>
              </Card>
            )}

            {/* Social Links */}
            {(hasSocials || profile.websiteUrl) && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Connect</h3>
                <div className="space-y-2">
                  {socialLinks.linkedin && (
                    <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-purple hover:underline">
                      LinkedIn
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-purple hover:underline">
                      Twitter / X
                    </a>
                  )}
                  {socialLinks.github && (
                    <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-purple hover:underline">
                      GitHub
                    </a>
                  )}
                  {socialLinks.youtube && (
                    <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-purple hover:underline">
                      YouTube
                    </a>
                  )}
                  {profile.websiteUrl && (
                    <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-purple hover:underline">
                      Website
                    </a>
                  )}
                </div>
              </Card>
            )}

            {/* Contact / Hire */}
            {(profile.contactEmail || profile.availableForHire) && (
              <Card className="p-5">
                <h3 className="font-semibold text-brand-grey-dark mb-3">Contact</h3>
                {profile.availableForHire && profile.hourlyRate && (
                  <p className="text-sm text-brand-grey mb-2">
                    Rate: {profile.currency ?? "USD"} {profile.hourlyRate}/hr
                  </p>
                )}
                {profile.contactEmail && (
                  <a
                    href={`mailto:${profile.contactEmail}`}
                    className="inline-block"
                  >
                    <Button variant="outline" size="sm">Send Email</Button>
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

