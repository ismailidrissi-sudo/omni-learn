"use client";

import { CompanyUserDirectory } from "@/components/admin/company-user-directory";
import { DeepAnalyticsBody } from "@/components/analytics/deep-analytics-body";
import { Gate } from "@/components/gate";

export default function AnalyticsUsersPage() {
  return (
    <div className="space-y-12">
      <CompanyUserDirectory />
      <Gate permission="admin:analytics">
        <DeepAnalyticsBody section="users" />
      </Gate>
    </div>
  );
}
