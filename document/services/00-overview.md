# BAAM NY Local Services — Master Overview

## What This Is

A suite of **free Chinese-first utility tools** for NYC residents, built on public data APIs. Each tool serves a real daily need — checking parking tickets, looking up property taxes, verifying restaurant hygiene scores — and funnels users into the Baam platform ecosystem.

**The strategic play:**
1. Free tools rank on Google for Chinese + English search queries → drives organic traffic
2. Traffic lands on Baam → discovers business directory, community content, guides
3. Email capture on every tool → builds newsletter audience
4. Service badges upsold to existing Baam business clients
5. Lead gen CTAs activate once partner network is established (Phase 2+)

---

## Core Principles (Revised from Implementation Experience)

### 1. Chinese-First, Bilingual SEO
- All page titles, meta descriptions, H1s, and guide content in Simplified Chinese first
- English keywords as secondary targets (less competition in Chinese)
- Every tool page has 500+ words of Chinese guide content ABOVE the form — this is what Google indexes
- The interactive tool is a value-add, not the primary content

### 2. Static Content > Client-Side Rendering
- Google can't index a blank form with client-side results
- Each module needs **static SEO landing pages** alongside the lookup tool
- Restaurant inspections, property records, etc. generate **thousands of static detail pages** (one per entity)

### 3. Free First, Revenue Later
- Phase 1: 100% free, optimize for traffic + email capture
- Phase 2: Cross-sell badges/features to Baam business clients
- Phase 3: Lead gen CTAs with professional partners (attorneys, agents)
- Phase 4: Subscription tiers (only after 1,000+ active free users)

### 4. Services Feed the Platform
- Every tool result page links to relevant Baam businesses, guides, and Discover posts
- AI search (小邻) suggests services contextually: "你可以用我们的罚单查询工具查看"
- Guide articles embed service widgets
- Business pages link to relevant service data (health grade, contractor license)

### 5. Mobile-First, Share-Ready
- 70%+ of Chinese immigrant users are mobile-only
- Card-based results layout, not desktop tables
- "分享到微信" / "分享到WhatsApp" buttons on every results page
- "打印/导出" option for users who need physical records

---

## Architecture

```
app/[locale]/(public)/services/
├── page.tsx                              ← Services index ("实用工具")
├── vehicle-violations/                   ← Module 01 (DONE)
│   ├── page.tsx                          ← Tool + guide content + FAQ schema
│   ├── violation-lookup.tsx              ← Client component
│   └── guide/page.tsx                    ← "纽约停车罚单完全指南" (SEO article)
├── restaurant-inspections/               ← Module 05 (Phase 1 — NEXT)
│   ├── page.tsx                          ← Search tool + guide content
│   ├── inspections-client.tsx            ← Client component
│   ├── [camis]/page.tsx                  ← Individual restaurant pages (SSR, SEO)
│   └── guide/page.tsx                    ← "纽约餐厅卫生评分指南"
├── property-tax/                         ← Module 02 (Phase 1)
│   ├── page.tsx
│   ├── property-tax-client.tsx
│   ├── [bbl]/page.tsx                    ← Individual property pages (SEO)
│   └── guide/page.tsx                    ← "纽约房产税查询指南"
├── parking-schedule/                     ← Module 03 (Phase 2, renamed from alerts)
├── building-permits/                     ← Module 04 (Phase 2)
├── 311-tracker/                          ← Module 06 (Phase 2)
├── transit-status/                       ← Module 07 (Phase 3)
└── civic-tracker/                        ← Module 08 (Phase 3, optional)

app/api/services/
├── vehicle-violations/route.ts           ← DONE
├── restaurant-inspections/route.ts
├── property-tax/route.ts
└── ...
```

### Shared Components

```
components/services/
├── ServicePageLayout.tsx       ← Consistent header, guide content area, tool area, CTA sidebar
├── ServiceFAQ.tsx              ← FAQ accordion with FAQPage schema injection
├── ServiceShareButtons.tsx     ← WeChat, WhatsApp, copy link, print
├── ServiceEmailCapture.tsx     ← "保存结果到邮箱" inline form
├── ServiceRelatedContent.tsx   ← Links to Baam businesses, guides, discover posts
└── ServiceStructuredData.tsx   ← JSON-LD schema injection (FAQ, HowTo, Service)
```

---

## SEO Architecture (Every Module)

### Page Structure for Google Indexing

```
┌─────────────────────────────────────────┐
│  H1: 纽约停车罚单查询 (Chinese title)      │
│  Subtitle: NYC Parking Ticket Lookup     │
├─────────────────────────────────────────┤
│  Guide Content (500+ words, Chinese)     │  ← Google indexes this
│  - What this tool does                   │
│  - How to use it                         │
│  - Common violation types explained      │
│  - Tips (how to fight a ticket, etc.)    │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐     │
│  │  Interactive Tool (Client)       │     │  ← User value
│  │  [Plate input] [Search]          │     │
│  │  [Results table/cards]           │     │
│  └─────────────────────────────────┘     │
├─────────────────────────────────────────┤
│  FAQ Section (with FAQPage schema)       │  ← Rich snippets in Google
├─────────────────────────────────────────┤
│  Related: Baam businesses, guides, posts │  ← Internal links
├─────────────────────────────────────────┤
│  Email capture: "保存结果到邮箱"            │  ← Lead capture
└─────────────────────────────────────────┘
```

### Metadata Template

