# Module 02 — Visa Eligibility Screener

**Phase:** 1 — Launch Now  
**Estimated Build Time:** 2 weeks  
**Data Agreement Required:** No  
**Revenue Potential:** ⭐⭐⭐⭐⭐  
**Build Effort:** Medium  

---

## What It Does

A guided multi-step questionnaire that asks the visitor about their situation — country of origin, employment status, family ties, current visa, goals — and outputs a personalized list of visa categories they may be eligible for, with plain-language explanations and a consultation CTA.

This is the highest-conversion tool in the suite. It meets the visitor at peak anxiety ("I don't even know where to start") and gives them clarity and direction, while positioning the attorney as the expert who can take them the rest of the way.

**Built as an AI-powered tool** using the Anthropic API in-page (Claude-in-Claude pattern). The screener collects structured input, sends it to Claude with a detailed immigration law system prompt, and returns a personalized eligibility assessment.

---

## Architecture: AI-Powered Screener

This module uses the **Anthropic API client-side pattern** from BAAM's artifact capability:

```
User completes questionnaire
  → Structured JSON submitted to /api/immigration/visa-screener
  → API route calls Anthropic claude-sonnet-4-20250514 with immigration system prompt
  → Returns structured eligibility results
  → Client renders results with CTA
```

No immigration data API needed — Claude's training covers US immigration law comprehensively. The system prompt constrains output to structured JSON only.

---

## File Structure

```
app/
└── immigration/
    └── visa-screener/
        ├── page.tsx
        ├── screener-client.tsx        ← Multi-step form + results renderer
        ├── steps/
        │   ├── Step1Goal.tsx          ← What do you want to achieve?
        │   ├── Step2Country.tsx       ← Country of birth + citizenship
        │   ├── Step3CurrentStatus.tsx ← Current visa or immigration status
        │   ├── Step4Employment.tsx    ← Job, employer, field of work
        │   ├── Step5Family.tsx        ← US citizen/LPR family members
        │   └── Step6Education.tsx     ← Degree, credentials
        └── types.ts

app/
└── api/
    └── immigration/
        └── visa-screener/
            └── route.ts               ← POST: sends to Anthropic, returns eligibility JSON
```

---

## Questionnaire Steps

### Step 1 — Primary Goal
```
What are you trying to achieve?
○ Work in the United States
○ Immigrate permanently (Green Card)
○ Bring a family member to the US
○ Study in the United States
○ Start or invest in a business
○ Seek protection / asylum
○ Extend or change my current visa
```

### Step 2 — Background
```
Country of birth: [dropdown — all countries]
Country of citizenship: [dropdown]
Are you currently in the United States? [Yes / No]
  If Yes → Current immigration status: [dropdown]
    Options: US Citizen, Green Card Holder, H-1B, H-4, L-1, L-2,
             F-1 (Student), J-1, B-1/B-2 (Visitor), TN, O-1,
             DACA, TPS, EAD only, Undocumented, Other
```

### Step 3 — Employment (shown if goal = Work or Immigrate)
```
Current employment situation:
○ I have a job offer from a US employer
○ I am currently employed by a US employer
○ I am self-employed / business owner
○ I am not currently employed

Field of work: [dropdown]
  Options: Technology/Software, Healthcare/Medicine, Finance,
           Education/Research, Arts/Entertainment, Engineering,
           Legal, Business/Management, Science/Research,
           Skilled Trade, Other

Years of work experience: [dropdown] <2 / 2–5 / 5–10 / 10+

Highest education level:
○ High School / GED
○ Associate's Degree
○ Bachelor's Degree
○ Master's Degree
○ PhD / Doctoral
○ Professional Degree (MD, JD, etc.)
```

### Step 4 — Family (shown if goal = Family or Immigrate)
```
Do you have any of the following in the US?
☐ US Citizen spouse
☐ US Citizen parent
☐ US Citizen child (21+)
☐ US Citizen sibling
☐ Green Card holder spouse
☐ Green Card holder parent
☐ None of the above
```

### Step 5 — Additional Factors
```
Do any of the following apply to you?
☐ I have extraordinary ability in my field (awards, publications, recognition)
☐ I am an investor or entrepreneur
☐ I have served in the US military
☐ I have faced persecution in my home country
☐ I am a religious worker
☐ None of the above

Have you ever had any of the following? (affects eligibility)
☐ Visa denial
☐ Deportation or removal order
☐ Criminal conviction
☐ Previous overstay
☐ None of the above
```

---

## TypeScript Interfaces

```typescript
interface ScreenerInput {
  goal: 'work' | 'immigrate' | 'family' | 'study' | 'business' | 'protection' | 'extend_change';
  countryOfBirth: string;
  countryOfCitizenship: string;
  currentlyInUS: boolean;
  currentStatus?: string;
  employment?: {
    situation: 'job_offer' | 'employed' | 'self_employed' | 'unemployed';
    field: string;
    yearsExperience: string;
    educationLevel: string;
  };
  familyTies: string[];           // ['us_citizen_spouse', 'gc_parent', etc.]
  additionalFactors: string[];    // ['extraordinary_ability', 'investor', etc.]
  negativeFactors: string[];      // ['visa_denial', 'deportation', etc.]
}

interface VisaOption {
  category: string;               // "H-1B", "EB-2 NIW", "CR-1", etc.
  name: string;                   // "Specialty Occupation Worker"
  eligibilityScore: 'strong' | 'possible' | 'worth_exploring';
  whyEligible: string;            // Plain-language explanation
  keyRequirements: string[];
  typicalTimeline: string;        // "6–18 months"
  challenges: string[];           // Potential obstacles
  nextStep: string;               // What to do first
}

interface ScreenerResult {
  summary: string;                // 1–2 sentence overview
  recommendedOptions: VisaOption[];
  importantNotes: string[];       // Flags based on negative factors
  disclaimer: string;
}
```

