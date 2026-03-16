"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/use-user";
import { apiFetch } from "@/lib/api";

type Review = { id: string; userId: string; rating: number; review?: string; helpfulCount: number; createdAt: string };
type Stats = { total: number; average: number; distribution: { rating: number; count: number }[] };

export interface CourseReviewsProps {
  contentId: string;
  currentUserId?: string;
}

export function CourseReviews({ contentId, currentUserId }: CourseReviewsProps) {
  const { user } = useUser();
  const resolvedUserId = currentUserId ?? user?.id;
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    apiFetch(`/reviews/content/${contentId}`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => setReviews([]));
    apiFetch(`/reviews/content/${contentId}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, [contentId]);

  const submitReview = () => {
    if (rating < 1 || rating > 5 || !resolvedUserId) return;
    apiFetch(`/reviews/content/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resolvedUserId, rating, review: reviewText }),
    })
      .then(() => {
        setSubmitted(true);
        apiFetch(`/reviews/content/${contentId}`).then((r) => r.json()).then((d) => setReviews(d.reviews || []));
        apiFetch(`/reviews/content/${contentId}/stats`).then((r) => r.json()).then(setStats);
      });
  };

  const markHelpful = (reviewUserId: string) => {
    apiFetch(`/reviews/content/${contentId}/helpful/${reviewUserId}`, { method: "POST" })
      .then(() => apiFetch(`/reviews/content/${contentId}`).then((r) => r.json()).then((d) => setReviews(d.reviews || [])));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reviews.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="flex items-center gap-6">
            <div className="text-3xl font-bold text-brand-purple">{stats.average.toFixed(1)}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <span key={r} className={`text-lg ${r <= stats.average ? "text-brand-purple" : "text-brand-grey-light"}`}>★</span>
              ))}
            </div>
            <span className="text-brand-grey text-sm">{stats.total} {t("reviews.reviews")}</span>
          </div>
        )}

        {!submitted && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">{t("reviews.yourRating")}</p>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setRating(r)}
                  className={`text-2xl ${r <= rating ? "text-brand-purple" : "text-brand-grey-light hover:text-brand-purpleLight"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <Input
              placeholder={t("reviews.yourReviewPlaceholder")}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="mb-2"
            />
            <Button size="sm" onClick={submitReview} disabled={rating < 1}>{t("common.submit")}</Button>
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-brand-grey-light/50 pb-3">
              <div className="flex gap-2 items-center">
                <span className="text-brand-purple">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="text-brand-grey text-sm">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.review && <p className="text-sm text-brand-grey-dark mt-1">{r.review}</p>}
              <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => markHelpful(r.userId)}>
                {t("reviews.helpful")} ({r.helpfulCount})
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
