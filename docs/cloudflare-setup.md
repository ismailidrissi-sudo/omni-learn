# omnilearn.space — Cloudflare Setup

**Phase 1** | Afflatus Consulting Group

## Domain Setup

1. **Register or transfer** omnilearn.space to your domain registrar
2. **Add domain to Cloudflare**:
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Add site → Enter `omnilearn.space`
   - Update nameservers at your registrar to Cloudflare's

## Cloudflare Pages (Frontend)

1. Connect your Git repository to Cloudflare Pages
2. Build settings:
   - **Framework preset**: Next.js (Static HTML Export) or Next.js (Standalone)
   - **Build command**: `cd frontend && npm run build`
   - **Build output directory**: `frontend/.next` (or `frontend/out` for static export)
   - **Root directory**: `/`
   - **Environment variables**: Add `NEXT_PUBLIC_API_URL` for backend

3. For Next.js 15 with App Router, use **@cloudflare/next-on-pages** or deploy as Node.js:
   - Or use **Vercel** for Next.js (recommended) and Cloudflare for DNS/CDN only

## Cloudflare Workers (Backend API - Optional)

For NestJS backend on Cloudflare Workers, consider:
- Deploy to a VPS (Railway, Render, Fly.io) for full NestJS support
- Or use Cloudflare Workers with a lightweight API adapter

## DNS Records

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | (Pages/Worker IP) | Proxied |
| CNAME | www | omnilearn.space | Proxied |
| CNAME | api | (Backend URL) | Proxied |

## Environment Variables (Cloudflare Pages)

```
NEXT_PUBLIC_API_URL=https://api.omnilearn.space
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.omnilearn.space
```

## Wrangler Config (if using Workers)

See `wrangler.toml` in project root for Workers configuration.
