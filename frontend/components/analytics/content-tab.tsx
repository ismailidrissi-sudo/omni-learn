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

export function ContentTab({ data, filters, onPageChange }: Props) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">All Content ({data.total})</CardTitle>
        <button
          onClick={() => downloadCsv("/analytics/deep/export/content", filters, "content")}
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
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Domain</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Views</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Unique</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Avg Duration</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Completion</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-brand-grey uppercase tracking-wider">Watch Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-grey-light/20">
              {data.content.map((c) => (
                <tr key={c.id} className="hover:bg-brand-purple/5 transition-colors">
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate">{c.title}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple/10 text-brand-purple">{c.type}</span>
                  </td>
                  <td className="px-3 py-2">{c.domainName || "—"}</td>
                  <td className="px-3 py-2">{c.views}</td>
                  <td className="px-3 py-2">{c.uniqueViewers}</td>
                  <td className="px-3 py-2">{Math.round(c.avgDurationSeconds / 60)}m</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-brand-grey-light/30 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-purple rounded-full" style={{ width: `${c.completionRate}%` }} />
                      </div>
                      <span className="text-xs">{c.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{c.totalWatchHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-grey-light/30">
            <span className="text-xs text-brand-grey">
              Page {data.page} of {data.totalPages}
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
