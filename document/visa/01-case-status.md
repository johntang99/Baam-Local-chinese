# Module 01 — USCIS Case Status Tracker

**Phase:** 1 — Launch Now  
**Estimated Build Time:** 1 week  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐⭐⭐⭐ (Highest in suite)  
**Build Effort:** Low  

---

## What It Does

A visitor enters their **USCIS receipt number** and instantly sees their case status — the same information available on the USCIS website, but surfaced directly on the attorney's site with contextual guidance and a consultation CTA.

Receipt number format: 3-letter service center code + 10 digits (e.g. `IOE0123456789`, `EAC2290123456`, `LIN2290123456`)

This is the #1 thing every immigration client checks obsessively. Hosting this lookup on the lawyer's site means every anxious client returns to that site repeatedly — building trust and generating the highest-intent consultation leads in the suite.

---

## Data Source

### USCIS Case Status API
USCIS exposes case status via a public endpoint used by their own website. No authentication required.

```
POST https://egov.uscis.gov/casestatus/mycasestatus.do
Content-Type: application/x-www-form-urlencoded

appReceiptNum=IOE0123456789&caseStatusSearchBtn=CHECK+STATUS
```

The response is HTML — parse the status title and description from the response body.

#### Parsing Strategy
```typescript
// Target elements in the USCIS response HTML:
// <h1> — contains the status title e.g. "Case Was Received"
// <p>  — contains the status description paragraph

async function fetchCaseStatus(receiptNumber: string): Promise<CaseStatus> {
  const response = await fetch('https://egov.uscis.gov/casestatus/mycasestatus.do', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `appReceiptNum=${receiptNumber}&caseStatusSearchBtn=CHECK+STATUS`,
  });

  const html = await response.text();

  // Parse with a lightweight HTML parser (e.g. node-html-parser)
  const statusTitle = extractBetween(html, '<h1>', '</h1>');
  const statusBody = extractFirstParagraph(html, '.appointment-sec');

  return { receiptNumber, statusTitle, statusBody, fetchedAt: new Date().toISOString() };
}
```

#### npm Dependency
```json
{
  "dependencies": {
    "node-html-parser": "^6.1.0"
  }
}
```

---

## Receipt Number Format Validation

```typescript
const RECEIPT_NUMBER_REGEX = /^[A-Z]{3}\d{10}$/;

const SERVICE_CENTERS = {
  'EAC': 'Vermont Service Center',
  'IOE': 'USCIS Electronic Immigration System',
  'LIN': 'Nebraska Service Center',
  'MSC': 'National Benefits Center',
  'NBC': 'National Benefits Center',
  'SRC': 'Texas Service Center',
  'WAC': 'California Service Center',
  'YSC': 'Potomac Service Center',
  'TSC': 'Texas Service Center',
  'VSC': 'Vermont Service Center',
  'CSC': 'California Service Center',
  'NSC': 'Nebraska Service Center',
};

function validateReceiptNumber(input: string): {
  valid: boolean;
  formatted?: string;
  serviceCenter?: string;
  error?: string;
} {
  const cleaned = input.toUpperCase().replace(/[-\s]/g, '');
  if (!RECEIPT_NUMBER_REGEX.test(cleaned)) {
    return { valid: false, error: 'Receipt numbers are 3 letters followed by 10 digits (e.g. IOE0123456789)' };
  }
  const prefix = cleaned.slice(0, 3);
  return {
    valid: true,
    formatted: cleaned,
    serviceCenter: SERVICE_CENTERS[prefix] ?? 'USCIS Service Center',
  };
}
```

---

## File Structure

```
app/
└── immigration/
    └── case-status/
        ├── page.tsx
        ├── case-status-client.tsx
        └── types.ts

app/
└── api/
    └── immigration/
        └── case-status/
            └── route.ts
```

---

## TypeScript Interfaces

