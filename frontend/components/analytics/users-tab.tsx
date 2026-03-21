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

function SortHeader({ label, field, sortBy, sortOrder, onSort }: { label: string; field: string; sortBy: string; sortOrder: string; onSort: (f: string) => void }) {
  const active = sortBy === field;
  return (
    <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider cursor-pointer hover:text-brand-purple" onClick={() => onSort(field)}>
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
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-purple text-white rounded-md hover:bg-brand-purple/90 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-grey-light/30">
              <tr>
                <SortHeader label="Name" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Company</th>
                <SortHeader label="Sessions" field="sessionsCount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Duration</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Last Active</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Completion</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Enrolled</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Device</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Country</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Gender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-grey-light/20">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-purple/5 transition-colors">
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2 text-brand-grey">{u.email}</td>
                  <td className="px-3 py-2">{u.tenantName || "—"}</td>
                  <td className="px-3 py-2">{u.sessionsCount}</td>
                  <td className="px-3 py-2">{Math.round(u.totalDurationSeconds / 60)}m</td>
                  <td className="px-3 py-2 text-brand-grey">{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-brand-grey-light/30 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-purple rounded-full" style={{ width: `${u.completionRate}%` }} />
                      </div>
                      <span className="text-xs">{u.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{u.enrollments}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple/10 text-brand-purple">{u.primaryDevice}</span>
                  </td>
                  <td className="px-3 py-2">{u.country || "—"}</td>
                  <td className="px-3 py-2 text-xs">{u.gender || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-grey-light/30">
            <span className="text-xs text-brand-grey">
              Page {data.page} of {data.totalPages} ({data.total} users)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(data.page - 1)}
                disabled={data.page <= 1}
                className="px-3 py-1 text-xs border border-brand-grey-light/50 rounded-md disabled:opacity-40 hover:bg-brand-purple/10 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(data.page + 1)}
                disabled={data.page >= data.totalPages}
                className="px-3 py-1 text-xs border border-brand-grey-light/50 rounded-md disabled:opacity-40 hover:bg-brand-purple/10 transition-colors"
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
