# Module 05 — Restaurant Inspections: Implementation Notes

**Status:** Implemented (2026-04-02)
**Files:** See file list below

---

## Search Architecture

### Flow Diagram

```
User Input ("海底捞" or "dim sum")
  │
  ├─ Detect: has Chinese characters?
  │
  ├─ YES (Chinese Path)
  │   ├─ Search Baam businesses: display_name_zh ILIKE %海底捞%
  │   ├─ Found: "Haidilao Hotpot" (zh: "海底捞火锅法拉盛店")
  │   ├─ Extract keywords: ["haidilao", "hotpot"]
  │   │   └─ Strip noise: inc, llc, restaurant, flushing, nyc, etc.
  │   ├─ Query Socrata: $q=haidilao hotpot
  │   ├─ If < 5 results → retry with first word: $q=haidilao
  │   ├─ If < 5 results → also try original Chinese: $q=海底捞
  │   └─ Merge all results, deduplicate by camis
  │
  ├─ NO (English Path)
  │   ├─ Query Socrata directly: $q=dim sum
  │   └─ Also search Baam businesses: display_name ILIKE %dim sum%
  │       └─ Build Chinese name lookup map from matches
  │
  ├─ Enrich Results with Chinese Names
  │   ├─ For each Socrata result (e.g., "HAIDILAO HOT POT"):
  │   │   ├─ Exact match: baamNameMap["haidilao hot pot"] → "海底捞火锅法拉盛店"
  │   │   └─ Fuzzy match: split into words, check 2+ word overlap
  │   │       e.g., ["haidilao","hot","pot"] vs ["haidilao","hotpot"]
  │   │       → "haidilao" overlaps → match → attach dba_zh
  │   └─ Attach dba_zh to each result
  │
  └─ Return Response
      {
        camis: "50096038",
        dba: "HAIDILAO HOT POT",         ← NYC DOH (always English)
        dba_zh: "海底捞火锅法拉盛店",        ← Baam business directory
        grade: "A", score: 13, ...
      }
```

### Why This Architecture

The NYC DOH database stores restaurant names in **uppercase English DBA names only**. No Chinese characters exist in the source data. But Baam's primary audience searches in Chinese.

The solution: use Baam's own business directory (1,978+ businesses with Chinese names) as a **translation bridge** between Chinese search queries and the English-only Socrata API.

This coverage improves automatically as more businesses are added to Baam's directory.

---

## Display Rules

| Scenario | Primary Name (bold) | Secondary Name (gray) |
|----------|--------------------|-----------------------|
| Has Chinese name from Baam | 海底捞火锅法拉盛店 | HAIDILAO HOT POT |
| No Chinese name available | HAIDILAO HOT POT | — |

Applied on both **search results** and **detail pages**.

On the **detail page**, the Chinese name also appears in:
- H1 heading
- Page title (SEO metadata): "海底捞火锅法拉盛店 HAIDILAO HOT POT 卫生评分 A级"
- Breadcrumb (still shows English DBA for now)

---

## State Persistence

| Feature | Mechanism |
|---------|-----------|
| Back button preserves search + results | Query stored in URL params: `?q=海底捞&boro=Queens` |
| Auto-search on back navigation | Component reads `useSearchParams()` on mount, re-fetches if `q` exists |
| Recent searches dropdown | Last 8 searches saved to `localStorage` key `baam-restaurant-search-history` |
| History display | Shows on input focus when input is empty, with clock icon + "最近搜索" header |

---

## Data Sources

### Primary: NYC DOH Restaurant Inspections (Socrata)
- **Endpoint:** `https://data.cityofnewyork.us/resource/43nn-pn8j.json`
- **Auth:** None required. Optional `NYC_OPEN_DATA_APP_TOKEN` for higher limits.
- **Search:** `$q` parameter for full-text search across DBA + address
- **Detail:** `camis` parameter for a specific restaurant's full history
- **Records:** ~400,000+ (one row per violation per inspection)
- **Update frequency:** Daily

