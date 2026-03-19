"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PathBuilder } from "@/components/admin/path-builder";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { adminHubNavItems } from "@/lib/nav/burger-nav";
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
  availablePlans?: string[];
  availableInEnterprise?: boolean;
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
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

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
    apiFetch("/company/tenants").then((r) => r.json()).then((d) => setTenants(Array.isArray(d) ? d : [])).catch(() => setTenants([]));
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

  const adminNav = useMemo(() => adminHubNavItems(t), [t]);

  const handleTogglePublish = async (path: PathItem) => {
    try {
      const res = await apiFetch(`/learning-paths/${path.id}`, {
        method: "PUT",
        body: JSON.stringify({ isPublished: !path.isPublished }),
      });
      if (res.ok) {
        setPaths((prev) =>
          prev.map((p) =>
            p.id === path.id ? { ...p, isPublished: !path.isPublished } : p
          )
        );
      }
    } catch {
      console.error("Failed to toggle publish status");
    }
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
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={adminNav} />

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
                    <div className="flex gap-2 items-center">
                      <Badge variant={path.isPublished ? "pulsar" : "stardust"}>
                        {path.isPublished ? t("admin.published") : t("admin.draft")}
                      </Badge>
                      <Button
                        variant={path.isPublished ? "outline" : "primary"}
                        size="sm"
                        onClick={() => handleTogglePublish(path)}
                      >
                        {path.isPublished ? t("admin.unpublish") : t("admin.publish")}
                      </Button>
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
            tenants={tenants}
            editingPath={editingPath ? {
              id: editingPath.id,
              name: editingPath.name,
              domainId: editingPath.domainId ?? editingPath.domain?.id ?? "",
              description: editingPath.description,
              isPublished: editingPath.isPublished,
              availablePlans: editingPath.availablePlans,
              availableInEnterprise: editingPath.availableInEnterprise,
              steps: editingPath.steps,
            } : null}
          />
        )}
      </main>
    </div>
  );
}
