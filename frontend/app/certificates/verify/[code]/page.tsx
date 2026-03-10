"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VerifyCertificatePage() {
  const params = useParams();
  const { t } = useI18n();
  const code = params?.code as string;
  const [cert, setCert] = useState<{
    verifyCode: string;
    grade?: string;
    issuedAt: string;
    enrollment?: { path?: { name: string; domain?: { name: string } | string } };
    template?: { templateName: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    fetch(`${API}/certificates/verify/${code}`)
      .then((r) => r.json())
      .then(setCert)
      .catch(() => setCert(null))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <header className="absolute top-6 left-6 right-6 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <NavToggles />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center">
        <Card className="max-w-md w-full mt-8 p-8 text-center">
          {loading ? (
            <p className="text-brand-grey">{t("certificate.verifying")}</p>
          ) : cert ? (
            <>
              <div className="text-4xl mb-4">🎓</div>
              <h1 className="text-xl font-bold text-brand-grey-dark mb-2">{t("certificate.verified")}</h1>
              <p className="text-brand-grey-dark font-medium">{cert.enrollment?.path?.name ?? t("certificate.learningPath")}</p>
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
