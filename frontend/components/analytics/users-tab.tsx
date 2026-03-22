"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download, ChevronUp, ChevronDown } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";

interface UserRow {
  id: string;
  name: string;
  email: string;
  tenantName: string | null;
  gender: string | null;
  country: string | null;
  sessionsCount: number;
  totalDurationSeconds: number;
  lastActive: string;
  enrollments: number;
  completionRate: number;
  primaryDevice: string;
}

interface Props {
  data: { users: UserRow[]; total: number; page: number; limit: number; totalPages: number } | null;
  filters: Record<string, string | undefined>;
  onPageChange: (page: number) => void;
  sortBy: string;
  sortOrder: string;
  onSort: (field: string) => void;
}

const thCls = "px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider";

function SortHeader({ label, field, sortBy, sortOrder, onSort }: { label: string; field: string; sortBy: string; sortOrder: string; onSort: (f: string) => void }) {
  const active = sortBy === field;
  return (
    <th className={`${thCls} cursor-pointer hover:text-brand-purple transition-colors`} onClick={() => onSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {active && (sortOrder === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </div>
    </th>
  );
}

export function UsersTab({ data, filters, onPageChange, sortBy, sortOrder, onSort }: Props) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">All Users ({data.total})</CardTitle>
        <button
          onClick={() => downloadCsv("/analytics/deep/export/users", filters, "users")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors shadow-sm"
        >
          <Download size={14} /> Export CSV
        </button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-bg-secondary)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)]/50">
              <tr>
                <SortHeader label="Name" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className={thCls}>Email</th>
                <th className={thCls}>Company</th>
                <SortHeader label="Sessions" field="sessionsCount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className={thCls}>Duration</th>
                <th className={thCls}>Last Active</th>
                <th className={thCls}>Completion</th>
                <th className={thCls}>Enrolled</th>
                <th className={thCls}>Device</th>
                <th className={thCls}>Country</th>
                <th className={thCls}>Gender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-secondary)]">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-purple/5 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)]">{u.name}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{u.email}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{u.tenantName || "—"}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{u.sessionsCount}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{Math.round(u.totalDurationSeconds / 60)}m</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-purple rounded-full" style={{ width: `${u.completionRate}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-primary)]">{u.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{u.enrollments}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple/10 text-brand-purple font-medium">{u.primaryDevice}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{u.country || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)]">{u.gender || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-bg-secondary)]">
            <span className="text-xs text-[var(--color-text-muted)]">
              Page {data.page} of {data.totalPages} ({data.total} users)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(data.page - 1)}
                disabled={data.page <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--color-bg-secondary)] rounded-lg disabled:opacity-40 hover:bg-brand-purple/10 transition-colors text-[var(--color-text-primary)]"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(data.page + 1)}
                disabled={data.page >= data.totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--color-bg-secondary)] rounded-lg disabled:opacity-40 hover:bg-brand-purple/10 transition-colors text-[var(--color-text-primary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
