"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { authShellNavItems } from "@/lib/nav/burger-nav";
import { apiFetch } from "@/lib/api";

export default function VerifyCertificatePage() {
  const params = useParams();
  const { t } = useI18n();
  const shellNav = useMemo(() => authShellNavItems(t), [t]);
  const code = params?.code as string;
  const [cert, setCert] = useState<{
    verifyCode: string;
    grade?: string;
    issuedAt: string;
    enrollment?: { path?: { name: string; domain?: { name: string } | string } } | null;
    courseEnrollment?: { course?: { title: string; domain?: { name: string } | string } } | null;
    template?: { templateName: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    apiFetch(`/certificates/verify/${code}`)
      .then((r) => r.json())
      .then(setCert)
      .catch(() => setCert(null))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <AppBurgerHeader
        borderClassName="border-0"
        headerClassName="absolute top-6 left-6 right-6 z-10 flex justify-between items-center gap-3"
        logoHref="/"
        logo={<LearnLogo size="md" variant="purple" />}
        items={shellNav}
      />
      <div className="flex-1 flex flex-col items-center justify-center">
        <Card className="max-w-md w-full mt-8 p-8 text-center">
          {loading ? (
            <p className="text-brand-grey">{t("certificate.verifying")}</p>
          ) : cert ? (
            <>
              <div className="text-4xl mb-4">🎓</div>
              <h1 className="text-xl font-bold text-brand-grey-dark mb-2">{t("certificate.verified")}</h1>
              <p className="text-brand-grey-dark font-medium">
                {cert.courseEnrollment?.course?.title ?? cert.enrollment?.path?.name ?? t("certificate.learningPath")}
              </p>
              <p className="text-brand-grey text-sm mt-2">{cert.template?.templateName}</p>
              {cert.grade && <p className="text-brand-purple font-semibold mt-2">{t("certificate.grade")}: {cert.grade}</p>}
              <p className="text-brand-grey text-xs mt-4">{t("certificate.issued")} {new Date(cert.issuedAt).toLocaleDateString()}</p>
              <p className="text-brand-grey text-xs mt-1">{t("certificate.code")}: {cert.verifyCode}</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-xl font-bold text-brand-grey-dark">{t("certificate.notFound")}</h1>
              <p className="text-brand-grey text-sm mt-2">{t("certificate.invalidOrExpired")}</p>
            </>
          )}
        </Card>
        <Link href="/" className="mt-6">
          <Button variant="outline">{t("certificate.backToHome")}</Button>
        </Link>
      </div>
    </div>
  );
}
