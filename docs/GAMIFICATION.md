# Gamification — implemented system

This document describes **what the Omni-Learn codebase actually does today** for points, badges, streaks, and the leaderboard: data models, HTTP API, server logic, and where the UI reads it. It is not a product roadmap.

---

## 1. Scope

| Feature | Implemented |
|--------|-------------|
| Per-user point total | Yes (`UserPoints`) |
| Badges catalog + per-user awards | Yes (`Badge`, `UserBadge`) |
| Streak fields + last activity timestamp | Yes (`UserStreak`) |
| Leaderboard by total points | Yes (`GET /gamification/leaderboard`) |
| Point/badge grants tied to learning events (paths, quizzes, etc.) | **No** — nothing in the backend imports `GamificationService` outside the gamification module; grants only occur if a client calls the HTTP endpoints |
| Point transaction log / “reason” on `POST /gamification/points` | **No** — request body is `{ userId, points }` only |
| Authorization: caller limited to self or admin | **Not enforced in controller** — any authenticated JWT can hit `userId` in the path/body as written |
| Tenant-scoped leaderboard | **No** — `UserPoints` has no `tenantId`; ranking is global by user |

---

## 2. Data model (Prisma)

Defined in `backend/prisma/schema.prisma` under **GAMIFICATION**.

### `UserPoints`

- One row per user (`userId` **unique**).
- `points` — `Int`, default `0`; incremented by the service (no separate ledger table).

### `Badge`

- `slug` — **unique** stable key used by the API (`awardBadge`).
- `name`, `icon`, optional `description`.
- `criteria` — optional `Json`, default `{}` — **not interpreted by `GamificationService`**; reserved for future or external tooling.

### `UserBadge`

- Links `userId` + `badgeId`.
- `@@unique([userId, badgeId])` — same badge cannot be stored twice for one user at the DB level.
- `earnedAt` — set on create.

### `UserStreak`

- One row per user (`userId` **unique**).
- `currentStreak`, `longestStreak`, `lastActivityAt`.

---

## 3. HTTP API (NestJS)

Controller: `backend/src/gamification/gamification.controller.ts`  
Base path: **`/gamification`** (no global API prefix in `main.ts`).

| Method | Path | Auth | Response / behavior |
|--------|------|------|----------------------|
| `GET` | `/gamification/points/:userId` | JWT (`AuthGuard('jwt')`) | `{ points: number }` — `0` if no row |
| `POST` | `/gamification/points` | JWT | Body: `{ userId: string, points: number }`. Upserts `UserPoints`, **increments** `points` by given delta; then runs streak update (see §4) |
| `GET` | `/gamification/streak/:userId` | JWT | `{ currentStreak, longestStreak }` — defaults `0` if no row |
| `GET` | `/gamification/badges/:userId` | JWT | Array of `UserBadge` rows **with** `include: { badge: true }` (Prisma shape) |
| `POST` | `/gamification/badges/award` | JWT | Body: `{ userId: string, badgeSlug: string }`. Resolves `Badge` by `slug`; creates `UserBadge`; **throws** if slug unknown |
| `GET` | `/gamification/leaderboard` | Optional JWT (`OptionalJwtGuard`) | Query: optional `limit` (parsed int; default **10**). Rows from `UserPoints` ordered by `points` **desc** — `{ userId, points, ... }` per Prisma |

Module registration: `GamificationModule` imports `AuthModule`, registers controller + service, **exports** `GamificationService` (currently **unused** by other modules for automatic grants).

---

## 4. Server logic (`GamificationService`)

File: `backend/src/gamification/gamification.service.ts`.

### Points (`addPoints`)

- `upsert`: on create sets `points` to the provided value; on update uses `increment: points`.
- Prisma access is cast through `unknown` (runtime behavior is standard Prisma `userPoints` model when schema matches).
- On Prisma failure, `addPoints` returns `{ points }` (the delta passed in), **without** confirming persistence.

### Streak (`updateStreak`, private)

Called from **`addPoints` only** (not from `awardBadge`).

- **Create** (first activity): `currentStreak: 1`, `longestStreak: 1`, `lastActivityAt: now`.
- **Update** (row already exists): only sets `lastActivityAt` to **now**. It does **not** recalculate `currentStreak` / `longestStreak` from calendar days or consecutive days.

So in practice, after the first grant, streak counters **stay at their initial values** unless changed elsewhere (e.g. manual DB edit or future code). The UI may still show `lastActivityAt` from the profile payload where available.

### Badges (`awardBadge`)

- Lookup `badge` by `slug`; if missing, `throw new Error('Badge not found')` (surfaced as a 500-class error unless mapped).
- `userBadge.create` — duplicate `(userId, badgeId)` will fail at DB level.

### Leaderboard (`getLeaderboard`)

- `findMany` on `userPoints`, `orderBy: { points: 'desc' }`, `take: limit`.

---

## 5. Profile aggregate (read path)

`backend/src/profile/profile.service.ts` (full profile payload) loads:

- Points: `userPoints.findUnique({ where: { userId } })` → scalar `points`.
- Badges: `userBadge.findMany` with `badge` included, ordered by `earnedAt` desc.
- Streak: `userStreak.findUnique`.

Exposed under `gamification`:

```ts
{
  points: number,
  badges: Array<{ id, name, icon, description, earnedAt }>, // badge fields from join
  streak: { currentStreak, longestStreak, lastActivityAt }
}
```

(Exact key names match the mapper in `profile.service.ts`.)

---

## 6. Frontend usage

### Learn pages (live gamification strip)

- `frontend/app/learn/page.tsx`
- `frontend/app/[tenant]/learn/page.tsx`

Both **GET** (with auth via shared `apiFetch`):

- `/gamification/points/:userId`
- `/gamification/badges/:userId`
- `/gamification/streak/:userId`

They pass results into **`PointsBadgesStreaks`** (`frontend/components/gamification/points-badges-streaks.tsx`), which shows:

- Total points  
- Streak copy via i18n (`gamification.streakBest` with `current` / `longest`)  
- Badge **count** plus a row of badge icons/names when `badges.length > 0`

The learn pages map badge API rows to local `{ id, name, icon, earnedAt }` (the global learn page uses a synthetic `id` from array index).

### Profile page

- `frontend/app/profile/page.tsx` reads **`gamification`** from the **profile** API response (not only the gamification routes), including `lastActivityAt` for “last active” copy when present.

### Leaderboard endpoint

- **Not referenced** in the frontend grep results for this repo; only the backend route exists.

---

## 7. Relation to `docs/PHASE3-ENGAGEMENT.md`

Phase 3 doc mentions `POST /gamification/points` with **reason** in the body. The implemented controller accepts **`userId` and `points` only**.

---

## 8. Operational notes

- **Badges** must exist in the `Badge` table (seeded or inserted) before `awardBadge` can succeed.
- **Points and streak updates** are only as reliable as callers of `POST /gamification/points`; there is no built-in idempotency key or audit trail in code.
- **Fairness / scope** (per-tenant rankings, self-only writes) are **not** implemented in the gamification layer as of this document.

When you specify changes (rules, automation, auth, streak semantics, ledger, UI), this file can be updated to stay the single source of truth for “what exists.”
