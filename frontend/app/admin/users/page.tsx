import { redirect } from "next/navigation";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.view;
  const view = Array.isArray(raw) ? raw[0] : raw;
  const qs = view === "map" || view === "list" ? `?view=${encodeURIComponent(view)}` : "";
  redirect(`/admin/analytics/users${qs}`);
}
