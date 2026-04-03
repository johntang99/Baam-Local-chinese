# Module 05 — Immigration Court Date Lookup

**Phase:** 2 — Expand  
**Estimated Build Time:** 1 week  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐⭐  
**Build Effort:** Low  

---

## What It Does

People with pending immigration court cases can look up their next scheduled hearing date using their **A-Number** (Alien Registration Number). This is critical information — missing a hearing can result in an order of removal in absentia.

The Department of Justice's EOIR (Executive Office for Immigration Review) provides a public automated case information system. This tool surfaces that information cleanly on the attorney's site.

---

## Data Source

### EOIR Automated Case Information System (ACIS)
EOIR operates a public case status lookup at:
```
https://acis.eoir.justice.gov/en/
```

This is a web-based form, not a formal API. The lookup is performed via:
```
POST https://acis.eoir.justice.gov/api/caseinformation
Content-Type: application/json

{ "idnumber": "123456789" }
```

The A-Number is a 9-digit number (sometimes written with a leading A: A123456789).

#### Response Shape (approximate)
```json
{
  "data": {
    "nextHearingDate": "04/15/2025",
    "nextHearingTime": "09:00 AM",
    "nextHearingType": "Individual Hearing",
    "courtLocation": "New York, NY",
    "judge": "Hon. [Name]",
    "caseStatus": "Pending",
    "hearingHistory": [
      {
        "date": "02/01/2025",
        "type": "Master Calendar Hearing",
        "result": "Continued"
      }
    ]
  }
}
```

**Implementation Note:** EOIR's system may require session token handling or CAPTCHA. Build with a fallback: if the API is blocked, display a deep link directly to the EOIR website with the A-number pre-filled in the URL.

---

## A-Number Validation

```typescript
// A-numbers are 7–9 digits, sometimes prefixed with "A"
const ANUMBER_REGEX = /^A?\d{7,9}$/;

function validateANumber(input: string): {
  valid: boolean;
  formatted?: string;
  error?: string;
} {
  const cleaned = input.toUpperCase().replace(/[^A\d]/g, '');
  if (!ANUMBER_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'A-Numbers are 7–9 digits, sometimes written as A123456789',
    };
  }
  // Normalize: strip the "A" for API submission, keep it for display
  const digits = cleaned.replace(/^A/, '').padStart(9, '0');
  return {
    valid: true,
    formatted: `A${digits}`,
  };
}
```

---

## File Structure

```
app/
└── immigration/
    └── court-dates/
        ├── page.tsx
        ├── court-dates-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── court-dates/
            └── route.ts
```

---

## TypeScript Interfaces

```typescript
interface CourtHearing {
  date: string;
  time: string;
  type: HearingType;
  courtLocation: string;
  result?: string;    // For past hearings: "Continued", "Decision Reserved", etc.
}

type HearingType =
  | 'Master Calendar Hearing'
  | 'Individual Hearing'
  | 'Bond Hearing'
  | 'Motion Hearing'
  | 'Status Conference'
  | 'Other';

interface CourtCaseInfo {
  aNumber: string;
  nextHearing?: CourtHearing;
  caseStatus: 'Pending' | 'Decided' | 'Appealed' | 'Administratively Closed' | 'Unknown';
  courtLocation?: string;
  judge?: string;
  hearingHistory: CourtHearing[];
  lastUpdated: string;
}
```

---

## API Route

