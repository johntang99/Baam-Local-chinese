# Module 03 — USCIS Processing Time Lookup

**Phase:** 1 — Launch Now  
**Estimated Build Time:** 1 week  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐⭐⭐  
**Build Effort:** Low  

---

## What It Does

A visitor selects their **form type** (I-130, I-485, I-765, N-400, etc.) and optionally their **service center or field office**, and sees the current USCIS processing time estimate — how long USCIS is currently taking to process that form type at that location.

USCIS publishes these estimates and updates them monthly. The government's own tool is buried and confusing. A clean, well-designed version on the attorney's site is a constant resource for clients and prospects.

High-intent use: a client whose case is taking longer than the published time is a motivated consultation lead — they want to know if they can file for expedite.

---

## Data Source

### USCIS Processing Times API
USCIS exposes processing times via an undocumented but publicly accessible JSON endpoint used by their own processing times page.

```
GET https://egov.uscis.gov/processing-times/api/processingtime/{formType}/{officeOrCenter}
```

#### Alternative — Official Processing Times Page
If the above endpoint changes, scrape from:
```
https://egov.uscis.gov/processing-times/
```
The page is React-based and loads data from:
```
https://egov.uscis.gov/processing-times/api/forms
https://egov.uscis.gov/processing-times/api/processingtime/{form}/{office}
```

#### Example Request
```
GET https://egov.uscis.gov/processing-times/api/processingtime/I-130/NBC
```

#### Example Response Shape
```json
{
  "data": {
    "subtype": [
      {
        "form_type": "I-130",
        "subtype": "Spouse of a US Citizen",
        "office_code": "NBC",
        "office_name": "National Benefits Center",
        "publication_date": "2025-03-01",
        "range": {
          "value": 14,
          "unit": "Months",
          "min": 10,
          "max": 18
        }
      }
    ]
  }
}
```

---

## Key Form Types to Support

```typescript
const IMMIGRATION_FORMS = {
  // Family-Based
  'I-130':  { name: 'Petition for Alien Relative', category: 'Family' },
  'I-131':  { name: 'Application for Travel Document', category: 'Travel' },
  'I-485':  { name: 'Adjustment of Status (Green Card)', category: 'Green Card' },
  'I-751':  { name: 'Remove Conditions on Residence', category: 'Green Card' },
  'I-90':   { name: 'Renew or Replace Green Card', category: 'Green Card' },

  // Employment-Based
  'I-140':  { name: 'Immigrant Petition for Alien Workers', category: 'Employment' },
  'I-539':  { name: 'Extend or Change Nonimmigrant Status', category: 'Status Change' },
  'I-765':  { name: 'Employment Authorization (Work Permit)', category: 'Employment' },

  // Nonimmigrant Work
  'I-129':  { name: 'Petition for Nonimmigrant Worker (H-1B, L-1, O-1, etc.)', category: 'Work Visa' },
  'I-539A': { name: 'Biographic Info (co-applicants)', category: 'Status Change' },

  // Humanitarian
  'I-589':  { name: 'Application for Asylum', category: 'Asylum' },
  'I-730':  { name: 'Refugee/Asylee Relative Petition', category: 'Humanitarian' },

  // Citizenship
  'N-400':  { name: 'Application for Naturalization', category: 'Citizenship' },
  'N-600':  { name: 'Certificate of Citizenship', category: 'Citizenship' },
};
```

---

## Service Centers & Field Offices

```typescript
const SERVICE_CENTERS = {
  'NBC':  'National Benefits Center',
  'CSC':  'California Service Center',
  'NSC':  'Nebraska Service Center',
  'TSC':  'Texas Service Center',
  'VSC':  'Vermont Service Center',
  'YSC':  'Potomac Service Center',
  'IOE':  'USCIS Electronic Immigration System',
  'MSC':  'Missouri Service Center',
};

// Field offices are returned dynamically from the USCIS API
// Key offices for NY-area clients:
const KEY_FIELD_OFFICES = {
  'NEW YORK, NY':      'New York City Field Office',
  'GARDEN CITY, NY':  'Garden City Field Office (Long Island)',
  'NEWARK, NJ':       'Newark Field Office',
  'BROOKLYN, NY':     'Brooklyn Field Office',
};
```

---

## File Structure

```
app/
└── immigration/
    └── processing-times/
        ├── page.tsx
        ├── processing-times-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── processing-times/
            ├── forms/
            │   └── route.ts            ← GET: list all available forms + offices
            └── lookup/
                └── route.ts            ← GET: processing time for form + office
```

---

## TypeScript Interfaces

```typescript
interface ProcessingTimeRange {
  value: number;
  unit: 'Weeks' | 'Months';
  min: number;
  max: number;
}

interface ProcessingTimeResult {
  formType: string;
  formName: string;
  subtype: string;
  officeCode: string;
  officeName: string;
  publicationDate: string;
  range: ProcessingTimeRange;
  isOutsideNormalRange: boolean;    // derived: is case older than max range?
  daysOld?: number;                 // optional: if user enters their filing date
}

interface FormWithOffices {
  formType: string;
  formName: string;
  category: string;
  subtypes: string[];
  offices: { code: string; name: string }[];
}
```

