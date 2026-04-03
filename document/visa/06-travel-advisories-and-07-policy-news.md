# Module 06 — Country Travel Advisory Widget

**Phase:** 3 — Ecosystem  
**Estimated Build Time:** 3 days  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐  
**Build Effort:** Low  

---

## What It Does

Displays the current US State Department travel advisory for any country. Relevant for immigration clients who need to travel internationally while their cases are pending — a Level 3 or Level 4 advisory combined with advance parole or reentry concerns is critical information.

Also useful for: clients worried about traveling on a valid visa, people checking whether their home country carries a travel ban concern, and attorneys advising clients on international travel risks.

---

## Data Source

### State Department Travel Advisories RSS / JSON
The State Department publishes travel advisories at:
```
https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
```

The data is available as an RSS feed and as a structured page. Fetch and parse:
```
GET https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/_jcr_content/travelAdvisoriesFolder/travelAdvisories
```

Or parse the RSS feed:
```
GET https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/RSS.xml
```

Each entry has: country name, advisory level (1–4), advisory summary, date last updated.

---

## Advisory Levels

```typescript
const ADVISORY_LEVELS = {
  1: {
    label: 'Exercise Normal Precautions',
    color: '#00E5A0',
    icon: '🟢',
    description: 'This is the lowest advisory level.',
  },
  2: {
    label: 'Exercise Increased Caution',
    color: '#FFD000',
    icon: '🟡',
    description: 'Be aware of heightened risks.',
  },
  3: {
    label: 'Reconsider Travel',
    color: '#FF8C00',
    icon: '🟠',
    description: 'Avoid travel if possible. Serious risks present.',
  },
  4: {
    label: 'Do Not Travel',
    color: '#FF4444',
    icon: '🔴',
    description: 'Highest level. Life-threatening risks.',
  },
};
```

---

## TypeScript Interfaces

```typescript
interface TravelAdvisory {
  country: string;
  countryCode: string;      // ISO 3166-1 alpha-2
  level: 1 | 2 | 3 | 4;
  summary: string;
  lastUpdated: string;
  url: string;              // Link to full State Dept advisory
  specialCircumstances?: string[];  // Travel ban, visa restrictions, etc.
}
```

---

## File Structure

```
app/
└── immigration/
    └── travel-advisories/
        ├── page.tsx
        ├── travel-advisories-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── travel-advisories/
            └── route.ts              ← GET: all advisories or by country (cached 24hr)
```

---

## API Route

```typescript
// app/api/immigration/travel-advisories/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get('country');

  // Fetch and cache the full advisory list for 24 hours
  const res = await fetch(
    'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/RSS.xml',
    { next: { revalidate: 86400 } }
  );

  const xml = await res.text();
  const advisories = parseAdvisoryRSS(xml);

  if (country) {
    const match = advisories.find(a =>
      a.country.toLowerCase().includes(country.toLowerCase())
    );
    return NextResponse.json(match ?? null);
  }

  return NextResponse.json(advisories);
}
```

---

## UI Sections (in order)

1. **Country search** — Searchable dropdown of all countries, auto-complete
2. **Advisory result card** — Level badge (1–4) + label + last updated date
3. **Summary text** — State Dept summary of the advisory
4. **Immigration context panel** — Attorney-authored note: "If you have a pending case and are considering travel, consult your attorney before booking any international travel."
5. **Advance parole reminder** — "If you have a pending I-485 (green card), traveling without advance parole may abandon your application."
6. **CTA** — "Planning international travel with a pending case? Get legal guidance first."
7. **State Dept link** — "Full advisory at travel.state.gov →"

---

## Immigration-Specific Travel Warnings

Hardcode these additional warnings to display alongside State Dept data:

```typescript
const IMMIGRATION_TRAVEL_WARNINGS = {
  pending_485: "⚠️ Traveling while your I-485 (Adjustment of Status) is pending may be considered abandonment of your application unless you have advance parole (Form I-131).",
  h1b_reentry: "ℹ️ H-1B visa holders should carry an employment verification letter and recent pay stubs when re-entering the US.",
  visa_expiry: "ℹ️ Your visa stamp may expire while abroad, but your I-94 status in the US is separate. Consult your attorney about reentry.",
  level_3_4: "⛔ Traveling to a Level 3 or 4 advisory country may significantly complicate your immigration case and ability to return.",
};
```

---

## SEO Strategy

- "travel advisory [country] immigration"
- "can I travel with pending green card"
- "H-1B travel restrictions [country]"
- "advance parole travel State Department advisory"

---

## Monetization

1. **Lead gen → Travel consultation** — Anyone with a pending case asking about travel is a consultation lead.
2. **Add-on widget** — Embed on the attorney's "Resources" page or in client-facing portal.

---

---

# Module 07 — Immigration Policy & News Feed

**Phase:** 3 — Ecosystem  
**Estimated Build Time:** 3 days  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐  
**Build Effort:** Low  

---

## What It Does

An auto-updating feed of recent immigration law news, policy changes, and USCIS announcements embedded on the attorney's site. Positions the attorney as the authoritative local source for immigration news, drives repeat visits, and supports SEO through fresh content.

---

## Data Sources

### USCIS News & Alerts RSS
```
https://www.uscis.gov/news/rss/all
https://www.uscis.gov/news/rss/alerts
https://www.uscis.gov/news/rss/policy-manual-updates
```

