"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";

type PendingAdmin = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  createdAt: string;
};

export default function AdminCompanyAdminsPage() {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    apiFetch("/profile/company-admin-requests")
      .then((r) => r.json())
      .then(setPending)
      .catch(() => setError("Failed to load company admin requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const approve = (userId: string) => {
    setActingId(userId);
    apiFetch(`/profile/users/${userId}/company-admin-approve`, { method: "PATCH" })
      .then(() => load())
      .catch(() => setError("Failed to approve."))
      .finally(() => setActingId(null));
  };

  const reject = (userId: string) => {
    setActingId(userId);
    apiFetch(`/profile/users/${userId}/company-admin-reject`, { method: "PATCH" })
      .then(() => load())
      .catch(() => setError("Failed to reject."))
      .finally(() => setActingId(null));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/domains"><Button variant="ghost" size="sm">Domains</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/certificates"><Button variant="ghost" size="sm">Certificates</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/pages"><Button variant="ghost" size="sm">Pages</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <Link href="/admin/trainers"><Button variant="ghost" size="sm">Trainer requests</Button></Link>
          <Link href="/admin/company-admins"><Button variant="primary" size="sm">Company Admin requests</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-2">Company Admin requests</h1>
        <p className="text-brand-grey text-sm mb-6">
          Users who requested company admin access. Approve to grant them organization management rights.
        </p>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <Card>
          <CardHeader>
            <CardTitle>Pending ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-brand-grey text-sm">No pending company admin requests.</p>
            ) : (
              <ul className="space-y-4">
                {pending.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-brand-grey-light/50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-brand-grey-dark">{u.name || "\u2014"}</p>
                      <p className="text-sm text-brand-grey">{u.email}</p>
                      <p className="text-xs text-brand-grey mt-1">
                        Requested {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reject(u.id)}
                        disabled={actingId !== null}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approve(u.id)}
                        disabled={actingId !== null}
                      >
                        {actingId === u.id ? "..." : "Approve"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
