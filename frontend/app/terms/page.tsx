"use client";

import { StaticPage } from "@/components/static-page";

export default function TermsPage() {
  return (
    <StaticPage
      slug="terms"
      titleKey="landing.footer.terms"
      introKey="pages.terms.intro"
      defaultSections={[
        { titleKey: "pages.terms.section1Title", contentKey: "pages.terms.section1Content" },
        { titleKey: "pages.terms.section2Title", contentKey: "pages.terms.section2Content" },
        { titleKey: "pages.terms.section3Title", contentKey: "pages.terms.section3Content" },
        { titleKey: "pages.terms.section4Title", contentKey: "pages.terms.section4Content" },
        { titleKey: "pages.terms.section5Title", contentKey: "pages.terms.section5Content" },
        { titleKey: "pages.terms.section6Title", contentKey: "pages.terms.section6Content" },
        { titleKey: "pages.terms.section7Title", contentKey: "pages.terms.section7Content" },
        { titleKey: "pages.terms.section8Title", contentKey: "pages.terms.section8Content" },
      ]}
    />
  );
}
