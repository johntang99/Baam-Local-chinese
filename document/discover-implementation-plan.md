# Discover Module — Implementation Plan

> **Date:** 2026-03-31
> **Status:** Planning complete, prototypes done, ready to code
> **Prototypes:** `prototypes/zh/discover-*.html` (5 pages)

---

## Overview

Discover merges the existing Voices module with a xiaohongshu-style content discovery layer. It transforms the text-centric `/voices` into a visual, card-based, media-rich content feed connecting posts to businesses, guides, forums, and AI search.

**Core concept:** Discover = 发现纽约华人生活中值得关注的人、内容、地点、服务与趋势

**Sub-modules:**
- **Notes** — Photo + text posts (探店, 种草, 避坑, 经验分享)
- **Videos** — Short videos (15-90 seconds)
- **Voices** — Followable creators (达人, 专家, 主理人)
- **Picks/Lists** — Curated recommendation lists
- **Topics/Trends** — Trending tags and city hotspots

---

## Route Structure

| Route | Type | Description |
|---|---|---|
| `/discover` | SSR + ISR | Main feed with tabs (推荐/关注/笔记/视频/话题) |
| `/discover/[slug]` | SSR | Post detail (replaces `/voices/[username]/posts/[slug]`) |
| `/discover/voices` | SSR | Browse creators (migrated from `/voices`) |
| `/discover/voices/[username]` | SSR | Creator profile (migrated from `/voices/[username]`) |
| `/discover/tag/[slug]` | SSR | Topic/tag feed |
| `/discover/new` | Client | Create new post (auth required) |
| `/voices/*` | Redirect | 301 redirects to `/discover/voices/*` |

---

## Phase 1: Foundation — Schema, Routes, Core Feed (2-3 weeks)

### Database Schema Changes

**Extend `voice_post_type` enum:**
- Add `note` (photo+text) and `video` (short video 15-90s)

**New table: `discover_topics`**
```sql
CREATE TABLE discover_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  icon_emoji TEXT,
  cover_image_url TEXT,
  post_count INT DEFAULT 0,
  follower_count INT DEFAULT 0,
  is_trending BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New table: `discover_post_topics` (M2M)**
```sql
CREATE TABLE discover_post_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES discover_topics(id) ON DELETE CASCADE,
  UNIQUE(post_id, topic_id)
);
```

**New table: `discover_post_businesses` (post → business links)**
```sql
CREATE TABLE discover_post_businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  relation_note TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Add columns to `voice_posts`:**
- `video_url TEXT`
- `video_thumbnail_url TEXT`
- `video_duration_seconds SMALLINT`
- `aspect_ratio TEXT DEFAULT '4:3'` — `4:3`, `1:1`, `9:16`, `16:9`
- `cover_images TEXT[]` — array of image URLs (multi-image like xiaohongshu)
- `location_text TEXT` — freeform location tag

### Components to Build

1. **`DiscoverCard`** — Core visual card (image cover, author avatar, title, like/save counts). Different rendering for note (multi-image), video (play overlay), blog (text excerpt). **Most important component.**
2. **`DiscoverFeed`** (Server) — Paginated posts with masonry grid layout
3. **`DiscoverTabs`** (Client) — Tab bar: 推荐, 关注, 笔记, 视频, 话题
4. **`MasonryGrid`** (Client) — CSS grid with variable-height cards, mixed aspect ratios
5. **`ImageCarousel`** (Client) — Swipeable multi-image viewer with dot indicators
6. **`VideoPlayer`** (Client) — Lightweight player, autoplay on scroll (muted), 15-90s
7. **Redirect middleware** — `/voices/*` → `/discover/voices/*`

### Reuse from Existing Voices Code

| Existing | Reuse Strategy |
|---|---|
| `/voices/page.tsx` | Move to `/discover/voices/page.tsx`, add DiscoverCard grid |
| `/voices/[username]/page.tsx` | Move to `/discover/voices/[username]/page.tsx` |
| `/voices/[username]/posts/[slug]/page.tsx` | Major refactor into `/discover/[slug]/page.tsx` |
| `actions.ts` (createVoicePost, toggleLike, etc.) | Extend for images/video/business linking |
| `social-actions.tsx` (FollowButton, LikeButton) | Reuse, add SaveButton |

---

## Phase 2: Post Creation & Media Upload (1-2 weeks)

