"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantAdminBurgerHeader } from "@/components/ui/tenant-admin-burger-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

type PendingUser = {
  id: string;
  email: string;
  name: string;
  userType: string | null;
  createdAt: string;
};

export default function TenantAffiliationsPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { tenant, branding, isLoading: tenantLoading } = useTenant();
  const academyName = branding?.appName || tenant?.name || "Academy";

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError("");
    apiFetch(`/profile/org-affiliation-requests?tenantId=${tenant.id}`)
      .then((r) => r.json())
      .then(setPending)
      .catch(() => setError("Failed to load affiliation requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenant?.id) load();
  }, [tenant?.id]);

  const approve = (userId: string) => {
    setActingId(userId);
    apiFetch(`/profile/users/${userId}/org-approve`, { method: "PATCH" })
      .then(() => load())
      .catch(() => setError("Failed to approve."))
      .finally(() => setActingId(null));
  };

  const reject = (userId: string) => {
    setActingId(userId);
    apiFetch(`/profile/users/${userId}/org-reject`, { method: "PATCH" })
      .then(() => load())
      .catch(() => setError("Failed to reject."))
      .finally(() => setActingId(null));
  };

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading requests...</p>
        </div>
      </div>
    );
  }

  const userTypeLabel = (ut: string | null) => {
    if (ut === "TRAINER") return "Trainer";
    if (ut === "COMPANY_ADMIN") return "Company Admin";
    return "Trainee";
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TenantAdminBurgerHeader
        slug={slug}
        academyName={academyName}
        logoUrl={tenant?.logoUrl}
        trailing={
          <Link href={`/${slug}/admin`}>
            <Button variant="ghost" size="sm">Back to Admin</Button>
          </Link>
        }
      />

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Affiliation Requests
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">
          Users requesting to join your organization. Approve to grant them access.
        </p>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <Card>
          <CardHeader>
            <CardTitle>Pending ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm">
                No pending affiliation requests.
              </p>
            ) : (
              <ul className="space-y-4">
                {pending.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-[var(--color-bg-secondary)]/50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{u.name || "\u2014"}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{u.email}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {userTypeLabel(u.userType)} &middot; Requested{" "}
                        {new Date(u.createdAt).toLocaleDateString()}
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
