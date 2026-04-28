import type { ToastType } from "@/lib/use-toast";

/** Response from POST /company/users/bulk-invite */
export type BulkInviteResponse = {
  invited?: number;
  attached?: number;
  alreadyMember?: number;
  existsElsewhere?: number;
  total?: number;
};

/**
 * Maps bulk-invite API counts to a user-visible message and toast severity.
 */
export function bulkInviteFeedback(
  t: (key: string, vars?: Record<string, string>) => string,
  data: BulkInviteResponse,
): { message: string; type: ToastType } {
  const invited = Number(data.invited ?? 0);
  const attached = Number(data.attached ?? 0);
  const alreadyMember = Number(data.alreadyMember ?? 0);
  const existsElsewhere = Number(data.existsElsewhere ?? 0);
  const ok = invited + attached;

  if (ok > 0 && alreadyMember === 0 && existsElsewhere === 0) {
    if (invited > 0 && attached > 0) {
      return {
        message: t("adminTenant.inviteResultSuccessBoth", {
          invited: String(invited),
          attached: String(attached),
        }),
        type: "success",
      };
    }
    if (attached > 0) {
      return {
        message: t("adminTenant.inviteResultAttached", { count: String(attached) }),
        type: "success",
      };
    }
    return {
      message: t("adminTenant.inviteResultInvited", { count: String(invited) }),
      type: "success",
    };
  }

  if (ok === 0 && alreadyMember > 0 && existsElsewhere === 0) {
    return { message: t("adminTenant.inviteResultAlreadyMember"), type: "info" };
  }

  if (ok === 0 && existsElsewhere > 0 && alreadyMember === 0) {
    return { message: t("adminTenant.inviteResultExistsElsewhere"), type: "error" };
  }

  if (ok === 0) {
    return {
      message: t("adminTenant.inviteResultMixedNone", {
        alreadyMember: String(alreadyMember),
        existsElsewhere: String(existsElsewhere),
      }),
      type: "warning",
    };
  }

  return {
    message: t("adminTenant.inviteResultMixed", {
      invited: String(invited),
      attached: String(attached),
      alreadyMember: String(alreadyMember),
      existsElsewhere: String(existsElsewhere),
    }),
    type: "warning",
  };
}
