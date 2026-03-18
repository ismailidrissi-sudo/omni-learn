"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";
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
  { id: "basics", label: "Basics" },
  { id: "expertise", label: "Expertise" },
  { id: "credentials", label: "Credentials" },
  { id: "background", label: "Background" },
  { id: "social", label: "Links & Contact" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function TrainerProfileEditPage() {
  const { user, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<TrainerProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<TabId>("basics");

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
      setSuccess("Profile saved");
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">Loading...</p>
      </div>
    );
  }

  if (!isTrainer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-brand-grey-dark mb-2">Trainer access required</h1>
          <p className="text-brand-grey text-sm mb-4">
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
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trainer">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </Link>
          <Link href="/trainer/profile">
            <Button variant="primary" size="sm">My Profile</Button>
          </Link>
          <Link href="/trainers">
            <Button variant="ghost" size="sm">Directory</Button>
          </Link>
          <NavToggles />
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-grey-dark">Trainer Profile</h1>
            <p className="text-brand-grey text-sm mt-1">
              Build your public profile to showcase your expertise and attract learners.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profile.status && (
              <Badge variant={profile.status === "PUBLISHED" ? "pulsar" : "default"}>
                {profile.status}
              </Badge>
            )}
            {profile.slug && (
              <Link href={`/trainers/${profile.slug}`} target="_blank">
                <Button variant="ghost" size="sm">Preview</Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={togglePublish}
              disabled={saving}
            >
              {profile.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
            {success}
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-brand-grey-light overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? "border-brand-purple text-brand-purple"
                  : "border-transparent text-brand-grey hover:text-brand-grey-dark"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="min-h-[300px] flex items-center justify-center">
            <p className="text-brand-grey">Loading profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tab === "basics" && (
              <BasicsTab profile={profile} update={update} />
            )}
            {tab === "expertise" && (
              <ExpertiseTab profile={profile} update={update} />
            )}
            {tab === "credentials" && (
              <CredentialsTab profile={profile} update={update} />
            )}
            {tab === "background" && (
              <BackgroundTab profile={profile} update={update} />
            )}
            {tab === "social" && (
              <SocialTab profile={profile} update={update} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function BasicsTab({
  profile,
  update,
}: {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
}) {
  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Basic Information</h2>
        <div className="space-y-4">
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
              className="form-input min-h-[120px] resize-y"
              placeholder="Tell learners about yourself, your teaching philosophy, and what makes your courses unique..."
              value={profile.bio ?? ""}
              onChange={(e) => update("bio", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Location & Availability</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-brand-grey-dark cursor-pointer">
            <input
              type="checkbox"
              checked={profile.availableForHire ?? false}
              onChange={(e) => update("availableForHire", e.target.checked)}
              className="rounded border-brand-grey-light text-brand-purple focus:ring-brand-purple"
            />
            Available for hire / consulting
          </label>
        </div>
        {profile.availableForHire && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
      </Card>
    </>
  );
}

function ExpertiseTab({
  profile,
  update,
}: {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
}) {
  const [newSpec, setNewSpec] = useState("");
  const [newLang, setNewLang] = useState("");
  const specs = profile.specializations ?? [];
  const langs = profile.languages ?? [];

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Specializations</h2>
        <p className="text-sm text-brand-grey mb-3">
          Topics and domains you specialize in (e.g. Biotech, Food Safety, HACCP, AI/ML)
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {specs.map((s, i) => (
            <Badge key={i} variant="pulsar" className="gap-1.5 pr-1.5">
              {s}
              <button
                onClick={() => update("specializations", specs.filter((_, idx) => idx !== i))}
                className="ml-1 text-brand-purple hover:text-red-600"
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add specialization..."
            value={newSpec}
            onChange={(e) => setNewSpec(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSpec.trim()) {
                update("specializations", [...specs, newSpec.trim()]);
                setNewSpec("");
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (newSpec.trim()) {
                update("specializations", [...specs, newSpec.trim()]);
                setNewSpec("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Languages</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {langs.map((l, i) => (
            <Badge key={i} variant="default" className="gap-1.5 pr-1.5">
              {l}
              <button
                onClick={() => update("languages", langs.filter((_, idx) => idx !== i))}
                className="ml-1 hover:text-red-600"
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. English, French, Arabic..."
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLang.trim()) {
                update("languages", [...langs, newLang.trim()]);
                setNewLang("");
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (newLang.trim()) {
                update("languages", [...langs, newLang.trim()]);
                setNewLang("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Years of Experience</h2>
        <Input
          type="number"
          placeholder="e.g. 10"
          value={profile.yearsOfExperience ?? ""}
          onChange={(e) => update("yearsOfExperience", e.target.value ? Number(e.target.value) : undefined)}
          hint="Total years of professional experience in your field"
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Resume / CV</h2>
        <Input
          label="Resume URL"
          placeholder="https://drive.google.com/..."
          value={profile.resumeUrl ?? ""}
          onChange={(e) => update("resumeUrl", e.target.value)}
          hint="Link to your resume or CV (PDF or public URL)"
        />
      </Card>
    </>
  );
}

function CredentialsTab({
  profile,
  update,
}: {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
}) {
  const certs = profile.certifications ?? [];
  const distinctions = profile.distinctions ?? [];

  const addCert = () => update("certifications", [...certs, { name: "" }]);
  const updateCert = (i: number, field: keyof Certification, val: string | number) => {
    const updated = [...certs];
    updated[i] = { ...updated[i], [field]: val };
    update("certifications", updated);
  };
  const removeCert = (i: number) => update("certifications", certs.filter((_, idx) => idx !== i));

  const addDist = () => update("distinctions", [...distinctions, { title: "" }]);
  const updateDist = (i: number, field: keyof Distinction, val: string | number) => {
    const updated = [...distinctions];
    updated[i] = { ...updated[i], [field]: val };
    update("distinctions", updated);
  };
  const removeDist = (i: number) => update("distinctions", distinctions.filter((_, idx) => idx !== i));

  return (
    <>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-grey-dark">Certifications</h2>
          <Button variant="outline" size="sm" onClick={addCert}>Add Certification</Button>
        </div>
        {certs.length === 0 && (
          <p className="text-sm text-brand-grey">No certifications added yet. Showcase your professional credentials.</p>
        )}
        <div className="space-y-4">
          {certs.map((cert, i) => (
            <div key={i} className="p-4 border border-brand-grey-light rounded-lg relative">
              <button
                onClick={() => removeCert(i)}
                className="absolute top-2 right-2 text-brand-grey hover:text-red-600 text-lg"
              >
                &times;
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Certification Name"
                  placeholder="e.g. HACCP Level 3"
                  value={cert.name ?? ""}
                  onChange={(e) => updateCert(i, "name", e.target.value)}
                />
                <Input
                  label="Issuing Organization"
                  placeholder="e.g. CIEH"
                  value={cert.issuer ?? ""}
                  onChange={(e) => updateCert(i, "issuer", e.target.value)}
                />
                <Input
                  label="Year"
                  type="number"
                  placeholder="2024"
                  value={cert.year ?? ""}
                  onChange={(e) => updateCert(i, "year", e.target.value ? Number(e.target.value) : "")}
                />
                <Input
                  label="Credential URL"
                  placeholder="https://..."
                  value={cert.url ?? ""}
                  onChange={(e) => updateCert(i, "url", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-grey-dark">Distinctions & Awards</h2>
          <Button variant="outline" size="sm" onClick={addDist}>Add Distinction</Button>
        </div>
        {distinctions.length === 0 && (
          <p className="text-sm text-brand-grey">No distinctions added yet. Highlight your awards and recognitions.</p>
        )}
        <div className="space-y-4">
          {distinctions.map((d, i) => (
            <div key={i} className="p-4 border border-brand-grey-light rounded-lg relative">
              <button
                onClick={() => removeDist(i)}
                className="absolute top-2 right-2 text-brand-grey hover:text-red-600 text-lg"
              >
                &times;
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Title"
                  placeholder="e.g. Best Trainer of the Year"
                  value={d.title ?? ""}
                  onChange={(e) => updateDist(i, "title", e.target.value)}
                />
                <Input
                  label="Issuing Organization"
                  placeholder="e.g. European Food Safety Authority"
                  value={d.issuer ?? ""}
                  onChange={(e) => updateDist(i, "issuer", e.target.value)}
                />
                <Input
                  label="Year"
                  type="number"
                  placeholder="2024"
                  value={d.year ?? ""}
                  onChange={(e) => updateDist(i, "year", e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Description
                </label>
                <textarea
                  className="form-input min-h-[60px] resize-y"
                  placeholder="Brief description of the distinction..."
                  value={d.description ?? ""}
                  onChange={(e) => updateDist(i, "description", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function BackgroundTab({
  profile,
  update,
}: {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
}) {
  const edu = profile.education ?? [];
  const exp = profile.experience ?? [];

  const addEdu = () => update("education", [...edu, { institution: "", degree: "" }]);
  const updateEdu = (i: number, field: keyof Education, val: string | number) => {
    const updated = [...edu];
    updated[i] = { ...updated[i], [field]: val };
    update("education", updated);
  };
  const removeEdu = (i: number) => update("education", edu.filter((_, idx) => idx !== i));

  const addExp = () => update("experience", [...exp, { company: "", role: "" }]);
  const updateExp = (i: number, field: keyof Experience, val: string) => {
    const updated = [...exp];
    updated[i] = { ...updated[i], [field]: val };
    update("experience", updated);
  };
  const removeExp = (i: number) => update("experience", exp.filter((_, idx) => idx !== i));

  return (
    <>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-grey-dark">Education</h2>
          <Button variant="outline" size="sm" onClick={addEdu}>Add Education</Button>
        </div>
        {edu.length === 0 && (
          <p className="text-sm text-brand-grey">No education entries yet.</p>
        )}
        <div className="space-y-4">
          {edu.map((e, i) => (
            <div key={i} className="p-4 border border-brand-grey-light rounded-lg relative">
              <button
                onClick={() => removeEdu(i)}
                className="absolute top-2 right-2 text-brand-grey hover:text-red-600 text-lg"
              >
                &times;
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Institution"
                  placeholder="e.g. MIT"
                  value={e.institution ?? ""}
                  onChange={(ev) => updateEdu(i, "institution", ev.target.value)}
                />
                <Input
                  label="Degree"
                  placeholder="e.g. M.Sc."
                  value={e.degree ?? ""}
                  onChange={(ev) => updateEdu(i, "degree", ev.target.value)}
                />
                <Input
                  label="Field of Study"
                  placeholder="e.g. Biotechnology"
                  value={e.field ?? ""}
                  onChange={(ev) => updateEdu(i, "field", ev.target.value)}
                />
                <Input
                  label="Year"
                  type="number"
                  placeholder="2020"
                  value={e.year ?? ""}
                  onChange={(ev) => updateEdu(i, "year", ev.target.value ? Number(ev.target.value) : "")}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-grey-dark">Professional Experience</h2>
          <Button variant="outline" size="sm" onClick={addExp}>Add Experience</Button>
        </div>
        {exp.length === 0 && (
          <p className="text-sm text-brand-grey">No experience entries yet.</p>
        )}
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="p-4 border border-brand-grey-light rounded-lg relative">
              <button
                onClick={() => removeExp(i)}
                className="absolute top-2 right-2 text-brand-grey hover:text-red-600 text-lg"
              >
                &times;
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Company"
                  placeholder="e.g. Afflatus Consulting Group"
                  value={e.company ?? ""}
                  onChange={(ev) => updateExp(i, "company", ev.target.value)}
                />
                <Input
                  label="Role / Title"
                  placeholder="e.g. Senior Trainer"
                  value={e.role ?? ""}
                  onChange={(ev) => updateExp(i, "role", ev.target.value)}
                />
                <Input
                  label="From"
                  placeholder="e.g. Jan 2020"
                  value={e.from ?? ""}
                  onChange={(ev) => updateExp(i, "from", ev.target.value)}
                />
                <Input
                  label="To"
                  placeholder="e.g. Present"
                  value={e.to ?? ""}
                  onChange={(ev) => updateExp(i, "to", ev.target.value)}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Description
                </label>
                <textarea
                  className="form-input min-h-[60px] resize-y"
                  placeholder="Describe your responsibilities and achievements..."
                  value={e.description ?? ""}
                  onChange={(ev) => updateExp(i, "description", ev.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function SocialTab({
  profile,
  update,
}: {
  profile: TrainerProfile;
  update: <K extends keyof TrainerProfile>(key: K, value: TrainerProfile[K]) => void;
}) {
  const links = profile.socialLinks ?? {};

  const updateLink = (key: keyof SocialLinks, val: string) => {
    update("socialLinks", { ...links, [key]: val });
  };

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Social & Professional Links</h2>
        <div className="space-y-4">
          <Input
            label="LinkedIn"
            placeholder="https://linkedin.com/in/yourname"
            value={links.linkedin ?? ""}
            onChange={(e) => updateLink("linkedin", e.target.value)}
          />
          <Input
            label="Twitter / X"
            placeholder="https://twitter.com/yourhandle"
            value={links.twitter ?? ""}
            onChange={(e) => updateLink("twitter", e.target.value)}
          />
          <Input
            label="GitHub"
            placeholder="https://github.com/yourname"
            value={links.github ?? ""}
            onChange={(e) => updateLink("github", e.target.value)}
          />
          <Input
            label="YouTube"
            placeholder="https://youtube.com/@yourchannel"
            value={links.youtube ?? ""}
            onChange={(e) => updateLink("youtube", e.target.value)}
          />
          <Input
            label="Personal Website"
            placeholder="https://yoursite.com"
            value={profile.websiteUrl ?? ""}
            onChange={(e) => update("websiteUrl", e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">Contact</h2>
        <Input
          label="Public Contact Email"
          placeholder="trainer@example.com"
          value={profile.contactEmail ?? ""}
          onChange={(e) => update("contactEmail", e.target.value)}
          hint="Displayed on your public profile for inquiries"
        />
      </Card>
    </>
  );
}
