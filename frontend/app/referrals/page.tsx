"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api";

type ReferralDashboard = {
  referralLink: string | null;
  referralCode: string | null;
  codes: { id: string; code: string; label: string | null; isActive: boolean; _count: { referrals: number; invitations: number } }[];
  stats: {
    totalReferrals: number;
    conversions: number;
    pending: number;
    signedUp: number;
    conversionRate: number;
    invitationsSent: number;
  };
  activeRewards: { id: string; grantedPlan: string; durationDays: number; expiresAt: string; startsAt: string }[];
  recentReferrals: { id: string; referredEmail: string; status: string; channel: string | null; createdAt: string; signedUpAt: string | null; convertedAt: string | null }[];
};

const SHARE_CHANNELS = [
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", icon: "in" },
  { id: "twitter", label: "X / Twitter", color: "#000000", icon: "𝕏" },
  { id: "facebook", label: "Facebook", color: "#1877F2", icon: "f" },
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", icon: "W" },
  { id: "email", label: "Email", color: "#6B4E9A", icon: "@" },
] as const;

function buildShareUrl(channel: string, link: string, message: string) {
  const encoded = encodeURIComponent(link);
  const msg = encodeURIComponent(message);
  switch (channel) {
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${msg}&url=${encoded}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
    case "whatsapp":
      return `https://wa.me/?text=${msg}%20${encoded}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent("Join me on OmniLearn")}&body=${msg}%0A%0A${encoded}`;
    default:
      return link;
  }
}

