# Architecture Compliance Report

**Project**: omnilearn.space (Omni-Learn)  
**Reference**: ARCHITECTURE.md v3.0 (March 2026)  
**Report Date**: March 7, 2025

---

## Executive Summary

The current codebase has **significant deviations** from the ARCHITECTURE.md specification. Several items are **critical** (especially the Dynamic Domain System), while others are structural or tech-stack differences.

| Category | Status | Count |
|----------|--------|-------|
| Critical violations | ✅ Fixed | 0 |
| Major deviations | ⚠️ | 8 |
| Minor / acceptable | ✅ | Several |

---

## 1. CRITICAL: Dynamic Domain System — ✅ FIXED

**Architecture (Section 5)**: *"CRITICAL: Domains are NOT enums or hardcoded constants. They are database entities created and managed by admins at runtime."*

**Implemented (March 2025)**:
- ✅ Replaced `Domain` enum with `Domain` model (tenantId, name, slug, icon, color, isActive, sortOrder, metadata)
- ✅ Added `domainId` FK to `LearningPath`, `ContentItem`, `CertificateTemplate` (with `tenantId` on CertificateTemplate)
- ✅ Created `domains` module (domains.service, domains.controller, domains.module)
- ✅ Auto-create `CertificateTemplate` when admin creates a domain (ensureCertificateTemplate)
- ✅ Removed hardcoded `DOMAIN_THEMES`; themes derived from Domain entity
- ✅ REST API: `GET/POST/PUT/DELETE /domains`, `GET /domains?tenantId=`, `GET /domains/by-slug/:slug`
- ✅ Seed: Default tenant + 5 domains (ESG, Food Safety, Soft Skills, etc.) with certificate templates
- ✅ Frontend: Admin paths page fetches domains from API; PathBuilder uses domainId

---

## 2. Monorepo Structure

**Architecture**: Turborepo with `apps/web`, `apps/admin`, `apps/mobile`, `apps/api`, `packages/*`

**Current**: npm workspaces with `frontend`, `backend`, `mobile`

| Spec | Current | Status |
|------|---------|--------|
| apps/web | frontend/ | ⚠️ Renamed |
| apps/admin | (inside frontend/app/admin) | ⚠️ Not separate app |
| apps/mobile | mobile/ | ⚠️ Renamed |
| apps/api | backend/ | ⚠️ Renamed |
| packages/shared-types | — | ❌ Missing |
| packages/shared-graphql | — | ❌ Missing |
| packages/shared-utils | — | ❌ Missing |
| packages/shared-ui | — | ❌ Missing |
| turbo.json | — | ❌ Missing |
| pnpm | npm | ⚠️ Different package manager |

---

## 3. API Layer

**Architecture**: GraphQL (Apollo Server) as primary API + REST for mobile/webhooks

**Current**: REST-only (NestJS controllers). No GraphQL.

| Spec | Current | Status |
|------|---------|--------|
| Apollo Server 4.x | Not used | ❌ |
| GraphQL schema | — | ❌ |
| REST for mobile | REST used for all | ⚠️ Partial |

---

## 4. Frontend Web Structure

**Architecture**: `app/(auth)`, `app/(dashboard)`, `app/(public)` route groups

**Current**: Flat structure: `app/signin`, `app/signup`, `app/learn`, `app/forum`, `app/admin/*`, `app/content/[id]`, `app/discover`, `app/certificates/verify/[code]`

| Spec | Current | Status |
|------|---------|--------|
| (auth)/login | signin | ⚠️ Different path |
| (auth)/register | signup | ⚠️ Different path |
| (dashboard)/courses | — | ❌ Missing |
| (dashboard)/paths | learn (partial) | ⚠️ |
| (dashboard)/micro-learning | — | ❌ |
| (dashboard)/podcasts | — | ❌ |
| (dashboard)/documents | — | ❌ |
| (dashboard)/games | — | ❌ |
| (dashboard)/discussions | forum | ✅ |
| (dashboard)/certificates | certificates | ✅ |
| (dashboard)/profile | — | ❌ |
| (public)/verify/[code] | certificates/verify/[code] | ✅ |

---

## 5. Backend Modules

**Architecture**: domains, courses, content, learning-paths, certificates, ai, media, social, gamification, notifications, analytics, admin-config, search

**Current**: auth, content, learning-path, certificate, gamification, forum, review, company, analytics, scim, intelligence

| Spec | Current | Status |
|------|---------|--------|
| domains | — | ❌ Missing (critical) |
| courses | (inside content) | ⚠️ Merged |
| content | content | ✅ |
| learning-paths | learning-path | ✅ |
| certificates | certificate | ✅ |
| ai | intelligence (partial) | ⚠️ |
| media | — | ❌ Missing |
| social (discussions) | forum | ⚠️ Different structure |
| gamification | gamification | ✅ |
| notifications | — | ❌ Missing |
| analytics | analytics | ✅ |
| admin-config | — | ❌ Missing |
| search | — | ❌ Missing (Meilisearch) |

