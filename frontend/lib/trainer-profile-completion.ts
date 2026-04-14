/**
 * Weighted profile completion (0–100) per product spec.
 */
export type TrainerProfileLike = {
  photoUrl?: string;
  bio?: string;
  experience?: unknown[];
  education?: unknown[];
  certifications?: unknown[];
  expertiseDomains?: unknown[];
  specializations?: unknown[];
  languages?: unknown[];
  socialLinks?: { linkedin?: string };
  availability?: Record<string, unknown> | null;
};

export function computeProfileCompletion(profile: TrainerProfileLike): { pct: number; missing: string[] } {
  const missing: string[] = [];
  let score = 0;

  const add = (cond: boolean, pts: number, label: string) => {
    if (cond) score += pts;
    else missing.push(label);
  };

  add(!!profile.photoUrl?.trim(), 15, "Photo");
  add(!!profile.bio?.trim(), 15, "Bio");
  add((profile.experience?.length ?? 0) > 0, 15, "Experience");
  add((profile.education?.length ?? 0) > 0, 10, "Education");
  add((profile.certifications?.length ?? 0) > 0, 10, "Certifications");

  const domains = profile.expertiseDomains ?? profile.specializations;
  add(Array.isArray(domains) && domains.length > 0, 10, "Expertise");

  add((profile.languages?.length ?? 0) > 0, 5, "Languages");
  add(!!profile.socialLinks?.linkedin?.trim(), 10, "LinkedIn");

  const avail = profile.availability;
  if (!avail) {
    add(false, 10, "Availability");
  } else {
    const a = avail as { joursDispo?: unknown[]; modalites?: unknown[]; zones?: unknown[] };
    const hasAvailability =
      (Array.isArray(a.joursDispo) && a.joursDispo.length > 0) ||
      (Array.isArray(a.modalites) && a.modalites.length > 0) ||
      (Array.isArray(a.zones) && a.zones.length > 0);
    add(hasAvailability, 10, "Availability");
  }

  return { pct: Math.min(100, Math.round(score)), missing };
}
