"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { apiFetch, API_URL, apiAbsoluteMediaUrl } from "@/lib/api";
import { formatUserCount } from "@/lib/format-user-count";

type CertType = "course" | "path";

type PublicCertificateVerification = {
  verifyCode: string;
  grade?: string | null;
  issuedAt: string;
  certType: CertType;
  templateName?: string | null;
  recipientName: string;
  recipientImageUrl: string | null;
  title: string;
  description: string | null;
  domainName: string | null;
  thumbnailUrl: string | null;
  contentCount: number;
  durationMinutes: number | null;
  pdfPreviewUrl: string;
  pdfDownloadUrl: string;
};

type PlatformStats = {
  userCount: number;
};

function rewritePdfUrlToApiOrigin(url: string): string {
  try {
    const u = new URL(url);
    if (!u.pathname.includes("/certificates/") || !u.pathname.endsWith("/download")) {
      return url;
    }
    const api = new URL(API_URL);
    u.protocol = api.protocol;
    u.host = api.host;
    return u.toString();
  } catch {
    return url;
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function VerifyCertificatePage() {
  const params = useParams();
  const { t, locale } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const code = params?.code as string;
  const [cert, setCert] = useState<PublicCertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/certificates/verify/${encodeURIComponent(code)}`).then((r) => r.json()),
      apiFetch("/company/stats")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([payload, st]) => {
        if (payload && typeof payload === "object" && "verifyCode" in payload) {
          setCert(payload as PublicCertificateVerification);
        } else {
          setCert(null);
        }
        setStats(
          st && typeof st === "object" && typeof (st as PlatformStats).userCount === "number"
            ? (st as PlatformStats)
            : null,
        );
      })
      .catch(() => {
        setCert(null);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const previewSrc = cert ? rewritePdfUrlToApiOrigin(cert.pdfPreviewUrl) : "";
  const downloadHref = cert ? rewritePdfUrlToApiOrigin(cert.pdfDownloadUrl) : "";

  const handlePreviewClick = useCallback(() => {
    if (downloadHref) window.open(downloadHref, "_blank", "noopener,noreferrer");
  }, [downloadHref]);

  const formatDuration = (mins: number | null) => {
    if (mins == null || mins <= 0) return null;
    if (mins >= 60) {
      const h = Math.round((mins / 60) * 10) / 10;
      const key = h % 1 === 0 ? Math.round(h) : h;
      return t("certificate.verifyPage.durationHours", { hours: key });
    }
    return t("certificate.verifyPage.durationMinutes", { minutes: mins });
  };

  const userCount = stats?.userCount ?? 0;
  const displayCount = userCount > 0 ? formatUserCount(userCount) : "2,000,000+";

  const issuedDate =
    cert?.issuedAt &&
    new Date(cert.issuedAt).toLocaleDateString(locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const contentLabel =
    cert &&
    (cert.certType === "course"
      ? t("certificate.verifyPage.lessonsCount", { count: cert.contentCount })
      : t("certificate.verifyPage.stepsCount", { count: cert.contentCount }));

  const durationLabel = cert ? formatDuration(cert.durationMinutes) : null;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0f0f12] flex flex-col">
      <AppBurgerHeader
        borderClassName="border-0"
        headerClassName="absolute top-6 left-6 right-6 z-10 flex justify-between items-center gap-3"
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={shellNav}
      />

      <div className="flex-1 flex flex-col items-center px-4 pt-24 pb-16">
        <Card className="w-full max-w-2xl shadow-lg border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161d] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <p className="text-brand-grey">{t("certificate.verifying")}</p>
            </div>
          ) : cert ? (
            <div className="text-left">
              <div className="px-6 pt-8 pb-6 border-b border-gray-100 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#2D9C6C] mb-2">
                  {t("certificate.verifyPage.certificateOfCompletion")}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-brand-grey-dark dark:text-white leading-tight">
                  {cert.title}
                </h1>
                <p className="mt-3 text-sm md:text-base text-brand-grey dark:text-gray-400 leading-relaxed">
                  {cert.description ?? t("certificate.verifyPage.noDescription")}
                </p>
                {cert.domainName && (
                  <p className="mt-2 text-sm font-medium text-brand-purple dark:text-brand-purple-light">
                    {cert.domainName}
                  </p>
                )}
              </div>

              <div className="px-6 py-5 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-white/10 bg-[#f8fdf9] dark:bg-[#0f1f18]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D9C6C]/15 text-[#1f6f4d] dark:text-[#5ee9b5] px-3 py-1 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2D9C6C]" aria-hidden />
                  {t("certificate.verifyPage.credentialsVerified")}
                </span>
                <div className="text-sm">
                  <span className="text-brand-grey dark:text-gray-500">
                    {t("certificate.verifyPage.verificationId")}:{" "}
                  </span>
                  <span className="font-mono font-semibold text-brand-grey-dark dark:text-gray-200">
                    {cert.verifyCode}
                  </span>
                </div>
              </div>

              <div className="px-6 py-6 border-b border-gray-100 dark:border-white/10">
                <p className="text-xs font-medium text-brand-grey mb-2">
                  {t("certificate.verifyPage.certificatePreview")}
                </p>
                <button
                  type="button"
                  onClick={handlePreviewClick}
                  className="w-full rounded-lg border-2 border-gray-200 dark:border-white/15 overflow-hidden bg-gray-100 dark:bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D9C6C] transition hover:border-[#2D9C6C]/50"
                  aria-label={t("certificate.verifyPage.clickToDownload")}
                >
                  <div className="aspect-[1.414/1] w-full max-h-[420px]">
                    <iframe
                      title={t("certificate.verifyPage.certificatePreview")}
                      src={previewSrc}
                      className="w-full h-full border-0 pointer-events-none"
                    />
                  </div>
                  <div className="py-2.5 text-center text-sm font-medium text-[#2D9C6C]">
                    {t("certificate.verifyPage.clickToDownload")}
                  </div>
                </button>
              </div>

              <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100 dark:border-white/10">
                <div className="flex-shrink-0">
                  {cert.recipientImageUrl ? (
                    <img
                      src={cert.recipientImageUrl}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-md dark:border-white/10"
                    />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-full bg-brand-purple text-white flex items-center justify-center text-lg font-bold border-2 border-white shadow-md dark:border-white/10"
                      aria-hidden
                    >
                      {initialsFromName(cert.recipientName)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-grey uppercase tracking-wide">
                    {t("certificate.verifyPage.issuedTo")}
                  </p>
                  <p className="text-lg font-semibold text-brand-grey-dark dark:text-white">{cert.recipientName}</p>
                  {issuedDate && (
                    <p className="text-xs text-brand-grey mt-0.5">
                      {t("certificate.verifyPage.issuedOn", { date: issuedDate })}
                    </p>
                  )}
                  {cert.grade && (
                    <p className="text-sm text-brand-purple font-medium mt-1">
                      {t("certificate.grade")}: {cert.grade}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 flex gap-4 border-b border-gray-100 dark:border-white/10">
                <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  {cert.thumbnailUrl ? (
                    <img
                      src={apiAbsoluteMediaUrl(cert.thumbnailUrl) ?? cert.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">📚</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-brand-grey uppercase tracking-wide mb-1">
                    {cert.certType === "course"
                      ? t("certificate.verifyPage.fromCourse")
                      : t("certificate.verifyPage.fromPath")}
                  </p>
                  <p className="font-semibold text-brand-grey-dark dark:text-white line-clamp-2">{cert.title}</p>
                  <p className="text-sm text-brand-grey mt-1">
                    {[contentLabel, durationLabel].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="px-6 py-6 bg-gradient-to-b from-[#f0fdf4]/80 to-transparent dark:from-[#0f1f18]/50">
                <p className="text-center text-sm md:text-base text-brand-grey-dark dark:text-gray-200 leading-relaxed">
                  <span className="font-semibold text-[#059669] dark:text-[#34d399]">{cert.recipientName}</span>{" "}
                  {t("certificate.verifyPage.socialProofAfterName", { count: displayCount })}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-xl font-bold text-brand-grey-dark dark:text-white">{t("certificate.notFound")}</h1>
              <p className="text-brand-grey text-sm mt-2">{t("certificate.invalidOrExpired")}</p>
            </div>
          )}
        </Card>

        <Link href="/" className="mt-8">
          <Button variant="outline">{t("certificate.backToHome")}</Button>
        </Link>
      </div>
    </div>
  );
}