### State Department — Visa News
```
https://travel.state.gov/content/travel/en/News/visas-news.html/RSS.xml
```

### Federal Register — Immigration Rules
```
https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=department-of-homeland-security&conditions[type][]=Rule&per_page=10
```

### EOIR — Immigration Court Updates
```
https://www.justice.gov/eoir/rss.xml
```

---

## File Structure

```
app/
└── immigration/
    └── policy-news/
        ├── page.tsx
        ├── news-feed-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── policy-news/
            └── route.ts              ← GET: aggregated news from all feeds (cached 2hr)

lib/
└── jobs/
    └── news-feed-aggregator.ts       ← Optional: pre-aggregate and store in Supabase
```

---

## TypeScript Interfaces

```typescript
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: NewsSource;
  publishedAt: string;
  tags: NewsTag[];
  isUrgent: boolean;          // Policy changes that affect pending cases immediately
}

type NewsSource = 'USCIS' | 'State Dept' | 'EOIR' | 'Federal Register' | 'DHS';

type NewsTag =
  | 'DACA' | 'TPS' | 'H-1B' | 'Green Card' | 'Asylum' | 'Travel Ban'
  | 'Fee Change' | 'Form Change' | 'Processing Times' | 'Policy Update'
  | 'Court Decision' | 'Executive Order';
```

---

## API Route

```typescript
// app/api/immigration/policy-news/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get('tag');

  // Fetch all RSS feeds in parallel
  const [uscisAll, uscisAlerts, stateDept, eoir] = await Promise.allSettled([
    fetchRSS('https://www.uscis.gov/news/rss/all'),
    fetchRSS('https://www.uscis.gov/news/rss/alerts'),
    fetchRSS('https://travel.state.gov/content/travel/en/News/visas-news.html/RSS.xml'),
    fetchRSS('https://www.justice.gov/eoir/rss.xml'),
  ]);

  const items = [
    ...parseRSSItems(uscisAll, 'USCIS'),
    ...parseRSSItems(uscisAlerts, 'USCIS'),
    ...parseRSSItems(stateDept, 'State Dept'),
    ...parseRSSItems(eoir, 'EOIR'),
  ]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 30)
    .filter(item => !tag || item.tags.includes(tag as NewsTag));

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=7200' } });
}
```

---

## Auto-Tagging Logic

Use keyword matching to auto-tag news items:

```typescript
const TAG_KEYWORDS: Record<NewsTag, string[]> = {
  'DACA': ['daca', 'deferred action', 'dreamers'],
  'TPS': ['tps', 'temporary protected status'],
  'H-1B': ['h-1b', 'h1b', 'specialty occupation'],
  'Green Card': ['green card', 'lawful permanent', 'adjustment of status', 'i-485'],
  'Asylum': ['asylum', 'refugee', 'uscis asylum'],
  'Travel Ban': ['travel ban', 'proclamation', 'entry restriction'],
  'Fee Change': ['fee', 'filing fee', 'biometric'],
  'Form Change': ['form', 'edition date', 'revised form'],
  'Policy Update': ['policy manual', 'updated guidance', 'policy alert'],
  'Processing Times': ['processing time', 'processing update'],
  'Court Decision': ['court', 'circuit', 'ruling', 'decision'],
  'Executive Order': ['executive order', 'presidential proclamation'],
};

function autoTag(title: string, summary: string): NewsTag[] {
  const text = `${title} ${summary}`.toLowerCase();
  return (Object.entries(TAG_KEYWORDS) as [NewsTag, string[]][])
    .filter(([_, keywords]) => keywords.some(kw => text.includes(kw)))
    .map(([tag]) => tag);
}
```

---

## UI Sections (in order)

1. **Tag filter pills** — All / DACA / H-1B / Green Card / Asylum / Processing Times / Policy Updates
2. **Urgent alerts banner** — USCIS Alerts feed items pinned at top in amber/red
3. **News feed** — Cards with: source badge, title, date, 2-line summary, "Read more →" link to official source
4. **"How This Affects You" CTA** — Below each major policy change: "This change may affect your case. Ask our attorneys."
5. **Subscribe to updates** — Email subscription for weekly immigration news digest

---

## Email Digest (Optional Enhancement)

Weekly email digest of top immigration news to alert subscribers:

```typescript
// Sent every Monday morning via Resend
const digest = {
  subject: `Immigration Law Update — Week of ${weekOf}`,
  sections: [
    { title: 'USCIS Policy Changes', items: uscisItems },
    { title: 'Visa Bulletin Update', item: latestBulletin },
    { title: 'Court & Legal Decisions', items: courtItems },
  ],
  cta: 'Have questions about how these changes affect your case?',
};
```

---

## SEO Strategy

- "USCIS news updates 2025"
- "immigration policy changes [month] [year]"
- "DACA update 2025"
- "H-1B cap 2025 news"

Fresh content updated daily = strong SEO signal for the attorney's site.

---

## Monetization

1. **Repeat visits** — News feed brings clients and prospects back to the site weekly.
2. **CTA on policy changes** — "This affects you" CTAs on relevant stories convert policy anxiety into consultations.
3. **Email list growth** — News digest subscribers = warm audience for attorney marketing.
4. **Content authority** — Fresh immigration news boosts overall domain authority, lifting rankings for all attorney pages.
