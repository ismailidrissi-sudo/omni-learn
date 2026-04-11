import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_NAV_ANY_PERMISSIONS, hasAnyPermission } from "@/lib/permissions";

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

let jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array | null {
  if (jwtSecret) return jwtSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw) return null;
  jwtSecret = new TextEncoder().encode(raw);
  return jwtSecret;
}

async function verifyToken(token: string): Promise<{ omnilearn_permissions?: string[] } | null> {
  const secret = getJwtSecret();
  if (!secret) {
    // Fallback: no secret configured — degrade to base64 decode (dev mode)
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { omnilearn_permissions?: string[] };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
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
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
    const perms = Array.isArray(payload.omnilearn_permissions)
      ? payload.omnilearn_permissions
      : [];
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
