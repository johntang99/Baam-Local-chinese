---
name: AI search design decisions
description: Key architecture decisions for the AI search assistant (小邻) - keyword extraction, category matching, follow-up detection
type: feedback
---

Use Claude Haiku for keyword extraction instead of regex stop-word lists. The AI naturally handles any phrasing, slang, mixed languages. Regex is kept as fallback only.

**Why:** We tested 25 queries — AI won 18-0 with 7 ties. Regex can never cover all Chinese phrasings. ~200ms + ~$0.0001 per call.

**How to apply:** In actions.ts `extractKeywordsWithAI()`. Prompt tells Haiku to extract 1-5 core search keywords, remove filler/locations, map intent to categories.

---

Category matching uses name-vs-terms threshold: if keyword matches category NAME → list all businesses; if only matches search_terms AND category has >10 businesses → skip full listing (too broad), rely on text search.

**Why:** "饺子" matching food-chinese (27 biz) was too broad. But "火锅" matching food-hotpot (火锅烧烤) should list all. The distinction is whether the keyword IS the category vs just one item in a broad category.

---

Follow-up detection: AI classifies each message as FOLLOWUP (chat only) / SEARCH (needs fresh data) / NEW (full RAG). Don't use character-length heuristic.

**Why:** "帮我查一下Alley 41的地址" is a follow-up that NEEDS data (SEARCH), not just chat. Simple length check can't distinguish.
