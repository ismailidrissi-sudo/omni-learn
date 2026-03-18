"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";
import { downloadCertificatePdf, type CertificateData } from "@/lib/certificate-pdf";

interface CertRecord {
  id: string;
  verifyCode: string;
  grade?: string | null;
  issuedAt: string;
  template?: {
    id: string;
    templateName: string;
    themeConfig: string | Record<string, unknown>;
    elementsConfig: string | Record<string, unknown>;
    signatories: string | Array<{ name: string; title: string }>;
    domain?: { id: string; name: string; color: string; icon?: string };
  };
  enrollment?: {
    id: string;
    completedAt?: string;
    path?: {
      name: string;
      domain?: { name: string; icon?: string; color?: string };
      _count?: { steps: number };
    };
  } | null;
  courseEnrollment?: {
    id: string;
    completedAt?: string;
    course?: {
      title: string;
      domain?: { name: string; icon?: string; color?: string };
      _count?: { courseSections: number };
    };
  } | null;
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return (val as T) ?? fallback;
}

export default function UserCertificatesPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const router = useRouter();
  const { t } = useI18n();
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const { user, loading: userLoading } = useUser();

  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const academyName = branding?.appName || tenant?.name || "Academy";

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/${slug}/signin?redirect=/${slug}/certificates`);
    }
  }, [userLoading, user, router, slug]);

  const loadCerts = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    apiFetch(`/certificates/user/${user.id}`)
      .then((r) => r.json())
      .then((data) => setCerts(Array.isArray(data) ? data : []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const handleDownload = async (cert: CertRecord) => {
    setDownloadingId(cert.id);
    try {
      const res = await apiFetch(`/certificates/detail/${cert.id}`);
      const detail = await res.json();

      const themeConfig = parseJson(detail.template?.themeConfig, {});
      const elementsConfig = parseJson(detail.template?.elementsConfig, {});
      const signatories = parseJson<Array<{ name: string; title: string }>>(detail.template?.signatories, []);

      const isCourseCert = detail.certType === 'course';
      const certData: CertificateData = {
        userName: detail.user?.name ?? user?.name ?? "Learner",
        pathName: isCourseCert
          ? (detail.courseEnrollment?.course?.title ?? "Course")
          : (detail.enrollment?.path?.name ?? "Learning Path"),
        domainName: isCourseCert
          ? (detail.courseEnrollment?.course?.domain?.name ?? "Domain")
          : (detail.enrollment?.path?.domain?.name ?? "Domain"),
        domainIcon: isCourseCert
          ? detail.courseEnrollment?.course?.domain?.icon
          : detail.enrollment?.path?.domain?.icon,
        verifyCode: detail.verifyCode,
        grade: detail.grade,
        issuedAt: detail.issuedAt,
        totalLearningMinutes: detail.totalLearningMinutes,
        themeConfig,
        elementsConfig,
        signatories,
        tenantName: academyName,
        certType: isCourseCert ? 'course' : 'path',
      };

      downloadCertificatePdf(certData);
    } catch {
      // silently fail
    } finally {
      setDownloadingId(null);
    }
  };

  if (tenantLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}/learn`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("certificate.myCertificates")}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("certificate.myCertificates")}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            {t("certificate.myCertificatesDescription")}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-5 bg-[var(--color-bg-secondary)] rounded w-2/3 mb-3" />
                <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-1/3 mb-2" />
                <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : certs.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              {t("certificate.noCertificatesYet")}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {t("certificate.completePath")}
            </p>
            <Link href={`/${slug}/learn`}>
              <Button>{t("certificate.startLearning")}</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certs.map((cert) => {
              const theme = parseJson<Record<string, string>>(
                cert.template?.themeConfig,
                { primary_color: "#059669", secondary_color: "#10b981" },
              );
              const isCourseCert = !!cert.courseEnrollment;
              const domainName = isCourseCert
                ? (cert.courseEnrollment?.course?.domain?.name ?? cert.template?.domain?.name ?? "")
                : (cert.enrollment?.path?.domain?.name ?? cert.template?.domain?.name ?? "");
              const certTitle = isCourseCert
                ? (cert.courseEnrollment?.course?.title ?? "")
                : (cert.enrollment?.path?.name ?? "");
              const itemCount = isCourseCert
                ? cert.courseEnrollment?.course?._count?.courseSections
                : cert.enrollment?.path?._count?.steps;
              const isDownloading = downloadingId === cert.id;

              return (
                <Card key={cert.id} className="p-0 overflow-hidden group hover:shadow-lg transition-shadow">
                  <div
                    className="h-2"
                    style={{
                      background: `linear-gradient(to right, ${theme.primary_color ?? "#059669"}, ${theme.secondary_color ?? "#10b981"})`,
                    }}
                  />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl shrink-0">
                        {cert.template?.domain?.icon ?? "🎓"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                          {certTitle}
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {domainName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {isCourseCert && (
                        <Badge variant="pulsar">{t("certificate.course")}</Badge>
                      )}
                      {cert.grade && (
                        <Badge color={theme.accent_color}>{cert.grade}</Badge>
                      )}
                      <Badge variant="stardust">
                        {new Date(cert.issuedAt).toLocaleDateString()}
                      </Badge>
                      {!!itemCount && (
                        <Badge variant="pulsar">
                          {itemCount} {isCourseCert ? t("certificate.sections") : t("certificate.steps")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[var(--color-bg-secondary)]">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(cert)}
                        disabled={isDownloading}
                        className="flex-1"
                      >
                        {isDownloading ? t("certificate.generating") : t("certificate.downloadPdf")}
                      </Button>
                      <Link href={`/certificates/verify/${cert.verifyCode}`} target="_blank">
                        <Button variant="outline" size="sm">
                          {t("certificate.verify")}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
