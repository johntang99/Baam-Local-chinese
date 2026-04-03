# Module 04 — Building Permit & Contractor Lookup

**Phase:** 2
**Estimated Build Time:** 2 weeks
**Data Agreement Required:** No
**Revenue Potential:** High (contractor vertical)
**Build Effort:** Medium

---

## What It Does

Two tools in one module:

**1. Permit Lookup by Address** — See active/historical building permits and DOB violations at any NYC address. Used by renters (due diligence), buyers (unpermitted work check), tenants (reporting landlord violations).

**2. Contractor License Verification** — Enter a license number or name to verify a contractor is currently licensed. Used by homeowners before hiring.

---

## Data Sources

### NYC DOB Permits
- **Endpoint:** `https://data.cityofnewyork.us/resource/ipu4-2q9a.json`
- **Fields:** address, job type, permit status, contractor info, filing/expiration dates

### NYC DOB Violations
- **Endpoint:** `https://data.cityofnewyork.us/resource/3h2n-5cm9.json`
- **Fields:** address, violation category, type, description, disposition

### NYC DOB Contractor Licenses
- **Endpoint:** `https://data.cityofnewyork.us/resource/s3vy-pqs7.json`
- **Fields:** licensee name, license type/number/status, expiration, business info

---

## Route Structure

```
app/[locale]/(public)/services/
└── building-permits/
    ├── page.tsx                    ← Two-tab tool + guide content
    ├── permits-client.tsx          ← Tab 1: address → permits + violations
    ├── contractor-verify.tsx       ← Tab 2: license search
    └── guide/
        └── page.tsx                ← "纽约装修许可证指南" + "如何验证承包商执照"

app/api/services/
└── building-permits/
    ├── route.ts                    ← GET: permits + violations by address
    └── contractor/
        └── route.ts                ← GET: contractor license lookup
```

---

## SEO Strategy

### Chinese Keywords
- 纽约建筑许可证查询
- 纽约装修需要许可吗
- 怎么验证承包商执照 NYC
- 纽约DOB违规查询
- {地址} 建筑许可

### Guide Content
- 纽约装修需要什么许可证？
- 如何验证承包商是否有执照？
- DOB违规是什么？对房东/租客有什么影响？
- 发现无证施工怎么举报？

### FAQ Schema
- 纽约装修需要申请许可证吗？
- 怎么查一个地址有没有建筑许可？
- 如何举报无证施工？
- 承包商执照过期了还能施工吗？

---

## Revenue Paths

### Phase 2: Traffic
- Guide content ranks for Chinese renovation/contractor queries
- Cross-link to Baam contractor business listings

### Phase 3: Contractor Lead Gen
- **Licensed contractor referral** — "需要持证承包商？查看Baam认证商家" CTA
- **Contractor badge upsell** — Contractor business clients pay $15-30/mo for "DOB持证" badge on their Baam page
- **Legal leads** — Tenants discovering violations → tenant rights attorney CTA

---

## Baam Integration

- **Business directory:** Cross-link to Baam contractor listings from license verification results
- **Discover:** "写一篇装修经验分享" from permits page
- **AI search:** 小邻 answers "我想装修浴室需要什么许可？" with guide link + tool link
- **Forum:** Renovation discussions link to permit lookup and contractor verification

---

## V2 Additions

- Permit alert: "有人在我的地址申请了建筑许可" notification for renters
- 311 complaint filing guide for unpermitted work
- Contractor marketplace: verified contractor directory with Baam reviews
- Featured contractor placement on permit lookup results
