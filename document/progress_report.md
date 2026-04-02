# Baam Local Portal — Progress Report

> **Date:** 2026-03-31 (updated; business-data notes 2026-04-01)
> **Scope:** NY Chinese Site (Phase 1 MVP)
> **Branch:** main

---

## Executive Summary

**Maintenance note (business data vs Discover):** Updates under this report that concern **business listings, Google import, reviews, categories, and `/businesses`** are the **business data** workstream. The **Discover** module (separate tables and features) is handled by another team — do not require Discover changes when closing business-data tasks.

**Overall Phase 1 Completion: ~85%** (up from ~75% on 2026-03-26)

| Area | Status | Completion | Change |
|------|--------|------------|--------|
| Foundation & Infrastructure | ✅ Done | 100% | — |
| Admin Panel | ✅ Done | 95% | — |
| Public Pages — Content Browsing | ✅ Done | 85% | — |
| Public Pages — Interactive Features | 🟡 Partial | 40% | — |
| AI Features | ✅ Substantial | 80% | +20% (AI search assistant) |
| User System (Auth/Profile/Dashboard) | 🟡 Partial | 25% | — |
| **Business Data** | ✅ Substantial | 90% | **NEW** |
| **AI Search Assistant (小邻)** | ✅ Done | 95% | **NEW** |

### What Changed (2026-03-31 — AI Search & Business Data Sprint)

#### AI Search Assistant (小邻) — Major Feature

| Item | Before | After |
|------|--------|-------|
| Voice search | None | Mic button with `zh-CN` speech recognition (Web Speech API) |
| Keyword extraction | Regex-based (fragile) | AI-powered via Claude Haiku (handles any phrasing) |
| Follow-up detection | None (each message independent) | AI classifies FOLLOWUP/SEARCH/NEW for multi-turn chat |
| Category matching | Simple `ilike` | Bidirectional substring + name vs terms threshold + 3-tier sort |
| Search terms | ~1,050 | **6,600+** across 130 categories |
| Prompt debug modal | None | "查看Prompt" shows keywords, system/user prompts, model info |
| Phone click-to-call | Plain text | Auto-detected `tel:` links in tables and paragraphs |
| Source links | Same-page navigation (loses chat) | Opens in new tab (preserves chat history) |
| Review context | None | Google reviews included in AI context for recommendations |
| Conversation memory | None | Last 3 turns passed to AI; follow-ups like "需要" work in context |

#### Business Data — Massive Expansion

| Metric | Before (3/26) | After (3/31) | Change |
|--------|--------------|-------------|--------|
| Active businesses | 335 | **2,139** | **6.4x** |
| With categories | 335 | **2,139** (100%) | All categorized |
| Chinese names | 237 | **1,021** (48%) | 4.3x |
| Descriptions (zh) | 335 | **1,989** (93%) | AI-generated |
| Descriptions (en) | 329 | **1,989** (93%) | Google + AI |
| Phone | ~300 | **2,046** (96%) | Google backfill |
| Address | 1 | **2,138** (100%) | Google backfill |
| Business hours | 325 | **1,876** (88%) | Google backfill |
| Avg rating | ~300 | **2,083** (97%) | Google backfill |
| Google reviews | 0 | **9,277** | 5 per business |
| Google Place IDs | 0 | **2,139** (100%) | Linked to Google |

#### Data Sources Used

| Source | What | Businesses Affected |
|--------|------|-------------------|
| Google Places Text Search | Discover new businesses in Flushing | +1,804 new |
| Google Places Details (EN) | Address, phone, website, hours, editorial | 2,139 |
| Google Places Details (ZH-CN) | Chinese names, Chinese editorial | 2,139 |
| Google Places Reviews | 5 reviews per business | 9,277 reviews |
| nychinaren.com (phone search) | Chinese business names | +102 names |
| nychinaren.com (name search) | Chinese business names | +42 names |
| Claude Haiku AI | Chinese + English descriptions | ~1,800 generated |
| Claude Haiku AI | Category classification | 339 businesses |

#### Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/backfill-google-reviews.ts` | Fetch 5 Google reviews per business |
| `scripts/backfill-business-data.ts` | Phase 1 (enrich) + Phase 2 (discover) from Google |
| `scripts/backfill-business-details.ts` | Fill hours, Chinese names, AI descriptions |
| `scripts/discover-chinese-businesses.ts` | Chinese-focused discovery using zh-CN Google search; `--region=slug`, `--list-regions` for NYC corridors beyond Flushing |
| `scripts/assign-categories.ts` | Auto-categorize via Google type + AI classification |
| `scripts/test-ai-search.ts` | Self-test: 44 queries, validates keywords + categories + results |
| `scripts/populate-search-terms.ts` | 6,600+ search terms across 130 categories |

#### Database Migrations

| Migration | Changes |
|-----------|---------|
| `20260330_google_reviews.sql` | `google_place_id` on businesses; `source`, `google_author_name`, `google_review_id`, `google_publish_time`, `language` on reviews; nullable `author_id` for Google reviews |
| `20260401_business_data_regions_and_review_trigger.sql` | Regions: `sunset-park-ny`, `elmhurst-ny`, `manhattan-chinatown-ny`; `sync_business_reviews()` skips overwriting `review_count` / `avg_rating` when `google_place_id` is set |

---

## 1. Foundation & Infrastructure (100% ✅)

| Item | Status |
|------|--------|
| Turborepo monorepo (`apps/web/`, `packages/`) | ✅ |
| Next.js 15 App Router + TypeScript + Tailwind v4 | ✅ |
| Supabase clients (server + client + admin) | ✅ |
| i18n with `[locale]` route segment (next-intl) | ✅ |
| Claude AI wrapper (`lib/ai/claude.ts`) | ✅ |
| NavBar + Footer components | ✅ |
| Region persistence (localStorage + cookie) | ✅ |
| Database schema (36 tables, SQL in document/) | ✅ |
| Seed data (users, forum, voices, reviews) | ✅ |
| `robots.ts` + `sitemap.ts` | ✅ |
| Server-side auth helper (`lib/auth.ts`) | ✅ |

---

## 2. Admin Panel (95% ✅)

### Full CRUD (Complete)

| Module | List | Create | Edit | Delete | Notes |
|--------|------|--------|------|--------|-------|
| Articles | ✅ | ✅ | ✅ | ✅ | Bulk publish/archive, status workflow, AI generation |
| Businesses | ✅ | ✅ | ✅ | ✅ | Claim approve/reject, featured toggle, image upload |
| Events | ✅ | ✅ | ✅ | ✅ | Full form with datetime, pricing |
| Sites | ✅ | ✅ | ✅ | ✅ | Site + region CRUD, primary region |
| Settings (Categories) | ✅ | ✅ | ✅ | ✅ | Interactive category tree + search terms editor |

### Moderation / Management (Partial)

| Module | List | Approve | Status | Delete | Notes |
|--------|------|---------|--------|--------|-------|
| Forum | ✅ | ✅ | ✅ | ✅ | Pin, lock, feature |
| Voices | ✅ | ✅ | ✅ | — | Approve/reject/verify |
| Leads | ✅ | — | ✅ | ✅ | Status workflow |

### View Only

| Module | Notes |
|--------|-------|
| Dashboard | Stats cards + recent articles + leads |
| Users | Basic table, no edit/delete/role management |
| Sponsors | Read-only list of sponsor slots |
| AI Jobs | Monitoring: status counts, token usage, cost |

---

## 3. Public Pages — Content Browsing (85% ✅)

### Pages with Real Supabase Data Fetching

| Page | Route | Status |
|------|-------|--------|
| Homepage | `/[locale]/` | ✅ All 7 sections |
| News List | `/[locale]/news` | ✅ + pagination + filters |
| News Detail | `/[locale]/news/[slug]` | ✅ SSR |
| Guides List | `/[locale]/guides` | ✅ + category links |
| Guide Detail | `/[locale]/guides/[slug]` | ✅ SSR |
| Forum Home | `/[locale]/forum` | ✅ |
| Forum Board | `/[locale]/forum/[board]` | ✅ + pagination + sort |
| Forum Thread | `/[locale]/forum/[board]/[thread]` | ✅ + reply form |
| Businesses List | `/[locale]/businesses` | ✅ + pagination + filters |
| Business Detail | `/[locale]/businesses/[slug]` | ✅ SSR + Google reviews + write review CTA |
| Events List | `/[locale]/events` | ✅ + pagination + filters |
| Event Detail | `/[locale]/events/[slug]` | ✅ |
| Voices Discover | `/[locale]/voices` | ✅ + pagination + tags |
| Voice Profile | `/[locale]/voices/[username]` | ✅ |
| Voice Post | `/[locale]/voices/.../posts/[slug]` | ✅ |
| Search | `/[locale]/search` | ✅ 6-module search + tabs |
| **AI Ask (小邻)** | `/[locale]/ask` | ✅ **NEW** Full chat UI + voice + multi-turn |

