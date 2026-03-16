"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-context";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

type User = {
  id: string;
  name: string;
  email: string;
  tenantId?: string;
  planId?: string;
  trainerApprovedAt?: string | null;
  createdAt?: string;
};

export default function UserManagementPage() {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";
  const { t } = useI18n();
  const { tenant, branding, isLoading } = useTenant();

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const academyName = branding?.appName || tenant?.name || "Academy";

  const fetchUsers = () => {
    if (!tenant) return;
    setLoading(true);
    apiFetch(`/company/users?tenantId=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setError(t("adminTenant.failedToLoadUsers")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenant) fetchUsers();
  }, [tenant?.id]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setImporting(true);
    setError("");

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("email") || header.includes("name");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const importUsers = dataLines.map((line) => {
        const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        return { name: parts[0] || "", email: parts[1] || "", role: parts[2] || "LEARNER_BASIC" };
      }).filter((u) => u.email.includes("@"));

      const res = await apiFetch(`/company/users/bulk-import`, {
        method: "POST",
        body: JSON.stringify({ tenantId: tenant.id, users: importUsers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Import failed");
      }
      const result = await res.json();
      toast(t("adminTenant.importedSuccess", { count: String(result.created ?? importUsers.length) }), "success");
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminTenant.importFailed"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-10 w-10 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-bg-secondary)] px-6 py-4 flex justify-between items-center">
        <Link href={`/${slug}/admin`} className="flex items-center gap-3">
          <TenantLogo logoUrl={tenant?.logoUrl} name={academyName} size="md" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{academyName}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">/ {t("adminTenant.users")}</span>
        </Link>
        <NavToggles />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">User Management</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{users.length} users in {academyName}</p>
          </div>
          <div className="flex gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? t("common.loading") : t("adminTenant.importCsv")}
            </Button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminTenant.searchByNameEmail")}
                className="max-w-sm"
              />
              <span className="text-sm text-[var(--color-text-secondary)]">
                {filtered.length} {t("adminTenant.of")} {users.length}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-bg-secondary)]">
                <div className="grid grid-cols-12 gap-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-4">Email</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Actions</div>
                </div>
                {filtered.map((user) => (
                  <div key={user.id} className="grid grid-cols-12 gap-4 py-3 items-center text-sm">
                    <div className="col-span-4 font-medium text-[var(--color-text-primary)]">{user.name}</div>
                    <div className="col-span-4 text-[var(--color-text-secondary)]">{user.email}</div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-secondary)]">
                        {user.trainerApprovedAt ? "Instructor" : user.planId || "Learner"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <button className="text-xs text-[var(--color-accent)] hover:underline">
                        {t("adminTenant.edit")}
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-[var(--color-text-secondary)]">
                    {search ? t("adminTenant.noUsersMatch") : t("adminTenant.noUsersFound")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 rounded-lg bg-[var(--color-bg-secondary)]/50">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t("adminTenant.csvFormat")}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] font-mono">
            name, email, role<br />
            Jane Smith, jane@company.com, LEARNER_BASIC<br />
            John Doe, john@company.com, COMPANY_MANAGER
          </p>
        </div>
      </main>
    </div>
  );
}