```typescript
interface CaseStatus {
  receiptNumber: string;
  serviceCenter: string;
  statusTitle: string;
  statusBody: string;
  statusCategory: StatusCategory;
  fetchedAt: string;
}

type StatusCategory =
  | 'received'
  | 'in_progress'
  | 'approved'
  | 'denied'
  | 'rfe_issued'         // Request for Evidence
  | 'noid_issued'        // Notice of Intent to Deny
  | 'interview_scheduled'
  | 'card_mailed'
  | 'case_closed'
  | 'unknown';

// Map USCIS status titles to our categories
const STATUS_CATEGORY_MAP: Record<string, StatusCategory> = {
  'Case Was Received':                      'received',
  'Case Is Being Actively Reviewed':        'in_progress',
  'Request for Initial Evidence Was Sent':  'rfe_issued',
  'Request for Evidence Was Sent':          'rfe_issued',
  'Notice of Intent to Deny Was Sent':      'noid_issued',
  'Interview Was Scheduled':                'interview_scheduled',
  'Case Was Approved':                      'approved',
  'Card Was Mailed To Me':                  'card_mailed',
  'Case Was Denied':                        'denied',
  'Case Was Closed':                        'case_closed',
};
```

---

## API Route

```typescript
// app/api/immigration/case-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const receiptNumber = searchParams.get('receipt')?.toUpperCase().replace(/[-\s]/g, '');

  if (!receiptNumber || !/^[A-Z]{3}\d{10}$/.test(receiptNumber)) {
    return NextResponse.json({ error: 'Invalid receipt number format' }, { status: 400 });
  }

  try {
    const uscisRes = await fetch('https://egov.uscis.gov/casestatus/mycasestatus.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; BAAM/1.0)',
      },
      body: `appReceiptNum=${receiptNumber}&caseStatusSearchBtn=CHECK+STATUS`,
      next: { revalidate: 300 },    // cache 5 min
    });

    const html = await uscisRes.text();
    const root = parse(html);

    const statusTitle = root.querySelector('.appointment-sec h1')?.text?.trim()
      ?? root.querySelector('h1')?.text?.trim()
      ?? 'Status Unavailable';

    const statusBody = root.querySelector('.appointment-sec p')?.text?.trim()
      ?? '';

    const statusCategory = STATUS_CATEGORY_MAP[statusTitle] ?? 'unknown';

    return NextResponse.json({
      receiptNumber,
      serviceCenter: SERVICE_CENTERS[receiptNumber.slice(0, 3)] ?? 'USCIS',
      statusTitle,
      statusBody,
      statusCategory,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[case-status] fetch error:', err);
    return NextResponse.json({ error: 'Unable to reach USCIS. Please try again.' }, { status: 502 });
  }
}
```

---

## Status Category UI

```typescript
const STATUS_DISPLAY = {
  received: {
    color: '#00C2FF',
    icon: '📬',
    label: 'Received',
    guidance: 'Your case has been received. Processing has not yet begun.',
  },
  in_progress: {
    color: '#FFD000',
    icon: '⏳',
    label: 'In Progress',
    guidance: 'USCIS is actively reviewing your case.',
  },
  rfe_issued: {
    color: '#FF8C00',
    icon: '📋',
    label: 'Response Needed',
    guidance: 'USCIS has requested additional evidence. You must respond within the deadline.',
    urgentCTA: true,   // Triggers immediate attorney CTA
  },
  noid_issued: {
    color: '#FF4444',
    icon: '⚠️',
    label: 'Intent to Deny',
    guidance: 'USCIS intends to deny your case. You have a limited window to respond.',
    urgentCTA: true,
  },
  interview_scheduled: {
    color: '#A78BFA',
    icon: '📅',
    label: 'Interview Scheduled',
    guidance: 'Your interview has been scheduled. Preparation is critical.',
    urgentCTA: true,
  },
  approved: {
    color: '#00E5A0',
    icon: '✅',
    label: 'Approved',
    guidance: 'Congratulations! Your case has been approved.',
  },
  denied: {
    color: '#FF4444',
    icon: '❌',
    label: 'Denied',
    guidance: 'Your case was denied. Appeal options may be available.',
    urgentCTA: true,
  },
  card_mailed: {
    color: '#00E5A0',
    icon: '💳',
    label: 'Card Mailed',
    guidance: 'Your card has been produced and mailed.',
  },
  unknown: {
    color: '#888',
    icon: '❓',
    label: 'Check USCIS',
    guidance: 'We could not determine status. Check directly at uscis.gov.',
  },
};
```

