"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { trainerNavItemsApproved } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";

type Certification = { name: string; issuer?: string; year?: number; url?: string };
type Distinction = { title: string; issuer?: string; year?: number; description?: string };
type Education = { institution: string; degree: string; field?: string; year?: number };
type Experience = { company: string; role: string; from?: string; to?: string; description?: string };
type SocialLinks = { linkedin?: string; twitter?: string; github?: string; youtube?: string; website?: string };

interface TrainerProfile {
  id?: string;
  status?: "DRAFT" | "PUBLISHED" | "SUSPENDED";
  headline?: string;
  bio?: string;
  photoUrl?: string;
  bannerUrl?: string;
  resumeUrl?: string;
  specializations?: string[];
  certifications?: Certification[];
  distinctions?: Distinction[];
  languages?: string[];
  socialLinks?: SocialLinks;
  education?: Education[];
  experience?: Experience[];
  websiteUrl?: string;
  location?: string;
  timezone?: string;
  yearsOfExperience?: number;
  hourlyRate?: number;
  currency?: string;
  availableForHire?: boolean;
  contactEmail?: string;
  featuredVideoUrl?: string;
  slug?: string;
  totalStudents?: number;
  totalCourses?: number;
  avgRating?: number;
}

const TABS = [
  { id: "basics", label: "Basics", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "expertise", label: "Expertise", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { id: "credentials", label: "Credentials", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { id: "background", label: "Background", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "social", label: "Links & Contact", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function useProfileCompletion(profile: TrainerProfile): { pct: number; missing: string[] } {
  return useMemo(() => {
    const fields: [string, boolean][] = [
      ["Headline", !!profile.headline?.trim()],
      ["Bio", !!profile.bio?.trim()],
      ["Photo", !!profile.photoUrl?.trim()],
      ["Specializations", (profile.specializations?.length ?? 0) > 0],
      ["Location", !!profile.location?.trim()],
      ["Languages", (profile.languages?.length ?? 0) > 0],
      ["Contact email", !!profile.contactEmail?.trim()],
      ["Social links", Object.values(profile.socialLinks ?? {}).some((v) => !!v)],
    ];
    const filled = fields.filter(([, ok]) => ok).length;
    const missing = fields.filter(([, ok]) => !ok).map(([name]) => name);
    return { pct: Math.round((filled / fields.length) * 100), missing };
  }, [profile]);
}

export default function TrainerProfileEditPage() {
  const { t } = useI18n();
  const trainerNav = useMemo(() => trainerNavItemsApproved(t), [t]);
  const { user, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<TrainerProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<TabId>("basics");
  const completion = useProfileCompletion(profile);

  const isTrainer = !!user?.isAdmin || !!user?.trainerApprovedAt;

  const loadProfile = useCallback(() => {
    setLoading(true);
    apiFetch("/trainer-profiles/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isTrainer) loadProfile();
    else setLoading(false);
  }, [isTrainer, loadProfile]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/trainer-profiles/me", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save");
      }
      const saved = await res.json();
      setProfile(saved);
      setSuccess("Profile saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    const newStatus = profile.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/trainer-profiles/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update status");
      }
      const updated = await res.json();
      setProfile((prev) => ({ ...prev, status: updated.status }));
      setSuccess(newStatus === "PUBLISHED" ? "Profile is now public" : "Profile unpublished");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isTrainer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <Card className="p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-brand-purple/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Trainer access required</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            You need to be an approved trainer to create a public profile.
          </p>
          <Link href="/trainer">
            <Button>Go to Trainer Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      <div className="sticky top-0 z-40 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
        <AppBurgerHeader
          borderClassName="border-0"
          headerClassName="max-w-5xl mx-auto px-6 py-3 flex justify-between items-center gap-3"
          logoHref="/"
          logo={<LearnLogo size="md" variant="purple" />}
          items={trainerNav}
        />
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header with status and actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Trainer Profile</h1>
              {profile.status && (
                <Badge variant={profile.status === "PUBLISHED" ? "pulsar" : "default"}>
                  {profile.status === "PUBLISHED" ? "Live" : profile.status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Build your public profile to showcase your expertise and attract learners.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {profile.slug && (
              <Link href={`/trainers/${profile.slug}`} target="_blank">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Preview
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={togglePublish} disabled={saving}>
              {profile.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Profile completion bar */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Profile completeness
                </span>
                <span className={`text-sm font-bold ${completion.pct === 100 ? "text-emerald-600" : "text-brand-purple"}`}>
                  {completion.pct}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${completion.pct === 100 ? "bg-emerald-500" : "bg-brand-purple"}`}
                  style={{ width: `${completion.pct}%` }}
                />
              </div>
              {completion.missing.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Missing: {completion.missing.join(", ")}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Alerts */}
        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100/80 dark:bg-white/5 rounded-xl p-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${
                tab === t.id
                  ? "bg-white dark:bg-white/10 text-brand-purple shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-[var(--color-text-primary)]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="min-h-[300px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {tab === "basics" && <BasicsTab profile={profile} update={update} />}
            {tab === "expertise" && <ExpertiseTab profile={profile} update={update} />}
            {tab === "credentials" && <CredentialsTab profile={profile} update={update} />}
            {tab === "background" && <BackgroundTab profile={profile} update={update} />}
            {tab === "social" && <SocialTab profile={profile} update={update} />}
          </div>
        )}
      </main>
    </div>
  );
}

type TabProps = {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
};

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function BasicsTab({ profile, update }: TabProps) {
  return (
    <>
      <FormSection title="Basic Information" description="Tell learners who you are and what you do.">
        <div className="space-y-5">
          <Input
            label="Headline"
            placeholder="e.g. Senior Biotech Trainer & Food Safety Expert"
            value={profile.headline ?? ""}
            onChange={(e) => update("headline", e.target.value)}
            hint="A short tagline that appears below your name (max 200 characters)"
          />
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Bio</label>
            <textarea
              className="form-input min-h-[140px] resize-y"
              placeholder="Tell learners about yourself, your teaching philosophy, and what makes your courses unique..."
              value={profile.bio ?? ""}
              onChange={(e) => update("bio", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Profile Photo URL"
              placeholder="https://..."
              value={profile.photoUrl ?? ""}
              onChange={(e) => update("photoUrl", e.target.value)}
              hint="Square image works best (400x400px)"
            />
            <Input
              label="Banner Image URL"
              placeholder="https://..."
              value={profile.bannerUrl ?? ""}
              onChange={(e) => update("bannerUrl", e.target.value)}
              hint="Wide banner (1200x300px recommended)"
            />
          </div>
          <Input
            label="Featured Video URL"
            placeholder="https://youtube.com/watch?v=..."
            value={profile.featuredVideoUrl ?? ""}
            onChange={(e) => update("featuredVideoUrl", e.target.value)}
            hint="An introduction or highlight video shown on your profile"
          />
        </div>
      </FormSection>

      <FormSection title="Location & Availability" description="Help learners find trainers in their timezone.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Location"
            placeholder="e.g. Paris, France"
            value={profile.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
          />
          <Input
            label="Timezone"
            placeholder="e.g. Europe/Paris"
            value={profile.timezone ?? ""}
            onChange={(e) => update("timezone", e.target.value)}
          />
        </div>
        <div className="mt-5">
          <label className="flex items-center gap-3 text-sm text-[var(--color-text-primary)] cursor-pointer select-none group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={profile.availableForHire ?? false}
                onChange={(e) => update("availableForHire", e.target.checked)}
                className="rounded border-gray-300 dark:border-white/20 text-brand-purple focus:ring-brand-purple w-4.5 h-4.5"
              />
            </div>
            <span className="group-hover:text-brand-purple transition-colors">Available for hire / consulting</span>
          </label>
        </div>
        {profile.availableForHire && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 pt-5 border-t border-gray-100 dark:border-white/5">
            <Input
              label="Hourly Rate"
              type="number"
              placeholder="150"
              value={profile.hourlyRate ?? ""}
              onChange={(e) => update("hourlyRate", e.target.value ? Number(e.target.value) : undefined)}
            />
            <Input
              label="Currency"
              placeholder="USD"
              value={profile.currency ?? "USD"}
              onChange={(e) => update("currency", e.target.value)}
            />
          </div>
        )}
      </FormSection>
    </>
  );
}

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  variant = "pulsar",
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  variant?: "pulsar" | "default";
}) {
  const [value, setValue] = useState("");

  const add = () => {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onAdd(trimmed);
    setValue("");
  };

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag, i) => (
            <Badge key={i} variant={variant} className="gap-1.5 pr-1.5 py-1">
              {tag}
              <button
                onClick={() => onRemove(i)}
                className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-600 transition-opacity"
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function ExpertiseTab({ profile, update }: TabProps) {
  return (
    <>
      <FormSection title="Specializations" description="Topics and domains you specialize in (e.g. Biotech, Food Safety, HACCP, AI/ML)">
        <TagInput
          tags={profile.specializations ?? []}
          onAdd={(tag) => update("specializations", [...(profile.specializations ?? []), tag])}
          onRemove={(i) => update("specializations", (profile.specializations ?? []).filter((_, idx) => idx !== i))}
          placeholder="Add specialization..."
          variant="pulsar"
        />
      </FormSection>

      <FormSection title="Languages" description="Languages you can teach in.">
        <TagInput
          tags={profile.languages ?? []}
          onAdd={(tag) => update("languages", [...(profile.languages ?? []), tag])}
          onRemove={(i) => update("languages", (profile.languages ?? []).filter((_, idx) => idx !== i))}
          placeholder="e.g. English, French, Arabic..."
          variant="default"
        />
      </FormSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormSection title="Years of Experience">
          <Input
            type="number"
            placeholder="e.g. 10"
            value={profile.yearsOfExperience ?? ""}
            onChange={(e) => update("yearsOfExperience", e.target.value ? Number(e.target.value) : undefined)}
            hint="Total years of professional experience in your field"
          />
        </FormSection>

        <FormSection title="Resume / CV">
          <Input
            label="Resume URL"
            placeholder="https://drive.google.com/..."
            value={profile.resumeUrl ?? ""}
            onChange={(e) => update("resumeUrl", e.target.value)}
            hint="Link to your resume or CV (PDF or public URL)"
          />
        </FormSection>
      </div>
    </>
  );
}

function RepeatableSection<T extends Record<string, unknown>>({
  title,
  items,
  emptyText,
  addLabel,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyText: string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
          <p className="text-sm text-gray-400 dark:text-gray-500">{emptyText}</p>
          <Button variant="ghost" size="sm" onClick={onAdd} className="mt-2 text-brand-purple">
            {addLabel}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="relative p-5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] group">
              <button
                onClick={() => onRemove(i)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CredentialsTab({ profile, update }: TabProps) {
  const certs = profile.certifications ?? [];
  const distinctions = profile.distinctions ?? [];

  const updateCert = (i: number, field: keyof Certification, val: string | number) => {
    const updated = [...certs];
    updated[i] = { ...updated[i], [field]: val };
    update("certifications", updated);
  };

  const updateDist = (i: number, field: keyof Distinction, val: string | number) => {
    const updated = [...distinctions];
    updated[i] = { ...updated[i], [field]: val };
    update("distinctions", updated);
  };

  return (
    <>
      <RepeatableSection
        title="Certifications"
        items={certs}
        emptyText="No certifications added yet. Showcase your professional credentials."
        addLabel="Add Certification"
        onAdd={() => update("certifications", [...certs, { name: "" }])}
        onRemove={(i) => update("certifications", certs.filter((_, idx) => idx !== i))}
        renderItem={(cert, i) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Certification Name" placeholder="e.g. HACCP Level 3" value={cert.name ?? ""} onChange={(e) => updateCert(i, "name", e.target.value)} />
            <Input label="Issuing Organization" placeholder="e.g. CIEH" value={cert.issuer ?? ""} onChange={(e) => updateCert(i, "issuer", e.target.value)} />
            <Input label="Year" type="number" placeholder="2024" value={cert.year ?? ""} onChange={(e) => updateCert(i, "year", e.target.value ? Number(e.target.value) : "")} />
            <Input label="Credential URL" placeholder="https://..." value={cert.url ?? ""} onChange={(e) => updateCert(i, "url", e.target.value)} />
          </div>
        )}
      />

      <RepeatableSection
        title="Distinctions & Awards"
        items={distinctions}
        emptyText="No distinctions added yet. Highlight your awards and recognitions."
        addLabel="Add Distinction"
        onAdd={() => update("distinctions", [...distinctions, { title: "" }])}
        onRemove={(i) => update("distinctions", distinctions.filter((_, idx) => idx !== i))}
        renderItem={(d, i) => (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Title" placeholder="e.g. Best Trainer of the Year" value={d.title ?? ""} onChange={(e) => updateDist(i, "title", e.target.value)} />
              <Input label="Issuing Organization" placeholder="e.g. European Food Safety Authority" value={d.issuer ?? ""} onChange={(e) => updateDist(i, "issuer", e.target.value)} />
              <Input label="Year" type="number" placeholder="2024" value={d.year ?? ""} onChange={(e) => updateDist(i, "year", e.target.value ? Number(e.target.value) : "")} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
              <textarea
                className="form-input min-h-[60px] resize-y"
                placeholder="Brief description of the distinction..."
                value={d.description ?? ""}
                onChange={(e) => updateDist(i, "description", e.target.value)}
              />
            </div>
          </>
        )}
      />
    </>
  );
}

function BackgroundTab({ profile, update }: TabProps) {
  const edu = profile.education ?? [];
  const exp = profile.experience ?? [];

  const updateEdu = (i: number, field: keyof Education, val: string | number) => {
    const updated = [...edu];
    updated[i] = { ...updated[i], [field]: val };
    update("education", updated);
  };

  const updateExp = (i: number, field: keyof Experience, val: string) => {
    const updated = [...exp];
    updated[i] = { ...updated[i], [field]: val };
    update("experience", updated);
  };

  return (
    <>
      <RepeatableSection
        title="Education"
        items={edu}
        emptyText="No education entries yet."
        addLabel="Add Education"
        onAdd={() => update("education", [...edu, { institution: "", degree: "" }])}
        onRemove={(i) => update("education", edu.filter((_, idx) => idx !== i))}
        renderItem={(e, i) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Institution" placeholder="e.g. MIT" value={e.institution ?? ""} onChange={(ev) => updateEdu(i, "institution", ev.target.value)} />
            <Input label="Degree" placeholder="e.g. M.Sc." value={e.degree ?? ""} onChange={(ev) => updateEdu(i, "degree", ev.target.value)} />
            <Input label="Field of Study" placeholder="e.g. Biotechnology" value={e.field ?? ""} onChange={(ev) => updateEdu(i, "field", ev.target.value)} />
            <Input label="Year" type="number" placeholder="2020" value={e.year ?? ""} onChange={(ev) => updateEdu(i, "year", ev.target.value ? Number(ev.target.value) : "")} />
          </div>
        )}
      />

      <RepeatableSection
        title="Professional Experience"
        items={exp}
        emptyText="No experience entries yet."
        addLabel="Add Experience"
        onAdd={() => update("experience", [...exp, { company: "", role: "" }])}
        onRemove={(i) => update("experience", exp.filter((_, idx) => idx !== i))}
        renderItem={(e, i) => (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Company" placeholder="e.g. Afflatus Consulting Group" value={e.company ?? ""} onChange={(ev) => updateExp(i, "company", ev.target.value)} />
              <Input label="Role / Title" placeholder="e.g. Senior Trainer" value={e.role ?? ""} onChange={(ev) => updateExp(i, "role", ev.target.value)} />
              <Input label="From" placeholder="e.g. Jan 2020" value={e.from ?? ""} onChange={(ev) => updateExp(i, "from", ev.target.value)} />
              <Input label="To" placeholder="e.g. Present" value={e.to ?? ""} onChange={(ev) => updateExp(i, "to", ev.target.value)} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
              <textarea
                className="form-input min-h-[60px] resize-y"
                placeholder="Describe your responsibilities and achievements..."
                value={e.description ?? ""}
                onChange={(ev) => updateExp(i, "description", ev.target.value)}
              />
            </div>
          </>
        )}
      />
    </>
  );
}

function SocialTab({ profile, update }: TabProps) {
  const links = profile.socialLinks ?? {};

  const updateLink = (key: keyof SocialLinks, val: string) => {
    update("socialLinks", { ...links, [key]: val });
  };

  const socialFields: { key: keyof SocialLinks; label: string; placeholder: string; iconPath: string }[] = [
    { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname", iconPath: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" },
    { key: "twitter", label: "Twitter / X", placeholder: "https://twitter.com/yourhandle", iconPath: "M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" },
    { key: "github", label: "GitHub", placeholder: "https://github.com/yourname", iconPath: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" },
    { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel", iconPath: "M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z" },
  ];

  return (
    <>
      <FormSection title="Social & Professional Links" description="Connect your online presence so learners can find you elsewhere.">
        <div className="space-y-4">
          {socialFields.map((sf) => (
            <div key={sf.key} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 mt-6">
                <svg className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={sf.iconPath} />
                </svg>
              </div>
              <div className="flex-1">
                <Input
                  label={sf.label}
                  placeholder={sf.placeholder}
                  value={links[sf.key] ?? ""}
                  onChange={(e) => updateLink(sf.key, e.target.value)}
                />
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 mt-6">
              <svg className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div className="flex-1">
              <Input
                label="Personal Website"
                placeholder="https://yoursite.com"
                value={profile.websiteUrl ?? ""}
                onChange={(e) => update("websiteUrl", e.target.value)}
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Contact" description="How learners and companies can reach you.">
        <Input
          label="Public Contact Email"
          placeholder="trainer@example.com"
          value={profile.contactEmail ?? ""}
          onChange={(e) => update("contactEmail", e.target.value)}
          hint="Displayed on your public profile for inquiries"
        />
      </FormSection>
    </>
  );
}
