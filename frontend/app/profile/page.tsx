"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

type ProfileData = {
  user: {
    id: string;
    email: string;
    name: string;
    planId: string;
    billingCycle?: string | null;
    sectorFocus?: string | null;
    linkedinProfileUrl?: string | null;
    emailVerified: boolean;
    profileComplete: boolean;
    isAdmin: boolean;
    trainerApprovedAt?: string | null;
    createdAt: string;
  };
  department: { id: string; name: string; code: string } | null;
  position: { id: string; name: string; code: string } | null;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    linkedinProfileUrl?: string | null;
    industry?: { id: string; name: string; code: string } | null;
  } | null;
  completedCourses: {
    id: string;
    pathId: string;
    pathName: string;
    domainName?: string | null;
    domainColor?: string | null;
    stepCount: number;
    progressPct: number;
    completedAt?: string | null;
  }[];
  activeCourses: {
    id: string;
    pathId: string;
    pathName: string;
    domainName?: string | null;
    domainColor?: string | null;
    stepCount: number;
    progressPct: number;
  }[];
  certificates: {
    id: string;
    verifyCode: string;
    grade?: string | null;
    issuedAt: string;
    pdfUrl?: string | null;
    domainName?: string | null;
    templateName?: string | null;
    pathName?: string | null;
  }[];
  gamification: {
    points: number;
    badges: {
      id: string;
      name: string;
      icon: string;
      description?: string | null;
      earnedAt: string;
    }[];
    streak: {
      currentStreak: number;
      longestStreak: number;
      lastActivityAt?: string | null;
    };
  };
  trainerProfile: {
    headline?: string | null;
    bio?: string | null;
    specializations?: string[] | null;
    certifications?: string[] | null;
    education?: { institution: string; degree: string; field: string; year?: number }[] | null;
    experience?: { company: string; role: string; years?: number }[] | null;
    languages?: string[] | null;
    totalStudents: number;
    totalCourses: number;
    avgRating?: number | null;
    slug: string;
    status: string;
  } | null;
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  EXPLORER: { label: "Explorer", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  SPECIALIST: { label: "Specialist", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  VISIONARY: { label: "Visionary", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  NEXUS: { label: "Nexus Enterprise", color: "bg-brand-green/10 text-brand-green" },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SectionCard({
  title,
  icon,
  children,
  className = "",
  count,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
  count?: number;
}) {
  return (
    <div className={`card-brand p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
        {count != null && (
          <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatBadge({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-green/5 border border-brand-green/15">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-wider font-medium text-[var(--color-text-secondary)]">{label}</p>
        <p className="font-bold text-brand-green text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-8 text-[var(--color-text-secondary)]">
      <span className="text-3xl mb-2 block">{icon}</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "certificates" | "achievements">("overview");

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/signin?redirect=/profile");
    }
  }, [userLoading, user, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/full");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user, fetchProfile]);

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1510] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const p = profile;
  const initials = (p?.user?.name ?? user.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const plan = PLAN_LABELS[p?.user?.planId ?? user.planId] ?? PLAN_LABELS.EXPLORER;
  const memberSince = formatDate(p?.user?.createdAt);
  const totalCompleted = p?.completedCourses?.length ?? 0;
  const totalActive = p?.activeCourses?.length ?? 0;
  const totalCerts = p?.certificates?.length ?? 0;

  const TABS = [
    { key: "overview" as const, label: "Overview", icon: "👤" },
    { key: "courses" as const, label: "Learning", icon: "📚" },
    { key: "certificates" as const, label: "Certificates", icon: "🎓" },
    { key: "achievements" as const, label: "Achievements", icon: "🏆" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1510]">
      {/* Header */}
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <div className="flex gap-4">
            <Link href="/learn"><Button variant="ghost" size="sm">{t("nav.myProgress")}</Button></Link>
            <Link href="/forum"><Button variant="ghost" size="sm">{t("nav.forums")}</Button></Link>
            <Link href="/discover"><Button variant="ghost" size="sm">{t("nav.discover")}</Button></Link>
            <Link href="/referrals"><Button variant="ghost" size="sm">Referrals</Button></Link>
            <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
            {(user?.isAdmin || user?.planId === "NEXUS") && (
              <Link href="/admin/nexus"><Button variant="outline" size="sm">My Company</Button></Link>
            )}
            <Link href="/admin/paths"><Button variant="outline" size="sm">{t("nav.admin")}</Button></Link>
          </div>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className="card-brand p-8 mb-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-green to-brand-green-light flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-green/20">
                  <span className="text-3xl font-bold text-white">{initials}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {p?.user?.name ?? user.name}
                    </h1>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${plan.color}`}>
                      {plan.label}
                    </span>
                    {p?.user?.isAdmin && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Admin
                      </span>
                    )}
                    {p?.user?.trainerApprovedAt && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Trainer
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    {p?.user?.email ?? user.email}
                    {p?.user?.emailVerified && (
                      <span className="inline-flex items-center ml-2 text-brand-green text-xs font-medium">
                        <svg className="w-3.5 h-3.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
                    {p?.position && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {p.position.name}
                      </span>
                    )}
                    {p?.department && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {p.department.name}
                      </span>
                    )}
                    {p?.user?.linkedinProfileUrl && (
                      <a
                        href={p.user.linkedinProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[#0077B5] hover:underline"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn
                      </a>
                    )}
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Member since {memberSince}
                    </span>
                  </div>

                  {p?.user?.sectorFocus && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.user.sectorFocus.split(",").map((s) => (
                        <span
                          key={s.trim()}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-green/10 text-brand-green border border-brand-green/15"
                        >
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link href="/complete-profile">
                    <Button variant="outline" size="sm" className="w-full">Edit Profile</Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatBadge icon="⭐" label="Points" value={p?.gamification?.points ?? 0} />
              <StatBadge
                icon="🔥"
                label="Streak"
                value={`${p?.gamification?.streak?.currentStreak ?? 0} days`}
              />
              <StatBadge icon="📚" label="Completed" value={totalCompleted} />
              <StatBadge icon="🎓" label="Certificates" value={totalCerts} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-[var(--color-bg-secondary)] p-1 rounded-xl overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-white dark:bg-[#1a1e18] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Affiliation */}
                <SectionCard title="Company Affiliation" icon="🏢">
                  {p?.company ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {p.company.logoUrl ? (
                          <img
                            src={p.company.logoUrl}
                            alt={p.company.name}
                            className="h-12 w-12 rounded-xl object-contain border border-[var(--color-bg-secondary)]"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center">
                            <span className="text-lg font-bold text-[var(--color-text-secondary)]">
                              {p.company.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)]">{p.company.name}</p>
                          {p.company.industry && (
                            <p className="text-xs text-[var(--color-text-secondary)]">{p.company.industry.name}</p>
                          )}
                        </div>
                      </div>
                      {p.company.linkedinProfileUrl && (
                        <a
                          href={p.company.linkedinProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-[#0077B5] hover:underline"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          Company LinkedIn
                        </a>
                      )}
                    </div>
                  ) : (
                    <EmptyState icon="🏢" message="No company affiliation yet. Complete your profile to connect with your organization." />
                  )}
                </SectionCard>

                {/* Role & Department */}
                <SectionCard title="Professional Info" icon="💼">
                  <div className="space-y-3">
                    <InfoRow label="Position" value={p?.position?.name} />
                    <InfoRow label="Department" value={p?.department?.name} />
                    <InfoRow label="Sector Focus" value={p?.user?.sectorFocus} />
                    <InfoRow label="Subscription" value={plan.label} />
                    <InfoRow
                      label="Billing"
                      value={p?.user?.billingCycle ? p.user.billingCycle.charAt(0) + p.user.billingCycle.slice(1).toLowerCase() : "Free"}
                    />
                  </div>
                </SectionCard>

                {/* Academic Background / Education */}
                <SectionCard title="Education & Diplomas" icon="🎓">
                  {p?.trainerProfile?.education &&
                  Array.isArray(p.trainerProfile.education) &&
                  (p.trainerProfile.education as { institution: string; degree: string; field: string; year?: number }[]).length > 0 ? (
                    <div className="space-y-3">
                      {(p.trainerProfile.education as { institution: string; degree: string; field: string; year?: number }[]).map((edu, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                          <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-[var(--color-text-primary)]">{edu.degree} in {edu.field}</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{edu.institution}</p>
                            {edu.year && <p className="text-xs text-[var(--color-text-muted)]">{edu.year}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="🎓" message="No education data yet. Become a trainer to add your academic background." />
                  )}
                </SectionCard>

                {/* External Certifications */}
                <SectionCard title="Professional Certifications" icon="📜">
                  {p?.trainerProfile?.certifications &&
                  Array.isArray(p.trainerProfile.certifications) &&
                  (p.trainerProfile.certifications as string[]).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(p.trainerProfile.certifications as string[]).map((cert, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="📜" message="No professional certifications listed yet." />
                  )}
                </SectionCard>

                {/* Trainer Profile */}
                {p?.trainerProfile && (
                  <SectionCard title="Trainer Profile" icon="🎙️" className="lg:col-span-2">
                    <div className="space-y-4">
                      {p.trainerProfile.headline && (
                        <p className="text-base font-medium text-[var(--color-text-primary)] italic">
                          &ldquo;{p.trainerProfile.headline}&rdquo;
                        </p>
                      )}
                      {p.trainerProfile.bio && (
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          {p.trainerProfile.bio}
                        </p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MiniStat label="Students" value={p.trainerProfile.totalStudents} />
                        <MiniStat label="Courses" value={p.trainerProfile.totalCourses} />
                        <MiniStat
                          label="Rating"
                          value={p.trainerProfile.avgRating ? `${p.trainerProfile.avgRating.toFixed(1)}/5` : "N/A"}
                        />
                        <MiniStat
                          label="Status"
                          value={p.trainerProfile.status.charAt(0) + p.trainerProfile.status.slice(1).toLowerCase()}
                        />
                      </div>
                      {p.trainerProfile.specializations &&
                        Array.isArray(p.trainerProfile.specializations) &&
                        (p.trainerProfile.specializations as string[]).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                              Specializations
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(p.trainerProfile.specializations as string[]).map((s, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-green/10 text-brand-green border border-brand-green/15"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      {p.trainerProfile.languages &&
                        Array.isArray(p.trainerProfile.languages) &&
                        (p.trainerProfile.languages as string[]).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                              Languages
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(p.trainerProfile.languages as string[]).map((lang, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30"
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {activeTab === "courses" && (
              <div className="space-y-6">
                {/* Active Courses */}
                <SectionCard title="In Progress" icon="📖" count={totalActive}>
                  {totalActive > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {p?.activeCourses?.map((course) => (
                        <div key={course.id} className="p-4 rounded-xl border border-[var(--color-bg-secondary)] hover:border-brand-green/30 transition-colors">
                          {course.domainName && (
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-green mb-1 block">
                              {course.domainName}
                            </span>
                          )}
                          <p className="font-semibold text-sm text-[var(--color-text-primary)] mb-2 line-clamp-2">
                            {course.pathName}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-2">
                            <span>{course.stepCount} steps</span>
                            <span className="font-semibold text-brand-green">{course.progressPct}%</span>
                          </div>
                          <div className="h-1.5 bg-brand-green/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-green rounded-full transition-all"
                              style={{ width: `${course.progressPct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="📖" message="No courses in progress." />
                  )}
                </SectionCard>

                {/* Completed Courses */}
                <SectionCard title="Completed" icon="✅" count={totalCompleted}>
                  {totalCompleted > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {p?.completedCourses?.map((course) => (
                        <div key={course.id} className="p-4 rounded-xl border border-brand-green/20 bg-brand-green/5">
                          {course.domainName && (
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-green mb-1 block">
                              {course.domainName}
                            </span>
                          )}
                          <p className="font-semibold text-sm text-[var(--color-text-primary)] mb-2 line-clamp-2">
                            {course.pathName}
                          </p>
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                            <span>{course.stepCount} steps</span>
                            <span className="text-brand-green font-medium">
                              Completed {formatDate(course.completedAt)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-brand-green/20 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-brand-green rounded-full w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="✅" message="No completed courses yet. Keep learning!" />
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === "certificates" && (
              <SectionCard title="Issued Certificates" icon="🎓" count={totalCerts}>
                {totalCerts > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {p?.certificates?.map((cert) => (
                      <div
                        key={cert.id}
                        className="p-5 rounded-xl border-2 border-dashed border-brand-green/30 bg-gradient-to-br from-brand-green/5 to-transparent hover:border-brand-green/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-12 h-12 rounded-xl bg-brand-green/15 flex items-center justify-center">
                            <svg className="w-6 h-6 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                          {cert.grade && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              cert.grade === "DISTINCTION"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : cert.grade === "MERIT"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            }`}>
                              {cert.grade}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-[var(--color-text-primary)] mb-1">
                          {cert.templateName ?? cert.pathName ?? "Certificate"}
                        </p>
                        {cert.domainName && (
                          <p className="text-xs text-brand-green font-medium mb-2">{cert.domainName}</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                          <span>Issued {formatDate(cert.issuedAt)}</span>
                          <Link
                            href={`/certificates/verify/${cert.verifyCode}`}
                            className="text-brand-green font-semibold hover:underline"
                          >
                            Verify
                          </Link>
                        </div>
                        {cert.pdfUrl && (
                          <a
                            href={cert.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-green hover:underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Download PDF
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="🎓" message="No certificates issued yet. Complete learning paths to earn certificates." />
                )}
              </SectionCard>
            )}

            {activeTab === "achievements" && (
              <div className="space-y-6">
                {/* Gamification Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card-brand p-6 text-center">
                    <span className="text-4xl mb-2 block">⭐</span>
                    <p className="text-3xl font-bold text-brand-green">{p?.gamification?.points ?? 0}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Total Points</p>
                  </div>
                  <div className="card-brand p-6 text-center">
                    <span className="text-4xl mb-2 block">🔥</span>
                    <p className="text-3xl font-bold text-brand-green">
                      {p?.gamification?.streak?.currentStreak ?? 0}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Day Streak (Best: {p?.gamification?.streak?.longestStreak ?? 0})
                    </p>
                    {p?.gamification?.streak?.lastActivityAt && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Last active {formatDate(p.gamification.streak.lastActivityAt)}
                      </p>
                    )}
                  </div>
                  <div className="card-brand p-6 text-center">
                    <span className="text-4xl mb-2 block">🏆</span>
                    <p className="text-3xl font-bold text-brand-green">
                      {p?.gamification?.badges?.length ?? 0}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Badges Earned</p>
                  </div>
                </div>

                {/* Badges */}
                <SectionCard
                  title="Badges"
                  icon="🏅"
                  count={p?.gamification?.badges?.length ?? 0}
                >
                  {(p?.gamification?.badges?.length ?? 0) > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {p?.gamification?.badges?.map((badge) => (
                        <div
                          key={badge.id}
                          className="p-4 rounded-xl border border-[var(--color-bg-secondary)] text-center hover:border-brand-green/30 transition-colors"
                        >
                          <span className="text-3xl mb-2 block">{badge.icon}</span>
                          <p className="font-semibold text-sm text-[var(--color-text-primary)]">{badge.name}</p>
                          {badge.description && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                              {badge.description}
                            </p>
                          )}
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                            {formatDate(badge.earnedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="🏅" message="No badges earned yet. Keep learning to unlock achievements!" />
                  )}
                </SectionCard>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-bg-secondary)] last:border-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{value ?? "—"}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50 text-center">
      <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[11px] text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}