---

## UI Sections (in order)

1. **Receipt number input** — text field with format hint "e.g. IOE0123456789", auto-format as user types
2. **Service center badge** — show which center is handling the case (derived from prefix)
3. **Status result card** — large status title + color-coded badge + full USCIS description text
4. **Guidance panel** — plain-language explanation of what the status means and what to do next
5. **Urgent CTA** (if `urgentCTA: true`) — "You need to act now — speak to an attorney today" in red
6. **Standard CTA** (all results) — "Have questions about your case? Book a free consultation"
7. **USCIS link** — "View on USCIS.gov →" for reference and trust

---

## Trigger-Based CTAs

```json
{
  "immigration_ctas": {
    "case_status": {
      "rfe_issued": {
        "headline": "You Have a Deadline to Respond",
        "body": "RFE responses require careful preparation. Missing the deadline can result in denial.",
        "button_text": "Get Help Responding Now",
        "urgency": "high"
      },
      "noid_issued": {
        "headline": "Act Immediately — Intent to Deny Issued",
        "body": "You have a limited window to prevent denial. An attorney can help you respond.",
        "button_text": "Speak to an Attorney Today",
        "urgency": "critical"
      },
      "denied": {
        "headline": "Denial Is Not the End",
        "body": "Appeals, motions to reopen, and alternative pathways may be available.",
        "button_text": "Explore Your Options",
        "urgency": "high"
      },
      "interview_scheduled": {
        "headline": "Interview Preparation Is Critical",
        "body": "Clients who prepare with an attorney have significantly better outcomes.",
        "button_text": "Book an Interview Prep Session",
        "urgency": "medium"
      },
      "default": {
        "headline": "Questions About Your Case?",
        "body": "Our immigration attorneys can review your case and advise on next steps.",
        "button_text": "Book a Free Consultation",
        "urgency": "low"
      }
    }
  }
}
```

---

## Caching & Rate Limiting

- Cache responses for 5 minutes (`revalidate: 300`) — USCIS updates are not real-time
- IP-based rate limiting: 20 lookups/hour per IP (Upstash Redis or in-memory)
- Log lookup count (not receipt number) to `immigration_lookups` table for analytics
- Never log raw receipt numbers — hash them with SHA-256 before storing

---

## SEO Strategy

### Target Keywords
- "check USCIS case status" (450,000+/mo)
- "USCIS case status IOE / EAC / LIN / SRC"
- "what does [status title] mean USCIS"
- "USCIS case status checker [city/state]"

### On-Page SEO
- H1: "USCIS Case Status Checker"
- FAQ schema: "What does 'Case Was Received' mean?", "How long after RFE is a decision made?", "Can I appeal a USCIS denial?"
- Each status category gets a descriptive FAQ block below the result — doubles as SEO content

---

## Monetization Paths

1. **Lead gen → Attorney consultations** — Every RFE, NOID, denial result is a hot lead. Conversion rate on urgent CTAs should be 15–30%.
2. **Repeat visitors** — Clients check status weekly. Every visit = brand touchpoint on the attorney's site.
3. **White-label** — $30–60/mo add-on per BAAM immigration lawyer site.
4. **Multi-case tracker (V2)** — Families and firms tracking multiple cases pay for a dashboard.

---

## V2 Additions

- **Case history timeline** — If USCIS exposes it, show the full status change history
- **Processing time comparison** — "Your case is X days old — the average for this case type is Y days"
- **Multi-case dashboard** — Track multiple receipt numbers with one login (for attorneys managing client portfolios)
- **Email/SMS status change alerts** — "Notify me when my status changes"
