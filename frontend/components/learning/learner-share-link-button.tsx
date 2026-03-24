"use client";

import { useCallback } from "react";
import { useUser } from "@/lib/use-user";
import { useReferralShareCode } from "@/lib/use-referral-share-code";
import { absoluteLearnerUrlWithReferral } from "@/lib/referral-share-url";
import { toast } from "@/lib/use-toast";
import { useI18n } from "@/lib/i18n/context";

type Props = {
  /** Path starting with `/` (e.g. `/content/abc` or `/slug/content/abc`). */
  path: string;
  label?: string;
  className?: string;
  shareTitle?: string;
};

export function LearnerShareLinkButton({ path, label, className, shareTitle }: Props) {
  const { user } = useUser();
  const referralCode = useReferralShareCode(!!user);
  const { t } = useI18n();

  const handleShare = useCallback(async () => {
    const url = absoluteLearnerUrlWithReferral(path, referralCode);
    const title = shareTitle?.trim() || (typeof document !== "undefined" ? document.title : "OmniLearn");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(t("content.linkCopied"), "success");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast(t("content.linkCopied"), "success");
      } catch {
        /* ignore */
      }
    }
  }, [path, referralCode, shareTitle, t]);

  return (
    <button type="button" onClick={handleShare} className={className}>
      {label ?? t("content.shareLink")}
    </button>
  );
}
