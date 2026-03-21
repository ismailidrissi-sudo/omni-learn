import type { BurgerNavItem } from "@/components/ui/app-burger-header";

type T = (key: string) => string;

type UserLike = { isAdmin?: boolean; planId?: string; trainerApprovedAt?: string | null } | null | undefined;

export function trainersDirectoryNavItems(t: T, user: UserLike): BurgerNavItem[] {
  const items = globalLearnerNavItems(t, user);
  const trainerIdx = items.findIndex((i) => i.href === "/trainer");
  const extra: BurgerNavItem = { href: "/trainers", label: "Trainers", match: "exact" };
  if (trainerIdx >= 0) {
    return [...items.slice(0, trainerIdx + 1), extra, ...items.slice(trainerIdx + 1)];
  }
  return [...items, extra];
}

export function globalLearnerNavItems(t: T, user: UserLike): BurgerNavItem[] {
  const items: BurgerNavItem[] = [
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/referrals", label: "Referrals", match: "prefix" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/profile", label: "Profile", match: "exact" },
  ];
  if (user?.isAdmin || user?.planId === "NEXUS") {
    items.push({
      href: "/admin/nexus",
      label: "My Company",
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  items.push({
    href: "/admin",
    label: t("nav.admin"),
    match: "prefix",
    inactiveVariant: "outline",
  });
  return items;
}

/** Discover page: slightly shorter labels are OK — same destinations */
export function discoverNavItems(t: T, user: UserLike): BurgerNavItem[] {
  const items: BurgerNavItem[] = [
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/referrals", label: "Referrals", match: "prefix" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/profile", label: "Profile", match: "exact" },
  ];
  if (user?.isAdmin || user?.planId === "NEXUS") {
    items.push({
      href: "/admin/nexus",
      label: "My Company",
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  items.push({
    href: "/admin",
    label: t("nav.admin"),
    match: "prefix",
    inactiveVariant: "outline",
  });
  return items;
}

export function adminHubNavItems(t: T): BurgerNavItem[] {
  return [
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/admin/paths", label: t("nav.paths"), match: "exact" },
    { href: "/admin/domains", label: "Domains", match: "exact" },
    { href: "/admin/content", label: t("nav.content"), match: "exact" },
    { href: "/admin/certificates", label: "Certificates", match: "exact" },
    { href: "/admin/company", label: t("nav.company"), match: "exact" },
    { href: "/admin/pages", label: "Pages", match: "exact" },
    { href: "/admin/analytics", label: t("nav.analytics"), match: "exact" },
    { href: "/admin/referrals", label: "Referrals", match: "exact" },
    { href: "/admin/provisioning", label: t("nav.scim"), match: "exact" },
    { href: "/admin/trainers", label: "Trainer requests", match: "exact" },
    { href: "/admin/company-admins", label: "Company Admin requests", match: "exact" },
    { href: "/admin/email", label: "Email ops", match: "exact" },
    { href: "/admin/settings/email", label: "Email", match: "exact" },
    { href: "/admin/settings/content-suggestions", label: "Content suggestions", match: "exact" },
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
  ];
}

export function nexusCompanyNavItems(t: T): BurgerNavItem[] {
  return [
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/admin/nexus", label: "My Company", match: "exact" },
    { href: "/admin/company", label: t("nav.company"), match: "exact" },
    { href: "/admin/trainers", label: "Trainer requests", match: "exact" },
    { href: "/admin/company-admins", label: "Company Admin requests", match: "exact" },
    { href: "/admin/settings/email", label: "Email", match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/admin/paths", label: t("nav.admin"), match: "prefix", inactiveVariant: "outline" },
  ];
}

export function trainerNavItemsApproved(t: T): BurgerNavItem[] {
  return [
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/trainer/profile", label: "My Profile", match: "exact" },
    { href: "/admin/paths", label: t("nav.paths"), match: "exact" },
    { href: "/admin/content", label: t("nav.content"), match: "exact" },
    { href: "/admin/company", label: t("nav.company"), match: "exact" },
    { href: "/admin/pages", label: "Pages", match: "exact" },
    { href: "/admin/analytics", label: t("nav.analytics"), match: "exact" },
    { href: "/admin/provisioning", label: t("nav.scim"), match: "exact" },
    { href: "/admin/trainers", label: "Trainer requests", match: "exact" },
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
  ];
}

export function trainerNavItemsGuest(t: T): BurgerNavItem[] {
  return [
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/referrals", label: "Referrals", match: "prefix" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
  ];
}

export function tenantLearnerNavItems(t: T, slug: string, user: UserLike): BurgerNavItem[] {
  const base = `/${slug}`;
  const items: BurgerNavItem[] = [
    { href: `${base}/learn`, label: t("tenant.learn"), match: "exact" },
    { href: `${base}/discover`, label: t("tenant.discover"), match: "exact" },
    { href: `${base}/certificates`, label: t("certificate.myCertificates"), match: "exact" },
    { href: `${base}/forum`, label: t("tenant.forum"), match: "prefix" },
  ];
  if (user?.isAdmin || user?.planId === "NEXUS" || user?.trainerApprovedAt) {
    items.push({ href: `${base}/admin`, label: t("tenant.admin"), match: "prefix" });
  }
  return items;
}

/** Learner shell navigation. On tenant routes (`/[tenant]/...`), pass `tenantSlug` so links stay under the academy. */
export function learnerNavItems(t: T, user: UserLike, tenantSlug?: string): BurgerNavItem[] {
  if (tenantSlug) return tenantLearnerNavItems(t, tenantSlug, user);
  return globalLearnerNavItems(t, user);
}

/** Tenant admin subpages: learning app + admin home */
export function tenantAdminNavItems(t: T, slug: string): BurgerNavItem[] {
  const base = `/${slug}`;
  return [
    { href: base, label: "Academy home", match: "exact" },
    { href: `${base}/learn`, label: t("tenant.backToLearning"), match: "exact" },
    { href: `${base}/discover`, label: t("tenant.discover"), match: "exact" },
    { href: `${base}/certificates`, label: t("certificate.myCertificates"), match: "exact" },
    { href: `${base}/forum`, label: t("tenant.forum"), match: "prefix" },
    { href: `${base}/admin`, label: t("adminTenant.administration"), match: "exact" },
  ];
}

/** Sign-in, sign-up, verify-email, static CMS pages */
export function authShellNavItems(t: T): BurgerNavItem[] {
  return [
    { href: "/", label: "Home", match: "exact" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/signup", label: t("landing.nav.signUp"), match: "exact" },
    { href: "/signin", label: t("landing.nav.signIn"), match: "exact" },
  ];
}

export function tenantAuthShellNavItems(t: T, slug: string): BurgerNavItem[] {
  const base = `/${slug}`;
  return [
    { href: base, label: "Academy home", match: "exact" },
    { href: `${base}/learn`, label: t("tenant.learn"), match: "exact" },
    { href: `${base}/discover`, label: t("tenant.discover"), match: "exact" },
    { href: `${base}/signup`, label: t("landing.nav.signUp"), match: "exact" },
    { href: `${base}/signin`, label: t("landing.nav.signIn"), match: "exact" },
  ];
}
