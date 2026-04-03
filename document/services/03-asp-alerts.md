# Module 03 — Parking Schedule Lookup (+ Alerts in V2)

**Phase:** 2
**Estimated Build Time:** 1 week (lookup) + 2 weeks (alerts V2)
**Data Agreement Required:** No (NYC GeoClient requires free registration)
**Revenue Potential:** High (retention)
**Build Effort:** Low (lookup) / Medium (alerts)

---

## Revised Scope: Lookup First, Alerts Later

Original spec combined schedule lookup + subscription alerts into one module. **Revised approach:**

| Phase | Feature | Infra Needed |
|-------|---------|-------------|
| Phase 2 V1 | **Schedule lookup only** — enter address, see your cleaning schedule | API route + Socrata + GeoClient |
| Phase 2 V2 | **Email alerts** — subscribe for weekly reminders | Resend + cron job |
| Phase 4 | **SMS alerts + premium tier** — paid SMS, multi-address | Twilio + Stripe |

**Rationale:** Subscription alerts require cron jobs, email/SMS infra, subscription management, and unsubscribe flows. Schedule lookup alone is high-value and can be built in 1 week. Ship the lookup, build email list from it, then add alerts.

---

## What V1 Does (Phase 2)

Enter an NYC street address and see:
- Your block's street cleaning schedule (day, time, side of street)
- Whether today is an ASP suspension day (holidays, snow emergencies)
- Next scheduled cleaning for your block
- "保存到日历" (.ics) export

---

## Data Sources

### Street Cleaning Schedules
- **Endpoint:** `https://data.cityofnewyork.us/resource/r4ha-sde7.json`
- **Fields:** `boro`, `street`, `fromstreet`, `tostreet`, `day`, `fromhour`, `tohour`, `sides`

### ASP Suspension Calendar
- **Endpoint:** `https://www.nyc.gov/assets/dsny/downloads/json/calendar.json`
- **Alt:** `https://api.nyc.gov/content/v1/scraped/calendarItems/`

### Address → Block Resolution
- **NYC GeoClient** — resolves address to block segment + side of street

---

## Route Structure

```
app/[locale]/(public)/services/
└── parking-schedule/
    ├── page.tsx                    ← Schedule lookup + guide content
    ├── schedule-client.tsx         ← Client: address input + schedule display
    └── guide/
        └── page.tsx                ← "纽约扫街停车规则完全指南"

app/api/services/
└── parking-schedule/
    └── route.ts                    ← GET: address → cleaning schedule
```

---

## SEO Strategy

### Chinese Keywords
- 纽约扫街停车时间查询
- 纽约交替停车规则
- 今天需要挪车吗
- {街道名} 扫街时间
- 纽约停车罚单怎么避免

### Guide Content (above the tool)
- 什么是交替停车 (Alternate Side Parking)?
- 扫街时间怎么看？
- 今天暂停扫街吗？（假期列表）
- 收到扫街罚单怎么办？
- 减少罚单的实用技巧

### FAQ Schema
- 纽约扫街停车规则是什么？
- 今天需要挪车吗？
- 扫街罚单多少钱？
- 下雪天需要挪车吗？

---

## Revenue Paths

### Phase 2: Traffic + Email
- Guide content drives SEO traffic for parking-related Chinese searches
- "下次扫街前提醒我" → email capture
- Cross-link to Vehicle Violations tool: "已经被罚了？查看你的罚单记录"

### Phase 4: Subscription (requires volume)
- Free: email reminders
- Premium ($4.99/mo): SMS alerts, multiple addresses, snow emergency alerts
- Property manager tier: building-level subscriptions

---

## Baam Integration

- **Vehicle Violations cross-link:** "查看你的罚单记录" from schedule page
- **Business directory:** Link to nearby parking garages (if listed on Baam)
- **AI search:** 小邻 answers "今天需要挪车吗？" by checking suspension calendar
- **Guide articles:** "纽约停车指南" links to this tool

---

## V2 Additions (Alert Subscription System)

Only build after the lookup tool has traction:

- Email alerts via Resend: "⚠️ 明天早上8:00前请挪车 — {street}"
- Vercel Cron: daily at 6 AM EST
- Supabase `asp_subscriptions` table for subscriber management
- Unsubscribe via unique token link
- Premium SMS via Twilio ($4.99/mo)
- Calendar export (.ics file)
- Google Maps integration: show block segment on map
