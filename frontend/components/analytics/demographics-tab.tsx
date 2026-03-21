"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-download";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = ["#6B4E9A", "#8D6DB8", "#A78BCA", "#C1A9DC", "#DBCAEE", "#82ca9d", "#ffc658", "#ff7c7c"];

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
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => downloadCsv("/analytics/deep/export/demographics", filters, "demographics")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-purple text-white rounded-md hover:bg-brand-purple/90 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gender}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    nameKey="gender"
                    label={({ gender, count }) => `${gender}: ${count}`}
                  >
                    {data.gender.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Age */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.age}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6B4E9A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Browser Language</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.languages.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="language" width={60} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8D6DB8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subscription Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.plans}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    nameKey="plan"
                    label={({ plan, count }) => `${plan}: ${count}`}
                  >
                    {data.plans.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Types */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">User Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 flex-wrap">
              {data.userTypes.map((t, i) => (
                <div key={t.type} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-purple/5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div>
                    <p className="text-sm font-medium">{t.type}</p>
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
