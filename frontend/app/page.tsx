"use client";

import {
  LandingHeader,
  LandingHero,
  TrendingContent,
  MissionSection,
  EnterpriseSection,
  StorySection,
  TrustBar,
  BentoGrid,
  DomainExpertise,
  CTASection,
} from "@/components/landing";
import { PricingSection } from "@/components/pricing";

export default function Home() {
  return (
    <div className="min-h-screen font-landing bg-[#F5F5DC] dark:bg-[#0f1510]">
      <LandingHeader />
      <div>
        <LandingHero />
        <TrustBar />
        <StorySection />
        <BentoGrid />
        <DomainExpertise />
        <MissionSection />
        <EnterpriseSection />
        <TrendingContent />
        <PricingSection />
        <CTASection />
      </div>
    </div>
  );
}
