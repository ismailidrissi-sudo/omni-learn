-- Speed up due lookups for scheduled campaigns and one-shot email schedules
CREATE INDEX IF NOT EXISTS "email_campaigns_status_scheduledAt_idx" ON "email_campaigns"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "email_schedules_isActive_nextRunAt_idx" ON "email_schedules"("isActive", "nextRunAt");