```typescript
// app/api/immigration/court-dates/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const aNumber = searchParams.get('anumber')?.replace(/^A/i, '').padStart(9, '0');

  if (!aNumber || !/^\d{9}$/.test(aNumber)) {
    return NextResponse.json({ error: 'Valid A-Number required' }, { status: 400 });
  }

  try {
    const eiorRes = await fetch('https://acis.eoir.justice.gov/api/caseinformation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; BAAM/1.0)',
        'Referer': 'https://acis.eoir.justice.gov/en/',
      },
      body: JSON.stringify({ idnumber: aNumber }),
      next: { revalidate: 1800 },    // cache 30 min
    });

    if (!eiorRes.ok) {
      // Fallback: return the EOIR direct link
      return NextResponse.json({
        fallback: true,
        eiorUrl: `https://acis.eoir.justice.gov/en/`,
        message: 'EOIR lookup temporarily unavailable. Use the direct link below.',
      });
    }

    const data = await eiorRes.json();
    return NextResponse.json(mapEiorResponse(data, `A${aNumber}`));

  } catch (err) {
    console.error('[court-dates] error:', err);
    return NextResponse.json({
      fallback: true,
      eiorUrl: 'https://acis.eoir.justice.gov/en/',
      message: 'Use the EOIR website to look up your court date directly.',
    });
  }
}
```

---

## UI Sections (in order)

1. **Privacy notice** — Displayed prominently before the form: "Your A-Number is sent directly to the EOIR system. We do not store it."
2. **A-Number input** — With format hint and clear/paste button
3. **Next hearing card** (if found):
   - Date and time in large, clear type
   - Hearing type (Master Calendar / Individual)
   - Court location with Google Maps link
   - Days until hearing countdown: "Your hearing is in 23 days"
4. **Hearing history** — Past hearings, collapsed by default
5. **Missed hearing warning** — If `nextHearingDate` is in the past: "⚠️ Your hearing date has passed. Contact an attorney immediately."
6. **CTA** — Hearing-type specific (see below)

---

## Hearing-Type CTAs

```typescript
function getCourtCTA(caseInfo: CourtCaseInfo) {
  if (!caseInfo.nextHearing) {
    return {
      headline: 'No Upcoming Hearing Found',
      body: 'If you have a pending case, contact your attorney to verify your hearing schedule.',
      button: 'Speak to an Attorney',
    };
  }

  const daysUntil = getDaysUntil(caseInfo.nextHearing.date);

  if (daysUntil < 0) {
    return {
      headline: '⚠️ Your Hearing Date Has Passed',
      body: 'If you missed your hearing, you may have an order of removal. Contact an attorney immediately.',
      button: 'Emergency Consultation — Contact Now',
      urgency: 'critical',
    };
  }

  if (caseInfo.nextHearing.type === 'Individual Hearing') {
    return {
      headline: 'Your Individual Hearing Is Coming',
      body: `Individual hearings are the most important stage of your case. With ${daysUntil} days until your hearing, preparation time is limited.`,
      button: 'Schedule Hearing Preparation',
      urgency: daysUntil < 30 ? 'high' : 'medium',
    };
  }

  return {
    headline: 'Have an Attorney at Your Side',
    body: 'Even at Master Calendar hearings, representation significantly improves outcomes.',
    button: 'Book a Free Consultation',
    urgency: 'medium',
  };
}
```

---

## Hearing Countdown Display

```typescript
function getCountdownDisplay(daysUntil: number): {
  text: string;
  color: string;
} {
  if (daysUntil < 0)   return { text: 'PAST DUE', color: '#FF4444' };
  if (daysUntil === 0) return { text: 'TODAY', color: '#FF4444' };
  if (daysUntil <= 7)  return { text: `${daysUntil} days`, color: '#FF8C00' };
  if (daysUntil <= 30) return { text: `${daysUntil} days`, color: '#FFD000' };
  return { text: `${daysUntil} days`, color: '#00E5A0' };
}
```

---

## Privacy & Security Requirements

This module handles **sensitive personal information** (A-Numbers are tied to immigration status). Strict requirements:

1. **Never log A-Numbers** — The query hash stored in `immigration_lookups` must use SHA-256 of the A-Number only
2. **No client-side persistence** — Do not store A-Numbers in localStorage, sessionStorage, or cookies
3. **HTTPS only** — Ensure the API route enforces HTTPS
4. **Prominent privacy notice** — Display before the form and in the page footer
5. **EOIR fallback** — Always provide a direct link to EOIR so users aren't solely dependent on this tool

---

## SEO Strategy

### Target Keywords
- "immigration court date lookup"
- "EOIR case status by A number"
- "check immigration court hearing date"
- "what is my next immigration court date"
- "missed immigration court hearing what to do"

---

## Monetization Paths

1. **Lead gen → Representation** — Anyone looking up their court date has an active case and likely needs an attorney. Highest urgency of any lookup tool.
2. **Emergency consultation CTA** — Missed hearing or imminent hearing drives same-day consultation bookings.
3. **Post-hearing follow-up** — If a case is "Decided," CTA targets appeal services.

---

## V2 Additions

- **Court date reminder** — "Add to calendar" (.ics) + optional email reminder 7 days and 1 day before
- **Hearing type explainer** — Plain-language guide to what each hearing type means and what to bring
- **Court location info** — Address, parking, transit directions, security check-in instructions for each EOIR court
- **Know your rights cards** — What to do if you're detained, what to bring to court, etc.