```typescript
export const metadata: Metadata = {
  title: '{Chinese Title} | {English Title} · Baam',
  description: '{Chinese description, 150 chars}',
  keywords: ['{Chinese keywords}', '{English keywords}'],
  openGraph: {
    title: '{Chinese Title}',
    description: '{Chinese description}',
    locale: 'zh_CN',
    alternateLocale: 'en_US',
  },
  alternates: {
    languages: {
      'zh-CN': '/zh/services/{module}',
      'en': '/en/services/{module}',
    },
  },
};
```

### Structured Data (Every Module)

```typescript
// ServiceStructuredData.tsx
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer,
    },
  })),
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "{Tool Name}",
  "description": "{Description}",
  "applicationCategory": "UtilityApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "areaServed": {
    "@type": "City",
    "name": "New York",
    "containedInPlace": { "@type": "State", "name": "New York" },
  },
};
```

---

## Revenue Model (Phased)

### Phase 1: Traffic + Email Capture (Day 1)

| Action | How |
|--------|-----|
| SEO traffic | Chinese guide content ranks for Chinese search queries |
| Platform funnel | Every results page links to Baam businesses, guides, Discover |
| Email list | "保存结果到邮箱" / "订阅本地服务提醒" on every tool |
| AI search integration | 小邻 suggests tools contextually in chat |

### Phase 2: Business Client Upsell (Month 2+)

| Action | Revenue |
|--------|---------|
| Restaurant health grade badge on Baam page | $10-20/mo per restaurant client |
| Contractor license verification badge | $15-30/mo per contractor client |
| Property data widget on realtor pages | $20-40/mo per agent |
| "Featured" placement in tool results | $30-50/mo |

### Phase 3: Lead Gen Partnerships (Month 3+)

| Lead Type | Source Module | Est. Value |
|-----------|-------------|------------|
| Traffic attorney | Vehicle violations (amount_due > 0) | $15-40/lead |
| Tax certiorari attorney | Property tax (high assessment) | $50-200/lead |
| Licensed contractor | Building permits (renovation intent) | $20-50/lead |
| Tenant rights attorney | 311 tracker (heat/plumbing complaints) | $30-80/lead |
| Real estate agent | Property tax + 311 (buyer research) | $15-30/lead |

### Phase 4: Subscriptions (Month 6+, requires volume)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | All lookups, email alerts |
| Premium | $4.99/mo | SMS alerts, multi-address, fleet dashboard |

---

## Supabase Tables

```sql
-- Track all service lookups (analytics + rate limiting)
create table service_lookups (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  module text not null,
  query_hash text not null,       -- hashed query params (privacy)
  result_count int default 0,
  created_at timestamptz default now()
);

-- Email captures from service pages
create table service_email_captures (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  module text not null,
  email text not null,
  capture_type text not null,     -- 'save_results', 'subscribe_alerts', 'newsletter'
  metadata jsonb,                 -- module-specific data (plate, address, etc.)
  created_at timestamptz default now()
);

-- Lead captures (Phase 3+)
create table service_leads (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  module text not null,
  lead_type text not null,
  contact_info jsonb,
  context jsonb,                  -- what triggered the lead (violation count, amount due, etc.)
  created_at timestamptz default now()
);
```

---

## Build Sequence (Revised)

| # | Module | Phase | Priority | SEO Pages | Revenue Path |
|---|--------|-------|----------|-----------|--------------|
| 01 | Vehicle Violations | 1 | **DONE** | Guide + FAQ | Traffic → email → attorney leads |
| 05 | Restaurant Inspections | 1 | **NEXT** | ~40K restaurant pages | Traffic → biz badge upsell |
| 02 | Property Tax | 1 | High | ~1M property pages | Traffic → realtor/attorney leads |
| 06 | 311 Complaint Tracker | 2 | Medium | Guide + FAQ | Traffic → attorney/realtor leads |
| 03 | Parking Schedule Lookup | 2 | Medium | Guide + FAQ | Traffic → email alerts |
| 04 | Building Permits | 2 | Medium | Guide + FAQ | Traffic → contractor leads |
| 07 | Transit Status | 3 | Low | Guide only | Traffic → commuter audience |
| 08 | Civic Tracker | 3 | Optional | CB pages | Brand equity only |

---

## Environment Variables

```env
# NYC Open Data (Socrata)
NYC_OPEN_DATA_APP_TOKEN=           # Free, raises rate limit to 1M/day

# NYC GeoClient (address resolution)
NYC_GEOCLIENT_APP_ID=              # Free, required for property/311/ASP
NYC_GEOCLIENT_APP_KEY=

# Google Civic Information API (Module 08 only)
GOOGLE_CIVIC_API_KEY=              # Free tier: 25K req/day

# MTA API (Module 07 only)
MTA_API_KEY=                       # Free

# Email (Phase 2+)
RESEND_API_KEY=                    # For email captures + alerts

# SMS (Phase 4+)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Payments (Phase 4+)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## Integration Touchpoints with Baam Platform

| Baam Feature | Service Integration |
|-------------|-------------------|
| AI Search (小邻) | Suggest tools: "你可以用罚单查询工具查看" |
| Business Pages | Embed health grade badge, contractor license badge |
| Guide Articles | Link to relevant tools inline |
| Discover Posts | "写一篇关于这家餐厅的笔记" from inspection results |
| Homepage | "实用工具" section with tool cards |
| Navbar | "实用工具" link (DONE) |
| Footer | Service links in quick navigation (DONE) |
| Newsletter | Weekly digest includes "本周热门查询" |
