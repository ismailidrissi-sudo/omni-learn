"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PathBuilder } from "@/components/admin/path-builder";
import { NavToggles } from "@/components/ui/nav-toggles";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

const CONTENT_TYPES = [
  { type: "COURSE", icon: "📚" },
  { type: "MICRO_LEARNING", icon: "⚡" },
  { type: "PODCAST", icon: "🎧" },
  { type: "DOCUMENT", icon: "📄" },
  { type: "IMPLEMENTATION_GUIDE", icon: "🛠️" },
  { type: "QUIZ_ASSESSMENT", icon: "✅" },
  { type: "GAME", icon: "🎮" },
  { type: "VIDEO", icon: "🎬" },
];

type PathItem = {
  id: string;
  name: string;
  description?: string;
  domain?: { id: string; name: string; slug: string } | null;
  domainId?: string;
  _count?: { steps: number; enrollments: number };
  isPublished: boolean;
  steps?: Array<{
    id: string;
    contentItemId: string;
    contentItem?: { id: string; title: string; type: string; durationMinutes?: number };
    stepOrder: number;
    isRequired: boolean;
  }>;
};

export default function AdminPathsPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const userTenantId = user?.tenantId;
  const [view, setView] = useState<"list" | "builder">("list");
  const [search, setSearch] = useState("");
  const [domains, setDomains] = useState<Array<{ id: string; name: string; slug: string; icon?: string }>>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [editingPath, setEditingPath] = useState<PathItem | null>(null);

  const fetchPaths = useCallback(async (tid: string | null) => {
    setLoadingPaths(true);
    try {
      const qs = tid ? `?tenantId=${tid}&includeDraft=true` : "?includeDraft=true";
      const res = await apiFetch(`/learning-paths${qs}`);
      const data = await res.json();
      setPaths(Array.isArray(data) ? data : []);
    } catch {
      setPaths([]);
    } finally {
      setLoadingPaths(false);
    }
  }, []);

  useEffect(() => {
    const tid = userTenantId ?? null;
    setTenantId(tid);
    fetchPaths(tid);
    if (tid) {
      apiFetch(`/domains?tenantId=${tid}`)
        .then((r) => r.json())
        .then((d: { id: string; name: string; slug: string; icon?: string }[]) => setDomains(Array.isArray(d) ? d : []))
        .catch(() => setDomains([]));
    }
  }, [userTenantId, fetchPaths]);

  const domainsForBuilder = domains.length > 0
    ? domains.map((d) => ({ id: d.id, name: d.name, icon: d.icon ?? "📚" }))
    : [{ id: "", name: "ESG", icon: "🌍" }, { id: "", name: "Food Safety", icon: "🔬" }];

  const filteredPaths = paths.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = () => {
    setEditingPath(null);
    setView("list");
    fetchPaths(tenantId);
  };

  const handleNewPath = () => {
    setEditingPath(null);
    setView("builder");
  };

  const handleEditPath = async (path: PathItem) => {
    try {
      const res = await apiFetch(`/learning-paths/${path.id}`);
      if (res.ok) {
        const fullPath = await res.json();
        setEditingPath({ ...path, ...fullPath });
      } else {
        setEditingPath(path);
      }
    } catch {
      setEditingPath(path);
    }
    setView("builder");
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <LearnLogo size="md" variant="purple" />
        <nav className="flex items-center gap-4">
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths"><Button variant="primary" size="sm">{t("nav.paths")}</Button></Link>
          <Link href="/admin/domains"><Button variant="ghost" size="sm">Domains</Button></Link>
          <Link href="/admin/content"><Button variant="ghost" size="sm">{t("nav.content")}</Button></Link>
          <Link href="/admin/certificates"><Button variant="ghost" size="sm">Certificates</Button></Link>
          <Link href="/admin/company"><Button variant="ghost" size="sm">{t("nav.company")}</Button></Link>
          <Link href="/admin/pages"><Button variant="ghost" size="sm">Pages</Button></Link>
          <Link href="/admin/analytics"><Button variant="ghost" size="sm">{t("nav.analytics")}</Button></Link>
          <Link href="/admin/provisioning"><Button variant="ghost" size="sm">{t("nav.scim")}</Button></Link>
          <Link href="/admin/trainers"><Button variant="ghost" size="sm">Trainer requests</Button></Link>
          <Link href="/admin/company-admins"><Button variant="ghost" size="sm">Company Admin requests</Button></Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-brand-title text-brand-grey-dark font-bold">
            {t("admin.learningPathBuilder")}
          </h1>
          <Button
            onClick={() => view === "list" ? handleNewPath() : handleSaved()}
            variant="primary"
          >
            {view === "list" ? t("admin.newPath") : t("admin.allPaths")}
          </Button>
        </div>

        {view === "list" && (
          <div>
            <div className="flex gap-4 mb-6">
              <Input
                placeholder={t("admin.searchPaths")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="space-y-4">
              {loadingPaths ? (
                <Card className="p-8 text-center text-brand-grey">
                  <p>Loading...</p>
                </Card>
              ) : filteredPaths.length === 0 ? (
                <Card className="p-8 text-center text-brand-grey">
                  <p>{t("admin.noPathsYet")}</p>
                  <Button
                    className="mt-4"
                    onClick={handleNewPath}
                  >
                    {t("admin.createPath")}
                  </Button>
                </Card>
              ) : (
                filteredPaths.map((path) => (
                  <Card key={path.id} className="p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-brand-grey-dark">{path.name}</h3>
                      <div className="flex gap-2 mt-1">
                        {path.domain && (
                          <Badge variant="pulsar">{path.domain.name}</Badge>
                        )}
                        <span className="text-brand-grey text-sm">
                          {path._count?.steps ?? 0} {t("admin.steps")}
                        </span>
                        <span className="text-brand-grey text-sm">
                          {path._count?.enrollments ?? 0} enrolled
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={path.isPublished ? "pulsar" : "stardust"}>
                        {path.isPublished ? t("admin.published") : t("admin.draft")}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPath(path)}
                      >
                        {t("common.edit")}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {view === "builder" && (
          <PathBuilder
            domains={domainsForBuilder}
            tenantId={tenantId}
            contentTypes={CONTENT_TYPES}
            onSave={handleSaved}
            editingPath={editingPath ? {
              id: editingPath.id,
              name: editingPath.name,
              domainId: editingPath.domainId ?? editingPath.domain?.id ?? "",
              description: editingPath.description,
              isPublished: editingPath.isPublished,
              steps: editingPath.steps,
            } : null}
          />
        )}
      </main>
    </div>
  );
}
