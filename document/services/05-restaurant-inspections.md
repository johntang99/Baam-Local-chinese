# Module 05 — Restaurant Health Inspection Scores

**Phase:** 1 — **BUILD NEXT**
**Estimated Build Time:** 1–2 weeks
**Data Agreement Required:** No
**Revenue Potential:** High (SEO + business upsell)
**Build Effort:** Low-Medium

---

## Why This Is Phase 1 (Promoted from Phase 2)

This module generates the **most SEO value** of any service:
- ~27,000 active restaurants in NYC = ~27,000 indexable detail pages
- Every restaurant name + "卫生评分" / "health inspection" is a long-tail search query
- Direct tie to Baam's existing business directory — cross-link restaurant businesses with their inspection data
- Upsell path: restaurant clients pay for an "A grade badge" on their Baam business page

---

## What It Does

Look up any NYC restaurant's:
- Current DOH letter grade (A, B, C, or Grade Pending)
- Full inspection history with violation details
- Violation categories and severity (critical vs. non-critical)
- Last inspection date and score

---

## Data Source

### NYC DOHMH Restaurant Inspection Results
- **Endpoint:** `https://data.cityofnewyork.us/resource/43nn-pn8j.json`
- **Auth:** None required. App token recommended.
- **Records:** ~400,000+ inspection records, updated daily
- **Docs:** https://dev.socrata.com/foundry/data.cityofnewyork.us/43nn-pn8j

#### Key Query Parameters
```
dba            = restaurant name (partial match)
boro           = "MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"
zipcode        = ZIP code
camis          = unique restaurant ID (for detail pages)
$q             = full-text search across name + address
$limit         = 50
$order         = inspection_date DESC
```

#### Response Shape
```typescript
interface RestaurantInspection {
  camis: string;                  // Unique restaurant ID
  dba: string;                    // Restaurant name (uppercase)
  boro: string;
  building: string;
  street: string;
  zipcode: string;
  phone: string;
  cuisine_description: string;
  inspection_date: string;
  action: string;
  violation_code: string;
  violation_description: string;
  critical_flag: string;          // "Critical", "Not Critical", "Not Applicable"
  score: string;                  // Lower = better (0-13 = A, 14-27 = B, 28+ = C)
  grade: string;                  // "A", "B", "C", "Z", "P", "N"
  grade_date: string;
  inspection_type: string;
  latitude?: string;
  longitude?: string;
}
```

---

## Route Structure

```
app/[locale]/(public)/services/
└── restaurant-inspections/
    ├── page.tsx                    ← Search tool + guide content (SSR)
    ├── inspections-client.tsx      ← Client component: search form + results list
    ├── [camis]/
    │   └── page.tsx                ← Individual restaurant detail page (SSR, SEO)
    └── guide/
        └── page.tsx                ← "纽约餐厅卫生评分完全指南" (static article)

app/api/services/
└── restaurant-inspections/
    ├── route.ts                    ← GET: search by name/location
    └── [camis]/
        └── route.ts                ← GET: full history for one restaurant
```

### Critical: Individual Restaurant Pages are SSR

The `/[camis]/page.tsx` pages must be **server-rendered** (not client-side) so Google can index them. Each page should:
- Fetch the restaurant's latest inspection data at request time
- Include full structured data (LocalBusiness + Restaurant schema)
- Have a unique title: "{Restaurant Name} 卫生评分 | Health Inspection · Baam"
- Link to the restaurant's Baam business page if one exists (join on name/address)

---

## Page Content Architecture

### Search Page (`/services/restaurant-inspections/`)

```
┌──────────────────────────────────────────────┐
│ H1: 纽约餐厅卫生评分查询                         │
│ Subtitle: NYC Restaurant Health Inspection    │
├──────────────────────────────────────────────┤
│ Guide Content (Chinese, 500+ words):          │
│ - 纽约餐厅卫生评分怎么看？(A/B/C 评级解释)        │
│ - 评分标准：0-13分=A, 14-27分=B, 28+分=C       │
│ - 常见违规类型解释                               │
│ - 如何使用本工具                                │
├──────────────────────────────────────────────┤
│ [Search Tool: restaurant name / borough/ZIP]  │
│ [Results: name, address, grade badge, date]   │
├──────────────────────────────────────────────┤
│ FAQ (with FAQPage schema):                    │
│ Q: 纽约餐厅卫生评分在哪里查？                     │
│ Q: B级餐厅安全吗？                              │
│ Q: 评分多久更新一次？                            │
│ Q: 餐厅如何申诉评分？                            │
├──────────────────────────────────────────────┤
│ Related: Baam 美食商家 | 美食指南 | 社区笔记       │
└──────────────────────────────────────────────┘
```

### Restaurant Detail Page (`/[camis]/`)

