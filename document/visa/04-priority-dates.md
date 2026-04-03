# Module 04 — Visa Bulletin Priority Date Tracker

**Phase:** 2 — Expand  
**Estimated Build Time:** 2 weeks  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐⭐⭐  
**Build Effort:** Medium  

---

## What It Does

For employment-based and family-based green card applicants, the **Visa Bulletin** determines who can move forward each month based on their **priority date** (the date their petition was filed) and their **preference category + country of birth**.

This tool:
- Lets a user enter their preference category, country of chargeability, and priority date
- Shows whether their date is **current** (can proceed to green card) or how far back the queue is
- Subscribes them to a monthly alert when their date moves forward
- Tracks the Visa Bulletin over time so users can see the trend

This is deeply valued by people who have been waiting years — sometimes decades — for their priority date to become current. Many Indian EB-2 and EB-3 applicants wait 10–50+ years. Monthly Visa Bulletin day is a big event for these communities.

---

## Data Source

### State Department Visa Bulletin
Published monthly at:
```
https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html
```

The bulletin is an HTML page with tables. It must be scraped and parsed monthly.

#### Visa Bulletin Table Structure
Each bulletin contains two sets of tables:
1. **Final Action Dates** — The cutoff date to actually file for adjustment of status
2. **Dates for Filing** — Earlier dates; allowed to file in some months when USCIS permits

Tables are organized by preference category (rows) and country (columns).

#### Countries with Separate Chargeability
Most countries share "All Chargeability Areas Except Those Listed." The following have their own columns:
- **China (mainland-born)**
- **India**
- **Mexico**
- **Philippines**

---

## File Structure

```
app/
└── immigration/
    └── priority-dates/
        ├── page.tsx
        ├── priority-dates-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── priority-dates/
            ├── current/
            │   └── route.ts              ← GET: current bulletin data (cached)
            ├── check/
            │   └── route.ts              ← GET: is my date current?
            └── subscribe/
                └── route.ts              ← POST: alert subscription

lib/
└── jobs/
    └── visa-bulletin-parser.ts           ← Monthly cron: scrape + parse + store bulletin
    └── priority-date-alert-sender.ts     ← Monthly cron: send alerts when dates advance
```

---

## TypeScript Interfaces

```typescript
type PreferenceCategory =
  // Family-Based
  | 'F1'    // Unmarried sons/daughters of US citizens
  | 'F2A'   // Spouses/children of green card holders
  | 'F2B'   // Unmarried sons/daughters of green card holders (21+)
  | 'F3'    // Married sons/daughters of US citizens
  | 'F4'    // Brothers/sisters of US citizens
  // Employment-Based
  | 'EB1'   // Priority workers
  | 'EB2'   // Advanced degree / exceptional ability
  | 'EB3'   // Skilled workers / professionals
  | 'EB3O'  // Other workers (unskilled)
  | 'EB4'   // Special immigrants (religious workers, etc.)
  | 'EB5'   // Investors

type Country = 'china' | 'india' | 'mexico' | 'philippines' | 'all_other';

interface PriorityDateEntry {
  category: PreferenceCategory;
  country: Country;
  finalActionDate: string | 'C' | 'U';  // date string, "C" = Current, "U" = Unavailable
  datesForFilingDate: string | 'C' | 'U';
}

interface VisaBulletin {
  month: string;                        // "April 2025"
  publishedAt: string;
  entries: PriorityDateEntry[];
  notes: string[];                      // Important bulletin notes
}

interface PriorityDateCheck {
  category: PreferenceCategory;
  country: Country;
  userPriorityDate: string;
  finalActionDate: string | 'C' | 'U';
  datesForFilingDate: string | 'C' | 'U';
  isCurrent: boolean;
  isFilingDateCurrent: boolean;
  estimatedMonthsCurrent?: number;      // rough estimate based on recent advance rate
  monthsInQueue: number;                // how far back from cutoff
  advanceRateLast3Months: number;       // days/month the date has been advancing
}
```

---

## Preference Category Reference

```typescript
const CATEGORY_DESCRIPTIONS = {
  'F1':   { label: 'F1 — Unmarried Sons/Daughters of US Citizens', type: 'family' },
  'F2A':  { label: 'F2A — Spouses & Children of Green Card Holders', type: 'family' },
  'F2B':  { label: 'F2B — Unmarried Sons/Daughters of Green Card Holders (21+)', type: 'family' },
  'F3':   { label: 'F3 — Married Sons/Daughters of US Citizens', type: 'family' },
  'F4':   { label: 'F4 — Brothers & Sisters of US Citizens', type: 'family' },
  'EB1':  { label: 'EB-1 — Priority Workers (Extraordinary Ability, Managers, Researchers)', type: 'employment' },
  'EB2':  { label: 'EB-2 — Advanced Degree / Exceptional Ability', type: 'employment' },
  'EB3':  { label: 'EB-3 — Skilled Workers & Professionals', type: 'employment' },
  'EB3O': { label: 'EB-3 Other Workers (Unskilled)', type: 'employment' },
  'EB4':  { label: 'EB-4 — Special Immigrants (Religious Workers, etc.)', type: 'employment' },
  'EB5':  { label: 'EB-5 — Investors', type: 'employment' },
};
```

---

## Visa Bulletin Parser (Monthly Cron)

