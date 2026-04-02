---
name: Business data pipeline - Google Places + AI enrichment
description: Complete workflow for fetching businesses from Google, enriching with reviews/hours/descriptions, and categorizing. Scripts, API costs, and data quality targets.
type: reference
---

## Scope

This document and the scripts below cover **business listing data** (`businesses`, `business_locations`, `reviews`, categories, Google linkage). It does **not** cover the **Discover** module (`discover_*` tables and related app features); that is maintained separately.

## Business Data Pipeline

### Step 1: Discover Businesses
**Script:** `scripts/discover-chinese-businesses.ts` (for Chinese-focused) or `scripts/backfill-business-data.ts` (general)

**Regions:** Pass `--region=<slug>` (default `flushing-ny`). Run `npx tsx scripts/discover-chinese-businesses.ts --list-regions` for slugs. Presets include Flushing, Sunset Park (八大道), Elmhurst (艾姆赫斯特), and Manhattan Chinatown (曼哈顿华埠), each with its own grid and query prefix (e.g. 法拉盛 → 八大道 / neighborhood-specific prefix). Ensure matching `regions` rows exist (see migration `supabase/migrations/20260401_business_data_regions_and_review_trigger.sql` for Sunset Park, Elmhurst, Manhattan Chinatown).

**Method:** Google Places Text Search API (`places:searchText`)
- Search using Chinese terms for Chinese businesses (e.g. "法拉盛川菜", "法拉盛华人牙医")
- Use `languageCode: 'zh-CN'` to get Chinese names directly
- Subdivide area into grid zones (multiple zones per preset, ~1.5km radius each)
- For Flushing: 124 Chinese query terms × 5 zones = 620 searches (other regions: same term count × their zone count)
- Max 20 results per search → ~800-1000 new businesses per run
- **Cost:** ~$0.032/search, ~$20 per run

**Key fields from search:** `id`, `displayName`, `formattedAddress`, `nationalPhoneNumber`, `rating`, `userRatingCount`, `primaryType`, `types`, `location`, `websiteUri`, `regularOpeningHours`, `businessStatus`

**Auto-categorization:** Google `primaryType` → our category slug via TYPE_MAP (e.g. `chinese_restaurant` → `food-chinese`)

### Step 2: Enrich Business Details
**Script:** `scripts/backfill-business-details.ts`

**Method:** Google Place Details API (2 calls per business)
1. **English details** (`X-Goog-Api-Language: en`): hours, editorial summary, website, phone
2. **Chinese details** (`X-Goog-Api-Language: zh-CN`): Chinese name, Chinese editorial

**Hours conversion:** Google `regularOpeningHours.periods` → our `hours_json` format (`{mon:{open:"09:00",close:"18:00"}, ...}`)
**Cost:** ~$0.017/detail call × 2 = ~$0.034/business

### Step 3: AI Description Generation
**Script:** `scripts/backfill-business-details.ts` (same script, uses Claude)

**Method:** Claude Haiku generates Chinese + English descriptions from:
- Business name, type, address, rating, tags
- Google editorial summary
- Top 3 Google reviews
- Prompt: "写亲切自然的中文，像本地华人介绍给朋友。不要翻译腔。"
- Format: `ZH: [中文简介]\nEN: [English description]`
- **Cost:** ~$0.0001/business

### Step 4: Google Reviews
**Script:** `scripts/backfill-google-reviews.ts`

**Method:** Google Place Details with `reviews` field mask
- Returns max 5 reviews per business (Google API limit)
- Stored in `reviews` table with `source = 'google'`
- Fields: `google_review_id`, `google_author_name`, `google_publish_time`, `language`, `body` (review text), `rating`

**Review totals:** Migration `20260401_business_data_regions_and_review_trigger.sql` defines `sync_business_reviews()` so that if `businesses.google_place_id` is set, **`review_count` and `avg_rating` are not overwritten** when rows change in `reviews` (Google Places remains authoritative; stored Google reviews are display samples only). Listings **without** a Google place id still get aggregates from approved `reviews`. After fixing historical bad totals, you can run `scripts/fix-review-counts.ts --apply` once; going forward the trigger avoids clobbering Google-backed listings.

### Step 5: Chinese Names from nychinaren.com
**Script:** `scripts/scrape-chinese-names.ts` (by phone) + `scripts/scrape-chinese-names-by-name.ts` (by English name)

**Method:** Search nychinaren.com using business phone number or English name, extract Chinese name from results.

### Step 6: Category Assignment
**Script:** `scripts/assign-categories.ts`

**Method (2-tier):**
1. Google `primaryType` → our slug via TYPE_MAP (covers ~60%)
2. Claude Haiku AI classification from name + description (covers remaining ~40%)

### Data Quality Targets
| Field | Target | Current |
|---|---|---|
| Address | 100% | 100% ✅ |
| Phone | 95%+ | 96% ✅ |
| Category | 100% | 100% ✅ |
| Avg Rating | 95%+ | 97% ✅ |
| Description (zh) | 90%+ | 93% ✅ |
| Hours | 85%+ | 88% ✅ |
| Chinese name | 50%+ | 48% ⚠️ (many are non-Chinese businesses) |
| Google reviews | 5/business | ✅ (9,277 total) |

### Total API Costs (Flushing, 2,139 businesses)
| API | Calls | Cost |
|---|---|---|
| Google Text Search | ~620 | ~$20 |
| Google Place Details | ~4,300 | ~$73 |
| Claude Haiku (descriptions) | ~1,800 | ~$0.20 |
| Claude Haiku (categories) | ~340 | ~$0.04 |
| **Total** | | **~$93** (within $200/month free tier) |
