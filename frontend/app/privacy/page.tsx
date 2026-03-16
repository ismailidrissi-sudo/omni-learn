"use client";

import { StaticPage } from "@/components/static-page";

export default function PrivacyPage() {
  return (
    <StaticPage
      slug="privacy"
      titleKey="landing.footer.privacy"
      introKey="pages.privacy.intro"
      defaultSections={[
        { titleKey: "pages.privacy.section1Title", contentKey: "pages.privacy.section1Content" },
        { titleKey: "pages.privacy.section2Title", contentKey: "pages.privacy.section2Content" },
        { titleKey: "pages.privacy.section3Title", contentKey: "pages.privacy.section3Content" },
        { titleKey: "pages.privacy.section4Title", contentKey: "pages.privacy.section4Content" },
        { titleKey: "pages.privacy.section5Title", contentKey: "pages.privacy.section5Content" },
        { titleKey: "pages.privacy.section6Title", contentKey: "pages.privacy.section6Content" },
        { titleKey: "pages.privacy.section7Title", contentKey: "pages.privacy.section7Content" },
        { titleKey: "pages.privacy.section8Title", contentKey: "pages.privacy.section8Content" },
      ]}
    />
  );
}
