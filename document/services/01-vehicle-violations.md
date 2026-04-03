# Module 01 — Vehicle Violations Lookup

**Phase:** 1 — **DONE** (implemented 2026-04-01)
**Revenue Potential:** High
**Build Effort:** Low

---

## Implementation Status

### What's Built

| Component | File | Status |
|-----------|------|--------|
| API route (Socrata proxy) | `app/api/services/vehicle-violations/route.ts` | Done |
| Lookup client component | `app/[locale]/(public)/services/vehicle-violations/violation-lookup.tsx` | Done |
| Page (server component) | `app/[locale]/(public)/services/vehicle-violations/page.tsx` | Done |
| Services index page | `app/[locale]/(public)/services/page.tsx` | Done |
| Navbar + footer links | `navbar.tsx`, `footer.tsx` | Done |
| Translation keys | `zh-CN/common.json`, `en/common.json` | Done |

### What's Working

- Plate + state input (all 50 US states + DC tested)
- Summary cards: total violations, fines, paid, amount due
- Expandable violation rows with full detail (summons #, agency, penalty, interest, reduction)
- County code mapping (handles all Socrata format variants: K, BK, Kings, etc.)
- Summons image links
- In-memory rate limiting (10 req/min per IP)
- 5-minute edge cache on API responses
- Mobile-responsive layout (card on mobile, table on desktop)
- Chinese UI with English violation data

### Data Source

- **NYC DOF Open Parking & Camera Violations (Socrata)**
- **Endpoint:** `https://data.cityofnewyork.us/resource/nc67-uf89.json`
- **Auth:** None required. Optional `NYC_OPEN_DATA_APP_TOKEN` for higher limits.
- **Query:** `$where=plate='{plate}' AND state='{state}'&$order=issue_date DESC&$limit=100`
- **Date format:** MM/DD/YYYY (not ISO — handled in client)

---

## What Needs to Be Added (V1.1)

### SEO Improvements (High Priority)

1. **Guide content above the tool** — Add 500+ words of Chinese guide content:
   - 什么是纽约停车罚单？
   - 常见违规类型及罚款金额
   - 如何缴纳罚款
   - 如何申诉停车罚单
   - 逾期不缴的后果

2. **FAQ section with schema markup** — Add FAQPage structured data:
   - 怎么查询纽约停车罚单？
   - 停车罚单多久会生效？
   - 不缴罚单会怎样？
   - 外州车牌也会收到纽约罚单吗？

3. **Metadata upgrade** — Current metadata is minimal. Needs Chinese-first titles + keywords.

4. **Guide article page** — `/services/vehicle-violations/guide` — "纽约停车罚单完全指南" static article for deep SEO.

### Business Improvements (Medium Priority)

5. **Email capture** — "保存查询结果到邮箱" button after results display. Captures email + associates with the query.

6. **Share buttons** — "分享到微信" / WhatsApp / copy link on results page.

7. **Print/export** — "打印罚单记录" button for users who need records for court.

8. **AI search integration** — 小邻 should suggest the tool: "你可以用我们的罚单查询工具查看你的车牌是否有未缴罚单"

### Lead Gen (Phase 3)

9. **Attorney CTA** — Show when `totalDue > 0`: "有未缴罚单？免费咨询交通律师"
10. **Insurance CTA** — Show when violation count > 5: "多次违规可能影响保险费率"

---

## SEO Target Keywords

### Chinese (Primary — low competition)
- 纽约停车罚单查询
- 纽约罚单怎么查
- NYC停车罚单
- 纽约交通摄像头罚单
- 车牌罚单查询

### English (Secondary — high competition)
- NYC parking ticket lookup
- check parking violations NY
- NYC camera violation check
- how to check parking tickets NYC

---

## Learned from Implementation

1. **Socrata `issue_date` is MM/DD/YYYY string**, not ISO — don't use `new Date()` parsing, display as-is
2. **County codes are inconsistent** — Socrata returns both codes (K, BK, QN, MN, R) and full names (Kings, Queens, etc.). Need comprehensive mapping.
3. **Rate limiting is essential** — Our own rate limiter triggered during testing before Socrata's limit. 10 req/min per IP works well.
4. **Summary math must use `reduce`** — Individual amounts are strings; parse to float and sum server-side.
5. **The `state` query param uses `state` not `registration_state`** — despite what the Socrata docs say for this dataset.
