'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Key, Shield, Send, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Clock, BarChart3, Settings2, Loader2, Eye, EyeOff,
  Zap, Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface EmailConfig {
  configured: boolean;
  provider?: string;
  apiKeyMasked?: string;
  apiKeyLastFour?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
  defaultReplyTo?: string | null;
  dailySendLimit?: number;
  rateLimitPerSecond?: number;
  overflowStrategy?: string;
  overflowSendHour?: number;
  isActive?: boolean;
  lastVerifiedAt?: string | null;
  updatedAt?: string;
}

interface TodayStats {
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  failedToday: number;
  overflowedToday: number;
  pendingInQueue: number;
  usagePercentage: number;
}

interface ProviderUsage {
  configured: boolean;
  thisMinute: number;
  thisHour: number;
  today: number;
  limitPerMinute: number;
  limitPerHour: number;
  limitPerDay: number;
  minuteResetAt: string | null;
  hourResetAt: string | null;
  dayResetAt: string | null;
  queueDepth: number;
  estimatedClearMinutes: number | null;
}

interface QueueItem {
  id: string;
  toEmail: string;
  subject: string;
  emailType: string;
  priority: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

type Tab = 'settings' | 'queue' | 'stats';

export default function EmailAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [queue, setQueue] = useState<{ items: QueueItem[]; total: number }>({ items: [], total: 0 });
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [queuePage, setQueuePage] = useState(1);

