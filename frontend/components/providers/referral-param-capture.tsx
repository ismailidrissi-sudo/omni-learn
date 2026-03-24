"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureReferralFromSearchParams } from "@/lib/referral-storage";

function ReferralParamCaptureInner() {
  const searchParams = useSearchParams();
  useEffect(() => {
    captureReferralFromSearchParams(searchParams);
  }, [searchParams]);
  return null;
}

export function ReferralParamCapture() {
  return (
    <Suspense fallback={null}>
      <ReferralParamCaptureInner />
    </Suspense>
  );
}
