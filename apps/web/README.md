# Baam Chinese New York (CNY)

The Chinese-language community platform for NYC, primarily serving the Flushing/Queens area.

## Quick Start

```bash
# From monorepo root
npm run dev:chinese

# Or from this directory
npm run dev
```


lsof -ti:5001 | xargs kill -9
rm -rf .next
npm run dev

npm install
npm run build

git add .
git commit -m "Update: describe your changes"
git push





Runs on **http://localhost:5001**

## Overview

| Item | Value |
|------|-------|
| Package | `@baam/web` |
| Port | 5001 |
| Default locale | `zh` (Simplified Chinese) |
| Theme color | Orange (`#F97316`) |
| Favicon | Orange "CNY" |
| Target region | Flushing, Queens, NYC |

## Key Features

- **News** — Local news aggregation with AI summaries
- **Living Guides** — How-to guides for immigrants (DMV, taxes, healthcare, housing)
- **Forum** — Community discussion boards
- **Businesses** — 1000+ Chinese business directory with AI descriptions and reviews
- **Local Voices** — Creator/expert profiles
- **Discover** — User-generated community posts (moderated)
- **AI Assistant** — RAG-powered Q&A ("Ask Xiao Lin")
- **Tools** — Vehicle violations, restaurant inspections, property tax lookup
- **Immigration** — Visa eligibility screener

## Architecture

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (shared with English site)
- **i18n**: `next-intl` with `[locale]` route segment (`/zh/...`)
- **Chinese Script**: Simplified Chinese by default; Traditional Chinese via `opencc-js` runtime conversion (not a separate locale)
- **AI**: Claude API for search, moderation, content generation

## Radius Token Standard

Control all radius values in `src/lib/theme.ts` under `shape.*`. Use semantic classes from `src/app/globals.css` instead of hardcoded `rounded-*`.

| UI Element | Token in `theme.ts` | Class |
|------|-------|-------|
| Card / Panel | `shape.radiusCard` | `r-card` |
| Button (default) | `shape.radiusButton` | `r-button` |
| Chip / Badge / Pill / Tab | `shape.radiusChip` | `r-chip` |
| Input / Select / Textarea | `shape.radiusInput` | `r-input` |
| Generic small corners | `shape.radius` | `r-base` |
| Generic medium corners | `shape.radiusLg` | `r-lg` |
| Generic large corners | `shape.radiusXl` | `r-xl` |
| Fully rounded | `shape.radiusFull` | `r-full` |

For one-sided corners, use tokenized arbitrary values like `rounded-r-[var(--radius-lg)]`.

## Directory Structure

```
src/
  app/
    [locale]/(public)/     # Public pages (news, guides, businesses, etc.)
    admin/                 # Admin panel (no locale prefix)
    api/                   # API routes
  components/
    layout/                # Navbar, Footer
    shared/                # Reusable components
  lib/
    supabase/              # Supabase client helpers
    ai/                    # Claude API wrapper
    i18n/                  # Locale config, routing, Chinese script converter
  types/                   # TypeScript types
public/
  locales/zh-CN/           # Chinese translation strings
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase admin access
- `ANTHROPIC_API_KEY` — Claude AI
- `GOOGLE_PLACES_API_KEY` — Business data enrichment
- `NEXT_PUBLIC_DEFAULT_SITE=ny-zh`
- `NEXT_PUBLIC_SITE_PLATFORM=chinese`
- `NEXT_PUBLIC_DEFAULT_LOCALE=zh`
- `HELPER_STRICT_EVIDENCE_MODE` — Helper evidence mode switch:
  - `0` / `false` (default): normal mode
  - `1` / `true`: strict evidence mode (no unsupported factual details)

## Related

- [Baam English (Middletown)](../english/README.md) — English-language sister site
- [Shared packages](../../packages/) — Shared types and utilities
- [Database schema](../../document/Baam_Supabase_Schema.sql) — Full Supabase schema
- [Business data pipeline](../../document/business-data-pipeline.md) — Import/enrichment scripts
- [Helper production env checklist](../../document/helper-production-env-checklist.md) — Vercel env checklist and rollout guidance


