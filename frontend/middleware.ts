import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function isProtected(pathname: string): boolean {
  if (PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Tenant-scoped admin: /:tenant/admin or /:tenant/admin/*
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[1] === "admin") {
    return true;
  }
  return false;
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)",
  ],
};
