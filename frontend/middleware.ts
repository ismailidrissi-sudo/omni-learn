import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_NAV_ANY_PERMISSIONS, hasAnyPermission, parsePermissionsFromToken } from "@/lib/permissions";

const PROTECTED_PATHS = [
  "/learn",
  "/admin",
  "/checkout",
  "/complete-profile",
  "/trainer",
  "/referrals",
];

const PUBLIC_PATHS = [
  "/",
  "/signin",
  "/signup",
  "/verify-email",
  "/discover",
  "/forum",
  "/about",
  "/terms",
  "/privacy",
  "/what-we-offer",
  "/press",
  "/contact",
  "/modern-slavery",
  "/content",
  "/course",
  "/micro",
  "/certificates/verify",
];

/** Match /:tenant/admin or /:tenant/admin/... (tenant-scoped admin) */
function isTenantAdminPath(pathname: string): boolean {
  return /^\/[^/]+\/admin(\/|$)/.test(pathname);
}

function isProtected(pathname: string): boolean {
  if (isTenantAdminPath(pathname)) return true;
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("omnilearn_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signinUrl);
  }

  const isGlobalAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isGlobalAdmin) {
    const perms = parsePermissionsFromToken(token);
    if (!hasAnyPermission(perms, [...ADMIN_NAV_ANY_PERMISSIONS])) {
      return NextResponse.redirect(new URL("/learn", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)",
  ],
};