### Components

1. **`CreatePostPage`** — Auth check wrapper
2. **`CreatePostForm`** — Major upgrade:
   - Post type selector: 笔记/视频/推荐清单
   - Multi-image uploader (max 9, drag-and-drop, reorder, crop)
   - Video uploader (15-90s validation, thumbnail auto-extraction)
   - Business linker (search-as-you-type, max 5 per post)
   - Topic selector (multi-select + freeform tags)
   - Location input with neighborhood suggestions
3. **`BusinessSearchInput`** — Debounced search returning business cards

### Server Actions

- `createDiscoverPost` — Extended createVoicePost handling cover_images, video_url, business/topic linking, AI auto-tagging
- `uploadDiscoverMedia` — Multi-file upload to Supabase Storage 'discover' folder

---

## Phase 3: Post Detail & Business Linking (2 weeks)

### Components

1. **`DiscoverPostDetail`** — Full refactor of voice post detail:
   - Full-width image carousel or video player
   - Author card with follow button
   - Markdown body
   - **Linked businesses section** — cards from `discover_post_businesses`
   - **Related guides** — matched by business or topic
   - **Related forum threads** — matched by topic tags
   - **Related discover posts** — same author or topics
   - Like, save, share, comments
2. **`LinkedBusinessCard`** — Compact inline business card
3. **`RelatedDiscoverPosts`** — Horizontal scroll of related cards

### Cross-Module Integration

- **Business detail page** — Add "社区笔记" section showing discover posts mentioning this business
- **Guide detail page** — Add "相关笔记" section with matching topic tags

---

## Phase 4: Topics/Trends, Creator Profiles, Homepage (1-2 weeks)

### Components

1. **`TopicPage`** — `/discover/tag/[slug]` with topic header + filtered feed
2. **`TrendingTopics`** — Horizontal scrollable chips on feed + homepage
3. **`DiscoverHeroSection`** — Homepage section replacing current "Local Voices"
4. **Enhanced Creator Profile** — Content tabs (笔记/视频/推荐清单/全部), masonry grid, recommendation lists, upgraded stats
5. **`RecommendationListCard`** + **Detail** — Curated lists display

### Admin Pages

- `/admin/discover/` — Moderate posts, manage topics, view reports
- `/admin/discover/topics/` — CRUD for topics, toggle trending/featured

### Homepage Changes

- Replace "Local Voices" section with Discover featured cards + trending topics bar

---

## Phase 5: AI Integration & Feed Algorithm (1-2 weeks)

### AI Search Integration

- Extend AI search (小邻) to return discover posts in results
- Add "社区笔记" section to search results
- AI auto-tagging on post creation → match to discover_topics

### Feed Algorithm

**推荐 tab scoring:**
```
score = featured_boost × 0.20 + verified_author × 0.15 + engagement_rate × 0.25
      + content_quality × 0.20 + topic_relevance × 0.15 + freshness × 0.05
```

**关注 tab scoring:**
```
score = freshness × 0.40 + engagement × 0.25 + author_relevance × 0.20
      + content_diversity × 0.15
```

Implementation: Supabase DB function `get_discover_feed(user_id, tab, limit, offset)` for server-side scoring.

### Components

- `InfiniteScrollFeed` — Replace pagination with Intersection Observer infinite scroll

---

## Navigation Changes

Update navbar: `voices` → `discover` (发现)

Suggested nav order: 首页 | **发现** | 新闻 | 生活指南 | 商家 | 活动 | 社区 | AI助手

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Video upload size | Client-side validation (15-90s, max 50MB), chunked upload |
| Masonry layout shifts | Require `aspect_ratio` on posts, CSS `aspect-ratio` + skeleton loading |
| Feed cold start | Fall back to chronological + featured until 100+ posts |
| Image optimization | Supabase image transforms or Next.js Image optimization |

---

## Prototypes (completed)

| File | Description |
|---|---|
| `prototypes/zh/discover-home.html` | Main feed, masonry grid, tabs, trending sidebar |
| `prototypes/zh/discover-post-detail.html` | Photo note detail, business cards, related content |
| `prototypes/zh/discover-video-detail.html` | Video player, related videos, comments |
| `prototypes/zh/discover-voice-profile.html` | Creator profile, content tabs, stats |
| `prototypes/zh/discover-create-post.html` | Create post form, image upload, business linker |
