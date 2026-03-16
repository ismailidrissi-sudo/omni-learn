"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OmnilearnLogo } from "@/components/ui/omnilearn-logo";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/use-toast";

export interface PageSection {
  title: string;
  content: string;
}

interface StaticPageProps {
  slug: string;
  titleKey: string;
  introKey: string;
  /** i18n fallback sections — used when no API override exists */
  defaultSections: { titleKey: string; contentKey: string }[];
}

export function StaticPage({ slug, titleKey, introKey, defaultSections }: StaticPageProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const isAdmin = !!user?.isAdmin || user?.planId === "NEXUS" || user?.planId === "VISIONARY";

  const [apiSections, setApiSections] = useState<PageSection[] | null>(null);
  const [apiTitle, setApiTitle] = useState<string | null>(null);
  const [apiIntro, setApiIntro] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<PageSection[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/site-pages/${slug}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((page) => {
        if (page) {
          const sections =
            typeof page.sections === "string" ? JSON.parse(page.sections) : page.sections;
          if (Array.isArray(sections) && sections.length > 0) {
            setApiTitle(page.title);
            setApiIntro(sections[0]?.content || null);
            setApiSections(sections.slice(1));
          }
        }
      })
      .catch(() => {});
  }, [slug]);

  const title = apiTitle || t(titleKey);
  const intro = apiIntro || t(introKey);
  const sections: PageSection[] = apiSections || defaultSections.map((s) => ({
    title: t(s.titleKey),
    content: t(s.contentKey),
  }));

  const startEditing = useCallback(() => {
    setEditTitle(title);
    const fullSections = [{ title: "Introduction", content: intro }, ...sections];
    setEditSections(fullSections);
    setEditing(true);
  }, [title, intro, sections]);

  const addSection = () => {
    setEditSections((prev) => [...prev, { title: "", content: "" }]);
  };

  const removeSection = (idx: number) => {
    if (idx === 0) return;
    setEditSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: "title" | "content", value: string) => {
    setEditSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await apiFetch(`/site-pages/${slug}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle,
          sections: editSections,
          updatedBy: user?.id,
        }),
      });
      setApiTitle(editTitle);
      setApiIntro(editSections[0]?.content || "");
      setApiSections(editSections.slice(1));
      setEditing(false);
    } catch {
      toast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]">
        <header className="border-b border-gray-200 dark:border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
          <Link href="/">
            <OmnilearnLogo size="md" variant="light" />
          </Link>
          <NavToggles />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-brand-heading">
              Editing: {slug}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Page Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>

            {editSections.map((section, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {idx === 0 ? "Introduction" : `Section ${idx}`}
                  </span>
                  {idx > 0 && (
                    <button
                      onClick={() => removeSection(idx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {idx > 0 && (
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(idx, "title", e.target.value)}
                    placeholder="Section title"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
                  />
                )}
                <textarea
                  value={section.content}
                  onChange={(e) => updateSection(idx, "content", e.target.value)}
                  placeholder="Section content"
                  rows={idx === 0 ? 3 : 5}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm resize-y"
                />
              </div>
            ))}

            <button
              onClick={addSection}
              className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#059669] hover:text-[#059669] transition text-sm font-medium"
            >
              + Add Section
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#0f1510]">
      <header className="border-b border-gray-200 dark:border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
        <Link href="/">
          <OmnilearnLogo size="md" variant="light" />
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#059669]/30 text-[#059669] hover:bg-[#059669]/10 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Page
            </button>
          )}
          <NavToggles />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-brand-heading">
          {title}
        </h1>
        <p className="mt-4 text-gray-600 dark:text-brand-stardustLight">
          {intro}
        </p>
        <div className="mt-8 space-y-6 text-gray-700 dark:text-gray-300">
          {sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-heading">
                {section.title}
              </h2>
              <p className="mt-2 leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>
        <Link href="/" className="mt-12 inline-block text-brand-nova hover:underline">
          &larr; {t("pages.backToHome")}
        </Link>
      </main>
    </div>
  );
}
