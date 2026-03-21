"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { AppBurgerHeader } from "@/components/ui/app-burger-header";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { tenantAdminNavItems } from "@/lib/nav/burger-nav";

type Props = {
  slug: string;
  academyName: string;
  logoUrl?: string | null;
  contextSlot?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Merged onto the header element (e.g. background for dark shells) */
  className?: string;
  borderClassName?: string;
};

export function TenantAdminBurgerHeader({
  slug,
  academyName,
  logoUrl,
  contextSlot,
  trailing,
  className,
  borderClassName = "border-b border-[var(--color-bg-secondary)]",
}: Props) {
  const { t } = useI18n();
  const items = useMemo(() => tenantAdminNavItems(t, slug), [t, slug]);

  return (
    <AppBurgerHeader
      borderClassName={borderClassName}
      logoHref={`/${slug}`}
      logo={<TenantLogo logoUrl={logoUrl} name={academyName} size="md" />}
      title={academyName}
      contextSlot={contextSlot}
      trailing={trailing}
      items={items}
      className={className}
    />
  );
}
