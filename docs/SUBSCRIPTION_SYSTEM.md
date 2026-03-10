# OmniLearn.space — 4-Tier Subscription System

## Overview

The subscription system implements four tiers: **Explorer** (Free), **Specialist** (Pro Sector), **Visionary** (All-Access), and **Nexus** (Enterprise).

## Database Schema

### Migration

Run the migration when `DATABASE_URL` is configured:

```bash
cd backend && npx prisma migrate dev --name add_subscription_tiers_and_tenant_content
```

Or apply manually: `backend/prisma/migrations/20250309000000_add_subscription_tiers_and_tenant_content/migration.sql`

### New Fields

**User**
- `planId` (SubscriptionPlan enum): EXPLORER | SPECIALIST | VISIONARY | NEXUS
- `billingCycle` (BillingCycle enum): MONTHLY | ANNUAL
- `sectorFocus` (string, nullable): For Specialist tier — e.g. "biotech", "food_safety", "ai"
- `stripeCustomerId`, `stripeSubscriptionId` (string, nullable)

**ContentItem**
- `accessLevel` (int): 0=Foundational, 1=Sector, 2=All-access
- `sectorTag` (string, nullable): Sector for Specialist filtering
- `tenantId` (uuid, nullable): For Nexus private enterprise content
- `isFoundational` (boolean): Tagged for Explorer (Free) tier

## Backend

### Access Filtering (checkAccess logic)

- **Tier 0 (Explorer)**: Only `isFoundational: true` content
- **Tier 1 (Specialist)**: Platform content where `sectorTag == user.sectorFocus` OR `isFoundational`
- **Tier 2 (Visionary)**: All platform content (`tenantId` null)
- **Tier 3 (Nexus)**: Platform content + content where `tenantId == user.tenantId`

### Stripe Webhooks

Endpoint: `POST /subscription/webhook/stripe`

**Required env vars:**
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_PRICE_SPECIALIST_MONTHLY`, `STRIPE_PRICE_SPECIALIST_ANNUAL` (comma-separated price IDs)
- `STRIPE_PRICE_VISIONARY_MONTHLY`, `STRIPE_PRICE_VISIONARY_ANNUAL`

**Note:** Configure your NestJS app to pass raw body for the webhook route (Stripe requires it for signature verification). See [NestJS raw body](https://docs.nestjs.com/faq/raw-body).

### Auth Endpoints

- `GET /auth/me` — Returns current user with `planId`, `sectorFocus`, `tenantId` (requires JWT)

## Frontend

### Pricing Table

- Location: Home page (`#pricing`), `PricingTable` component
- Monthly/Annual toggle with discount display
- SectorSelector modal for Specialist tier signup

### Ad-Injected Player

- `AdInjectedPlayer` wraps `VideoPlayer` with ad slots when `adsEnabled` is true (Explorer tier)
- Content API returns `adsEnabled` based on user plan

### Enterprise Dashboard

- `/admin/nexus` — Visible only to Nexus plan users
- Employee Analytics table
- Private Upload button for tenant-specific content

### My Company Tab

- Shown in Learn page nav when `user.planId === "NEXUS"`
- Links to `/admin/nexus`

## Content API

- `GET /content` — Tier-filtered list (optional JWT for auth)
- `GET /content/:id` — Single item with access check; returns `adsEnabled` for video content

## Sector Values

Used for Specialist tier: `biotech`, `food_safety`, `ai`, `esg`, `pharma`, `manufacturing`
