"use client";

import { useParams } from "next/navigation";
import { PublicTrainerProfile } from "@/components/trainer/public-trainer-profile";

export default function TrainerPublicSlugPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  if (!slug) return null;
  return <PublicTrainerProfile slug={slug} />;
}
