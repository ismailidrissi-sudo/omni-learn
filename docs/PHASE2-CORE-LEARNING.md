# Phase 2 — Core Learning ✅

**omnilearn.space** | Afflatus Consulting Group

## 1. Course Builder (SCORM/xAPI) ✅

- **Content API** (`/content`) — CRUD for content items
- **POST /content/courses** — Create course with SCORM metadata (scormPackageUrl, xapiEndpoint, sections)
- **xAPI LRS** (`POST /xapi/statements`) — Store xAPI statements from SCORM/course players
- **ScormViewer** — Frontend component to render SCORM packages in iframe

## 2. Video/Podcast Player (HLS) ✅

- **VideoPlayer** (`components/media/video-player.tsx`) — HLS.js for adaptive video streaming (.m3u8)
- **PodcastPlayer** (`components/media/podcast-player.tsx`) — Audio with speed controls (0.75x–2x), transcript toggle

## 3. Learning Path CRUD ✅

- **GET /learning-paths** — List paths (tenantId, domain)
- **GET /learning-paths/:id** — Get path with steps
- **POST /learning-paths** — Create path
- **PUT /learning-paths/:id** — Update path
- **DELETE /learning-paths/:id** — Delete path
- **POST /learning-paths/:pathId/steps** — Add step
- **PUT /learning-paths/steps/:stepId** — Update step
- **DELETE /learning-paths/steps/:stepId** — Remove step

## 4. Progress Tracking + Certificates ✅

- **Path enrollment** — enrollUser, getEnrollment, updateStepProgress
- **Certificate issuance** — POST /certificates/issue (when path completed)
- **Certificate verification** — GET /certificates/verify/:code

## 5. Domain-Themed Certificate Templates ✅

- **DOMAIN_THEMES** — ESG, Food Safety, Soft Skills, OpEx, Marketing
- **GET /certificates/templates/:domain** — Get or create template
- Theme: primaryColor, accentColor, icon per domain
