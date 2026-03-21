"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const FUNNEL_COLORS = ["#6B4E9A", "#8D6DB8", "#A78BCA", "#C1A9DC"] as const;

interface FunnelItem {
  stage: string;
  count: number;
}

interface VelocityItem {
  courseId: string;
  title: string;
  avgDaysToComplete: number;
  completions: number;
}

interface CohortData {
  cohort: string;
  months: { month: string; users: number }[];
}

interface Props {
  funnel: FunnelItem[];
  velocity: VelocityItem[];
  retention: CohortData[];
}

export function EngagementTab({ funnel, velocity, retention }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.length > 0 ? (
              <div className="space-y-3">
                {funnel.map((f, i) => {
                  const maxCount = funnel[0]?.count || 1;
                  const width = Math.max(20, (f.count / maxCount) * 100);
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      <span className="text-xs text-brand-grey w-24 text-right">{f.stage}</span>
                      <div className="flex-1 relative">
                        <div
                          className="h-8 rounded-md flex items-center justify-end px-3 transition-all"
                          style={{
                            width: `${width}%`,
                            backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          }}
                        >
                          <span className="text-xs text-white font-medium">{f.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-brand-grey text-center py-8">No funnel data available</p>
            )}
          </CardContent>
        </Card>

        {/* Learning Velocity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Learning Velocity (Avg Days to Complete)</CardTitle>
          </CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocity.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} days`, "Avg Days"]}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="avgDaysToComplete" fill="#6B4E9A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-brand-grey text-center py-8">No completion data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retention Cohorts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Retention Cohorts</CardTitle>
        </CardHeader>
        <CardContent>
          {retention.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-brand-grey">Cohort</th>
                    {retention[0]?.months.map((m) => (
                      <th key={m.month} className="px-2 py-1 text-center font-medium text-brand-grey">{m.month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retention.map((cohort) => (
                    <tr key={cohort.cohort}>
                      <td className="px-2 py-1 font-medium">{cohort.cohort}</td>
                      {cohort.months.map((m) => {
                        const maxUsers = cohort.months[0]?.users || 1;
                        const opacity = m.users > 0 ? Math.max(0.1, m.users / maxUsers) : 0;
                        return (
                          <td
                            key={m.month}
                            className="px-2 py-1 text-center"
                            style={{ backgroundColor: `rgba(107, 78, 154, ${opacity})`, color: opacity > 0.5 ? "#fff" : "inherit" }}
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
            <p className="text-sm text-brand-grey text-center py-8">No retention data available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
