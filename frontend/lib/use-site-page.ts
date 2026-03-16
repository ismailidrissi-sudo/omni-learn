"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface SitePageSection {
  title: string;
  content: string;
}

export interface SitePageData {
  slug: string;
  title: string;
  sections: SitePageSection[];
}

export function useSitePage(slug: string) {
  const [data, setData] = useState<SitePageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/site-pages/${slug}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((page) => {
        if (page) {
          const sections =
            typeof page.sections === "string"
              ? JSON.parse(page.sections)
              : page.sections;
          setData({ slug: page.slug, title: page.title, sections });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading };
}
