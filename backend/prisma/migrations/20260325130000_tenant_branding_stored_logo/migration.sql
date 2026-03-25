-- Store tenant academy logos in DB; served via GET /company/tenants/:tenantId/logo
ALTER TABLE "TenantBranding" ADD COLUMN IF NOT EXISTS "logoData" BYTEA;
ALTER TABLE "TenantBranding" ADD COLUMN IF NOT EXISTS "logoMimeType" VARCHAR(127);
