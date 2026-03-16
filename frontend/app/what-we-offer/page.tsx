"use client";

import { StaticPage } from "@/components/static-page";

export default function WhatWeOfferPage() {
  return (
    <StaticPage
      slug="what-we-offer"
      titleKey="landing.footer.whatWeOffer"
      introKey="pages.whatWeOffer.intro"
      defaultSections={[
        { titleKey: "pages.whatWeOffer.section1Title", contentKey: "pages.whatWeOffer.section1Content" },
        { titleKey: "pages.whatWeOffer.section2Title", contentKey: "pages.whatWeOffer.section2Content" },
        { titleKey: "pages.whatWeOffer.section3Title", contentKey: "pages.whatWeOffer.section3Content" },
        { titleKey: "pages.whatWeOffer.section4Title", contentKey: "pages.whatWeOffer.section4Content" },
        { titleKey: "pages.whatWeOffer.section5Title", contentKey: "pages.whatWeOffer.section5Content" },
        { titleKey: "pages.whatWeOffer.section6Title", contentKey: "pages.whatWeOffer.section6Content" },
        { titleKey: "pages.whatWeOffer.section7Title", contentKey: "pages.whatWeOffer.section7Content" },
        { titleKey: "pages.whatWeOffer.section8Title", contentKey: "pages.whatWeOffer.section8Content" },
      ]}
    />
  );
}
