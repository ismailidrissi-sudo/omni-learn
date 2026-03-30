"use client";

import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";

export default function AdminDashboardPage() {
  const { resolveAdminLabel } = usePermissions();

  return (
    <main className="p-6 md:p-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
        {resolveAdminLabel()}
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Use the sidebar to manage platform areas you have access to. Approvals, content, and
        analytics are grouped by permission.
      </p>
      <ul className="space-y-2 text-sm text-[var(--color-accent)]">
        <li>
          <Link href="/admin/approvals" className="underline">
            Approvals queue
          </Link>
        </li>
        <li>
          <Link href="/admin/content" className="underline">
            Courses &amp; content
          </Link>
        </li>
        <li>
          <Link href="/admin/paths" className="underline">
            Learning paths
          </Link>
        </li>
      </ul>
    </main>
  );
}
