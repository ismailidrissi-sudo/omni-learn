"use client";

import { useParams } from "next/navigation";
import { TenantProvider } from "@/components/providers/tenant-context";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/context";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey={`${slug}-theme`}>
      <I18nProvider>
        <TenantProvider slug={slug}>
          {children}
        </TenantProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
