"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type Overview = {
  totalReferrals: number;
  conversions: number;
  pendingSignups: number;
  signedUp: number;
  conversionRate: number;
  totalInvitations: number;
  activeRewards: number;
};

type TopReferrer = {
  userId: string;
  name: string;
  email: string;
  plan: string;
  totalReferrals: number;
  conversions: number;
  conversionRate: number;
};

type Trend = { date: string; referrals: number; conversions: number; signups: number };
type Channel = { channel: string; total: number; conversions: number; conversionRate: number };
type RewardsSummary = {
  active: number;
  expired: number;
  revoked: number;
  totalDaysGranted: number;
  byPlan: { plan: string; count: number }[];
};

type ActiveReward = {
  id: string;
  userId: string;
  grantedPlan: string;
  durationDays: number;
  expiresAt: string;
  startsAt: string;
  status: string;
  user: { id: string; name: string; email: string } | null;
};

export default function AdminReferralsPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rewardsSummary, setRewardsSummary] = useState<RewardsSummary | null>(null);
  const [activeRewards, setActiveRewards] = useState<ActiveReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlan, setGrantPlan] = useState("SPECIALIST");
  const [grantMonths, setGrantMonths] = useState("1");
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, tr, trends, ch, rw, ar] = await Promise.all([
        apiFetch("/referral/admin/overview").then((r) => r.json()),
        apiFetch("/referral/admin/top-referrers").then((r) => r.json()),
        apiFetch("/referral/admin/trends?groupBy=day").then((r) => r.json()),
        apiFetch("/referral/admin/channels").then((r) => r.json()),
        apiFetch("/referral/admin/rewards").then((r) => r.json()),
        apiFetch("/referral/admin/rewards/active").then((r) => r.json()),
      ]);
      setOverview(ov);
      setTopReferrers(Array.isArray(tr) ? tr : []);
      setTrends(Array.isArray(trends) ? trends : []);
      setChannels(Array.isArray(ch) ? ch : []);
      setRewardsSummary(rw);
      setActiveRewards(ar?.rewards ?? []);
    } catch {
      setError("Failed to load referral analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGrant = async () => {
    if (!grantUserId || !grantPlan || !grantMonths) return;
    setGrantLoading(true);
    setGrantSuccess("");
    try {
      const res = await apiFetch("/referral/admin/grant-access", {
        method: "POST",
        body: JSON.stringify({
          userId: grantUserId,
          plan: grantPlan,
          durationMonths: parseInt(grantMonths, 10),
          reason: grantReason || undefined,
        }),
      });
      if (!res.ok) throw new Error("Grant failed");
      setGrantSuccess(`Access granted: ${grantPlan} for ${grantMonths} month(s)`);
      setGrantUserId("");
      setGrantReason("");
      loadData();
    } catch {
      setError("Failed to grant access.");
    } finally {
      setGrantLoading(false);
    }
  };

  const revokeReward = async (rewardId: string) => {
    try {
      await apiFetch(`/referral/admin/revoke-reward/${rewardId}`, { method: "POST" });
      loadData();
    } catch {
      setError("Failed to revoke reward.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand-grey">Loading...</p>
      </div>
    );
  }

  const maxTrend = Math.max(...trends.map((t) => t.referrals), 1);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/domains"><Button variant="ghost" size="sm">Domains</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/certificates"><Button variant="ghost" size="sm">Certificates</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/pages"><Button variant="ghost" size="sm">Pages</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/referrals"><Button variant="primary" size="sm">Referrals</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark dark:text-white mb-6">Referral Analytics</h1>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {[
            { label: "Total Referrals", value: overview?.totalReferrals ?? 0 },
            { label: "Conversions", value: overview?.conversions ?? 0 },
            { label: "Conversion Rate", value: `${overview?.conversionRate ?? 0}%` },
            { label: "Signed Up", value: overview?.signedUp ?? 0 },
            { label: "Pending", value: overview?.pendingSignups ?? 0 },
            { label: "Invitations Sent", value: overview?.totalInvitations ?? 0 },
            { label: "Active Rewards", value: overview?.activeRewards ?? 0 },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader><CardTitle className="text-xs font-medium text-brand-grey">{s.label}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-brand-purple">{s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trends Chart (simple bar visualization) */}
          <Card>
            <CardHeader><CardTitle>Referral Trends (Last 30 Days)</CardTitle></CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <p className="text-sm text-brand-grey">No data yet</p>
              ) : (
                <div className="space-y-1">
                  {trends.slice(-14).map((t) => (
                    <div key={t.date} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-brand-grey shrink-0">{t.date.slice(5)}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div
                          className="h-4 rounded bg-brand-purple/60 transition-all"
                          style={{ width: `${(t.referrals / maxTrend) * 100}%`, minWidth: t.referrals > 0 ? "4px" : "0" }}
                        />
                        <span className="text-brand-grey-dark dark:text-gray-300">{t.referrals}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channel Breakdown */}
          <Card>
            <CardHeader><CardTitle>Channel Breakdown</CardTitle></CardHeader>
            <CardContent>
              {channels.length === 0 ? (
                <p className="text-sm text-brand-grey">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <div key={ch.channel} className="flex items-center justify-between py-2 border-b border-brand-grey-light/50">
                      <span className="text-sm font-medium text-brand-grey-dark dark:text-white capitalize">{ch.channel}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-brand-grey">Total: {ch.total}</span>
                        <span className="text-green-600 dark:text-green-400">Conv: {ch.conversions}</span>
                        <span className="text-brand-purple font-medium">{ch.conversionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Referrers */}
        <Card className="mb-8">
          <CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
          <CardContent>
            {topReferrers.length === 0 ? (
              <p className="text-sm text-brand-grey">No referrers yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-grey-light">
                      <th className="text-left py-2 text-brand-grey font-medium">Name</th>
                      <th className="text-left py-2 text-brand-grey font-medium">Email</th>
                      <th className="text-left py-2 text-brand-grey font-medium">Plan</th>
                      <th className="text-right py-2 text-brand-grey font-medium">Referrals</th>
                      <th className="text-right py-2 text-brand-grey font-medium">Conversions</th>
                      <th className="text-right py-2 text-brand-grey font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topReferrers.map((r) => (
                      <tr key={r.userId} className="border-b border-brand-grey-light/50">
                        <td className="py-2 text-brand-grey-dark dark:text-white font-medium">{r.name}</td>
                        <td className="py-2 text-brand-grey">{r.email}</td>
                        <td className="py-2">
                          <span className="inline-block rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-brand-purple">
                            {r.plan}
                          </span>
                        </td>
                        <td className="py-2 text-right text-brand-grey-dark dark:text-white">{r.totalReferrals}</td>
                        <td className="py-2 text-right text-green-600 dark:text-green-400">{r.conversions}</td>
                        <td className="py-2 text-right text-brand-purple font-medium">{r.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewards Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader><CardTitle>Rewards Summary</CardTitle></CardHeader>
            <CardContent>
              {rewardsSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-brand-grey">Active</p>
                      <p className="text-xl font-bold text-green-600">{rewardsSummary.active}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-grey">Expired</p>
                      <p className="text-xl font-bold text-brand-grey">{rewardsSummary.expired}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-grey">Revoked</p>
                      <p className="text-xl font-bold text-red-500">{rewardsSummary.revoked}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-grey">Total Days Granted</p>
                      <p className="text-xl font-bold text-brand-purple">{rewardsSummary.totalDaysGranted}</p>
                    </div>
                  </div>
                  {rewardsSummary.byPlan.length > 0 && (
                    <div>
                      <p className="text-xs text-brand-grey mb-2">By Plan</p>
                      <div className="flex gap-3">
                        {rewardsSummary.byPlan.map((p) => (
                          <span key={p.plan} className="rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple">
                            {p.plan}: {p.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-brand-grey">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Grant Access Form */}
          <Card>
            <CardHeader><CardTitle>Grant Access to Account</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-brand-grey mb-4">
                Manually grant a user access to a subscription tier for a set duration.
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="User ID"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  className="w-full rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={grantPlan}
                    onChange={(e) => setGrantPlan(e.target.value)}
                    className="rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="SPECIALIST">Specialist</option>
                    <option value="VISIONARY">Visionary</option>
                    <option value="NEXUS">Nexus (Enterprise)</option>
                  </select>
                  <select
                    value={grantMonths}
                    onChange={(e) => setGrantMonths(e.target.value)}
                    className="rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 6, 12, 24].map((m) => (
                      <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
                <Button onClick={handleGrant} disabled={grantLoading || !grantUserId} size="sm">
                  {grantLoading ? "Granting..." : "Grant Access"}
                </Button>
                {grantSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">{grantSuccess}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Rewards Table */}
        <Card>
          <CardHeader><CardTitle>Active Rewards</CardTitle></CardHeader>
          <CardContent>
            {activeRewards.length === 0 ? (
              <p className="text-sm text-brand-grey">No active rewards</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-grey-light">
                      <th className="text-left py-2 text-brand-grey font-medium">User</th>
                      <th className="text-left py-2 text-brand-grey font-medium">Plan</th>
                      <th className="text-left py-2 text-brand-grey font-medium">Duration</th>
                      <th className="text-left py-2 text-brand-grey font-medium">Expires</th>
                      <th className="text-right py-2 text-brand-grey font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRewards.map((r) => (
                      <tr key={r.id} className="border-b border-brand-grey-light/50">
                        <td className="py-2">
                          <div>
                            <p className="text-brand-grey-dark dark:text-white font-medium">{r.user?.name ?? "Unknown"}</p>
                            <p className="text-xs text-brand-grey">{r.user?.email ?? r.userId}</p>
                          </div>
                        </td>
                        <td className="py-2">
                          <span className="inline-block rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-brand-purple">
                            {r.grantedPlan}
                          </span>
                        </td>
                        <td className="py-2 text-brand-grey">{r.durationDays} days</td>
                        <td className="py-2 text-brand-grey">{new Date(r.expiresAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeReward(r.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
