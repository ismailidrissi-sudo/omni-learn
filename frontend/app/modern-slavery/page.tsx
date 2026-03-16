"use client";

import { StaticPage } from "@/components/static-page";

export default function ModernSlaveryPage() {
  return (
    <StaticPage
      slug="modern-slavery"
      titleKey="landing.footer.modernSlavery"
      introKey="pages.modernSlavery.intro"
      defaultSections={[
        { titleKey: "pages.modernSlavery.section1Title", contentKey: "pages.modernSlavery.section1Content" },
        { titleKey: "pages.modernSlavery.section2Title", contentKey: "pages.modernSlavery.section2Content" },
        { titleKey: "pages.modernSlavery.section3Title", contentKey: "pages.modernSlavery.section3Content" },
        { titleKey: "pages.modernSlavery.section4Title", contentKey: "pages.modernSlavery.section4Content" },
        { titleKey: "pages.modernSlavery.section5Title", contentKey: "pages.modernSlavery.section5Content" },
      ]}
    />
  );
}