### Pages NOT Implemented

| Page | PRD Priority | Status |
|------|-------------|--------|
| Guide Category `/guides/[category]` | P1 | ❌ Missing |
| Business Dashboard `/dashboard/business` | P0 | ❌ Missing |
| Business Registration/Claim Flow | P0 | ❌ Missing |
| Following Feed `/following` | P1 | ❌ Missing |
| Classifieds | P1 | ❌ Missing |
| User Profile `/profile/[username]` | P1 | ❌ Missing |
| User Settings `/settings` | P1 | ❌ Missing |

---

## 4. Interactive Features (40% 🟡)

| Feature | Status |
|---------|--------|
| Auth Modal (Login/Register/Google OAuth) | ✅ Full |
| Forum post + reply submission | ✅ Server actions |
| Newsletter subscription | ✅ 3 locations |
| Search tab filtering | ✅ All 6 modules |
| Pagination (all list pages) | ✅ |
| Voices post publishing | ❌ Missing |
| Business registration/claim | ❌ Missing |
| Business dashboard | ❌ Missing |
| Like / Save / Share | ❌ UI only |
| Follow/Unfollow | ❌ UI only |
| User reviews (write + submit) | 🟡 UI ready, needs auth integration |
| RSVP to events | ❌ Button only |

---

## 5. AI Features (80% ✅)

| AI Feature | Status |
|------------|--------|
| **AI Search Assistant (小邻)** | ✅ **NEW** Full RAG pipeline: AI keyword extraction → category matching → 6-source search → Claude answer |
| **Voice search** | ✅ **NEW** Browser SpeechRecognition API, zh-CN |
| **Multi-turn conversation** | ✅ **NEW** AI classifies FOLLOWUP/SEARCH/NEW, maintains context |
| **AI keyword extraction** | ✅ **NEW** Claude Haiku extracts search terms from any Chinese phrasing |
| **Prompt debug modal** | ✅ **NEW** Shows keywords, prompts, model, result count |
| AI Article Generation | ✅ Full pipeline via Claude Opus |
| AI Article Rewrite | ✅ Paste source → bilingual article |
| News/Guide summaries | ✅ Claude Haiku zh + en |
| AI FAQ generation | ✅ 5 Q&A pairs via Sonnet |
| AI auto-tagging | ✅ Generated with summaries |
| **AI business descriptions** | ✅ **NEW** 1,800+ generated via Haiku from Google data + reviews |
| **AI category classification** | ✅ **NEW** 339 businesses auto-categorized by AI |
| Article preview modal | ✅ Markdown with zh/en toggle |
| Forum speed-read summary | ⚠️ UI exists, no batch generation |
| Cross-language summary | ⚠️ Function exists, not wired |
| Spam detection | ⚠️ Field exists, no scoring |
| Floating AI widget | ❌ Not implemented |

---

## 6. Business Data (90% ✅) — NEW SECTION

### Data Completeness (2,139 businesses)

| Field | Count | % |
|-------|-------|---|
| Google Place ID | 2,139 | 100% ✅ |
| Address | 2,138 | 100% ✅ |
| Lat/Lng | 2,138 | 100% ✅ |
| Avg Rating | 2,083 | 97% ✅ |
| Phone | 2,046 | 96% ✅ |
| Categories | 2,139 | 100% ✅ |
| Descriptions (zh) | 1,989 | 93% ✅ |
| Descriptions (en) | 1,989 | 93% ✅ |
| Business Hours | 1,876 | 88% ✅ |
| Website | 1,343 | 63% ⚠️ |
| Chinese Name | 1,021 | 48% ⚠️ |
| Google Reviews | 9,277 | ~4.3/business |

### Category Distribution

