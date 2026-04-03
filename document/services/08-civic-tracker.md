# Module 08 — Local Government / Civic Info

**Phase:** 3 — Optional (build only if specific client need)
**Estimated Build Time:** 2–3 weeks (officials lookup only)
**Data Agreement Required:** No
**Revenue Potential:** Low
**Build Effort:** Medium

---

## Revised Assessment

**Original spec** proposed a full civic engagement platform: officials lookup, community board meetings, legislation tracker. This is 4–6 weeks of work with low revenue potential and fragmented data sources (59 community boards with no unified API).

**Revised scope:** Build **only the officials lookup** (Google Civic API — simple, clean) as a lightweight civic info page. Community board meetings and legislation tracking are cut unless a specific Baam client (civic org, community board) requests them.

**The real value of this module is SEO:** "who is my NYC council member" and neighborhood-specific civic pages rank well and drive local traffic. But revenue per visitor is near zero.

---

## What V1 Does

Enter an address, see all elected officials at every level:
- Federal: President, Senators, Representative
- State: Governor, State Senator, Assemblymember
- City: Mayor, City Council Member, Borough President, District Attorney
- Contact info: phone, email, website, social media

---

## Data Source

### Google Civic Information API
- **Endpoint:** `https://civicinfo.googleapis.com/civicinfo/v2/representatives`
- **Auth:** Google API key (free, 25K req/day)
- **Query:** `?address={address}&key={GOOGLE_CIVIC_API_KEY}`
- **Returns:** All elected officials for a given address across all levels

This is the easiest data source in the entire suite. One API call returns everything.

---

## Route Structure

```
app/[locale]/(public)/services/
└── civic-info/
    ├── page.tsx                    ← Officials lookup + guide content
    ├── civic-client.tsx            ← Client: address input + officials cards
    └── guide/
        └── page.tsx                ← "纽约民选官员查询指南"

app/api/services/
└── civic-info/
    └── route.ts                    ← GET: address → officials (Google Civic API)
```

---

## SEO Strategy

### Chinese Keywords
- 纽约市议员查询
- 我的选区代表是谁
- 纽约州参议员查询
- {社区名} 民选官员

### Guide Content
- 纽约有哪些民选官员？各自管什么？
- 怎么联系你的市议员
- 华人怎么参与社区事务
- 什么是社区委员会 (Community Board)？

---

## Revenue Paths

- **Direct revenue:** Near zero. No one pays for civic info.
- **SEO value:** Neighborhood-specific pages drive local traffic
- **Brand equity:** Civic engagement builds community trust for Baam
- **Indirect:** Civic-engaged users are high-value audience for other Baam services (real estate, legal)

---

## Decision Criteria: When to Build This

Build this module IF:
- [ ] A Baam client is a civic organization or community board
- [ ] Other modules are live and generating traffic, team has bandwidth
- [ ] Chinese civic content gap is confirmed (check if competitors already fill this)

Otherwise, skip. The effort is better spent on restaurant inspections and property tax.

---

## V2 Additions (Only if built)

- Community board meeting calendar (requires scraping 59 websites)
- Voting reminders and polling place lookup
- NYC Council legislation tracker
- Campaign finance lookup
