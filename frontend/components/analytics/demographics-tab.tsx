"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";

const COLORS = ["#059669", "#10b981", "#34d399", "#fbbf24", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];

interface DemographicsData {
  gender: { gender: string; count: number }[];
  age: { bracket: string; count: number }[];
  languages: { language: string; count: number }[];
  plans: { plan: string; count: number }[];
  userTypes: { type: string; count: number }[];
}

interface Props {
  data: DemographicsData | null;
  filters: Record<string, string | undefined>;
}

export function DemographicsTab({ data, filters }: Props) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const grid = dark ? "#2d3a2f" : "#e5e7eb";
  const tick = dark ? "#9ca3af" : "#6b7280";
  const ttStyle = { backgroundColor: dark ? "#1a1e18" : "#fff", border: `1px solid ${dark ? "#2d3a2f" : "#e5e7eb"}`, borderRadius: 8, color: dark ? "#F5F5DC" : "#1a1212", fontSize: 12 };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => downloadCsv("/analytics/deep/export/demographics", filters, "demographics")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors shadow-sm"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Gender Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.gender} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="count" nameKey="gender" label={({ name, value }) => `${name}: ${value}`} paddingAngle={2}>
                    {data.gender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Age Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.age}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="bracket" tick={{ fontSize: 11, fill: tick }} />
                  <YAxis tick={{ fontSize: 11, fill: tick }} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Browser Language</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.languages.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: tick }} />
                  <YAxis type="category" dataKey="language" width={60} tick={{ fontSize: 11, fill: tick }} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Subscription Plans</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.plans} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="count" nameKey="plan" label={({ name, value }) => `${name}: ${value}`} paddingAngle={2}>
                    {data.plans.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-medium">User Types</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {data.userTypes.map((t, i) => (
                <div key={t.type} className="flex items-center gap-3 px-5 py-3 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--color-bg-secondary)]">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{t.type}</p>
                    <p className="text-lg font-bold text-brand-purple">{t.count}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
