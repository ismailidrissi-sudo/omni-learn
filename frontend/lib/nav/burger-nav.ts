import type { BurgerNavItem } from "@/components/ui/app-burger-header";
import { ADMIN_NAV_ANY_PERMISSIONS, hasAnyPermission } from "@/lib/permissions";

type T = (key: string) => string;

type UserLike = {
  isAdmin?: boolean;
  planId?: string;
  trainerApprovedAt?: string | null;
  permissions?: string[];
} | null | undefined;

function showAdminNav(user: UserLike): boolean {
  if (user?.isAdmin) return true;
  return hasAnyPermission(user?.permissions, [...ADMIN_NAV_ANY_PERMISSIONS]);
}

export function trainersDirectoryNavItems(t: T, user: UserLike): BurgerNavItem[] {
  const items = globalLearnerNavItems(t, user);
  const trainerIdx = items.findIndex((i) => i.href === "/trainer");
  const extra: BurgerNavItem = { href: "/trainers", label: t("admin.sectionTrainers"), match: "exact" };
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
    { href: "/referrals", label: t("admin.sectionReferrals"), match: "prefix" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/profile", label: t("profile.editProfile"), match: "exact" },
  ];
  if (user?.isAdmin || user?.planId === "NEXUS") {
    items.push({
      href: "/admin/nexus",
      label: t("admin.sectionMyCompany"),
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  if (showAdminNav(user)) {
    items.push({
      href: "/admin/dashboard",
      label: t("nav.admin"),
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  return items;
}

/** Discover page: slightly shorter labels are OK — same destinations */
export function discoverNavItems(t: T, user: UserLike): BurgerNavItem[] {
  const items: BurgerNavItem[] = [
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/referrals", label: t("admin.sectionReferrals"), match: "prefix" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/profile", label: t("profile.editProfile"), match: "exact" },
  ];
  if (user?.isAdmin || user?.planId === "NEXUS") {
    items.push({
      href: "/admin/nexus",
      label: t("admin.sectionMyCompany"),
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  if (showAdminNav(user)) {
    items.push({
      href: "/admin/dashboard",
      label: t("nav.admin"),
      match: "prefix",
      inactiveVariant: "outline",
    });
  }
  return items;
}

export function adminHubNavItems(t: T): BurgerNavItem[] {
  return [
    { href: "/admin/dashboard", label: t("admin.sectionDashboard"), match: "exact" },
    { href: "/admin/approvals", label: t("admin.sectionApprovals"), match: "exact" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/admin/paths", label: t("admin.sectionPaths"), match: "exact" },
    { href: "/admin/domains", label: t("admin.sectionDomains"), match: "exact" },
    { href: "/admin/content", label: t("admin.sectionContent"), match: "exact" },
    { href: "/admin/certificates", label: t("admin.sectionCertificates"), match: "exact" },
    { href: "/admin/company", label: t("admin.sectionCompany"), match: "exact" },
    { href: "/admin/pages", label: t("admin.sectionPages"), match: "exact" },
    { href: "/admin/analytics", label: t("admin.sectionAnalytics"), match: "exact" },
    { href: "/admin/referrals", label: t("admin.sectionReferrals"), match: "exact" },
    { href: "/admin/provisioning", label: t("admin.sectionProvisioning"), match: "exact" },
    { href: "/admin/trainers", label: t("admin.sectionTrainers"), match: "exact" },
    { href: "/admin/company-admins", label: t("admin.sectionCompanyAdmins"), match: "exact" },
    { href: "/admin/email", label: t("admin.sectionEmailOps"), match: "exact" },
    { href: "/admin/settings/email", label: t("admin.sectionEmail"), match: "exact" },
    { href: "/admin/settings/content-suggestions", label: t("admin.sectionContentSuggestions"), match: "exact" },
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
  ];
}

export function nexusCompanyNavItems(t: T): BurgerNavItem[] {
  return [
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/admin/nexus", label: t("admin.sectionMyCompany"), match: "exact" },
    { href: "/admin/company", label: t("admin.sectionCompany"), match: "exact" },
    { href: "/admin/trainers", label: t("admin.sectionTrainers"), match: "exact" },
    { href: "/admin/company-admins", label: t("admin.sectionCompanyAdmins"), match: "exact" },
    { href: "/admin/settings/email", label: t("admin.sectionEmail"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/admin/paths", label: t("admin.sectionPaths"), match: "prefix", inactiveVariant: "outline" },
  ];
}

export function trainerNavItemsApproved(t: T): BurgerNavItem[] {
  return [
    { href: "/trainer", label: t("nav.trainer"), match: "prefix" },
    { href: "/trainer/profile", label: t("profile.editProfile"), match: "exact" },
    { href: "/admin/paths", label: t("admin.sectionPaths"), match: "exact" },
    { href: "/admin/content", label: t("admin.sectionContent"), match: "exact" },
    { href: "/admin/company", label: t("admin.sectionCompany"), match: "exact" },
    { href: "/admin/pages", label: t("admin.sectionPages"), match: "exact" },
    { href: "/admin/analytics", label: t("admin.sectionAnalytics"), match: "exact" },
    { href: "/admin/provisioning", label: t("admin.sectionProvisioning"), match: "exact" },
    { href: "/admin/trainers", label: t("admin.sectionTrainers"), match: "exact" },
    { href: "/learn", label: t("nav.myProgress"), match: "exact" },
    { href: "/forum", label: t("nav.forums"), match: "prefix" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
  ];
}

export function trainerNavItemsGuest(t: T): BurgerNavItem[] {
  return [
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/referrals", label: t("admin.sectionReferrals"), match: "prefix" },
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
  if (showAdminNav(user) || user?.trainerApprovedAt) {
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
    { href: base, label: t("tenant.academyHome"), match: "exact" },
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
    { href: "/", label: t("nav.startLearning"), match: "exact" },
    { href: "/discover", label: t("nav.discover"), match: "exact" },
    { href: "/learn", label: t("nav.learn"), match: "exact" },
    { href: "/signup", label: t("landing.nav.signUp"), match: "exact" },
    { href: "/signin", label: t("landing.nav.signIn"), match: "exact" },
  ];
}

export function tenantAuthShellNavItems(t: T, slug: string): BurgerNavItem[] {
  const base = `/${slug}`;
  return [
    { href: base, label: t("tenant.academyHome"), match: "exact" },
    { href: `${base}/learn`, label: t("tenant.learn"), match: "exact" },
    { href: `${base}/discover`, label: t("tenant.discover"), match: "exact" },
    { href: `${base}/signup`, label: t("landing.nav.signUp"), match: "exact" },
    { href: `${base}/signin`, label: t("landing.nav.signIn"), match: "exact" },
  ];
}
