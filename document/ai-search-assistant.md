---
name: AI Search Assistant (小邻) architecture
description: Complete architecture of the AI search assistant - keyword extraction, category matching, RAG pipeline, follow-up detection, voice search
type: reference
---

## AI Search Assistant (小邻) — Architecture

**Main file:** `apps/web/src/app/[locale]/(public)/ask/actions.ts`
**Chat UI:** `apps/web/src/app/[locale]/(public)/ask/chat.tsx`

### Flow

```
User query → AI keyword extraction (Haiku) → 3 parallel search strategies → build context → AI response (Haiku)
```

### 1. AI Keyword Extraction
- Claude Haiku extracts 1-5 search keywords from any natural language query
- Handles Chinese slang, mixed language, vague queries, rambling text
- Prompt: extract core search terms, remove filler/locations, map intent to categories
- Regex fallback if API fails (stopPhrases + stopChars + edge stripping)

### 2. Business Search (3 strategies in parallel)
**Strategy 1: Category matching**
- Fetch all business categories with search_terms
- Bidirectional substring matching: keyword↔category name, keyword↔search_terms
- **Name match** (keyword ≈ category name) → list ALL businesses in category
- **Terms-only match** + category has >10 businesses → SKIP (too broad, e.g. "饺子" in food-chinese)
- **Terms-only match** + category has ≤10 businesses → list all (specific enough)

**Strategy 2: ai_tags array match**
- `contains('ai_tags', [keyword])` for each keyword

**Strategy 3: Text search**
- `ilike` on display_name, display_name_zh, short_desc_zh, ai_summary_zh

**Sort order:** text-match businesses first → category-match businesses → others → by rating

### 3. Non-Business Content (parallel with business search)
- News articles (title_zh, ai_summary_zh)
- Guide articles (title_zh, ai_summary_zh, body_zh)
- Forum threads (title, body, ai_summary_zh)
- Voice posts (title, content)
- Events (title_zh, summary_zh, venue_name)

### 4. AI Response Generation
- Claude Haiku with system prompt as "小邻" (community AI neighbor)
- Context includes: businesses (with ratings, phone, tags), guides, news, threads, events
- Conversation history: last 3 turns passed as messages

### 5. Follow-up Detection (multi-turn)
- Before RAG search, AI classifies message as:
  - **FOLLOWUP** — can answer from context alone (e.g. "需要", "谢谢") → skip RAG, chat only
  - **SEARCH** — references conversation but needs fresh data (e.g. "帮我查地址") → full RAG with context
  - **NEW** — completely new topic → full RAG, fresh search
- Classification uses Haiku with last assistant reply as context

### 6. Voice Search
- Web Speech API (`SpeechRecognition`) with `lang: 'zh-CN'`
- `useVoiceInput` hook in chat.tsx
- Browser mic button, transcript feeds into search input
- Type declaration in `apps/web/src/types/speech-recognition.d.ts`

### 7. UI Features
- "查看Prompt" debug modal showing keywords, system/user prompts, model, result counts
- Phone numbers auto-linked as `tel:` for click-to-call (regex in ReactMarkdown components)
- Source links open in new tab (`target="_blank"`) to preserve chat
- Conversation history maintained in React state

### Search Terms
- 6,600+ terms across 130 categories
- Script: `scripts/populate-search-terms.ts`
- Admin UI: Settings → Categories → search terms editor
- Medical categories most expanded (e.g. medical-chinese-medicine: 34 terms)
