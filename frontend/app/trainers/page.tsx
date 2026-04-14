"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { trainersDirectoryNavItems } from "@/lib/nav/burger-nav";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

interface TrainerCard {
  id: string;
  slug: string;
  headline?: string;
  photoUrl?: string;
  location?: string;
  specializations?: string[];
  totalCourses: number;
  totalStudents: number;
  avgRating?: number;
  availableForHire: boolean;
  user: { id: string; name: string };
}

export default function TrainersDirectoryPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const navItems = useMemo(() => trainersDirectoryNavItems(t, user), [t, user]);
  const [trainers, setTrainers] = useState<TrainerCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (search) params.set("search", search);

    apiFetch(`/trainer-profiles/directory?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTrainers(data.profiles ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => setTrainers([]))
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="min-h-screen bg-white">
      <AppBurgerHeader logoHref="/" logo={<LearnLogo size="md" variant="purple" />} items={navItems} />

      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-grey-dark mb-2">Meet Our Trainers</h1>
          <p className="text-brand-grey max-w-xl mx-auto">
            Discover expert trainers across industries. Browse profiles, explore their courses, and connect with the right instructor for your learning goals.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-8">
          <Input
            placeholder="Search trainers by name, expertise, or topic..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="min-h-[300px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
              <p className="text-sm text-brand-grey">Loading trainers...</p>
            </div>
          </div>
        ) : trainers.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-brand-grey text-lg mb-2">No trainers found</p>
            <p className="text-brand-grey text-sm">
              {search ? "Try adjusting your search terms." : "No published trainer profiles yet."}
            </p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-brand-grey mb-4">{total} trainer{total !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trainers.map((t) => (
                <Link key={t.id} href={`/trainer/${t.slug}`}>
                  <Card className="p-0 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="h-20 bg-gradient-to-r from-brand-purple/20 to-brand-purple/5" />
                    <div className="px-5 pb-5 -mt-8">
                      <div className="w-16 h-16 rounded-full border-4 border-white bg-brand-grey-light overflow-hidden mb-3">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-brand-grey">
                            {t.user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-brand-grey-dark text-lg">{t.user.name}</h3>
                      {t.headline && (
                        <p className="text-sm text-brand-grey mt-0.5 line-clamp-2">{t.headline}</p>
                      )}
                      {t.location && (
                        <p className="text-xs text-brand-grey mt-1">{t.location}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(t.specializations ?? []).slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="pulsar">{s}</Badge>
                        ))}
                        {(t.specializations ?? []).length > 3 && (
                          <Badge variant="default">+{(t.specializations ?? []).length - 3}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-4 text-xs text-brand-grey">
                        <span>{t.totalCourses} course{t.totalCourses !== 1 ? "s" : ""}</span>
                        <span>{t.totalStudents} student{t.totalStudents !== 1 ? "s" : ""}</span>
                        {t.avgRating != null && <span>{t.avgRating.toFixed(1)} avg rating</span>}
                      </div>
                      {t.availableForHire && (
                        <Badge variant="pulsar" className="mt-3">Available for hire</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm text-brand-grey">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
