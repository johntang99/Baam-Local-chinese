# BAAM Immigration Lawyer Services — Master Overview

## What This Is

A suite of **Immigration Utility Modules** deployable on any BAAM immigration lawyer site. Each module targets a specific high-anxiety moment in the immigration journey — case status anxiety, eligibility confusion, processing time uncertainty, visa bulletin waiting — and converts that anxiety into a consultation booking.

These tools are built on **public government data APIs** (USCIS, State Dept, EOIR). No licensing fees. No data agreements required.

The strategic play: free tools that are more useful than anything the government's own websites offer, embedded on the lawyer's BAAM site, converting research traffic into retained clients.

---

## Architecture Fit

```
BAAM Multi-Tenant Platform (Next.js)
└── /immigration/                        ← New route group for immigration vertical
    ├── case-status/                     ← Module 01
    ├── visa-screener/                   ← Module 02
    ├── processing-times/                ← Module 03
    ├── priority-dates/                  ← Module 04
    ├── court-dates/                     ← Module 05
    ├── travel-advisories/               ← Module 06
    └── policy-news/                     ← Module 07
```

Each module follows the same BAAM pattern:
- `page.tsx` — server component with metadata + OG tags
- `[module]-client.tsx` — client component with form + results UI
- `api/immigration/[module]/route.ts` — API route proxying the government data source
- `types.ts` — TypeScript interfaces for the data shape
- JSON content schema entry for site-level CTA customization

---

## Supabase Tables Required

```sql
-- Track tool usage per site for analytics and rate limiting
create table immigration_lookups (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  module text not null,           -- 'case-status', 'processing-times', etc.
  query_hash text not null,       -- hashed query (never store raw receipt/A-numbers)
  created_at timestamptz default now()
);

-- Consultation lead capture
create table immigration_leads (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  module text not null,
  trigger text not null,          -- what triggered the CTA: 'case_delayed', 'eligible_match', etc.
  contact_info jsonb,             -- name, email, phone
  notes text,                     -- brief situation summary from screener
  created_at timestamptz default now()
);

-- Priority date alert subscriptions (Module 04)
create table priority_date_subscriptions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  email text not null,
  preference_category text not null,   -- 'F1', 'F2A', 'EB1', 'EB2', etc.
  country_of_chargeability text not null,
  priority_date date not null,
  notify_when text default 'current',  -- 'current' | 'within_6mo' | 'within_1yr'
  active boolean default true,
  last_alerted_at timestamptz,
  created_at timestamptz default now()
);
```

---

## Shared UI Components to Build

```
components/immigration/
├── ImmigrationPageShell.tsx       ← Header, disclaimer banner, CTA sidebar
├── ConsultationCTA.tsx            ← Primary lead capture ("Book a free consultation")
├── LeadCaptureModal.tsx           ← Modal with name/email/phone + situation notes
├── DisclaimerBanner.tsx           ← "This tool provides general information only, not legal advice"
├── GovernmentDataBadge.tsx        ← "Data sourced from USCIS / State Dept" trust signal
└── StatusBadge.tsx                ← Reusable colored status pill
```

---

## Legal Disclaimer (Required on All Modules)

Every page must display prominently:

```
⚠️ This tool provides general information only and does not constitute legal advice.
Immigration law is complex and fact-specific. Always consult a licensed immigration
attorney before making decisions based on this information.
```

Store as a shared component `DisclaimerBanner.tsx` and render at the top of every immigration module page.

---

## Monetization Infrastructure

### Consultation CTA (All Modules)
Each module triggers a site-specific consultation CTA configured in the BAAM admin:

```json
{
  "immigration_ctas": {
    "default": {
      "headline": "Have Questions About Your Case?",
      "body": "Schedule a free 30-minute consultation with our immigration attorneys.",
      "button_text": "Book Free Consultation",
      "button_url": "/contact",
      "calendly_url": "https://calendly.com/your-firm"
    }
  }
}
```

### Trigger-Based CTAs
Each module fires a specific CTA based on the result:
- Case status = "Case Was Denied" → "Appeal options — speak to an attorney today"
- Visa screener = "3 visa categories matched" → "Find out which path is right for you"
- Processing time = "18 months behind schedule" → "Expedite your case — free consultation"

### White-Label Add-On
Each module can be enabled per BAAM immigration lawyer site for $30–60/mo as a "Client Tools" package.

---

## Build Sequence

| # | Module | Phase | Est. Time | Spec File |
|---|--------|-------|-----------|-----------|
| 01 | Case Status Tracker | 1 | 1 week | `01-case-status.md` |
| 02 | Visa Eligibility Screener | 1 | 2 weeks | `02-visa-screener.md` |
| 03 | Processing Time Lookup | 1 | 1 week | `03-processing-times.md` |
| 04 | Priority Date Tracker | 2 | 2 weeks | `04-priority-dates.md` |
| 05 | Immigration Court Date Lookup | 2 | 1 week | `05-court-dates.md` |
| 06 | Travel Advisory Widget | 3 | 3 days | `06-travel-advisories.md` |
| 07 | Policy & News Feed | 3 | 3 days | `07-policy-news.md` |

---

## Environment Variables Required

```env
# USCIS API (case status — may require scraping fallback)
USCIS_API_BASE=https://egov.uscis.gov

# EOIR Court Date Lookup
EOIR_API_BASE=https://acis.eoir.justice.gov

# State Dept Travel Advisories
STATE_DEPT_FEED=https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html

# Anthropic — for Visa Screener AI (Module 02)
ANTHROPIC_API_KEY=

# Resend — for Priority Date alert emails (Module 04)
RESEND_API_KEY=

# NYC Open Data token (shared across BAAM)
NYC_OPEN_DATA_APP_TOKEN=
```

---

## SEO Opportunity

Immigration is one of the highest-CPM search verticals in legal. These tools target high-intent informational queries that convert:

| Query | Monthly Searches | Intent |
|-------|-----------------|--------|
| "check USCIS case status" | 450,000+ | Very High |
| "USCIS processing times 2025" | 200,000+ | High |
| "visa bulletin priority dates" | 90,000+ | High |
| "am I eligible for H1B" | 60,000+ | High |
| "immigration court date lookup" | 30,000+ | Very High |

Deploying these tools on a BAAM immigration lawyer site creates a powerful organic SEO moat.
