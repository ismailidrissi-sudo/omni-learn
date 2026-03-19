"use client";

import { useState, useEffect, useMemo } from "react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
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
  const adminNav = useMemo(() => adminHubNavItems(t), [t]);
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
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

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
