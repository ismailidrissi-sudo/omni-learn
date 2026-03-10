"use client";

import {
  LandingHeader,
  LandingHero,
  TrendingContent,
  MissionSection,
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
        <TrendingContent />
        <MissionSection />
        <StorySection />
        <TrustBar />
        <BentoGrid />
        <DomainExpertise />
        <PricingSection />
        <CTASection />
      </div>
    </div>
  );
}