```
┌──────────────────────────────────────────────┐
│ H1: {Restaurant Name} 卫生评分                  │
│ Address | Cuisine | Phone                     │
├──────────────────────────────────────────────┤
│ ┌──────────┐                                  │
│ │    A     │  评分: 12  |  最近检查: 2025-03-01 │
│ │  (大字)   │  通过初始检查                       │
│ └──────────┘                                  │
├──────────────────────────────────────────────┤
│ 检查历史 (timeline):                            │
│ - 2025-03-01: A (12分) - 1项违规                │
│ - 2024-09-15: A (9分) - 0项违规                 │
│ - 2024-03-20: B (18分) - 3项违规                │
│   └─ [展开] 违规详情                             │
├──────────────────────────────────────────────┤
│ 在 Baam 上查看:                                │
│ [Link to Baam business page if exists]        │
│ [写一篇关于这家餐厅的笔记 → Discover]             │
├──────────────────────────────────────────────┤
│ Share: 微信 | WhatsApp | 复制链接               │
├──────────────────────────────────────────────┤
│ 附近的A级餐厅 (internal links)                  │
└──────────────────────────────────────────────┘
```

---

## Grade Logic & Display

```typescript
function getGradeFromScore(score: number): string {
  if (score <= 13) return 'A';
  if (score <= 27) return 'B';
  return 'C';
}

const GRADE_STYLES = {
  'A': { bg: 'bg-green-500', text: 'text-white', label: '优秀' },
  'B': { bg: 'bg-yellow-500', text: 'text-white', label: '良好' },
  'C': { bg: 'bg-orange-500', text: 'text-white', label: '需改进' },
  'Z': { bg: 'bg-red-500', text: 'text-white', label: '待评级' },
  'P': { bg: 'bg-gray-400', text: 'text-white', label: '待评级' },
  'N': { bg: 'bg-gray-300', text: 'text-gray-600', label: '未评级' },
};
```

## Inspection History Grouping

Each restaurant has many rows (one per violation per inspection). Must group by inspection date:

```typescript
function groupByInspection(records: RestaurantInspection[]) {
  const map = new Map<string, {
    date: string;
    score: number;
    grade: string;
    type: string;
    violations: { code: string; description: string; critical: boolean }[];
  }>();

  for (const r of records) {
    const key = `${r.camis}-${r.inspection_date}`;
    if (!map.has(key)) {
      map.set(key, {
        date: r.inspection_date,
        score: parseInt(r.score || '0'),
        grade: r.grade || '',
        type: r.inspection_type || '',
        violations: [],
      });
    }
    if (r.violation_code && r.violation_description) {
      map.get(key)!.violations.push({
        code: r.violation_code,
        description: r.violation_description,
        critical: r.critical_flag === 'Critical',
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

---

## Baam Platform Integration

### Cross-link with Business Directory

When displaying a restaurant inspection result, check if a matching Baam business exists:

```typescript
// Match by name similarity + address proximity
const { data: baamBiz } = await supabase
  .from('businesses')
  .select('slug, display_name_zh, display_name')
  .or(`display_name.ilike.%${dba}%,display_name_zh.ilike.%${dba}%`)
  .eq('status', 'active')
  .limit(1);
```

If found, show: "在 Baam 上查看这家餐厅 →" linking to the business page.

### Discover Integration

Add "写一篇关于这家餐厅的笔记" button → links to `/discover/new-post?business={baam_slug}` (uses the bridge we already built in Task C).

### AI Search Integration

小邻 should reference inspection data: "这家餐厅卫生评分A级，最近一次检查是2025年3月"

---

## SEO Strategy

### Chinese Keywords (Primary)
- 纽约餐厅卫生评分查询
- {餐厅名} 卫生检查
- 纽约餐厅卫生等级
- 法拉盛餐厅卫生评分
- 纽约中餐厅卫生检查

### English Keywords (Secondary)
- NYC restaurant health inspection
- restaurant inspection scores NYC
- {restaurant name} health grade
- DOH restaurant grades

### Static Page Generation

For top restaurants (rating A, high review count), consider ISR (Incremental Static Regeneration):

```typescript
// [camis]/page.tsx
export const revalidate = 86400; // Revalidate daily
```

This generates static HTML that Google can crawl efficiently, revalidated every 24 hours.

---

## Revenue Paths (Phased)

### Phase 1: Traffic (Day 1)
- ~27,000 restaurant pages = massive long-tail SEO surface
- Chinese users searching restaurant names land on Baam
- Internal links funnel to business directory + Discover

### Phase 2: Business Upsell (Month 2)
- **Health Grade Badge** — Restaurant clients pay $10-20/mo to embed their A grade prominently on their Baam business page
- **"Verified Clean" label** — Visible in search results and business directory

### Phase 3: Lead Gen (Month 3+)
- Restaurants with B/C grades: "需要提升卫生评分？我们的合作伙伴可以帮助" → food safety consultant leads
- Food industry suppliers targeting restaurant owners via placement

---

## V2 Additions

- Cuisine filter: "法拉盛A级中餐厅"
- Map view: restaurants plotted with grade overlay
- Grade change alerts: "你关注的餐厅评分从A降到B"
- Comparison widget: two restaurants side by side
- Embeddable grade widget: iframe for restaurant websites
