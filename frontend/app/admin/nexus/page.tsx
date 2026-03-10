"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { NavToggles } from "@/components/ui/nav-toggles";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type EmployeeProgress = {
  userId: string;
  name: string;
  email: string;
  enrollments: number;
  completedPct: number;
};

export default function NexusAdminPage() {
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const [employees, setEmployees] = useState<EmployeeProgress[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const isNexus = user?.planId === "NEXUS";

  useEffect(() => {
    if (!user?.tenantId) return;
    fetch(`${API}/company/users?tenantId=${user.tenantId}`)
      .then((r) => r.json())
      .then((users: { id: string; name: string; email: string }[]) => {
        setEmployees(
          users.map((u) => ({
            userId: u.id,
            name: u.name,
            email: u.email,
            enrollments: 0,
            completedPct: 0,
          }))
        );
      })
      .catch(() => setEmployees([]));
  }, [user?.tenantId]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-brand-grey">{t("common.loading")}</p>
      </div>
    );
  }

  if (!isNexus) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-4">
          Nexus Enterprise Access Required
        </h1>
        <p className="text-brand-grey mb-6 text-center max-w-md">
          This dashboard is available only for Nexus (Enterprise) plan subscribers.
          Contact sales to upgrade your organization.
        </p>
        <Link href="/#pricing">
          <Button variant="primary">View Plans</Button>
        </Link>
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
          <Link href="/learn">
            <Button variant="ghost" size="sm">
              {t("nav.myProgress")}
            </Button>
          </Link>
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/nexus">
            <Button variant="primary" size="sm">
              My Company
            </Button>
          </Link>
          <Link href="/admin/company">
            <Button variant="ghost" size="sm">
              {t("nav.company")}
            </Button>
          </Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-2">
          My Company — Nexus Admin
        </h1>
        <p className="text-brand-grey text-sm mb-6">
          Employee analytics and private content for your organization.
        </p>

        <div className="flex gap-4 mb-8">
          <Button
            variant="primary"
            onClick={() => setShowUploadModal(true)}
          >
            Private Upload
          </Button>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-grey-dark mb-4">
            Employee Analytics
          </h2>
          <div className="rounded-lg border border-brand-grey-light overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-right px-4 py-3 font-medium">Enrollments</th>
                  <th className="text-right px-4 py-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-brand-grey">
                      No employees in your organization yet.
                    </td>
                  </tr>
                ) : (
                  employees.map((e) => (
                    <tr key={e.userId} className="border-t border-brand-grey-light">
                      <td className="px-4 py-3">{e.name}</td>
                      <td className="px-4 py-3 text-brand-grey">{e.email}</td>
                      <td className="px-4 py-3 text-right">{e.enrollments}</td>
                      <td className="px-4 py-3 text-right">{e.completedPct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showUploadModal && (
        <PrivateUploadModal
          onClose={() => setShowUploadModal(false)}
          tenantId={user?.tenantId ?? ""}
        />
      )}
    </div>
  );
}

function PrivateUploadModal({
  onClose,
  tenantId,
}: {
  onClose: () => void;
  tenantId: string;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("VIDEO");
  const [mediaUrl, setMediaUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/content", {
        method: "POST",
        body: JSON.stringify({
          type,
          title,
          mediaId: mediaUrl || undefined,
          tenantId: tenantId || undefined,
          metadata: mediaUrl ? { videoUrl: mediaUrl, hlsUrl: mediaUrl } : {},
        }),
      });
      if (res.ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Upload Private Content</h3>
        <p className="text-sm text-brand-grey mb-4">
          This content will be visible only to your organization.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Course or video title"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="VIDEO">Video</option>
              <option value="COURSE">Course</option>
              <option value="DOCUMENT">Document</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Media URL (optional)</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Upload"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
