import { redirect } from "next/navigation";

/**
 * Bare /certificates was used in older certificate emails but conflicts with [tenant] routing
 * (the first segment is the academy slug). Send users to the default academy wallet.
 */
const DEFAULT_ACADEMY_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_ACADEMY_SLUG ?? "omnilearn";

export default function CertificatesWalletRedirectPage() {
  redirect(`/${DEFAULT_ACADEMY_SLUG}/certificates`);
}