---

## API Route — Anthropic Integration

```typescript
// app/api/immigration/visa-screener/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an immigration law information assistant. Based on the user's situation, identify which US visa categories they may be eligible for.

CRITICAL RULES:
1. Respond ONLY with valid JSON matching the ScreenerResult schema. No preamble, no markdown, no explanation outside the JSON.
2. Always include the disclaimer: "This assessment is for informational purposes only and does not constitute legal advice."
3. Return 2–5 visa options maximum, ordered by likelihood of eligibility.
4. Use plain language — assume the user is not an immigration expert.
5. Be honest about challenges and limitations, not just optimistic.
6. Flag any negative factors (prior denials, overstays, criminal history) with appropriate notes.
7. eligibilityScore must be: "strong" | "possible" | "worth_exploring"

JSON Schema to follow exactly:
{
  "summary": "string",
  "recommendedOptions": [
    {
      "category": "string",
      "name": "string", 
      "eligibilityScore": "strong | possible | worth_exploring",
      "whyEligible": "string",
      "keyRequirements": ["string"],
      "typicalTimeline": "string",
      "challenges": ["string"],
      "nextStep": "string"
    }
  ],
  "importantNotes": ["string"],
  "disclaimer": "string"
}`;

export async function POST(req: NextRequest) {
  const input: ScreenerInput = await req.json();

  const userMessage = `Assess visa eligibility for this person:
Goal: ${input.goal}
Country of birth: ${input.countryOfBirth}
Country of citizenship: ${input.countryOfCitizenship}
Currently in US: ${input.currentlyInUS}
Current status: ${input.currentStatus ?? 'Not in US'}
Employment: ${JSON.stringify(input.employment ?? {})}
Family ties in US: ${input.familyTies.join(', ') || 'None'}
Additional factors: ${input.additionalFactors.join(', ') || 'None'}
Negative factors: ${input.negativeFactors.join(', ') || 'None'}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text;

  try {
    const result: ScreenerResult = JSON.parse(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Could not process screening results' }, { status: 500 });
  }
}
```

---

## Results UI

### Eligibility Score Display
```typescript
const SCORE_DISPLAY = {
  strong: {
    label: 'Strong Match',
    color: '#00E5A0',
    description: 'Based on your profile, you likely meet the key requirements.',
  },
  possible: {
    label: 'Possible Match',
    color: '#FFD000',
    description: 'You may qualify, depending on additional details.',
  },
  worth_exploring: {
    label: 'Worth Exploring',
    color: '#00C2FF',
    description: 'This path is less straightforward but may be worth discussing.',
  },
};
```

### Result Card Per Visa Option
For each `VisaOption` render:
1. Visa category badge (e.g. "H-1B") + eligibility score chip
2. Visa name + why eligible paragraph
3. Key requirements list (3–5 bullets)
4. Typical timeline
5. Challenges (collapsed by default, "See potential challenges ↓")
6. Next step suggestion
7. "Learn more about [H-1B] →" linking to a lawyer-authored blog post (BAAM content)

### Bottom CTA (After All Results)
```
"Ready to find out which path is right for you?"
[Book a Free Consultation] ← Primary CTA
"Your results will be shared with our attorneys before your call."
```

---

## Lead Capture on Submission

Before showing results, optionally capture:
```typescript
interface ScreenerLead {
  name: string;       // optional
  email: string;      // optional but encouraged
  phone?: string;
  // Results are emailed to the law firm with the lead contact info
}
```

This allows the attorney to follow up even if the visitor doesn't book immediately. Stored in `immigration_leads` table with `trigger: 'visa_screener'`.

---

## Trigger-Based CTAs

```json
{
  "immigration_ctas": {
    "visa_screener": {
      "strong_match": {
        "headline": "You Have a Clear Path Forward",
        "body": "Our attorneys can evaluate your specific case and begin the process.",
        "button_text": "Start My Case — Free Consultation"
      },
      "possible_match": {
        "headline": "Your Case Has Potential",
        "body": "Every immigration case is unique. Let us review the details with you.",
        "button_text": "Get a Case Evaluation"
      },
      "negative_factors_present": {
        "headline": "Your Situation Requires Expert Guidance",
        "body": "Prior immigration issues don't always close the door. An attorney can assess your options.",
        "button_text": "Speak to an Attorney"
      }
    }
  }
}
```

---

## SEO Strategy

### Target Keywords
- "am I eligible for H-1B visa"
- "how to get a green card from [country]"
- "visa options for [profession] in USA"
- "immigration options for spouse of US citizen"
- "what visa can I get to work in the US"

### Content Synergy
Each visa option in the results links to attorney-authored blog posts on the BAAM site. The screener drives traffic to the blog; the blog builds authority; the authority drives more organic traffic to the screener.

---

## Monetization Paths

1. **Lead gen → Consultations** — Screener is the highest-intent lead source. User has self-identified their need and received value before the CTA.
2. **Email follow-up sequence** — Captured email → 3-email educational sequence → consultation offer.
3. **Screener as gated tool (V2)** — Require email to see full results. Immediate lead capture.
4. **White-label** — Premium BAAM add-on for immigration clients: $40–80/mo.

---

## V2 Additions

- **Saved results** — Email results PDF to the user
- **Family screener** — Run screener for multiple family members simultaneously
- **Annual update prompt** — "Immigration law changed — re-run your screener"
- **Chatbot follow-up** — Claude-powered Q&A after results: "What if I told you I have a PhD?"