| Category | Businesses | Subcategories |
|----------|-----------|---------------|
| 餐饮美食 Food & Dining | ~400+ | 22 |
| 医疗健康 Medical & Health | ~200+ | 17 |
| 法律移民 Legal & Immigration | ~100+ | 9 |
| 财税服务 Finance & Tax | ~150+ | 8 |
| 教育培训 Education | ~100+ | 11 |
| 美容保健 Beauty & Wellness | ~100+ | 9 |
| 装修家居 Home & Renovation | ~100+ | 15 |
| 汽车服务 Auto Services | ~80+ | 7 |
| 地产保险 Real Estate | ~80+ | 6 |
| 其他服务 Other Services | ~100+ | 16 |

### Search Terms Coverage

| Category Group | Subcategories | Avg Terms per Category |
|---------------|--------------|----------------------|
| Food & Dining | 23 | ~48 |
| Medical & Health | 18 | ~56 |
| Legal & Immigration | 10 | ~54 |
| Finance & Tax | 9 | ~49 |
| Real Estate | 7 | ~40 |
| Education | 12 | ~52 |
| Home & Renovation | 16 | ~54 |
| Beauty & Wellness | 10 | ~56 |
| Auto Services | 8 | ~47 |
| Other Services | 17 | ~55 |
| **Total** | **130** | **~6,600 terms** |

---

## 7. AI Search Assistant Architecture

```
User query (text or voice)
    │
    ├─ If conversation history exists:
    │   └─ Claude Haiku classifies: FOLLOWUP / SEARCH / NEW
    │       ├─ FOLLOWUP → Continue chat (no RAG search)
    │       ├─ SEARCH → Fall through to RAG
    │       └─ NEW → Fall through to RAG
    │
    ├─ Claude Haiku extracts 1-5 keywords
    │   (fallback: regex-based extraction)
    │
    ├─ RAG: 6-source parallel search
    │   ├─ Businesses (category match + ai_tags + text search)
    │   ├─ News articles (title + summary ilike)
    │   ├─ Living guides (title + summary + body ilike)
    │   ├─ Forum threads (title + body ilike)
    │   ├─ Voice posts (title + content ilike)
    │   └─ Events (title + summary + venue ilike)
    │
    ├─ Google reviews for top businesses
    │
    ├─ Build context with all results
    │
    └─ Claude Haiku generates answer
        (with conversation history for continuity)
```

### Business Search Strategy

1. **Category match** (name match = always list all; terms-only ≤ 20 biz)
2. **AI tags match** (`ai_tags` array contains keyword)
3. **Text search** (name/description ilike — always runs as supplement)
4. **3-tier sort**: text match first → category match → other → by rating

---

## 8. Recommended Next Steps

### Immediate (before launch)

1. **Business detail: display Google reviews** — already in DB, show on business pages ✅ DONE
2. **Run description backfill for remaining 150 businesses** — minor gap
3. **Test AI search with real users** — self-test shows 29/44 pass rate (failures = empty categories, not code bugs)

### Short-term (1-2 weeks)

4. **Expand to other NYC regions** — Elmhurst, Chinatown Manhattan, Sunset Park (scripts ready)
5. **User review submission** — form UI ready, needs auth integration
6. **Business claim/registration flow** — P0 gap
7. **Like/Follow/Comment backends** — social features visible but non-functional

### Medium-term

8. **English site** — same data, different frontend (monorepo ready)
9. **Business dashboard** — merchant self-service
10. **Floating AI widget** — AI assistant accessible from any page
11. **nychinaren.com data matching** — expand Chinese name coverage

---

## Appendix: Google API Cost Summary

| API | Calls | Cost | Free Tier |
|-----|-------|------|-----------|
| Places Text Search | ~1,200 | ~$38 | ✅ Within $200/mo |
| Places Details (EN) | ~2,500 | ~$42 | ✅ |
| Places Details (ZH) | ~2,500 | ~$42 | ✅ |
| **Total** | ~6,200 | ~$122 | ✅ All within free tier |

## Appendix: AI API Cost Summary

| Use | Model | Est. Calls | Est. Cost |
|-----|-------|-----------|-----------|
| Keyword extraction | Haiku | Per search query | ~$0.0001/query |
| Follow-up classification | Haiku | Per follow-up | ~$0.00005/query |
| Business descriptions | Haiku | ~1,800 | ~$0.18 |
| Category classification | Haiku | ~340 | ~$0.03 |
| Search answer generation | Haiku | Per search query | ~$0.001/query |
| **Total one-time scripts** | | | **~$0.21** |
| **Per user query** | | | **~$0.002** |
