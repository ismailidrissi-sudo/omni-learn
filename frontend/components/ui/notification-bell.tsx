"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type Notification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/notifications/unread-count")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    apiFetch("/notifications?limit=10")
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    setUnreadCount(0);
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    setNotifications((ns) => ns.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const typeIcon: Record<string, string> = {
    TRAINING_ASSIGNED: "📋",
    PATH_COMPLETED: "🎉",
    CERTIFICATE_ISSUED: "🏆",
    DUE_DATE_APPROACHING: "⏰",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--color-bg-secondary)] bg-white dark:bg-[#1a1e18] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-secondary)]">
            <span className="font-semibold text-sm text-[var(--color-text-primary)]">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[var(--color-accent)] hover:underline">
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
                {t("notifications.noNotifications")}
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--color-bg-secondary)] last:border-0 hover:bg-[var(--color-bg-secondary)]/50 transition-colors ${
                    !n.isRead ? "bg-[var(--color-accent)]/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{typeIcon[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? "font-semibold" : ""} text-[var(--color-text-primary)]`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="h-2 w-2 rounded-full bg-[var(--color-accent)] mt-1.5 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
