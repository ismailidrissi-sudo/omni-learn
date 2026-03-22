"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Users, Activity, Clock, BookOpen, Target, TrendingUp, Eye, Layers } from "lucide-react";
import { useTheme } from "next-themes";

const COLORS = ["#059669", "#10b981", "#34d399", "#fbbf24", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];

interface OverviewData {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  totalPageViews: number;
  totalEnrollments: number;
  totalCompletions: number;
  completionRate: number;
  totalLearningHours: number;
}

interface Props {
  overview: OverviewData | null;
  timeline: { date: string; sessions: number }[];
  heatmap: number[][];
  devices: { deviceType: string; count: number; percentage: number }[];
  browsers: { browsers: { name: string; count: number }[]; operatingSystems: { name: string; count: number }[] };
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-brand-purple mt-1">{value}</p>
            {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-brand-purple/10 group-hover:bg-brand-purple/20 transition-colors">
            <Icon size={18} className="text-brand-purple" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    grid: dark ? "#2d3a2f" : "#e5e7eb",
    tick: dark ? "#9ca3af" : "#6b7280",
    tooltipBg: dark ? "#1a1e18" : "#ffffff",
    tooltipBorder: dark ? "#2d3a2f" : "#e5e7eb",
    tooltipText: dark ? "#F5F5DC" : "#1a1212",
    heatmapEmpty: dark ? "#1a1e18" : "#f3f4f6",
    heatmapFn: (intensity: number) =>
      dark
        ? `rgba(16, 185, 129, ${Math.max(0.15, intensity)})`
        : `rgba(5, 150, 105, ${Math.max(0.1, intensity)})`,
  };
}

export function OverviewTab({ overview, timeline, heatmap, devices, browsers }: Props) {
  const ct = useChartTheme();

  if (!overview) return null;

  const maxHeatVal = Math.max(...heatmap.flat(), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total Users" value={overview.totalUsers} />
        <KpiCard icon={Activity} label="Active (30d)" value={overview.activeUsers} />
        <KpiCard icon={TrendingUp} label="New Users" value={overview.newUsers} sub="in period" />
        <KpiCard icon={Clock} label="Avg Session" value={formatDuration(overview.avgSessionDuration)} />
        <KpiCard icon={BookOpen} label="Learning Hours" value={overview.totalLearningHours} />
        <KpiCard icon={Target} label="Completion Rate" value={`${overview.completionRate}%`} />
        <KpiCard icon={Layers} label="Enrollments" value={overview.totalEnrollments} />
        <KpiCard icon={Eye} label="Page Views" value={overview.totalPageViews.toLocaleString()} />
      </div>

      {timeline.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Sessions Over Time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.tick }} />
                  <YAxis tick={{ fontSize: 11, fill: ct.tick }} />
                  <Tooltip contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                  <Area type="monotone" dataKey="sessions" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {devices.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Device Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={devices} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="count" nameKey="deviceType" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} paddingAngle={2}>
                      {devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {browsers.browsers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Browser & OS</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={browsers.browsers.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: ct.tick }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: ct.tick }} />
                    <Tooltip contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Activity Heatmap (UTC)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left font-medium text-[var(--color-text-muted)]" />
                  {HOURS.map((h) => (
                    <th key={h} className="p-1 font-medium text-[var(--color-text-muted)] text-center w-8">{h.split(":")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => (
                  <tr key={day}>
                    <td className="p-1 font-medium text-[var(--color-text-muted)] pr-2">{day}</td>
                    {heatmap[di]?.map((val, hi) => (
                      <td key={hi} className="p-0.5">
                        <div
                          className="w-full h-5 rounded-sm transition-colors"
                          style={{
                            backgroundColor: val === 0 ? ct.heatmapEmpty : ct.heatmapFn(val / maxHeatVal),
                          }}
                          title={`${day} ${HOURS[hi]}: ${val} sessions`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