**Key fields used:**
| Field | Description | Example |
|-------|-------------|---------|
| `camis` | Unique restaurant ID | `50096038` |
| `dba` | Restaurant name (uppercase English) | `HAIDILAO HOT POT` |
| `boro` | Borough | `Queens` |
| `building` + `street` | Address | `138-23` + `39 AVENUE` |
| `zipcode` | ZIP code | `11354` |
| `phone` | Phone (10 digits, no formatting) | `9172318888` |
| `cuisine_description` | Cuisine type | `Chinese` |
| `inspection_date` | Date (ISO format) | `2026-01-13T00:00:00.000` |
| `grade` | Letter grade | `A`, `B`, `C`, `Z`, `P`, `N` |
| `score` | Numeric score (lower = better) | `13` |
| `violation_code` | Violation code | `04N` |
| `violation_description` | Full violation text | `Cold TCS food item held above 41°F...` |
| `critical_flag` | Severity | `Critical`, `Not Critical`, `Not Applicable` |
| `inspection_type` | Inspection category | `Cycle Inspection / Initial Inspection` |
| `latitude` / `longitude` | Geo coordinates | `40.759477` / `-73.832243` |

### Secondary: Baam Business Directory (Supabase)
- **Table:** `businesses`
- **Used for:** Chinese name lookup (`display_name_zh`), cross-linking to Baam business pages
- **Query:** `display_name_zh ILIKE %query%` for Chinese search, `display_name ILIKE %query%` for English enrichment
- **Coverage:** ~1,978 businesses with Chinese names (as of 2026-04-02)

---

## API Routes

### Search: `GET /api/services/restaurant-inspections?q=&boro=`

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `q` | Yes (unless `camis`) | Search query (Chinese or English) |
| `boro` | No | Filter by borough: `Manhattan`, `Brooklyn`, `Queens`, `Bronx`, `Staten Island` |
| `camis` | No | Fetch specific restaurant's full history |

**Response (search):**
```json
{
  "restaurants": [
    {
      "camis": "50096038",
      "dba": "HAIDILAO HOT POT",
      "dba_zh": "海底捞火锅法拉盛店",
      "boro": "Queens",
      "building": "138-23",
      "street": "39 AVENUE",
      "zipcode": "11354",
      "phone": "9172318888",
      "cuisine": "Chinese",
      "grade": "A",
      "score": 13,
      "inspection_date": "2026-01-13T00:00:00.000",
      "latitude": "40.759477",
      "longitude": "-73.832243"
    }
  ],
  "total": 1
}
```

**Response (detail with `?camis=`):**
```json
{
  "restaurant": {
    "camis": "50096038",
    "dba": "HAIDILAO HOT POT",
    "boro": "Queens",
    "building": "138-23",
    "street": "39 AVENUE",
    "zipcode": "11354",
    "phone": "9172318888",
    "cuisine": "Chinese",
    "latitude": "40.759477",
    "longitude": "-73.832243"
  },
  "inspections": [
    {
      "date": "2026-01-13T00:00:00.000",
      "score": 13,
      "grade": "A",
      "type": "Cycle Inspection / Initial Inspection",
      "violations": [
        {
          "code": "02G",
          "description": "Cold TCS food item held above 41°F...",
          "critical": true
        }
      ]
    }
  ]
}
```

**Caching:**
- Search results: `s-maxage=300` (5 min edge cache)
- Detail results: `s-maxage=3600` (1 hour edge cache)

**Rate limiting:** 15 requests/min per IP (in-memory)

---

## Grade System

