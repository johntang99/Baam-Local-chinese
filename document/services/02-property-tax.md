# Module 02 — Property Tax & Assessment Lookup

**Phase:** 1
**Estimated Build Time:** 1–2 weeks
**Data Agreement Required:** No (NYC GeoClient requires free registration)
**Revenue Potential:** High
**Build Effort:** Medium

---

## What It Does

A resident enters a **NYC property address** and gets back:
- Current assessed value (land + total)
- Market value estimate
- Property tax class and exemptions (STAR, senior, veteran, disabled)
- Estimated annual tax
- Property details (lot size, year built, zoning, building class)
- Sale history (last 3 sales with price + date)

**Why it matters for Baam:** High-intent users — renters doing due diligence, buyers researching tax exposure, homeowners comparing assessments. Every lookup is a potential real estate or legal lead.

---

## Data Sources

### Primary: NYC Property Assessment (Finance)
- **Endpoint:** `https://data.cityofnewyork.us/resource/yjxr-fw8i.json`
- **Auth:** None. App token recommended.
- **Key:** Query by BBL (Borough-Block-Lot) — the universal NYC property identifier

### Address → BBL Resolution: NYC GeoClient
- **Endpoint:** `https://api.nyc.gov/geo/geoclient/v2/address`
- **Auth:** Free API key required — register at https://api-portal.nyc.gov/
- **Query:** `houseNumber`, `street`, `borough` → returns `bbl`, `buildingIdentificationNumber`, `zipCode`, etc.
- **Env vars:** `NYC_GEOCLIENT_APP_ID`, `NYC_GEOCLIENT_APP_KEY`

### Supplementary: NYC MapPLUTO (Property Details)
- **Endpoint:** `https://data.cityofnewyork.us/resource/64uk-42ks.json`
- **Fields:** zoning, year built, lot area, building area, floor area ratio, units

### Supplementary: NYC ACRIS (Sale History)
- **Endpoint:** `https://data.cityofnewyork.us/resource/7isb-wh4c.json`
- **Fields:** deed transfers, sale prices, ownership history

---

## Route Structure

```
app/[locale]/(public)/services/
└── property-tax/
    ├── page.tsx                    ← Search tool + guide content (SSR)
    ├── property-tax-client.tsx     ← Client: address input + results
    ├── [bbl]/
    │   └── page.tsx                ← Individual property page (SSR, SEO)
    └── guide/
        └── page.tsx                ← "纽约房产税查询完全指南"

app/api/services/
└── property-tax/
    ├── route.ts                    ← GET: address → assessment + property data
    └── geocode/
        └── route.ts                ← GET: address → BBL resolution
```

### Individual Property Pages (`/[bbl]/`)

Like restaurant inspection pages, each BBL gets a unique indexable page. NYC has ~1 million properties — this is an enormous SEO surface.

```typescript
// [bbl]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bbl } = await params;
  const property = await fetchPropertyByBBL(bbl);
  return {
    title: `${property.address} 房产税查询 | Property Tax · Baam`,
    description: `${property.address} 的房产评估值、税额、产权信息。Tax class ${property.taxClass}, assessed value $${property.assessedTotal}.`,
  };
}
```

---

## Tax Calculation

```typescript
// NYC property tax rates (FY2025 — update annually)
const TAX_RATES: Record<string, number> = {
  '1':  0.19963,   // Class 1: 1-3 family homes
  '2':  0.12267,   // Class 2: Apartments
  '2A': 0.12267,
  '2B': 0.12267,
  '2C': 0.12267,
  '3':  0.12826,   // Class 3: Utilities
  '4':  0.10646,   // Class 4: Commercial
};

function estimateAnnualTax(assessedValue: number, taxClass: string): number {
  const rate = TAX_RATES[taxClass] || TAX_RATES['1'];
  return assessedValue * rate;
}
```

**Disclaimer required:** "实际税额可能因减免和调整而不同。以NYC Finance官方账单为准。"

---

## Page Content Architecture

### Search Page

```
┌──────────────────────────────────────────────┐
│ H1: 纽约房产税查询                               │
│ Subtitle: NYC Property Tax & Assessment       │
├──────────────────────────────────────────────┤
│ Guide Content (Chinese, 500+ words):          │
│ - 纽约房产税怎么算？                             │
│ - 四种房产税等级详解                             │
│ - STAR减免是什么？谁可以申请？                    │
│ - 如何申诉房产评估值                             │
├──────────────────────────────────────────────┤
│ [Address Input: 门牌号 + 街道名 + 区]           │
│ [Results: assessment card, tax estimate, etc.] │
├──────────────────────────────────────────────┤
│ FAQ (with FAQPage schema):                    │
│ Q: 纽约房产税税率是多少？                         │
│ Q: 怎么查自己房子的评估值？                       │
│ Q: 房产评估值太高怎么申诉？                       │
│ Q: STAR减免怎么申请？                            │
├──────────────────────────────────────────────┤
│ Related: Baam 房产商家 | 房产指南 | 论坛帖子      │
└──────────────────────────────────────────────┘
```

---

## SEO Strategy

### Chinese Keywords (Primary)
- 纽约房产税查询
- 纽约房产评估值
- NYC房产税怎么算
- 纽约STAR减免申请
- {小区/地区名} 房产税

### English Keywords (Secondary)
- NYC property tax lookup
- check property assessment NYC
- property tax by address New York
- NYC STAR exemption

### Structured Data
- `RealEstateListing` schema on property detail pages
- `FAQPage` schema on search page
- `WebApplication` schema for the tool itself

---

## Baam Platform Integration

- **Business directory cross-link:** Link to Baam real estate agents, mortgage brokers, tax attorneys
- **Guide articles:** Link to "纽约买房指南", "STAR减免申请指南"
- **AI search:** 小邻 can reference: "你可以用房产税查询工具查看这个地址的评估值"
- **Forum:** Property tax discussions link to the tool

---

## Revenue Paths

### Phase 1: Traffic + Email
- Property detail pages drive SEO traffic
- "保存查询结果" captures email
- Internal links to Baam business directory

### Phase 2: Lead Gen
- **Tax certiorari attorneys** — "评估值太高？免费咨询房产税律师" CTA when assessed value > neighborhood median. High-value leads: $50-200/lead.
- **Real estate agents** — "想在这个区买房？" CTA on every property page. Links to Baam agent listings.
- **Mortgage brokers** — Secondary CTA for first-time buyers.

### Phase 3: Business Upsell
- Real estate agent clients can sponsor property pages in their service area
- "附近的持牌地产经纪" featured placement on property detail pages

---

## V2 Additions

- Tax bill PDF link (NYC DOF ePay deep link)
- Neighborhood comparison: average assessed value vs. nearby properties
- Assessment history chart: year-over-year changes
- Exemption eligibility checker: "我能申请STAR减免吗？" questionnaire
- Landlord portfolio dashboard: multi-property tracking