export default function ReferralsPage() {
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ sent: number; skipped: number; errors: number } | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailContacts, setGmailContacts] = useState<{ email: string; name?: string }[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinContacts, setLinkedinContacts] = useState<{ email?: string; name?: string; linkedinId?: string; profileUrl?: string }[]>([]);
  const [selectedLinkedinContacts, setSelectedLinkedinContacts] = useState<Set<number>>(new Set());
  const [linkedinInviteResult, setLinkedinInviteResult] = useState<{ sent: number; skipped: number; errors: number } | null>(null);
  const [tab, setTab] = useState<"share" | "invite" | "gmail" | "linkedin">("share");
  const [, setGsiLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && !(window as any).google?.accounts?.oauth2) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => setGsiLoaded(true);
      document.head.appendChild(script);
    } else {
      setGsiLoaded(true);
    }
  }, []);

  const switchTab = (t: "share" | "invite" | "gmail" | "linkedin") => {
    setError("");
    setInviteResult(null);
    setLinkedinInviteResult(null);
    setTab(t);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/referral/dashboard");
      if (!res.ok) throw new Error("Failed to load");
      setDashboard(await res.json());
    } catch {
      setError("Failed to load referral dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const copyLink = () => {
    if (!dashboard?.referralLink) return;
    navigator.clipboard.writeText(dashboard.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendBulkInvites = async () => {
    const lines = bulkEmails.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
    const contacts = lines.map((line) => {
      const match = line.match(/^(.+?)\s*<(.+?)>$/);
      if (match) return { name: match[1].trim(), email: match[2].trim() };
      return { email: line };
    });
    if (contacts.length === 0) return;

    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await apiFetch("/referral/invite/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      setInviteResult(data);
      setBulkEmails("");
      loadDashboard();
    } catch {
      setError("Failed to send invitations.");
    } finally {
      setInviteLoading(false);
    }
  };

  const importGmail = async () => {
    setError("");
    setGmailLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        setError("Google API is loading. Please wait a moment and try again.");
        setGmailLoading(false);
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/contacts.readonly",
        callback: async (response: { access_token?: string; error?: string }) => {
          if (response.error || !response.access_token) {
            setError("Gmail authorization failed.");
            setGmailLoading(false);
            return;
          }
          try {
            const res = await apiFetch("/referral/import/gmail", {
              method: "POST",
              body: JSON.stringify({ accessToken: response.access_token }),
            });
            const contacts = await res.json();
            setGmailContacts(Array.isArray(contacts) ? contacts : []);
            setSelectedContacts(new Set(contacts.map((_: unknown, i: number) => i)));
          } catch {
            setError("Failed to import Gmail contacts.");
          } finally {
            setGmailLoading(false);
          }
        },
      });
      client.requestAccessToken();
    } catch {
      setError("Failed to initialize Gmail import.");
      setGmailLoading(false);
    }
  };

  const inviteSelectedGmailContacts = async () => {
    const contacts = gmailContacts.filter((_, i) => selectedContacts.has(i));
    if (contacts.length === 0) return;
    setInviteLoading(true);
    try {
      const res = await apiFetch("/referral/invite/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      setInviteResult(data);
      setGmailContacts([]);
      setSelectedContacts(new Set());
      loadDashboard();
    } catch {
      setError("Failed to send invitations.");
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleContact = (idx: number) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const importLinkedIn = async () => {
    setError("");
    setLinkedinLoading(true);
    setLinkedinInviteResult(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("omnilearn_linkedin_token") : null;
      if (!token) {
        setError("No LinkedIn access token found. Please sign in with LinkedIn first (from the Sign In page), then return here.");
        setLinkedinLoading(false);
        return;
      }
      const res = await apiFetch("/referral/import/linkedin", {
        method: "POST",
        body: JSON.stringify({ accessToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || "Failed to import LinkedIn contacts.");
        setLinkedinLoading(false);
        return;
      }
      const contacts = await res.json();
      setLinkedinContacts(Array.isArray(contacts) ? contacts : []);
      const withEmail = (Array.isArray(contacts) ? contacts : [])
        .map((c: { email?: string }, i: number) => (c.email ? i : -1))
        .filter((i: number) => i >= 0);
      setSelectedLinkedinContacts(new Set(withEmail));
    } catch {
      setError("Failed to import LinkedIn contacts.");
    } finally {
      setLinkedinLoading(false);
    }
  };

  const toggleLinkedinContact = (idx: number) => {
    setSelectedLinkedinContacts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const inviteSelectedLinkedinContacts = async () => {
    const contacts = linkedinContacts
      .filter((c, i) => selectedLinkedinContacts.has(i) && c.email)
      .map((c) => ({ email: c.email!, name: c.name }));
    if (contacts.length === 0) return;
    setInviteLoading(true);
    setLinkedinInviteResult(null);
    try {
      const res = await apiFetch("/referral/invite/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      setLinkedinInviteResult(data);
      setLinkedinContacts([]);
      setSelectedLinkedinContacts(new Set());
      loadDashboard();
    } catch {
      setError("Failed to send invitations.");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand-grey">Loading...</p>
      </div>
    );
  }

  const shareMessage = "I'm learning on OmniLearn — the platform where every skill lives in one space. Join me!";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/learn"><Button variant="ghost" size="sm">Learn</Button></Link>
          <Link href="/discover"><Button variant="ghost" size="sm">Discover</Button></Link>
          <Link href="/referrals"><Button variant="primary" size="sm">Referrals</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-brand-grey-dark dark:text-white">Invite Your Network</h1>
            <p className="text-brand-grey mt-1">Share OmniLearn and earn premium access rewards</p>
          </div>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" />}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Referrals", value: dashboard?.stats.totalReferrals ?? 0 },
            { label: "Signed Up", value: dashboard?.stats.signedUp ?? 0 },
            { label: "Converted", value: dashboard?.stats.conversions ?? 0 },
            { label: "Conversion Rate", value: `${dashboard?.stats.conversionRate ?? 0}%` },
            { label: "Invites Sent", value: dashboard?.stats.invitationsSent ?? 0 },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader><CardTitle className="text-xs font-medium text-brand-grey">{s.label}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-brand-purple">{s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Link */}
        {dashboard?.referralLink && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Your Referral Link</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input
                  readOnly
                  value={dashboard.referralLink}
                  className="flex-1 rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm text-brand-grey-dark dark:text-white font-mono"
                />
                <Button onClick={copyLink} variant="primary" size="sm">
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Share / Invite / Gmail / LinkedIn */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["share", "invite", "gmail", "linkedin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? t === "linkedin" ? "bg-[#0A66C2] text-white" : "bg-brand-purple text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-brand-grey-dark dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t === "share" ? "Social Share" : t === "invite" ? "Bulk Email Invite" : t === "gmail" ? "Import from Gmail" : "Import from LinkedIn"}
            </button>
          ))}
        </div>

        {/* Share Tab */}
        {tab === "share" && dashboard?.referralLink && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Share on Social Media</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-brand-grey mb-4">Share your referral link with your network</p>
              <div className="flex flex-wrap gap-3">
                {SHARE_CHANNELS.map((ch) => (
                  <a
                    key={ch.id}
                    href={buildShareUrl(ch.id, dashboard.referralLink!, shareMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: ch.color }}
                  >
                    <span className="font-bold text-lg leading-none">{ch.icon}</span>
                    {ch.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Email Invite Tab */}
        {tab === "invite" && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Bulk Email Invite</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-brand-grey mb-3">
                Paste email addresses (one per line, or comma-separated). Optionally add names: &quot;Jane Smith &lt;jane@co.com&gt;&quot;
              </p>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                rows={6}
                placeholder={"jane@company.com\nJohn Doe <john@example.com>\nteam@startup.io"}
                className="w-full rounded-lg border border-brand-grey-light bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-brand-grey-dark dark:text-white placeholder:text-gray-400 font-mono focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
              />
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-brand-grey">
                  {bulkEmails.split(/[\n,;]+/).filter((l) => l.trim()).length} contact(s)
                </p>
                <Button onClick={sendBulkInvites} disabled={inviteLoading || !bulkEmails.trim()} size="sm">
                  {inviteLoading ? "Sending..." : "Send Invitations"}
                </Button>
              </div>
              {inviteResult && (
                <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
                  Sent: {inviteResult.sent} | Skipped (existing): {inviteResult.skipped} | Errors: {inviteResult.errors}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gmail Import Tab */}
        {tab === "gmail" && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Import from Gmail Contacts</CardTitle></CardHeader>
            <CardContent>
              {gmailContacts.length === 0 ? (
                <div>
                  <p className="text-sm text-brand-grey mb-4">
                    Connect your Google account to import contacts and send referral invitations in bulk.
                  </p>
                  <Button onClick={importGmail} disabled={gmailLoading} size="sm">
                    {gmailLoading ? "Connecting..." : "Connect Gmail & Import Contacts"}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-brand-grey">
                      {gmailContacts.length} contacts found | {selectedContacts.size} selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedContacts(new Set(gmailContacts.map((_, i) => i)))}
                      >
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedContacts(new Set())}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-brand-grey-light">
                    {gmailContacts.map((c, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-brand-grey-light/50 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(i)}
                          onChange={() => toggleContact(i)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                        />
                        <span className="text-sm text-brand-grey-dark dark:text-white">
                          {c.name ? `${c.name} — ` : ""}{c.email}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={inviteSelectedGmailContacts}
                      disabled={inviteLoading || selectedContacts.size === 0}
                      size="sm"
                    >
                      {inviteLoading ? "Sending..." : `Invite ${selectedContacts.size} Contact(s)`}
                    </Button>
                  </div>
                  {inviteResult && (
                    <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
                      Sent: {inviteResult.sent} | Skipped: {inviteResult.skipped} | Errors: {inviteResult.errors}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* LinkedIn Import Tab */}
        {tab === "linkedin" && (
          <Card className="mb-8">
            <CardHeader><CardTitle className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2" className="h-5 w-5">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Import from LinkedIn
            </CardTitle></CardHeader>
            <CardContent>
              {linkedinContacts.length === 0 ? (
                <div>
                  <p className="text-sm text-brand-grey mb-4">
                    Import your LinkedIn connections to invite them to OmniLearn. You need to have signed in with LinkedIn at least once to use this feature.
                  </p>
                  <Button onClick={importLinkedIn} disabled={linkedinLoading} size="sm">
                    {linkedinLoading ? "Importing..." : "Import LinkedIn Connections"}
                  </Button>
                  <p className="text-xs text-brand-grey mt-3">
                    Note: LinkedIn limits contact data for third-party apps. Some connections may not include email addresses.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-brand-grey">
                      {linkedinContacts.length} connections found | {linkedinContacts.filter((c) => c.email).length} with email | {selectedLinkedinContacts.size} selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedLinkedinContacts(
                            new Set(linkedinContacts.map((c, i) => (c.email ? i : -1)).filter((i) => i >= 0)),
                          )
                        }
                      >
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLinkedinContacts(new Set())}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-brand-grey-light">
                    {linkedinContacts.map((c, i) => (
                      <label
                        key={i}
                        className={`flex items-center gap-3 px-4 py-2 border-b border-brand-grey-light/50 last:border-b-0 ${
                          c.email
                            ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                            : "opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLinkedinContacts.has(i)}
                          onChange={() => c.email && toggleLinkedinContact(i)}
                          disabled={!c.email}
                          className="h-4 w-4 rounded border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2]"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm text-brand-grey-dark dark:text-white">
                            {c.name || "Unknown"}
                            {c.email ? ` — ${c.email}` : ""}
                          </span>
                          {!c.email && (
                            <span className="text-xs text-brand-grey">No email available</span>
                          )}
                          {c.profileUrl && (
                            <a
                              href={c.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#0A66C2] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View profile
                            </a>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={inviteSelectedLinkedinContacts}
                      disabled={inviteLoading || selectedLinkedinContacts.size === 0}
                      size="sm"
                    >
                      {inviteLoading ? "Sending..." : `Invite ${selectedLinkedinContacts.size} Contact(s)`}
                    </Button>
                  </div>
                  {linkedinInviteResult && (
                    <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
                      Sent: {linkedinInviteResult.sent} | Skipped: {linkedinInviteResult.skipped} | Errors: {linkedinInviteResult.errors}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Rewards */}
        {(dashboard?.activeRewards?.length ?? 0) > 0 && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Your Active Rewards</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard!.activeRewards.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-brand-grey-light/50 p-3">
                    <div>
                      <span className="inline-block rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple">
                        {r.grantedPlan}
                      </span>
                      <span className="ml-3 text-sm text-brand-grey">
                        {r.durationDays} days
                      </span>
                    </div>
                    <span className="text-xs text-brand-grey">
                      Expires {new Date(r.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Referrals */}
        <Card>
          <CardHeader><CardTitle>Recent Referrals</CardTitle></CardHeader>
          <CardContent>
            {(dashboard?.recentReferrals?.length ?? 0) === 0 ? (
              <p className="text-sm text-brand-grey">No referrals yet. Start sharing your link!</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {dashboard!.recentReferrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-brand-grey-light/50">
                    <div className="flex items-center gap-3">
                      <span className="text-brand-grey-dark dark:text-white font-medium">{r.referredEmail}</span>
                      {r.channel && (
                        <span className="text-xs text-brand-grey bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5">{r.channel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                        r.status === "CONVERTED"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : r.status === "SIGNED_UP"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {r.status}
                      </span>
                      <span className="text-xs text-brand-grey">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
