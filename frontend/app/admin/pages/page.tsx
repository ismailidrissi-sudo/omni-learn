"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NavToggles } from "@/components/ui/nav-toggles";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/use-user";
import { toast } from "@/lib/use-toast";

interface PageSection {
  title: string;
  content: string;
}

interface SitePage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[] | string;
  updatedAt: string;
}

const ALL_PAGES = [
  { slug: "about", label: "About", route: "/about" },
  { slug: "terms", label: "Terms of Use", route: "/terms" },
  { slug: "privacy", label: "Privacy Policy", route: "/privacy" },
  { slug: "what-we-offer", label: "What We Offer", route: "/what-we-offer" },
  { slug: "press", label: "Press", route: "/press" },
  { slug: "contact", label: "Contact", route: "/contact" },
  { slug: "modern-slavery", label: "Modern Slavery Declaration", route: "/modern-slavery" },
];

export default function AdminPagesPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<PageSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/site-pages")
      .then((r) => r.json())
      .then((data) => setPages(Array.isArray(data) ? data : []))
      .catch(() => setPages([]));
  }, []);

  const getPageData = (slug: string): SitePage | undefined =>
    pages.find((p) => p.slug === slug);

  const selectPage = (slug: string) => {
    const existing = getPageData(slug);
    setSelected(slug);
    setSaved(false);
    if (existing) {
      const sections =
        typeof existing.sections === "string"
          ? JSON.parse(existing.sections)
          : existing.sections;
      setEditTitle(existing.title);
      setEditSections(sections);
    } else {
      const pageMeta = ALL_PAGES.find((p) => p.slug === slug);
      setEditTitle(pageMeta?.label || slug);
      setEditSections([{ title: "Introduction", content: "" }]);
    }
  };

  const addSection = () => {
    setEditSections((prev) => [...prev, { title: "", content: "" }]);
  };

  const removeSection = (idx: number) => {
    setEditSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: "title" | "content", value: string) => {
    setEditSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch(`/site-pages/${selected}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle,
          sections: editSections,
          updatedBy: user?.id,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPages((prev) => {
          const exists = prev.find((p) => p.slug === selected);
          if (exists) {
            return prev.map((p) => (p.slug === selected ? updated : p));
          }
          return [...prev, updated];
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      toast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetPage = async () => {
    if (!selected) return;
    if (!confirm("Reset this page to default content? This will delete the custom version.")) return;
    try {
      await apiFetch(`/site-pages/${selected}`, { method: "DELETE" });
      setPages((prev) => prev.filter((p) => p.slug !== selected));
      setSelected(null);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1510]">
      <header className="border-b border-brand-grey-light dark:border-white/10 px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4 flex-wrap">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="ghost" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/domains"><Button variant="ghost" size="sm">Domains</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/certificates"><Button variant="ghost" size="sm">Certificates</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/pages"><Button variant="primary" size="sm">Pages</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <Link href="/admin/trainers"><Button variant="ghost" size="sm">Trainer requests</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light dark:border-white/10">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-brand-heading mb-2">
          Site Pages Editor
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          Edit the content of public pages. Changes override the default content. Reset to restore defaults.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Page list */}
          <Card>
            <CardHeader>
              <CardTitle>Pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ALL_PAGES.map((page) => {
                const hasCustom = !!getPageData(page.slug);
                return (
                  <button
                    key={page.slug}
                    onClick={() => selectPage(page.slug)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center justify-between ${
                      selected === page.slug
                        ? "bg-[#059669]/10 text-[#059669] font-medium"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span>{page.label}</span>
                    <span className="flex items-center gap-2">
                      {hasCustom && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#059669]" title="Custom content" />
                      )}
                      <Link
                        href={page.route}
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-[#059669] transition"
                        title="View page"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </Link>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Editor */}
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Edit: {ALL_PAGES.find((p) => p.slug === selected)?.label}</CardTitle>
                  <div className="flex gap-2 items-center">
                    {saved && (
                      <span className="text-xs text-[#059669] font-medium">Saved!</span>
                    )}
                    {getPageData(selected) && (
                      <button
                        onClick={resetPage}
                        className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition"
                      >
                        Reset to Default
                      </button>
                    )}
                    <button
                      onClick={saveChanges}
                      disabled={saving}
                      className="px-4 py-1.5 text-xs rounded-lg font-semibold text-white transition disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {editSections.map((section, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Section {idx + 1}
                      </span>
                      <button
                        onClick={() => removeSection(idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(idx, "title", e.target.value)}
                      placeholder="Section title"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
                    />
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(idx, "content", e.target.value)}
                      placeholder="Section content..."
                      rows={4}
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-20">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select a page from the left to edit its content.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