---

## 6. Database Schema

**Architecture**: Full Prisma schema with Tenant, User, Role, Domain (entity), Course, CourseModule, CourseLesson, ContentItem, LearningPath, PathStep, PathEnrollment, StepProgress, CertificateTemplate, IssuedCertificate, AiProvider, AiUsageLog, VideoSource, VideoItem, DrmSession, Review, Discussion, UserPoints, Badge, AdminConfig, ContentAccessLog, etc.

**Current**: Different schema. Key differences:

| Spec | Current | Status |
|------|---------|--------|
| Domain (entity) | Domain (enum) | ❌ Critical |
| Role model | — | ❌ (RBAC uses enum) |
| Course model | — | ❌ (content only) |
| Keycloak integration | Google OAuth | ⚠️ |
| Discussion (flat) | ForumChannel/Topic/Post | ⚠️ Different |
| Review | CourseReview | ✅ |
| VideoSource, VideoItem | — | ❌ |
| DrmSession | — | ❌ |
| AdminConfig | — | ❌ |
| Meilisearch | — | ❌ |

---

## 7. RBAC & Permissions

**Architecture**: Permission strings (`domains:create`, `paths:assign`, etc.) with `@Permissions` decorator

**Current**: Role-based `@Roles(RbacRole.INSTRUCTOR)` only. No permission strings.

| Spec | Current | Status |
|------|---------|--------|
| Permission strings | — | ❌ |
| @Permissions decorator | @Roles | ⚠️ |
| moderator | CONTENT_MODERATOR | ✅ Close |

---

## 8. Tech Stack Versions

| Component | Spec | Current | Status |
|-----------|------|---------|--------|
| Next.js | 15 | 15.0.3 | ✅ |
| Tailwind | 4.x | 3.4 | ⚠️ |
| Framer Motion | 11.x | 10.18 | ⚠️ |
| Zustand | 5.x | 4.4 | ⚠️ |
| TanStack Query | 5.x | 5.17 | ✅ |
| Apollo Client | 3.x | — | ❌ |
| Radix UI | latest | ✓ | ✅ |
| Shaka Player | 4.x | hls.js | ⚠️ |
| next-pwa | latest | — | ❌ |
| NestJS | 11.x | 10.3 | ⚠️ |
| Prisma | 6.x | 5.8 | ⚠️ |
| React Native | 0.76+ | 0.83 | ✅ |
| Expo | 52+ | 55 | ✅ |
| Expo Router | 4.x | React Navigation | ❌ |

---

## 9. Mobile App

**Architecture**: Expo Router (file-based), `app/(tabs)`, `app/course/[slug]`, `app/path/[slug]`, `app/auth/login`, Apollo Client, expo-drm, expo-notifications, expo-local-authentication, expo-sqlite

**Current**: React Navigation (Stack), `App.tsx` with Home, SignIn, Learn, Search screens. No Expo Router, no Apollo, no DRM/notifications/biometrics/offline.

---

## 10. Content Types

**Architecture**: COURSE, MICRO_LESSON, PODCAST, DOCUMENT, IMPL_GUIDE, QUIZ, GAME, VIDEO

**Current**: COURSE, MICRO_LEARNING, PODCAST, DOCUMENT, IMPLEMENTATION_GUIDE, QUIZ_ASSESSMENT, GAME, VIDEO — naming aligned except IMPL_GUIDE vs IMPLEMENTATION_GUIDE, QUIZ vs QUIZ_ASSESSMENT.

---

## 11. What Is Aligned

- Next.js 15 App Router
- NestJS backend
- Prisma ORM
- Learning paths, enrollments, step progress
- Certificate issuance and verification
- Gamification (points, badges, streaks)
- Forum/discussions (different structure but present)
- Course reviews
- Tenant/company branding
- Analytics tracking
- SCIM provisioning
- AI intelligence (recommendations, search, embeddings)
- React Native + Expo mobile app (basic)

---

## Recommended Priority Order

1. **P0 – Critical**: Implement Dynamic Domain System (replace enum with Domain entity + domains module)
2. **P1 – High**: Add GraphQL API layer (Apollo Server) alongside REST
3. **P1 – High**: Create `packages/shared-types` and `packages/shared-utils`
4. **P2 – Medium**: Restructure frontend routes to `(auth)`, `(dashboard)`, `(public)`
5. **P2 – Medium**: Add missing modules (media, notifications, admin-config, search)
6. **P3 – Lower**: Migrate to Turborepo + pnpm, separate admin app
7. **P3 – Lower**: Upgrade mobile to Expo Router, add DRM/notifications/offline

---

*Generated by architecture compliance audit.*
