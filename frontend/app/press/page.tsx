"use client";

import { StaticPage } from "@/components/static-page";

export default function PressPage() {
  return (
    <StaticPage
      slug="press"
      titleKey="landing.footer.press"
      introKey="pages.press.intro"
      defaultSections={[
        { titleKey: "pages.press.section1Title", contentKey: "pages.press.section1Content" },
        { titleKey: "pages.press.section2Title", contentKey: "pages.press.section2Content" },
        { titleKey: "pages.press.section3Title", contentKey: "pages.press.section3Content" },
        { titleKey: "pages.press.section4Title", contentKey: "pages.press.section4Content" },
      ]}
    />
  );
}
