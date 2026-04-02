# Baam Local Portal

## Project Overview
AI-powered hyperlocal community platform for Chinese communities in NYC (and later English communities in Orange County). Six core modules: News, Living Guides, Forum, Businesses, Local Voices, AI Assistant.

## Workstream scope (this track — business data)
Focus here is **business listing data only**: Supabase tables (`businesses`, `business_locations`, `reviews`, `business_categories`, `categories` for businesses), **import/enrichment scripts** under `scripts/` (Google Places, AI descriptions, reviews, categorization), and **admin/public business surfaces** tied to that data.

**Out of scope for this track:** the **Discover** product area (e.g. `discover_*` tables, discover UI/routes) — owned by another team. Do not mix discover changes into business-data PRs unless explicitly coordinated.

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **AI**: Claude API (Sonnet for complex, Haiku for batch)
- **i18n**: next-intl with [locale] route segment
- **UI**: shadcn/ui components + Tailwind
- **Monorepo**: npm workspaces (Turborepo)

## Key Architecture Decisions
1. **Chinese Script**: Simplified Chinese is the default. Traditional Chinese uses `opencc-js` for runtime client-side conversion — NOT a separate locale or translation file.
2. **Image Storage**: Supabase Storage buckets (NOT Cloudflare R2).
3. **Admin Panel**: Lives at `/admin/*` with no locale prefix, separate layout from public site.
4. **NY Chinese First**: Build the Chinese site first, Middletown English site later as a separate app in the monorepo.

## Directory Structure
- `apps/web/` — Main Next.js app (NY Chinese site)
- `packages/` — Shared types and UI (for future English site)
- `prototypes/` — HTML prototype pages (visual reference)
- `document/` — PRD documents and SQL schema
- `supabase/` — Database migrations and seed data

## Key Commands
```bash
npm run dev          # Start dev server (from root)
npm run build        # Build for production
```

## Database
Schema is in `document/Baam_Supabase_Schema.sql` (36 tables, 4 views, 8 functions, 12 triggers).
Generated types: `apps/web/src/types/database.ts`

## Environment Variables
See `.env.local.example` for required variables.

## Coding Conventions
- Use Server Components by default, Client Components only when needed ('use client')
- SSR for detail pages (news, guides, business), ISR for homepage (revalidate: 300)
- All database queries go through typed Supabase clients in `lib/supabase/`
- AI calls go through `lib/ai/claude.ts` wrapper
- Chinese content uses Simplified Chinese; render Traditional via useChineseScript() hook