  const [formApiKey, setFormApiKey] = useState('');
  const [formFromName, setFormFromName] = useState('');
  const [formFromEmail, setFormFromEmail] = useState('');
  const [formReplyTo, setFormReplyTo] = useState('');
  const [formDailyLimit, setFormDailyLimit] = useState(100);
  const [formOverflowHour, setFormOverflowHour] = useState(6);
  const [formIsActive, setFormIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; error?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [providerUsage, setProviderUsage] = useState<ProviderUsage | null>(null);

  const loadProviderUsage = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/settings/email-provider/usage');
      if (res.ok) setProviderUsage(await res.json());
    } catch {}
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/email/config');
      const data = await res.json();
      setConfig(data);
      if (data.configured) {
        setFormFromName(data.defaultFromName || '');
        setFormFromEmail(data.defaultFromEmail || '');
        setFormReplyTo(data.defaultReplyTo || '');
        setFormDailyLimit(data.dailySendLimit ?? 100);
        setFormOverflowHour(data.overflowSendHour ?? 6);
        setFormIsActive(data.isActive ?? true);
      }
    } catch (err) {
      console.error('Failed to load email config:', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/email/stats/today');
      setStats(await res.json());
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    const statusParam = queueFilter !== 'all' ? `&status=${queueFilter}` : '';
    try {
      const res = await apiFetch(`/admin/email/queue?page=${queuePage}&perPage=20${statusParam}`);
      setQueue(await res.json());
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }, [queueFilter, queuePage]);

  useEffect(() => {
    Promise.all([loadConfig(), loadStats(), loadQueue(), loadProviderUsage()]).finally(() => setIsLoading(false));
  }, [loadConfig, loadStats, loadQueue]);

  useEffect(() => {
    loadQueue();
  }, [queueFilter, queuePage, loadQueue]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
      loadProviderUsage();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadStats, loadProviderUsage]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const body: Record<string, string | number | boolean | null> = {};
      if (formApiKey) body.apiKey = formApiKey;
      if (formFromName !== (config?.defaultFromName || '')) body.defaultFromName = formFromName;
      if (formFromEmail !== (config?.defaultFromEmail || '')) body.defaultFromEmail = formFromEmail;
      if (formReplyTo !== (config?.defaultReplyTo || '')) body.defaultReplyTo = formReplyTo || null;
      if (formDailyLimit !== (config?.dailySendLimit ?? 100)) body.dailySendLimit = formDailyLimit;
      if (formOverflowHour !== (config?.overflowSendHour ?? 6)) body.overflowSendHour = formOverflowHour;
      if (formIsActive !== (config?.isActive ?? true)) body.isActive = formIsActive;

      if (!config?.configured && !body.apiKey) {
        setSaveMessage({ type: 'error', text: 'API key is required for initial setup.' });
        setIsSaving(false);
        return;
      }

      if (config?.configured && Object.keys(body).length === 0) {
        setSaveMessage({ type: 'error', text: 'No changes detected.' });
        setIsSaving(false);
        return;
      }

      const res = await apiFetch('/admin/email/config', {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Configuration saved successfully.' });
        setFormApiKey('');
        await loadConfig();
      } else {
        const err = await res.json();
        setSaveMessage({ type: 'error', text: err.message || 'Failed to save.' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/admin/email/test-connection', { method: 'POST' });
      setTestResult(await res.json());
    } catch {
      setTestResult({ status: 'error', error: 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmailAddress) return;
    setIsSendingTest(true);
    try {
      const res = await apiFetch('/admin/email/send-test', {
        method: 'POST',
        body: JSON.stringify({ toEmail: testEmailAddress }),
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: `Test email queued to ${testEmailAddress}` });
      } else {
        setSaveMessage({ type: 'error', text: 'Failed to queue test email.' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to queue test email.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRetry = async (id: string) => {
    await apiFetch(`/admin/email/queue/${id}/retry`, { method: 'POST' });
    loadQueue();
  };

  const handleCancel = async (id: string) => {
    await apiFetch(`/admin/email/queue/${id}/cancel`, { method: 'POST' });
    loadQueue();
  };

  const priorityLabel = (p: string) => {
    const map: Record<string, string> = { CRITICAL: 'Critical', HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' };
    return map[p] || p;
  };
  const priorityColor = (p: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'text-red-400', HIGH: 'text-orange-400', NORMAL: 'text-slate-400', LOW: 'text-slate-500',
    };
    return map[p] || 'text-slate-400';
  };
  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      SENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      SENDING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
      SCHEDULED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    };
    return styles[s] || styles.PENDING;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Mail className="w-7 h-7 text-indigo-400" />
          Email Configuration
        </h1>
        <p className="text-slate-400 mt-1">
          Manage email provider, sending limits, and monitor the email queue.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {([
            { label: 'Sent Today', value: stats.sentToday, max: stats.dailyLimit, icon: Send, color: 'text-emerald-400' },
            { label: 'Remaining', value: stats.remainingToday, icon: Zap, color: 'text-indigo-400' },
            { label: 'Failed', value: stats.failedToday, icon: XCircle, color: 'text-red-400' },
            { label: 'Overflowed', value: stats.overflowedToday, icon: Calendar, color: 'text-amber-400' },
            { label: 'In Queue', value: stats.pendingInQueue, icon: Clock, color: 'text-purple-400' },
          ]).map(({ label, value, max, icon: Icon, color }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {value}
                {max !== undefined && (
                  <span className="text-sm font-normal text-slate-500"> / {max}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Daily Usage</span>
            <span className="text-sm text-slate-400">{stats.usagePercentage}%</span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.usagePercentage >= 90 ? 'bg-red-500' :
                stats.usagePercentage >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, stats.usagePercentage)}%` }}
            />
          </div>
          {stats.usagePercentage >= 90 && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Approaching daily limit. New emails will be scheduled for tomorrow.
            </p>
          )}
        </div>
      )}

      {providerUsage?.configured && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Provider Rate Limits (Live)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              {
                label: 'This Minute',
                used: providerUsage.thisMinute,
                limit: providerUsage.limitPerMinute,
                resetAt: providerUsage.minuteResetAt,
              },
              {
                label: 'This Hour',
                used: providerUsage.thisHour,
                limit: providerUsage.limitPerHour,
                resetAt: providerUsage.hourResetAt,
              },
              {
                label: 'Today',
                used: providerUsage.today,
                limit: providerUsage.limitPerDay,
                resetAt: providerUsage.dayResetAt,
              },
            ]).map(({ label, used, limit, resetAt }) => {
              const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
              return (
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{label}</span>
                    <span className="text-slate-400">{used} / {limit}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  {resetAt && (
                    <p className="text-[10px] text-slate-500">
                      Resets {new Date(resetAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-6 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
            <span>Queue depth: <strong className="text-white">{providerUsage.queueDepth}</strong> emails</span>
            {providerUsage.estimatedClearMinutes != null && (
              <span>Est. clear time: <strong className="text-white">~{providerUsage.estimatedClearMinutes} min</strong></span>
            )}
          </div>

          <div className="mt-3 text-[10px] text-slate-500 space-y-0.5">
            <p className="font-medium text-slate-400">Priority queue order:</p>
            <p>P1 (Critical): Password reset, email verification</p>
            <p>P2 (High): Account approval/rejection</p>
            <p>P3 (Normal): Enrollment, completion, certificates</p>
            <p>P4 (Low): Suggestions, digests, campaigns</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 w-fit">
        {([
          { id: 'settings' as const, label: 'SMTP Settings', icon: Settings2 },
          { id: 'queue' as const, label: 'Email Queue', icon: Mail },
          { id: 'stats' as const, label: 'Send History', icon: BarChart3 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${activeTab === id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-indigo-400" />
              Provider &amp; Authentication
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Provider</label>
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Resend</p>
                    <p className="text-xs text-slate-400">resend.com — HTTP API</p>
                  </div>
                  {config?.lastVerifiedAt && (
                    <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              {config?.configured && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Current API Key</label>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm text-slate-400">
                    {config.apiKeyMasked || '••••••••••••'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {config?.configured ? 'Update API Key' : 'Resend API Key'}
                  {config?.configured && <span className="text-slate-500 ml-1">(leave empty to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="re_xxxxxxxxx..."
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 pr-12
                             text-white font-mono text-sm placeholder:text-slate-600
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {config?.configured && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600
                             text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    Test Connection
                  </button>
                  {testResult && (
                    <span className={`text-sm flex items-center gap-1 ${
                      testResult.status === 'connected' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {testResult.status === 'connected'
                        ? <><CheckCircle2 className="w-4 h-4" /> Connected</>
                        : <><XCircle className="w-4 h-4" /> {testResult.error}</>
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-indigo-400" />
              Sender Defaults
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">From Name</label>
                <input
                  type="text"
                  value={formFromName}
                  onChange={(e) => setFormFromName(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">From Email</label>
                <input
                  type="email"
                  value={formFromEmail}
                  onChange={(e) => setFormFromEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Reply-To Email</label>
                <input
                  type="email"
                  value={formReplyTo}
                  onChange={(e) => setFormReplyTo(e.target.value)}
                  placeholder="Optional — defaults to From Email"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>
          </section>

          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Rate Limits &amp; Overflow
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Daily Send Limit</label>
                <input
                  type="number"
                  min={1}
                  value={formDailyLimit}
                  onChange={(e) => setFormDailyLimit(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Emails exceeding this limit are auto-scheduled to the next day.
                  Critical emails (password resets, 2FA) bypass this limit.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Overflow Send Hour (UTC)
                </label>
                <select
                  value={formOverflowHour}
                  onChange={(e) => setFormOverflowHour(parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 UTC
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Overflowed emails start sending at this hour the next day.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div>
                <p className="text-sm font-medium text-white">Email System Active</p>
                <p className="text-xs text-slate-400">When disabled, all emails are queued but not sent.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormIsActive(!formIsActive)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formIsActive ? 'bg-indigo-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  formIsActive ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </section>

          {config?.configured && (
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Send className="w-5 h-5 text-emerald-400" />
                Send Test Email
              </h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm
                           placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testEmailAddress}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500
                           text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Test
                </button>
              </div>
            </section>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500
                       text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Configuration
            </button>
            {saveMessage && (
              <span className={`text-sm flex items-center gap-1 ${
                saveMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {saveMessage.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <XCircle className="w-4 h-4" />
                }
                {saveMessage.text}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {['all', 'PENDING', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'].map(f => (
              <button
                key={f}
                onClick={() => { setQueueFilter(f); setQueuePage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  queueFilter === f
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
            <button
              onClick={loadQueue}
              className="ml-auto text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {queue.items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-white font-mono text-xs">{item.toEmail}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">{item.subject}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                        {item.emailType}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${priorityColor(item.priority)}`}>
                      {priorityLabel(item.priority)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusBadge(item.status)}`}>
                        {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {item.sentAt
                        ? new Date(item.sentAt).toLocaleString()
                        : item.scheduledFor
                          ? `Sched: ${new Date(item.scheduledFor).toLocaleString()}`
                          : new Date(item.createdAt).toLocaleString()
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 mr-2"
                        >
                          Retry
                        </button>
                      )}
                      {['PENDING', 'SCHEDULED'].includes(item.status) && (
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {queue.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No emails in queue matching this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {queue.total > 20 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-400">
                Showing {((queuePage - 1) * 20) + 1}–{Math.min(queuePage * 20, queue.total)} of {queue.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                  disabled={queuePage === 1}
                  className="px-3 py-1.5 rounded bg-slate-700 text-white text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setQueuePage(p => p + 1)}
                  disabled={queuePage * 20 >= queue.total}
                  className="px-3 py-1.5 rounded bg-slate-700 text-white text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <p className="text-slate-400 text-sm mb-4">
            Send history for the last 30 days. Connect a chart library (e.g. Recharts) to
            the <code className="text-indigo-400">/admin/email/stats/history</code> endpoint.
          </p>
          <p className="text-slate-500 text-xs">
            Fields available per day: <code>dayBucket</code>, <code>sentCount</code>,{' '}
            <code>failedCount</code>, <code>scheduledOverflowCount</code>
          </p>
        </div>
      )}
    </div>
  );
}
