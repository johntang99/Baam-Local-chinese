# Business Category System

> Tools for managing, expanding, and auto-classifying business categories.

---

## Overview

Baam uses a **two-level category hierarchy** for businesses:

```
Parent Category (e.g., 医疗健康 / Medical & Health)
  └── Subcategory (e.g., 中医 / Chinese Medicine)
  └── Subcategory (e.g., 牙科 / Dental)
  └── ...
```

Every business is assigned **one primary category** via the `business_categories` table. The system supports multiple categories per business, but the AI classifier assigns the single best match.

---

## Category Coverage (10 Parents, 120+ Subcategories)

| Parent | Slug | Subcategories | Example Subcategories |
|--------|------|--------------|----------------------|
| **餐饮美食** | food-dining | 22 | 中餐, 日料, 韩餐, 奶茶, 火锅烧烤, 早茶点心, 咖啡, 超市杂货 |
| **医疗健康** | medical-health | 17 | 中医, 牙科, 眼科, 儿科, 妇产科, 皮肤科, 物理治疗, 药房 |
| **法律移民** | legal-immigration | 9 | 移民签证, 商业法, 家庭法, 人身伤害, 劳工法, 公证翻译 |
| **财税服务** | finance-tax | 8 | 会计服务, 报税服务, 保险, 贷款, 投资理财, 商业咨询 |
| **地产保险** | real-estate | 6 | 地产经纪, 物业管理, 验房, 商业地产, 过户服务 |
| **教育培训** | education | 11 | 课后辅导, 语言学校, 驾校, 编程科技, 体育培训, 升学顾问 |
| **装修家居** | home-renovation | 15 | 搬家, 水管, 电工, 油漆, 暖通空调, 园艺绿化, 总承包商 |
| **美容保健** | beauty-wellness | 9 | 美发沙龙, 美甲店, SPA按摩, 健身房, 医美 |
| **汽车服务** | auto | 7 | 汽车维修, 钣金喷漆, 车行, 洗车, 拖车 |
| **其他服务** | other-services | 16 | 旅行社, 快递物流, 摄影摄像, 宠物服务, 干洗洗衣, 老人护理 |

All categories have both `name_zh` (Chinese) and `name_en` (English) fields, making them ready for both the NY Chinese site and the Middletown English site.

---

## Scripts

### 1. `scripts/expand-categories.ts` — Add New Subcategories

Inserts missing subcategories into the `categories` table. Safe to run multiple times (skips existing slugs).

```bash
# Preview what will be added
npx tsx scripts/expand-categories.ts

# Apply changes
npx tsx scripts/expand-categories.ts --apply
```

**When to use:** When you identify a business type that doesn't fit any existing subcategory, add it to the `EXPANSIONS` array in this script and run again.

---

### 2. `scripts/classify-businesses.ts` — AI Auto-Classification

Uses Claude Haiku to analyze each business's name, tags, and description, then assigns the best parent + subcategory.

```bash
# Preview all businesses (dry run)
npx tsx scripts/classify-businesses.ts

# Apply to all businesses
npx tsx scripts/classify-businesses.ts --apply

# Classify one specific business
npx tsx scripts/classify-businesses.ts --slug=natural-life-acupuncture-pc --apply

# Only classify businesses with no category (after a new crawl)
npx tsx scripts/classify-businesses.ts --missing-only --apply
```

**How it works:**
1. Loads all business-relevant categories from DB (auto-discovers new subcategories)
2. Sends businesses to Claude Haiku in batches of 20
3. AI returns: `parent_slug`, `sub_slug`, confidence (high/medium/low), and reasoning
4. In `--apply` mode: updates `business_categories` table

**Cost:** ~$0.02 per batch of 20 businesses (Claude Haiku). Classifying 335 businesses costs ~$0.35.

---

### 3. `scripts/crawl-businesses-v2.ts` — Crawl from Google Places

Searches Google Places API for businesses by category queries, saves to DB.

```bash
npx tsx scripts/crawl-businesses-v2.ts
```

### 4. `scripts/enrich-businesses.ts` — Enrich with Emails, GBP Status

Extracts emails from websites, maps Google types to subcategories, checks GBP claim status.

```bash
npx tsx scripts/enrich-businesses.ts
```

---

## Recommended Pipeline

When onboarding businesses for a new region or expanding coverage:

```
Step 1: Crawl          → crawl-businesses-v2.ts    (fetch from Google Places)
Step 2: Backfill       → backfill-locations.ts     (get addresses, lat/lng, phone)
Step 3: Enrich         → enrich-businesses.ts      (emails, GBP status)
Step 4: Classify       → classify-businesses.ts    (AI-powered category assignment)
```

For ongoing operations:
- **New businesses added via admin** → Run `classify-businesses.ts --missing-only --apply`
- **New business type needed** → Add to `expand-categories.ts`, run it, then re-classify
- **Manual override** → Use Admin > Businesses > Edit to change category via dropdown

---

## Database Schema

### `categories` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| slug | TEXT | Unique, URL-friendly identifier |
| name_zh | TEXT | Chinese display name |
| name_en | TEXT | English display name |
| parent_id | UUID | FK to categories.id (null = parent category) |
| content_type | TEXT | 'business', 'guide', 'forum', etc. |

### `business_categories` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| business_id | UUID | FK to businesses.id |
| category_id | UUID | FK to categories.id |
| is_primary | BOOLEAN | Whether this is the primary category |

---

## AI Classification Details

The classify script sends this context to Claude Haiku:

- Full category hierarchy (all parents + subcategories with slugs)
- Business name (Chinese + English), AI tags, short description
- Name-based hints (e.g., 针灸 → 中医, bakery → 烘焙甜品)

The AI returns a JSON response with confidence levels:
- **High (🟢):** Name/tags clearly match one category
- **Medium (🟡):** Could fit multiple categories, AI picked the best one
- **Low (🔴):** Ambiguous — may need manual review

---

## Adding Categories for a New City/Language

When launching a new English-language city (e.g., Middletown OC):

1. The same categories work — all have `name_en` fields
2. English-specific business types (e.g., "Lawn Care") are already covered under existing subcategories
3. If new types are needed, add them to `expand-categories.ts` and run
4. The classify script works on English business names too — Claude understands both languages