```typescript
// lib/jobs/visa-bulletin-parser.ts
import * as cheerio from 'cheerio';

export async function parseLatestVisaBulletin(): Promise<VisaBulletin> {
  // 1. Fetch the bulletin index page to find current month's URL
  const indexRes = await fetch(
    'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html'
  );
  const indexHtml = await indexRes.text();

  // 2. Extract the current month's bulletin URL
  const $ = cheerio.load(indexHtml);
  const bulletinUrl = $('a[href*="visa-bulletin-for"]').first().attr('href');

  // 3. Fetch the actual bulletin page
  const bulletinRes = await fetch(`https://travel.state.gov${bulletinUrl}`);
  const bulletinHtml = await bulletinRes.text();

  // 4. Parse the priority date tables
  const $b = cheerio.load(bulletinHtml);
  const entries: PriorityDateEntry[] = [];

  // Tables are labeled — find Final Action Dates table
  // Parse rows: category column, then country columns
  // ... table parsing logic ...

  return {
    month: extractBulletinMonth(bulletinHtml),
    publishedAt: new Date().toISOString(),
    entries,
    notes: extractNotes($b),
  };
}
```

**npm Dependency:** `cheerio` for HTML parsing

---

## Check Logic

```typescript
function checkPriorityDate(
  bulletin: VisaBulletin,
  category: PreferenceCategory,
  country: Country,
  userPriorityDate: string
): PriorityDateCheck {
  const entry = bulletin.entries.find(
    e => e.category === category && e.country === country
  ) ?? bulletin.entries.find(
    e => e.category === category && e.country === 'all_other'
  );

  const finalActionDate = entry?.finalActionDate ?? 'U';
  const datesForFilingDate = entry?.datesForFilingDate ?? 'U';

  const isCurrent =
    finalActionDate === 'C' ||
    (finalActionDate !== 'U' && new Date(userPriorityDate) <= new Date(finalActionDate));

  const isFilingDateCurrent =
    datesForFilingDate === 'C' ||
    (datesForFilingDate !== 'U' && new Date(userPriorityDate) <= new Date(datesForFilingDate));

  const monthsInQueue = finalActionDate !== 'C' && finalActionDate !== 'U'
    ? Math.floor((new Date(finalActionDate).getTime() - new Date(userPriorityDate).getTime())
        / (1000 * 60 * 60 * 24 * 30))
    : 0;

  return {
    category, country, userPriorityDate,
    finalActionDate, datesForFilingDate,
    isCurrent, isFilingDateCurrent,
    monthsInQueue: Math.abs(monthsInQueue),
  };
}
```

---

## UI Sections (in order)

1. **Category selector** — grouped: Family-Based / Employment-Based with full labels
2. **Country of chargeability** — China / India / Mexico / Philippines / All Other Countries
3. **Priority date input** — month + year picker (not full date — bulletin uses month precision)
4. **Result panel:**
   - Large status: "✅ Your date is CURRENT" or "⏳ Not yet current"
   - Final Action Date cutoff shown prominently
   - Dates for Filing cutoff (if different — and explained)
   - If not current: "Your date is X months behind the current cutoff"
5. **Advance rate panel** — "This category has been advancing ~X days/month over the past 3 months"
6. **Historical chart** — Line chart of this category's cutoff date over the past 12 months
7. **Alert subscription** — "Notify me when my date becomes current" (email, monthly)
8. **CTA** — "Ready to file? An attorney can prepare your application now →"

---

## Alert System (Monthly Cron)

Run on the 8th–10th of each month (Visa Bulletin publishes ~2nd week):

```typescript
// lib/jobs/priority-date-alert-sender.ts
export async function sendPriorityDateAlerts() {
  const newBulletin = await getLatestBulletin();
  const prevBulletin = await getPreviousBulletin();

  const subs = await getAllActivePriorityDateSubscriptions();

  for (const sub of subs) {
    const prevCheck = checkPriorityDate(prevBulletin, sub.preference_category, sub.country_of_chargeability, sub.priority_date);
    const newCheck = checkPriorityDate(newBulletin, sub.preference_category, sub.country_of_chargeability, sub.priority_date);

    // Alert if newly current OR if date advanced significantly (>3 months)
    const newlyCurrent = !prevCheck.isCurrent && newCheck.isCurrent;
    const advancedSignificantly = !newCheck.isCurrent &&
      (prevCheck.monthsInQueue - newCheck.monthsInQueue) > 3;

    if (newlyCurrent || advancedSignificantly) {
      await sendAlertEmail(sub, newCheck, { newlyCurrent, advancedSignificantly });
    }
  }
}
```

---

## SEO Strategy

### Target Keywords
- "visa bulletin [month] [year]"
- "EB2 India priority date 2025"
- "F2A priority date current"
- "when will my priority date be current"
- "visa bulletin tracker alert"

### Content — High SEO Value
Publish monthly auto-generated pages:
- `/immigration/priority-dates/visa-bulletin-april-2025`
- Structured with tables + plain-language summary of movements

These rank consistently because people search for the bulletin every month.

---

## Monetization Paths

1. **Lead gen → Green card consultations** — When a date goes current, the client must act quickly. Attorney consultation urgency is very high.
2. **Alert subscriptions** — Monthly touchpoint keeps clients connected to the law firm for years while waiting.
3. **EB-5 and EB-1 fast-track consultation** — When EB-2/EB-3 is deeply backlogged, suggest premium alternatives (EB-1, NIW, EB-5). High-value cases.

---

## V2 Additions

- **Retrogression alerts** — Dates sometimes move backward. Alert subscribers immediately when this happens.
- **Category comparison** — "If you upgraded to EB-2 NIW, your wait would be X shorter"
- **Historical data going back 5 years** — Full chart history
- **Probability calculator** — "Based on current advance rate, your date may become current around [estimated date]"
