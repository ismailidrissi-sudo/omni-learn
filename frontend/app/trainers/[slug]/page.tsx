import { redirect } from "next/navigation";

/** Canonical URL is `/trainer/[slug]`; kept for explicit server redirect if config is bypassed. */
export default async function LegacyTrainersSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/trainer/${slug}`);
}
