# Learn!

**Unleash your potential with our innovative platform!**

Our mission is to make learning and growth accessible by providing an innovative and inclusive platform where everyone can develop skills and enrich knowledge without limits.

A product by **Afflatus Consulting Group**.

## Architecture

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Radix UI
- **Backend**: NestJS, GraphQL (Apollo), REST, Prisma ORM
- **Local dev**: SQLite (file-based, no setup)
- **Production (VPS)**: PostgreSQL + pgvector

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy env (uses SQLite by default)
copy backend\.env.example backend\.env

# 3. Set up local database (creates backend/prisma/dev.db)
npm run db:setup:local

# 4. Start development servers
npm run dev
```

Frontend: http://localhost:3000 | Backend: http://localhost:4000

## Production (VPS)

When deploying to your VPS with PostgreSQL:

1. Set `DATABASE_URL` in `backend/.env` to your PostgreSQL connection string
2. Run `npm run db:generate` (generates Prisma client for PostgreSQL)
3. Run `npm run db:migrate` (applies migrations from `schema.prisma` with pgvector)

## Implementation Summary

All phases from `docs/PHASE1-FOUNDATION.md`, `PHASE2-CORE-LEARNING.md`, `PHASE3-ENGAGEMENT.md`, and Phase 4–5 are implemented:

- **Content page** (`/content/[id]`) — Fetches content, renders ScormViewer, VideoPlayer, or PodcastPlayer by type
- **Learn page** (`/learn`) — Path enrollment, step progress (API), gamification (API), Quiz/GameCard → points
- **Forum** (`/forum`) — Moderation: Pin, Close, Hide topic/post, Delete post
- **Analytics** — `track()` on content view, enrollment, step progress, quiz/game/guide complete
- **Branding** — `BrandingProvider` applies tenant logo/colors in layout
- **Certificates** — Verify at `/certificates/verify/[code]`

## Phase 5 — Intelligence

- **AI content recommendations** — Embedding-based (pgvector in prod; `embeddingJson` for SQLite). `POST /intelligence/content/:id/embed` to index.
- **Smart path suggestions** — Personalized path recommendations. `GET /intelligence/path-suggestions?userId=`
- **Semantic search** — Meaning-based content search. `GET /intelligence/search?q=`
- **Predictive analytics** — At-risk enrollments, completion rate. `GET /intelligence/predictive`
- **Mobile app** — React Native (Expo). `npm run dev:mobile` | `/discover` on web
- **Microlearnings** — TikTok/Reels-style vertical feed: like, comment, share. Login → Dashboard → Microlearnings

Set `OPENAI_API_KEY` for production-quality embeddings; mock embeddings used otherwise.

## Phase 4 — Social & Enterprise

- **Discussion Forums** — Channels, topics, posts, moderation (hide/delete/pin/close). `/forum`
- **Course Reviews & Ratings** — 1–5 stars, reviews, helpful votes. `CourseReviews` component on `/content/[id]`
- **Company Admin & Branding** — Tenant management, logo, colors, custom CSS. `/admin/company`
- **Advanced Analytics** — Overview, path analytics, event tracking. `/admin/analytics`
- **Bulk Provisioning (SCIM)** — SCIM 2.0 Users/Groups. `/scim/v2/Users`, `/scim/v2/Groups`. Logs at `/admin/provisioning`

## Project Structure

```
omnilearn/
├── frontend/          # Next.js 15 App Router
├── backend/           # NestJS API
└── package.json
```
