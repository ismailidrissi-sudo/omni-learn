"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";

const FUNNEL_COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7"] as const;

interface FunnelItem { stage: string; count: number; }
interface VelocityItem { courseId: string; title: string; avgDaysToComplete: number; completions: number; }
interface CohortData { cohort: string; months: { month: string; users: number }[]; }

interface Props {
  funnel: FunnelItem[];
  velocity: VelocityItem[];
  retention: CohortData[];
}

export function EngagementTab({ funnel, velocity, retention }: Props) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const grid = dark ? "#2d3a2f" : "#e5e7eb";
  const tick = dark ? "#9ca3af" : "#6b7280";
  const ttStyle = { backgroundColor: dark ? "#1a1e18" : "#fff", border: `1px solid ${dark ? "#2d3a2f" : "#e5e7eb"}`, borderRadius: 8, color: dark ? "#F5F5DC" : "#1a1212", fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Completion Funnel</CardTitle></CardHeader>
          <CardContent>
            {funnel.length > 0 ? (
              <div className="space-y-3">
                {funnel.map((f, i) => {
                  const maxCount = funnel[0]?.count || 1;
                  const width = Math.max(20, (f.count / maxCount) * 100);
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)] w-24 text-right font-medium">{f.stage}</span>
                      <div className="flex-1 relative">
                        <div
                          className="h-9 rounded-lg flex items-center justify-end px-3 transition-all shadow-sm"
                          style={{ width: `${width}%`, backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
                        >
                          <span className="text-xs text-white font-semibold drop-shadow-sm">{f.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No funnel data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Learning Velocity (Avg Days to Complete)</CardTitle></CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocity.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: tick }} />
                    <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 10, fill: tick }} />
                    <Tooltip
                      formatter={(value) => [`${value} days`, "Avg Days"]}
                      labelFormatter={(label) => label}
                      contentStyle={ttStyle}
                    />
                    <Bar dataKey="avgDaysToComplete" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No completion data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Retention Cohorts</CardTitle></CardHeader>
        <CardContent>
          {retention.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-bg-secondary)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-bg-secondary)]/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-muted)]">Cohort</th>
                    {retention[0]?.months.map((m) => (
                      <th key={m.month} className="px-3 py-2 text-center font-semibold text-[var(--color-text-muted)]">{m.month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retention.map((cohort) => (
                    <tr key={cohort.cohort} className="border-t border-[var(--color-bg-secondary)]">
                      <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{cohort.cohort}</td>
                      {cohort.months.map((m) => {
                        const maxUsers = cohort.months[0]?.users || 1;
                        const opacity = m.users > 0 ? Math.max(0.1, m.users / maxUsers) : 0;
                        return (
                          <td
                            key={m.month}
                            className="px-3 py-2 text-center font-medium"
                            style={{
                              backgroundColor: `rgba(5, 150, 105, ${opacity})`,
                              color: opacity > 0.5 ? "#fff" : "var(--color-text-primary)",
                            }}
                          >
                            {m.users}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No retention data available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
