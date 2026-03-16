"use client";

import { StaticPage } from "@/components/static-page";

export default function AboutPage() {
  return (
    <StaticPage
      slug="about"
      titleKey="landing.footer.about"
      introKey="pages.about.intro"
      defaultSections={[
        { titleKey: "pages.about.section1Title", contentKey: "pages.about.section1Content" },
        { titleKey: "pages.about.section2Title", contentKey: "pages.about.section2Content" },
        { titleKey: "pages.about.section3Title", contentKey: "pages.about.section3Content" },
        { titleKey: "pages.about.section4Title", contentKey: "pages.about.section4Content" },
        { titleKey: "pages.about.section5Title", contentKey: "pages.about.section5Content" },
        { titleKey: "pages.about.section6Title", contentKey: "pages.about.section6Content" },
      ]}
    />
  );
}