---

## API Route

```typescript
// app/api/immigration/processing-times/lookup/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const form = searchParams.get('form');
  const office = searchParams.get('office');
  const filingDate = searchParams.get('filingDate'); // optional

  if (!form || !office) {
    return NextResponse.json({ error: 'form and office are required' }, { status: 400 });
  }

  const uscisRes = await fetch(
    `https://egov.uscis.gov/processing-times/api/processingtime/${form}/${office}`,
    { next: { revalidate: 3600 } }  // cache 1 hour — updates monthly
  );

  const data = await uscisRes.json();
  const subtypes = data?.data?.subtype ?? [];

  // If user provided filing date, calculate if outside normal range
  const results = subtypes.map(s => {
    let daysOld: number | undefined;
    let isOutsideNormalRange = false;

    if (filingDate) {
      const filed = new Date(filingDate);
      daysOld = Math.floor((Date.now() - filed.getTime()) / (1000 * 60 * 60 * 24));
      const maxDays = s.range.unit === 'Months'
        ? s.range.max * 30
        : s.range.max * 7;
      isOutsideNormalRange = daysOld > maxDays;
    }

    return { ...s, daysOld, isOutsideNormalRange };
  });

  return NextResponse.json({ results, publishedAt: subtypes[0]?.publication_date });
}
```

---

## UI Sections (in order)

1. **Form selector** — searchable dropdown grouped by category (Family / Green Card / Work Visa / Citizenship / Humanitarian)
2. **Office selector** — appears after form selection; shows available service centers or field offices
3. **Filing date input** (optional) — "When did you file?" triggers the "outside normal range" comparison
4. **Processing time result** — Large display: "10–18 months" with publication date note
5. **Case age panel** (if filing date entered) — "Your case is X days old. The average is Y months. You are [within range / outside range]."
6. **Expedite eligibility panel** (if outside range) — Brief explanation of USCIS expedite criteria
7. **CTA** — "Your case may be eligible for expedite. An attorney can file on your behalf →"

---

## Outside Normal Range CTA

```typescript
function getProcessingCTA(result: ProcessingTimeResult) {
  if (result.isOutsideNormalRange) {
    return {
      headline: 'Your Case Is Outside Normal Processing Time',
      body: `Your case has been pending ${result.daysOld} days. USCIS typically processes this in ${result.range.min}–${result.range.max} ${result.range.unit}. You may be eligible to request an expedite.`,
      button: 'Ask About Expediting Your Case',
      urgency: 'high',
    };
  }

  return {
    headline: 'Have Questions About Your Timeline?',
    body: 'Processing times are averages. An attorney can advise on your specific case.',
    button: 'Book a Free Consultation',
    urgency: 'low',
  };
}
```

---

## USCIS Expedite Criteria Reference

Display as an informational accordion below results:

```typescript
const EXPEDITE_CRITERIA = [
  {
    title: 'Severe Financial Loss',
    description: 'You will suffer severe financial loss if not expedited (e.g., job offer expires, contract loss).',
  },
  {
    title: 'Urgent Humanitarian Reasons',
    description: 'Serious illness or disability, death of a family member, or other urgent humanitarian situation.',
  },
  {
    title: 'US Government Interest',
    description: 'A US government agency has requested expedite for its interest.',
  },
  {
    title: 'USCIS Error',
    description: 'USCIS made an error that caused the delay.',
  },
  {
    title: 'Nonprofit Organization',
    description: 'A nonprofit whose request is in the national cultural or social interest.',
  },
  {
    title: 'Military Deployment',
    description: 'The applicant or petitioner is being deployed in the US Armed Forces.',
  },
];
```

---

## SEO Strategy

### Target Keywords
- "USCIS processing times 2025 [form type]"
- "how long does I-485 take 2025"
- "USCIS I-130 processing time NBC"
- "N-400 processing time [city/state]"
- "how long for work permit EAD"

### Content Strategy
Add a static explainer section below the tool for each major form type — these rank for high-volume long-tail queries:
- "What is Form I-485 and how long does it take?"
- "I-130 processing times by service center — 2025 update"

---

## Monetization Paths

1. **Lead gen → Expedite consultations** — "Outside normal range" result = highly motivated client. Attorneys charge $500–2,000 to file an expedite request.
2. **Lead gen → General consultations** — Every user who checks processing time is actively in the immigration process.
3. **White-label** — Included in the "Client Tools" BAAM add-on package.

---

## V2 Additions

- **Processing time history chart** — Show how processing times have changed over the past 12 months
- **Email alert** — "Notify me when processing times for I-485 at NBC change significantly"
- **Multi-form comparison** — Compare processing times across service centers for the same form
- **Case age calculator widget** — Embeddable on any page: "Is your case taking too long?"
