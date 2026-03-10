"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Log = { id: string; operation: string; resourceType: string; externalId?: string; status: string; createdAt: string };

export default function ProvisioningPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    fetch(`${API}/scim/v2/provisioning-logs`)
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="primary" size="sm">{t("nav.scim")}</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-2">{t("admin.bulkProvisioning")}</h1>
        <p className="text-brand-grey text-sm mb-6">
          {t("admin.scimDescription")}
        </p>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.provisioningLogs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-brand-grey text-sm">{t("admin.noProvisioningOps")}</p>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="flex justify-between items-center py-2 border-b border-brand-grey-light/50">
                    <div>
                      <span className="font-medium">{l.operation}</span>
                      <span className="text-brand-grey mx-2">{l.resourceType}</span>
                      {l.externalId && <span className="text-brand-grey text-sm">({l.externalId})</span>}
                    </div>
                    <Badge variant={l.status === "SUCCESS" ? "pulsar" : l.status === "FAILED" ? "stardust" : "default"}>
                      {l.status}
                    </Badge>
                    <span className="text-brand-grey text-sm">{new Date(l.createdAt).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