| Grade | Score Range | Chinese Label | Color | Meaning |
|-------|------------|---------------|-------|---------|
| A | 0–13 | 优秀 | Green (`bg-green-500`) | Meets standards with minimal violations |
| B | 14–27 | 良好 | Yellow (`bg-yellow-500`) | Some issues, generally acceptable |
| C | 28+ | 需改进 | Orange (`bg-orange-500`) | Significant issues, needs remediation |
| Z | — | 待评级 | Red (`bg-red-500`) | Scored 28+ on initial, awaiting re-inspection |
| P | — | 待评级 | Gray (`bg-gray-400`) | Pending (first inspection not yet graded) |
| N | — | 未评级 | Gray (`bg-gray-300`) | Not yet graded |

**Scoring:** Lower is better. Each violation deducts points:
- Critical violations: 5–28 points each
- Non-critical violations: 2–5 points each

---

## Baam Platform Integration

### Business Cross-Link (Detail Page)

On each restaurant detail page (`/[camis]/`), the system searches Baam's business directory for a matching restaurant:

```
Restaurant DBA: "HAIDILAO HOT POT"
  → Extract key words: ["haidilao", "hot", "pot"] (words > 2 chars)
  → Query: businesses.display_name ILIKE %haidilao%hot%pot%
  → Prefer matches with display_name_zh (has Chinese name)
  → If found: show Baam business card with rating, address, "Baam认证" badge
```

### Discover Bridge

If a Baam business match is found, the "写笔记" button links to:
```
/discover/new-post?business={baam_slug}
```
This pre-links the restaurant in the Discover post creation form (uses Task C business→discover bridge).

### AI Search (小邻)

Not yet integrated. Future: 小邻 should be able to answer "海底捞卫生评分怎么样？" by querying the inspections API.

---

## Files

| File | Purpose |
|------|---------|
| `app/api/services/restaurant-inspections/route.ts` | API proxy: Socrata search + detail, Chinese name enrichment via Baam DB, rate limiting, caching |
| `app/[locale]/(public)/services/restaurant-inspections/page.tsx` | Search page: SEO guide content (grade explainer, violation types), FAQ with schema, Baam integration links |
| `app/[locale]/(public)/services/restaurant-inspections/inspections-client.tsx` | Client component: search form with history dropdown, results with Chinese names, URL state persistence |
| `app/[locale]/(public)/services/restaurant-inspections/[camis]/page.tsx` | Detail page (SSR): grade hero, stats, inspection timeline, Baam cross-link, 写笔记 CTA, Restaurant JSON-LD |
| `components/services/service-faq.tsx` | Reusable FAQ accordion with FAQPage structured data |

---

## Known Limitations

1. **Chinese name coverage** depends on Baam's business directory (~1,978 businesses have Chinese names). Restaurants not in Baam show English-only.
2. **Socrata `$q` full-text search** doesn't handle compound words well ("hotpot" ≠ "hot pot"). Mitigated by first-word fallback.
3. **Fuzzy word matching** can occasionally mis-match restaurants sharing common words (e.g., multiple "dim sum" restaurants matched to the same Chinese name).
4. **Inspection data grouping** — Socrata returns one row per violation per inspection. Must group by `camis` + `inspection_date` to reconstruct inspection records.
5. **Date format** — Socrata returns ISO format `2026-01-13T00:00:00.000`, displayed as `2026-01-13`.

---

## Tested Scenarios

| Search Query | Results | Chinese Name | Notes |
|-------------|---------|-------------|-------|
| 海底捞 | 1 (HAIDILAO HOT POT) | 海底捞火锅法拉盛店 | Chinese → Baam → keyword → Socrata + first-word fallback |
| 南翔 | 3 (NAN XIANG EXPRESS...) | 南翔小笼包 | Chinese → Baam → multiple locations found |
| nan xiang | 7 locations | 南翔小笼包 | English → Socrata direct + Baam enrichment |
| dim sum | 13 restaurants | Mixed | English → some have Baam Chinese names |
| (empty plate) | 0 results | — | "未找到餐厅" empty state |
| Back navigation | Preserved | — | URL params restore search state + results |
| Input focus (empty) | History dropdown | — | Shows up to 8 recent searches from localStorage |
