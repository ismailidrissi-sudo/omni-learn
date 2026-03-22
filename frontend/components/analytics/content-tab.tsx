"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";

interface ContentRow {
  id: string;
  title: string;
  type: string;
  domainName: string | null;
  views: number;
  uniqueViewers: number;
  avgDurationSeconds: number;
  completionRate: number;
  totalWatchHours: number;
}

interface Props {
  data: { content: ContentRow[]; total: number; page: number; limit: number; totalPages: number } | null;
  filters: Record<string, string | undefined>;
  onPageChange: (page: number) => void;
}

const thCls = "px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider";

export function ContentTab({ data, filters, onPageChange }: Props) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">All Content ({data.total})</CardTitle>
        <button
          onClick={() => downloadCsv("/analytics/deep/export/content", filters, "content")}
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
                <th className={thCls}>Title</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Domain</th>
                <th className={thCls}>Views</th>
                <th className={thCls}>Unique</th>
                <th className={thCls}>Avg Duration</th>
                <th className={thCls}>Completion</th>
                <th className={thCls}>Watch Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-secondary)]">
              {data.content.map((c) => (
                <tr key={c.id} className="hover:bg-brand-purple/5 transition-colors">
                  <td className="px-3 py-2.5 font-medium max-w-[200px] truncate text-[var(--color-text-primary)]">{c.title}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple/10 text-brand-purple font-medium">{c.type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{c.domainName || "—"}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{c.views}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{c.uniqueViewers}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{Math.round(c.avgDurationSeconds / 60)}m</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-purple rounded-full" style={{ width: `${c.completionRate}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-primary)]">{c.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{c.totalWatchHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-bg-secondary)]">
            <span className="text-xs text-[var(--color-text-muted)]">
              Page {data.page} of {data.totalPages}
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
