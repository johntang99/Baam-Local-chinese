# Module 06 — 311 Complaint Tracker

**Phase:** 2
**Estimated Build Time:** 1 week
**Data Agreement Required:** No
**Revenue Potential:** Medium-High (real estate vertical)
**Build Effort:** Low

---

## What It Does

Look up 311 service requests at any NYC address or neighborhood:
- Noise complaints, rodent reports, heat/hot water outages
- Illegal construction, blocked driveways, graffiti
- Status tracking (open, closed, in progress)
- History over 30/90/365 days

**Primary use case for Baam:** Chinese renters researching apartments. "这栋楼投诉多不多？" is a real question every prospective tenant asks.

---

## Data Source

### NYC 311 Service Requests
- **Endpoint:** `https://data.cityofnewyork.us/resource/erm2-nwe9.json`
- **Auth:** None. App token recommended.
- **Records:** ~35M+ records, updated daily
- **Key fields:** `incident_address`, `borough`, `complaint_type`, `status`, `created_date`, `resolution_description`

---

## Route Structure

```
app/[locale]/(public)/services/
└── 311-tracker/
    ├── page.tsx                    ← Lookup tool + guide content
    ├── tracker-client.tsx          ← Client: address input + results
    └── guide/
        └── page.tsx                ← "纽约311投诉查询指南"

app/api/services/
└── 311-tracker/
    └── route.ts                    ← GET: complaints by address + filters
```

---

## Complaint Category Grouping

Group 100+ complaint types into Chinese-friendly categories:

```typescript
const CATEGORIES = {
  '噪音': ['Noise - Residential', 'Noise - Commercial', 'Noise - Street/Sidewalk'],
  '供暖供水': ['HEAT/HOT WATER', 'PLUMBING', 'WATER SYSTEM'],
  '害虫卫生': ['Rodent', 'Dirty Conditions', 'Sanitation Condition'],
  '房屋维修': ['PAINT/PLASTER', 'DOOR/WINDOW', 'ELEVATOR', 'UNSANITARY CONDITION'],
  '街道交通': ['Street Light Condition', 'Blocked Driveway', 'Illegal Parking'],
  '施工问题': ['Illegal Construction', 'Construction Lead Dust'],
};
```

---

## SEO Strategy

### Chinese Keywords
- 纽约311投诉查询
- {地址} 投诉记录
- 纽约租房怎么查投诉
- 纽约噪音投诉查询
- 纽约暖气投诉

### Guide Content
- 什么是311？华人怎么使用311？
- 租房前怎么查这栋楼的投诉记录？
- 房东不开暖气怎么投诉？
- 常见投诉类型及处理流程
- 投诉后多久能得到回复？

### FAQ Schema
- 怎么查一个地址的311投诉记录？
- 房东不修东西可以打311吗？
- 311投诉是匿名的吗？
- 投诉多的楼能住吗？

---

## Dynamic CTAs by Complaint Type

```typescript
function getCTA(types: string[]): CTA {
  if (types.includes('HEAT/HOT WATER') || types.includes('PLUMBING'))
    return { headline: '暖气/热水问题？', body: '租客有法律权利。咨询租客权益律师。', leadType: 'lawyer' };
  if (types.some(t => t.startsWith('Noise')))
    return { headline: '噪音影响生活？', body: '考虑换一个安静的社区。', leadType: 'realtor' };
  if (types.includes('Illegal Construction'))
    return { headline: '发现无证施工？', body: '了解你的权利。', leadType: 'lawyer' };
  return { headline: '想搬家？', body: '查看投诉少的优质楼盘。', leadType: 'realtor' };
}
```

---

## Revenue Paths

### Phase 2: Traffic
- "租房前查投诉" is a compelling use case for Chinese renters
- Cross-link to Baam real estate agent listings and rental guides
- Email capture: "订阅这个地址的投诉提醒"

### Phase 3: Lead Gen
- **Tenant rights attorney** — Heat/plumbing complaints → legal help CTA
- **Real estate agent** — "想搬到投诉少的社区？" CTA
- **Property manager** — "管理你的楼盘311记录" landlord-facing pitch

---

## Baam Integration

- **Guide articles:** "纽约租房指南" links to 311 tracker for due diligence
- **AI search:** 小邻 answers "这个地址投诉多吗？" by querying 311 data
- **Business directory:** Real estate agents listed near complaint results
- **Forum:** Rental discussions link to 311 lookup

---

## V2 Additions

- Complaint alert subscription: "这个地址有新投诉时通知我"
- Neighborhood heatmap: complaint density by block
- Building score: composite from 311 + DOB + HPD data
- 311 complaint filing helper: pre-filled form guidance in Chinese
