# Module 07 — Transit Status Board

**Phase:** 3
**Estimated Build Time:** 1–2 weeks (status board only)
**Data Agreement Required:** No (free MTA API key)
**Revenue Potential:** Low-Medium
**Build Effort:** Low (status board) / High (alert subscriptions)

---

## Revised Scope: Status Board Only

**Original spec** proposed a full alert subscription system with morning digests, SMS, and cron jobs. This is over-engineered for Phase 3.

**Revised approach:** Build a **live subway status board** — a simple, useful page that shows current service status for all lines. No subscriptions, no cron jobs, no SMS. Just a clean real-time display.

**Rationale:**
- MTA already has apps and Twitter alerts. We can't compete on real-time push notifications.
- What we CAN offer: a Chinese-language transit status page (MTA doesn't have one)
- The SEO value is in the guide content, not the real-time data

---

## What V1 Does

- Grid of subway line buttons with real-time status colors (good/delayed/suspended)
- Click a line to see current alerts and planned work details
- Chinese translations of alert messages (Google Translate API or Claude Haiku)
- Weekend planned work section
- Guide content about NYC subway system in Chinese

---

## Data Source

### MTA Service Alerts (JSON)
- **Endpoint:** `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json`
- **Auth:** `x-api-key: ${MTA_API_KEY}` (free registration at https://api.mta.info/)
- **Format:** JSON (unlike GTFS-RT binary feeds)
- **Update frequency:** Real-time

This JSON feed is much simpler than the GTFS-RT binary feeds. No `gtfs-realtime-bindings` needed.

---

## Route Structure

```
app/[locale]/(public)/services/
└── transit-status/
    ├── page.tsx                    ← Status board + guide content
    ├── transit-client.tsx          ← Client: line grid + alert display
    └── guide/
        └── page.tsx                ← "纽约地铁乘坐指南"

app/api/services/
└── transit-status/
    └── route.ts                    ← GET: current alerts (cached 60s)
```

---

## SEO Strategy

### Chinese Keywords
- 纽约地铁今天正常吗
- 纽约地铁延误查询
- 7号线今天正常吗
- 纽约地铁怎么坐（新移民指南）
- 纽约地铁周末施工

### Guide Content (High SEO Value)
- 纽约地铁新手指南（MetroCard/OMNY怎么用）
- 法拉盛坐7号线到曼哈顿攻略
- 纽约地铁安全吗？华人乘车注意事项
- 周末地铁施工怎么绕路
- 纽约地铁常用英语

This guide content targets new Chinese immigrants — a core Baam audience with high search volume and almost no Chinese-language competition.

---

## Revenue Paths

### Phase 3: Traffic Only
- Chinese subway guide content drives organic traffic
- Internal links to Baam guide articles and forum discussions
- No direct monetization — audience building for other services

### V2 Consideration
- Station-targeted local business ads (coffee shops near stations)
- Commuter audience = high-value demographic for insurance/real estate verticals
- Only build subscriptions if the status board gets significant repeat traffic

---

## Baam Integration

- **AI search:** 小邻 answers "7号线今天正常吗？" by checking MTA alerts
- **Guide articles:** "纽约交通指南" links to transit status
- **Forum:** Transit discussions link to status board

---

## V2 Additions (Only if Phase 3 shows traction)

- Morning digest email subscription
- Elevator/escalator status (accessibility)
- Trip planner: "我的通勤会受影响吗？"
- Historical reliability scores
- Push notifications (PWA)
