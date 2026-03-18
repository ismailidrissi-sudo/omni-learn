"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { downloadCertificatePdf, type CertificateData } from "@/lib/certificate-pdf";
import { apiFetch } from "@/lib/api";

interface CompletionCelebrationProps {
  certificateId: string;
  pathName: string;
  domainName: string;
  onClose: () => void;
}

export function CompletionCelebration({
  certificateId,
  pathName,
  domainName,
  onClose,
}: CompletionCelebrationProps) {
  const { t } = useI18n();
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch(`/certificates/detail/${certificateId}`)
      .then((r) => r.json())
      .then((detail) => {
        const themeConfig = typeof detail.template?.themeConfig === "string"
          ? JSON.parse(detail.template.themeConfig)
          : detail.template?.themeConfig;
        const elementsConfig = typeof detail.template?.elementsConfig === "string"
          ? JSON.parse(detail.template.elementsConfig)
          : detail.template?.elementsConfig;
        const signatories = typeof detail.template?.signatories === "string"
          ? JSON.parse(detail.template.signatories)
          : detail.template?.signatories ?? [];

        const isCourseCert = detail.certType === 'course';
        setCertData({
          userName: detail.user?.name ?? "Learner",
          pathName: isCourseCert
            ? (detail.courseEnrollment?.course?.title ?? pathName)
            : (detail.enrollment?.path?.name ?? pathName),
          domainName: isCourseCert
            ? (detail.courseEnrollment?.course?.domain?.name ?? domainName)
            : (detail.enrollment?.path?.domain?.name ?? domainName),
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
          tenantName: detail.template?.domain?.name,
          certType: isCourseCert ? 'course' : 'path',
        });
      })
      .catch(() => setCertData(null))
      .finally(() => setLoading(false));
  }, [certificateId, pathName, domainName]);

  const handleDownload = () => {
    if (!certData) return;
    setDownloading(true);
    try {
      downloadCertificatePdf(certData);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          <Card className="max-w-lg w-full p-8 text-center relative overflow-hidden">
            {/* Confetti-like top decoration */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-400 via-green-500 to-blue-500" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-6xl mb-4"
            >
              🎓
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-[var(--color-text-primary)] mb-2"
            >
              {t("certificate.congratulations")}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[var(--color-text-secondary)] mb-1"
            >
              {t("certificate.completedPath")}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="text-lg font-semibold text-[var(--color-accent)] mb-1"
            >
              {pathName}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-[var(--color-text-secondary)] mb-6"
            >
              {domainName}
            </motion.p>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-8 w-8 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
              </div>
            ) : certData ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                {certData.grade && (
                  <p className="text-sm font-medium text-[var(--color-accent)]">
                    {t("certificate.grade")}: {certData.grade}
                  </p>
                )}

                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("certificate.code")}: {certData.verifyCode}
                </p>

                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={handleDownload} disabled={downloading}>
                    {downloading ? t("certificate.generating") : t("certificate.downloadPdf")}
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    {t("common.close")}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("certificate.earnedMessage")}
                </p>
                <Button variant="outline" onClick={onClose}>
                  {t("common.close")}
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
