-- ============================================================
-- BAAM LOCAL PORTAL — SUPABASE SQL SCHEMA
-- Phase 1 MVP — Complete Database Setup
-- Run this in Supabase SQL Editor (split into sections if needed)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ============================================================
-- SECTION 1: UTILITY TYPES & ENUMS
-- ============================================================

-- Region types
CREATE TYPE region_type AS ENUM ('country','state','county','city','neighborhood','borough');

-- Content language
CREATE TYPE content_lang AS ENUM ('zh','en','bilingual');

-- Article / Guide vertical
CREATE TYPE content_vertical AS ENUM (
  'news_alert','news_brief','news_explainer','news_roundup','news_community',
  'guide_howto','guide_checklist','guide_bestof','guide_comparison',
  'guide_neighborhood','guide_seasonal','guide_resource','guide_scenario'
);

-- Source types for news/guides
CREATE TYPE source_type AS ENUM ('official_gov','school_district','media','community_org','ngo','original','ai_assisted');

-- Editorial status
CREATE TYPE editorial_status AS ENUM ('draft','ai_drafted','human_reviewed','published','archived');

-- Business statuses
CREATE TYPE business_status AS ENUM ('pending','active','suspended','claimed','unclaimed');

-- Verification status
CREATE TYPE verification_status AS ENUM ('unverified','pending','verified');

-- Profile types
CREATE TYPE profile_type AS ENUM ('user','creator','expert','professional','community_leader','business_owner');

-- Voice post types
CREATE TYPE voice_post_type AS ENUM ('short_post','blog','guide_post','recommendation','question','event_post','opinion');

-- Content visibility
CREATE TYPE visibility_type AS ENUM ('public','followers_only','private');

-- Review / moderation status
CREATE TYPE moderation_status AS ENUM ('pending','approved','rejected','flagged');

-- Lead status
CREATE TYPE lead_status AS ENUM ('new','contacted','qualified','converted','closed');

-- Plan types
CREATE TYPE plan_type AS ENUM ('free','pro','content','reputation','lead','growth','verified_expert','creator_growth');

-- Sponsor slot types
CREATE TYPE sponsor_type AS ENUM ('homepage_banner','news_sidebar','guide_inline','forum_board','newsletter','featured_voice','event_listing','category_top');

-- Relation types (reused in link tables)
CREATE TYPE voice_article_relation AS ENUM ('author','mentioned','related_expert','commentary');
CREATE TYPE voice_business_relation AS ENUM ('owner','expert','ambassador','recommended','featured');
CREATE TYPE voice_thread_relation AS ENUM ('author','featured_voice','top_contributor');
CREATE TYPE guide_voice_relation AS ENUM ('author','contributor','featured_voice','related_voice');
CREATE TYPE business_guide_relation AS ENUM ('featured','sponsor','ai_match','editorial');
CREATE TYPE classified_category AS ENUM ('housing_rent','housing_buy','jobs','secondhand','services','events','general');


-- ============================================================
-- SECTION 2: GEOGRAPHY — REGIONS & CATEGORIES
-- ============================================================

CREATE TABLE regions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  name_en       TEXT NOT NULL,
  name_zh       TEXT,
  type          region_type NOT NULL DEFAULT 'city',
  parent_id     UUID REFERENCES regions(id) ON DELETE SET NULL,
  timezone      TEXT DEFAULT 'America/New_York',
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regions_parent ON regions(parent_id);
CREATE INDEX idx_regions_slug ON regions(slug);

-- Seed initial regions
INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude) VALUES
  ('new-york-state', 'New York State', '纽约州', 'state', 'America/New_York', 42.1657, -74.9481),
  ('orange-county-ny', 'Orange County, NY', '奥兰治县', 'county', 'America/New_York', 41.3912, -74.3118),
  ('middletown-ny', 'Middletown, NY', '米德尔敦', 'city', 'America/New_York', 41.4459, -74.4229),
  ('flushing-ny', 'Flushing, NY', '法拉盛', 'neighborhood', 'America/New_York', 40.7674, -73.8330),
  ('sunset-park-ny', 'Sunset Park, Brooklyn', '日落公园', 'neighborhood', 'America/New_York', 40.6410, -73.9950),
  ('elmhurst-ny', 'Elmhurst, Queens', '艾姆赫斯特', 'neighborhood', 'America/New_York', 40.7370, -73.8800),
  ('manhattan-chinatown-ny', 'Manhattan Chinatown', '曼哈顿华埠', 'neighborhood', 'America/New_York', 40.7150, -73.9980),
  ('avenue-u-brooklyn-ny', 'Avenue U / Homecrest (Brooklyn)', '布鲁克林U大道', 'neighborhood', 'America/New_York', 40.5950, -73.9650),
  ('bensonhurst-ny', 'Bensonhurst, Brooklyn', '本森赫斯特', 'neighborhood', 'America/New_York', 40.6080, -73.9970),
  ('corona-ny', 'Corona, Queens', '可乐娜', 'neighborhood', 'America/New_York', 40.7490, -73.8700),
  ('long-island-city-ny', 'Long Island City, Queens', '长岛市', 'neighborhood', 'America/New_York', 40.7447, -73.9485),
  ('forest-hills-ny', 'Forest Hills & Rego Park, Queens', '森林小丘', 'neighborhood', 'America/New_York', 40.7210, -73.8440),
  ('queens-ny', 'Queens, NY', '皇后区', 'borough', 'America/New_York', 40.7282, -73.7949),
  ('new-york-city', 'New York City', '纽约市', 'city', 'America/New_York', 40.7128, -74.0060);

-- Update parent relationships
UPDATE regions SET parent_id = (SELECT id FROM regions WHERE slug='new-york-state')
  WHERE slug IN ('orange-county-ny','queens-ny','new-york-city');
UPDATE regions SET parent_id = (SELECT id FROM regions WHERE slug='orange-county-ny')
  WHERE slug = 'middletown-ny';
UPDATE regions SET parent_id = (SELECT id FROM regions WHERE slug='queens-ny')
  WHERE slug IN ('flushing-ny', 'elmhurst-ny', 'corona-ny', 'long-island-city-ny', 'forest-hills-ny');
UPDATE regions SET parent_id = (SELECT id FROM regions WHERE slug='new-york-city')
  WHERE slug IN ('sunset-park-ny', 'manhattan-chinatown-ny', 'avenue-u-brooklyn-ny', 'bensonhurst-ny');


CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  name_en         TEXT NOT NULL,
  name_zh         TEXT,
  type            TEXT NOT NULL DEFAULT 'business',  -- business | article | forum | event | classified
  parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon            TEXT,          -- emoji or icon class
  color           TEXT,          -- hex color for UI
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_type ON categories(type);

-- Business categories seed
INSERT INTO categories (slug, name_en, name_zh, type, icon, sort_order) VALUES
  ('food-dining', 'Food & Dining', '餐饮美食', 'business', '🍜', 1),
  ('medical-health', 'Medical & Health', '医疗健康', 'business', '🏥', 2),
  ('legal-immigration', 'Legal & Immigration', '法律移民', 'business', '⚖️', 3),
  ('real-estate', 'Real Estate', '地产保险', 'business', '🏠', 4),
  ('education', 'Education', '教育培训', 'business', '📚', 5),
  ('home-renovation', 'Home & Renovation', '装修家居', 'business', '🔧', 6),
  ('auto', 'Auto Services', '汽车服务', 'business', '🚗', 7),
  ('finance-tax', 'Finance & Tax', '财税服务', 'business', '💼', 8),
  ('beauty-wellness', 'Beauty & Wellness', '美容保健', 'business', '💆', 9),
  ('other-services', 'Other Services', '其他服务', 'business', '🛍️', 10);

-- Guide categories seed
INSERT INTO categories (slug, name_en, name_zh, type, icon, sort_order) VALUES
  ('guide-new-immigrant', 'New Immigrant Guide', '新移民与安家', 'article', '🌏', 1),
  ('guide-medical', 'Medical & Health', '医疗与健康', 'article', '🏥', 2),
  ('guide-education', 'Education & Schools', '教育与学区', 'article', '🏫', 3),
  ('guide-housing', 'Housing & Moving', '租房买房搬家', 'article', '🏠', 4),
  ('guide-tax-business', 'Tax & Small Business', '报税创业小商业', 'article', '💼', 5),
  ('guide-dmv-transport', 'DMV & Transportation', '驾照交通停车', 'article', '🚗', 6),
  ('guide-family', 'Family & Kids', '家庭生活儿童', 'article', '👨‍👩‍👧', 7),
  ('guide-food-weekend', 'Food & Weekend Life', '餐饮购物周末', 'article', '🍜', 8),
  ('guide-legal-docs', 'Legal & Documents', '法律证件办事', 'article', '⚖️', 9),
  ('guide-chinese-resources', 'Chinese Community Resources', '华人实用服务导航', 'article', '🗺️', 10),
  -- English station categories
  ('guide-new-in-town', 'New in Town', 'New in Town', 'article', '🆕', 11),
  ('guide-government-howto', 'Government & How-To', 'Government & How-To', 'article', '🏛️', 12),
  ('guide-best-of', 'Best of Local', 'Best of Local', 'article', '🏆', 13);

-- Forum board categories seed
INSERT INTO categories (slug, name_en, name_zh, type, icon, sort_order) VALUES
  ('forum-housing', 'Housing', '租房买房', 'forum', '🏠', 1),
  ('forum-jobs', 'Jobs & Careers', '求职招聘', 'forum', '💼', 2),
  ('forum-secondhand', 'Buy & Sell', '二手买卖', 'forum', '🛒', 3),
  ('forum-food', 'Food & Restaurants', '美食推荐', 'forum', '🍜', 4),
  ('forum-medical', 'Medical Experiences', '就医经验', 'forum', '🏥', 5),
  ('forum-education', 'Education & Schools', '教育学区', 'forum', '📚', 6),
  ('forum-legal', 'Legal & Immigration Q&A', '法律移民问答', 'forum', '⚖️', 7),
  ('forum-dmv', 'DMV & Traffic', '驾照交通', 'forum', '🚗', 8),
  ('forum-finance', 'Finance & Credit Cards', '理财信用卡', 'forum', '💳', 9),
  ('forum-expose', 'Community Watch', '曝光台', 'forum', '🔍', 10),
  ('forum-news', 'News Discussion', '新闻讨论', 'forum', '📰', 11),
  ('forum-events', 'Events & Groups', '活动拼团', 'forum', '🎪', 12);


-- ============================================================
-- SECTION 3: USERS & PROFILES
-- ============================================================

-- profiles: extends Supabase auth.users
CREATE TABLE profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username                  TEXT UNIQUE,
  display_name              TEXT NOT NULL DEFAULT '',
  avatar_url                TEXT,
  cover_image_url           TEXT,
  bio                       TEXT,
  bio_zh                    TEXT,
  bio_en                    TEXT,
  location_text             TEXT,
  region_id                 UUID REFERENCES regions(id),
  profile_type              profile_type DEFAULT 'user',
  headline                  TEXT,                     -- short tagline (e.g. "地产专家 | 法拉盛达人")
  primary_language          content_lang DEFAULT 'zh',
  secondary_languages       TEXT[],
  -- Voice / Creator fields
  is_verified               BOOLEAN DEFAULT FALSE,
  is_featured               BOOLEAN DEFAULT FALSE,
  verified_at               TIMESTAMPTZ,
  verified_type             TEXT,                     -- 'expert' | 'creator' | 'professional'
  allow_follow              BOOLEAN DEFAULT TRUE,
  allow_comments            BOOLEAN DEFAULT TRUE,
  allow_messages            BOOLEAN DEFAULT FALSE,
  visibility                visibility_type DEFAULT 'public',
  -- Counters (denormalized for performance)
  follower_count            INT DEFAULT 0,
  following_count           INT DEFAULT 0,
  post_count                INT DEFAULT 0,
  blog_count                INT DEFAULT 0,
  forum_contribution_count  INT DEFAULT 0,
  -- Preferences
  preferred_region_id       UUID REFERENCES regions(id),
  notification_prefs        JSONB DEFAULT '{"email_new_follower":true,"email_new_comment":true,"push_enabled":false}'::JSONB,
  onboarding_completed      BOOLEAN DEFAULT FALSE,
  interest_tags             TEXT[],                   -- set during onboarding
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_type ON profiles(profile_type);
CREATE INDEX idx_profiles_region ON profiles(region_id);
CREATE INDEX idx_profiles_featured ON profiles(is_featured) WHERE is_featured = TRUE;

-- Profile tags (topics/roles for discovery)
CREATE TABLE profile_tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  tag_type    TEXT DEFAULT 'topic',  -- topic | role | industry | audience
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, tag)
);

CREATE INDEX idx_profile_tags_profile ON profile_tags(profile_id);
CREATE INDEX idx_profile_tags_tag ON profile_tags(tag);

-- Follow relationships
CREATE TABLE follows (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_user_id, followed_profile_id),
  CHECK (follower_user_id != followed_profile_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_user_id);
CREATE INDEX idx_follows_followed ON follows(followed_profile_id);


-- ============================================================
-- SECTION 4: NEWS & LIVING GUIDES (articles table)
-- ============================================================

-- Content sources registry
CREATE TABLE content_sources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  source_type      source_type NOT NULL,
  base_url         TEXT,
  rss_url          TEXT,
  region_id        UUID REFERENCES regions(id),
  trust_level      SMALLINT DEFAULT 3 CHECK (trust_level BETWEEN 1 AND 5),
  language         content_lang DEFAULT 'en',
  fetch_frequency  TEXT DEFAULT 'daily',    -- hourly | daily | weekly | manual
  is_active        BOOLEAN DEFAULT TRUE,
  last_fetched_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial sources
INSERT INTO content_sources (name, source_type, base_url, trust_level, language, fetch_frequency) VALUES
  ('City of Middletown Official', 'official_gov', 'https://www.middletown-ny.gov', 5, 'en', 'daily'),
  ('Orange County Government', 'official_gov', 'https://www.orangecountygov.com', 5, 'en', 'daily'),
  ('NYC Government', 'official_gov', 'https://www.nyc.gov', 5, 'en', 'hourly'),
  ('Times Herald-Record', 'media', 'https://www.recordonline.com', 4, 'en', 'daily'),
  ('NYDMV Official', 'official_gov', 'https://dmv.ny.gov', 5, 'en', 'weekly');

-- Main articles table (serves both News and Living Guides)
CREATE TABLE articles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  TEXT UNIQUE NOT NULL,
  -- Categorization
  content_vertical      content_vertical NOT NULL,
  category_id           UUID REFERENCES categories(id),
  region_id             UUID REFERENCES regions(id),
  -- Bilingual content
  title_en              TEXT,
  title_zh              TEXT,
  summary_en            TEXT,         -- hand-written or AI-generated short summary
  summary_zh            TEXT,
  body_en               TEXT,         -- full markdown body
  body_zh               TEXT,
  cover_image_url       TEXT,
  -- Authorship & source
  author_id             UUID REFERENCES profiles(id),
  source_id             UUID REFERENCES content_sources(id),
  source_name           TEXT,
  source_url            TEXT,
  source_type           source_type,
  -- Editorial workflow
  editorial_status      editorial_status DEFAULT 'draft',
  fact_check_status     TEXT DEFAULT 'not_required',  -- pending|verified|partially_verified|not_required
  trust_score           DECIMAL(3,2) DEFAULT 0.80,
  -- Audience
  audience_types        TEXT[],   -- immigrant|family|business_owner|seniors|students|general
  -- Timing
  published_at          TIMESTAMPTZ,
  effective_date        DATE,       -- when does this policy/rule take effect
  expires_at            TIMESTAMPTZ,  -- seasonal/event-related content
  last_reviewed_at      TIMESTAMPTZ,
  -- SEO
  seo_title_en          TEXT,
  seo_title_zh          TEXT,
  seo_desc_en           TEXT,
  seo_desc_zh           TEXT,
  -- AI-generated fields
  ai_summary_en         TEXT,      -- 3-sentence AI summary EN
  ai_summary_zh         TEXT,      -- 3-sentence AI summary ZH
  ai_key_facts          JSONB,     -- {who_affected, when, where, action_required}
  ai_faq                JSONB,     -- [{q, a}, ...]
  ai_checklist          JSONB,     -- [{step, description}, ...] for checklist guides
  ai_compare_table      JSONB,     -- [{name, col1, col2, ...}] for comparison guides
  ai_tags               TEXT[],    -- auto-extracted topic tags
  ai_quality_score      DECIMAL(3,2),
  -- Cross-module links (AI-matched)
  related_business_ids  UUID[],
  related_event_ids     UUID[],
  related_thread_ids    UUID[],
  related_voice_ids     UUID[],
  -- Counters
  view_count            INT DEFAULT 0,
  share_count           INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_vertical ON articles(content_vertical);
CREATE INDEX idx_articles_region ON articles(region_id);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_status ON articles(editorial_status);
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE editorial_status = 'published';
CREATE INDEX idx_articles_expires ON articles(expires_at) WHERE expires_at IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_articles_fts_en ON articles USING GIN(to_tsvector('english', COALESCE(title_en,'') || ' ' || COALESCE(summary_en,'')));
CREATE INDEX idx_articles_fts_zh ON articles USING GIN(to_tsvector('simple', COALESCE(title_zh,'') || ' ' || COALESCE(summary_zh,'')));

-- Content update history
CREATE TABLE content_updates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id   UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  update_type  TEXT NOT NULL,  -- ai_refresh|human_edit|source_update|fact_check
  summary      TEXT,
  performed_by UUID REFERENCES profiles(id),
  trigger_event TEXT,          -- related_news_published|forum_hotpost|scheduled_review
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_updates_article ON content_updates(article_id);

-- Vector embeddings for semantic search (articles)
CREATE TABLE article_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  embedding   VECTOR(1536),   -- OpenAI/Claude embedding dimension
  language    content_lang DEFAULT 'en',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_article_embeddings_vec ON article_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ============================================================
-- SECTION 5: BUSINESSES
-- ============================================================

CREATE TABLE businesses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                 TEXT UNIQUE NOT NULL,
  display_name         TEXT NOT NULL,
  display_name_zh      TEXT,
  legal_name           TEXT,
  short_desc_en        TEXT,
  short_desc_zh        TEXT,
  full_desc_en         TEXT,
  full_desc_zh         TEXT,
  -- Contact
  phone                TEXT,
  email                TEXT,
  website_url          TEXT,
  wechat_id            TEXT,
  -- Status
  status               business_status DEFAULT 'unclaimed',
  verification_status  verification_status DEFAULT 'unverified',
  claimed_by_user_id   UUID REFERENCES profiles(id),
  claimed_at           TIMESTAMPTZ,
  -- Subscription
  current_plan         plan_type DEFAULT 'free',
  plan_expires_at      TIMESTAMPTZ,
  -- AI fields
  ai_profile_score     DECIMAL(3,2) DEFAULT 0,    -- 0-1, profile completeness
  ai_trust_score       DECIMAL(3,2) DEFAULT 0.5,  -- 0-1, composite trust
  ai_listing_tier      TEXT DEFAULT 'basic',
  ai_faq               JSONB,                      -- [{q,a},...] AI or manually set
  ai_tags              TEXT[],
  ai_summary_en        TEXT,
  ai_summary_zh        TEXT,
  -- Metrics (denormalized)
  review_count         INT DEFAULT 0,
  avg_rating           DECIMAL(3,2),
  view_count           INT DEFAULT 0,
  lead_count           INT DEFAULT 0,
  -- Languages served
  languages_served     TEXT[] DEFAULT ARRAY['en'],
  is_featured          BOOLEAN DEFAULT FALSE,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_plan ON businesses(current_plan);
CREATE INDEX idx_businesses_featured ON businesses(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_businesses_fts_en ON businesses USING GIN(to_tsvector('english', COALESCE(display_name,'') || ' ' || COALESCE(short_desc_en,'')));
CREATE INDEX idx_businesses_fts_zh ON businesses USING GIN(to_tsvector('simple', COALESCE(display_name_zh,'') || ' ' || COALESCE(short_desc_zh,'')));

-- Business locations (supports multi-location)
CREATE TABLE business_locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  region_id     UUID REFERENCES regions(id),
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  state         TEXT DEFAULT 'NY',
  zip_code      TEXT,
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  is_primary    BOOLEAN DEFAULT TRUE,
  hours_json    JSONB,   -- {mon:{open:"09:00",close:"18:00"}, ... }
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_biz_locations_business ON business_locations(business_id);
CREATE INDEX idx_biz_locations_region ON business_locations(region_id);
CREATE INDEX idx_biz_locations_geo ON business_locations(latitude, longitude);

-- Business ↔ Category
CREATE TABLE business_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  is_primary  BOOLEAN DEFAULT FALSE,
  UNIQUE(business_id, category_id)
);

CREATE INDEX idx_biz_categories_biz ON business_categories(business_id);
CREATE INDEX idx_biz_categories_cat ON business_categories(category_id);

-- Business media
CREATE TABLE business_media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_type  TEXT DEFAULT 'image',    -- image|video
  url         TEXT NOT NULL,
  caption     TEXT,
  is_cover    BOOLEAN DEFAULT FALSE,
  sort_order  SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_biz_media_business ON business_media(business_id);

-- Business reviews
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id),
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         TEXT,
  body          TEXT,
  status        moderation_status DEFAULT 'pending',
  -- AI fields
  ai_sentiment  TEXT,             -- positive|neutral|negative
  ai_highlights TEXT[],          -- extracted key points
  ai_reply_suggestion TEXT,      -- suggested owner reply
  helpful_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, author_id)   -- one review per user per business
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- Business claim requests
CREATE TABLE business_claim_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  user_id      UUID NOT NULL REFERENCES profiles(id),
  status       TEXT DEFAULT 'pending',   -- pending|approved|rejected
  notes        TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES profiles(id)
);

-- Business subscriptions
CREATE TABLE business_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  plan         plan_type NOT NULL,
  status       TEXT DEFAULT 'active',    -- active|cancelled|expired
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  stripe_sub_id TEXT,
  monthly_price DECIMAL(10,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_business ON business_subscriptions(business_id);


-- ============================================================
-- SECTION 6: EVENTS
-- ============================================================

CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  title_en        TEXT,
  title_zh        TEXT,
  summary_en      TEXT,
  summary_zh      TEXT,
  description_en  TEXT,
  description_zh  TEXT,
  cover_image_url TEXT,
  region_id       UUID REFERENCES regions(id),
  category_id     UUID REFERENCES categories(id),
  venue_name      TEXT,
  address         TEXT,
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  is_free         BOOLEAN DEFAULT TRUE,
  ticket_price    TEXT,
  ticket_url      TEXT,
  organizer_id    UUID REFERENCES profiles(id),
  organizer_name  TEXT,
  business_id     UUID REFERENCES businesses(id),
  status          TEXT DEFAULT 'published',   -- draft|published|cancelled
  is_featured     BOOLEAN DEFAULT FALSE,
  language        content_lang DEFAULT 'en',
  ai_summary_en   TEXT,
  ai_summary_zh   TEXT,
  ai_tags         TEXT[],
  view_count      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_region ON events(region_id);
CREATE INDEX idx_events_start ON events(start_at);
CREATE INDEX idx_events_status ON events(status);


-- ============================================================
-- SECTION 7: FORUM
-- ============================================================

-- Forum boards are managed via categories (type='forum')

CREATE TABLE forum_threads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug             TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  board_id         UUID NOT NULL REFERENCES categories(id),
  author_id        UUID NOT NULL REFERENCES profiles(id),
  region_id        UUID REFERENCES regions(id),
  language         content_lang DEFAULT 'zh',
  status           TEXT DEFAULT 'published',    -- published|pending|removed|locked
  is_pinned        BOOLEAN DEFAULT FALSE,
  is_featured      BOOLEAN DEFAULT FALSE,       -- editorial featured
  -- Counters
  view_count       INT DEFAULT 0,
  reply_count      INT DEFAULT 0,
  vote_count       INT DEFAULT 0,
  last_replied_at  TIMESTAMPTZ DEFAULT NOW(),
  -- AI fields
  ai_summary_zh    TEXT,
  ai_summary_en    TEXT,
  ai_tags          TEXT[],
  ai_spam_score    DECIMAL(3,2) DEFAULT 0,
  ai_intent        TEXT,      -- recommendation_request|question|complaint|review|news|discussion
  ai_merchant_ids  UUID[],    -- AI-matched business IDs for inline card injection
  ai_guide_trigger BOOLEAN DEFAULT FALSE,  -- whether this thread should trigger guide creation
  -- SEO
  seo_slug         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_board ON forum_threads(board_id);
CREATE INDEX idx_threads_author ON forum_threads(author_id);
CREATE INDEX idx_threads_region ON forum_threads(region_id);
CREATE INDEX idx_threads_status ON forum_threads(status);
CREATE INDEX idx_threads_last_replied ON forum_threads(last_replied_at DESC);
CREATE INDEX idx_threads_pinned ON forum_threads(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_threads_fts ON forum_threads USING GIN(to_tsvector('simple', title || ' ' || COALESCE(ai_summary_zh,'')));

-- Forum replies
CREATE TABLE forum_replies (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id        UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id        UUID NOT NULL REFERENCES profiles(id),
  body             TEXT NOT NULL,
  parent_reply_id  UUID REFERENCES forum_replies(id),   -- for nested replies (1 level)
  status           TEXT DEFAULT 'published',
  vote_count       INT DEFAULT 0,
  is_best_reply    BOOLEAN DEFAULT FALSE,       -- moderator marked
  ai_sentiment     TEXT,
  ai_merchant_recommendations UUID[],   -- business IDs to recommend in this reply context
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_replies_thread ON forum_replies(thread_id);
CREATE INDEX idx_replies_author ON forum_replies(author_id);
CREATE INDEX idx_replies_parent ON forum_replies(parent_reply_id);

-- Forum thread ↔ Business inline card links
CREATE TABLE forum_merchant_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id       UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id),
  link_type       TEXT DEFAULT 'ai_match',  -- mention|recommend|ai_match|paid
  is_ai_suggested BOOLEAN DEFAULT FALSE,
  is_paid         BOOLEAN DEFAULT FALSE,
  click_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, business_id)
);

CREATE INDEX idx_forum_merchant_links_thread ON forum_merchant_links(thread_id);
CREATE INDEX idx_forum_merchant_links_business ON forum_merchant_links(business_id);

-- Forum thread votes
CREATE TABLE forum_votes (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  reply_id  UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id),
  vote      SMALLINT NOT NULL CHECK (vote IN (1,-1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((thread_id IS NOT NULL) != (reply_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_forum_votes_unique_thread ON forum_votes(thread_id, user_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX idx_forum_votes_unique_reply ON forum_votes(reply_id, user_id) WHERE reply_id IS NOT NULL;


-- ============================================================
-- SECTION 8: LOCAL VOICES
-- ============================================================

-- Voice posts (blogs, short posts, recommendations, opinions)
CREATE TABLE voice_posts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type        voice_post_type NOT NULL DEFAULT 'short_post',
  title            TEXT,
  slug             TEXT UNIQUE,
  excerpt          TEXT,
  content          TEXT NOT NULL,
  content_zh       TEXT,
  content_en       TEXT,
  cover_image_url  TEXT,
  visibility       visibility_type DEFAULT 'public',
  status           TEXT DEFAULT 'published',    -- draft|published|archived
  region_id        UUID REFERENCES regions(id),
  language         content_lang DEFAULT 'zh',
  topic_tags       TEXT[],
  allow_comments   BOOLEAN DEFAULT TRUE,
  -- Counters
  like_count       INT DEFAULT 0,
  comment_count    INT DEFAULT 0,
  save_count       INT DEFAULT 0,
  share_count      INT DEFAULT 0,
  view_count       INT DEFAULT 0,
  -- AI fields
  ai_summary_en    TEXT,
  ai_summary_zh    TEXT,
  ai_tags          TEXT[],
  published_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_posts_author ON voice_posts(author_id);
CREATE INDEX idx_voice_posts_type ON voice_posts(post_type);
CREATE INDEX idx_voice_posts_status ON voice_posts(status);
CREATE INDEX idx_voice_posts_published ON voice_posts(published_at DESC);
CREATE INDEX idx_voice_posts_region ON voice_posts(region_id);

-- Voice post media
CREATE TABLE voice_post_media (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  media_type TEXT DEFAULT 'image',
  url        TEXT NOT NULL,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice post likes
CREATE TABLE voice_post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_vp_likes_post ON voice_post_likes(post_id);
CREATE INDEX idx_vp_likes_user ON voice_post_likes(user_id);

-- Voice post saves (bookmarks)
CREATE TABLE voice_post_saves (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Voice post comments
CREATE TABLE voice_post_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id           UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES profiles(id),
  parent_comment_id UUID REFERENCES voice_post_comments(id),
  content           TEXT NOT NULL,
  status            moderation_status DEFAULT 'approved',
  like_count        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vpc_post ON voice_post_comments(post_id);
CREATE INDEX idx_vpc_author ON voice_post_comments(author_id);

-- Voice recommendation lists
CREATE TABLE voice_recommendation_lists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  title_zh    TEXT,
  description TEXT,
  list_type   TEXT DEFAULT 'businesses',   -- businesses|guides|events|mixed
  visibility  visibility_type DEFAULT 'public',
  like_count  INT DEFAULT 0,
  save_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vrl_profile ON voice_recommendation_lists(profile_id);

-- Items in recommendation lists
CREATE TABLE voice_recommendation_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id      UUID NOT NULL REFERENCES voice_recommendation_lists(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,   -- business|article|event|thread|post
  entity_id    UUID NOT NULL,
  note         TEXT,            -- voice's personal note about this item
  sort_order   SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vri_list ON voice_recommendation_items(list_id);


-- ============================================================
-- SECTION 9: CROSS-MODULE LINK TABLES
-- ============================================================

-- Article (news/guide) ↔ Voice
CREATE TABLE article_voice_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id    UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relation_type voice_article_relation NOT NULL DEFAULT 'related_expert',
  priority      SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, profile_id)
);

CREATE INDEX idx_avl_article ON article_voice_links(article_id);
CREATE INDEX idx_avl_profile ON article_voice_links(profile_id);

-- Guide ↔ Business (inline recommendation in guide pages)
CREATE TABLE guide_business_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id    UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id),
  relation_type business_guide_relation NOT NULL DEFAULT 'ai_match',
  priority      SMALLINT DEFAULT 0,
  click_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, business_id)
);

CREATE INDEX idx_gbl_article ON guide_business_links(article_id);
CREATE INDEX idx_gbl_business ON guide_business_links(business_id);

-- Voice profile ↔ Business
CREATE TABLE profile_business_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id),
  relation_type voice_business_relation NOT NULL DEFAULT 'recommended',
  priority      SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, business_id)
);

CREATE INDEX idx_pbl_profile ON profile_business_links(profile_id);
CREATE INDEX idx_pbl_business ON profile_business_links(business_id);

-- Forum thread ↔ Voice (for top contributor highlighting)
CREATE TABLE thread_voice_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id     UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relation_type voice_thread_relation NOT NULL DEFAULT 'top_contributor',
  priority      SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, profile_id)
);


-- ============================================================
-- SECTION 10: CLASSIFIEDS
-- ============================================================

CREATE TABLE classifieds (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT,
  category       classified_category NOT NULL DEFAULT 'general',
  sub_category   TEXT,
  region_id      UUID REFERENCES regions(id),
  author_id      UUID NOT NULL REFERENCES profiles(id),
  contact_name   TEXT,
  contact_phone  TEXT,
  contact_email  TEXT,
  contact_wechat TEXT,
  price_text     TEXT,            -- free text: "免费"/"$500/月"/"面议"
  currency       TEXT DEFAULT 'USD',
  status         TEXT DEFAULT 'active',    -- active|expired|removed
  language       content_lang DEFAULT 'zh',
  expires_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  is_featured    BOOLEAN DEFAULT FALSE,
  view_count     INT DEFAULT 0,
  ai_spam_score  DECIMAL(3,2) DEFAULT 0,
  ai_quality_score DECIMAL(3,2) DEFAULT 0.5,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classifieds_category ON classifieds(category);
CREATE INDEX idx_classifieds_region ON classifieds(region_id);
CREATE INDEX idx_classifieds_status ON classifieds(status);
CREATE INDEX idx_classifieds_expires ON classifieds(expires_at);

CREATE TABLE classified_media (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classified_id  UUID NOT NULL REFERENCES classifieds(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  sort_order     SMALLINT DEFAULT 0
);


-- ============================================================
-- SECTION 11: LEADS (from guide/business/voice pages)
-- ============================================================

CREATE TABLE leads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID REFERENCES businesses(id),
  source_type      TEXT NOT NULL,     -- guide|business_page|voice_profile|forum|search
  source_article_id UUID REFERENCES articles(id),
  source_voice_id  UUID REFERENCES profiles(id),
  -- From anonymous or logged-in user
  user_id          UUID REFERENCES profiles(id),
  -- Contact info
  contact_name     TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,
  contact_wechat   TEXT,
  message          TEXT,
  preferred_contact TEXT DEFAULT 'phone',   -- phone|email|wechat
  -- AI processing
  ai_intent_score  DECIMAL(3,2),     -- 0-1 how likely to convert
  ai_summary       TEXT,             -- "客户想要：中文牙医咨询，偏好周末"
  ai_urgency       TEXT DEFAULT 'normal',   -- urgent|normal|low
  -- Status
  status           lead_status DEFAULT 'new',
  region_id        UUID REFERENCES regions(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_business ON leads(business_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);


-- ============================================================
-- SECTION 12: AI JOBS QUEUE
-- ============================================================

CREATE TABLE ai_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type      TEXT NOT NULL,    -- summarize|translate|tag|generate_faq|spam_check|merchant_match|generate_profile
  entity_type   TEXT,             -- article|thread|business|voice_post|review
  entity_id     UUID,
  content_vertical content_vertical,
  input_data    JSONB,
  output_data   JSONB,
  status        TEXT DEFAULT 'pending',   -- pending|processing|completed|failed|skipped
  model_name    TEXT DEFAULT 'claude-haiku-4-5-20251001',
  input_tokens  INT,
  output_tokens INT,
  cost_usd      DECIMAL(8,6),
  error_message TEXT,
  retry_count   SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_jobs_type ON ai_jobs(job_type);
CREATE INDEX idx_ai_jobs_entity ON ai_jobs(entity_type, entity_id);
CREATE INDEX idx_ai_jobs_pending ON ai_jobs(created_at) WHERE status = 'pending';


-- ============================================================
-- SECTION 13: SEARCH & ANALYTICS
-- ============================================================

CREATE TABLE search_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES profiles(id),
  session_id            TEXT,
  query                 TEXT NOT NULL,
  query_language        content_lang DEFAULT 'zh',
  region_id             UUID REFERENCES regions(id),
  result_count          INT DEFAULT 0,
  result_types          TEXT[],    -- which modules had results
  clicked_entity_type   TEXT,
  clicked_entity_id     UUID,
  clicked_position      SMALLINT,
  ai_intent             TEXT,      -- interpreted search intent
  response_time_ms      INT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_query ON search_logs USING GIN(to_tsvector('simple', query));
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);

-- User favorites (cross-module bookmarks)
CREATE TABLE favorites (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,    -- business|article|event|thread|voice_post
  entity_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- Newsletter subscribers
CREATE TABLE newsletter_subscribers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  region_id   UUID REFERENCES regions(id),
  language    content_lang DEFAULT 'zh',
  status      TEXT DEFAULT 'active',   -- active|unsubscribed
  source      TEXT DEFAULT 'footer',   -- footer|popup|article|guide
  user_id     UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, region_id)
);

-- Sponsor slots & bookings
CREATE TABLE sponsor_slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_name    TEXT NOT NULL,
  slot_type    sponsor_type NOT NULL,
  region_id    UUID REFERENCES regions(id),
  category_id  UUID REFERENCES categories(id),
  page_type    TEXT,              -- homepage|news_list|guide_detail|forum_board|etc
  max_sponsors SMALLINT DEFAULT 1,
  monthly_price DECIMAL(10,2),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sponsor_bookings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  slot_id     UUID NOT NULL REFERENCES sponsor_slots(id),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  price       DECIMAL(10,2),
  status      TEXT DEFAULT 'active',   -- active|expired|cancelled
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sponsor_bookings_slot ON sponsor_bookings(slot_id);
CREATE INDEX idx_sponsor_bookings_dates ON sponsor_bookings(starts_at, ends_at);


-- ============================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, self-write
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Follows: public read, auth write
CREATE POLICY "follows_public_read" ON follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_auth_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_user_id);
CREATE POLICY "follows_auth_delete" ON follows FOR DELETE USING (auth.uid() = follower_user_id);

-- Voice posts: public for published, auth for own
CREATE POLICY "voice_posts_public_read" ON voice_posts FOR SELECT
  USING (status = 'published' AND visibility = 'public');
CREATE POLICY "voice_posts_self_manage" ON voice_posts FOR ALL
  USING (auth.uid() = author_id);

-- Likes/saves: auth required
CREATE POLICY "likes_auth" ON voice_post_likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "saves_auth" ON voice_post_saves FOR ALL USING (auth.uid() = user_id);

-- Comments: public read, auth write
CREATE POLICY "comments_public_read" ON voice_post_comments FOR SELECT USING (status = 'approved');
CREATE POLICY "comments_auth_insert" ON voice_post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_self_update" ON voice_post_comments FOR UPDATE USING (auth.uid() = author_id);

-- Leads: only business owner can read their leads
CREATE POLICY "leads_business_read" ON leads FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE claimed_by_user_id = auth.uid()));
CREATE POLICY "leads_public_insert" ON leads FOR INSERT WITH CHECK (TRUE);

-- Favorites: user's own only
CREATE POLICY "favorites_own" ON favorites FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- SECTION 15: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_voice_posts_updated BEFORE UPDATE ON voice_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Sync follower_count / following_count
CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.followed_profile_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.followed_profile_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follow_counts AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();

-- Sync voice post like_count
CREATE OR REPLACE FUNCTION sync_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE voice_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE voice_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_like_count AFTER INSERT OR DELETE ON voice_post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_like_count();

-- Sync forum reply count & last_replied_at
CREATE OR REPLACE FUNCTION sync_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_threads
      SET reply_count = reply_count + 1, last_replied_at = NOW()
      WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.thread_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_thread_reply_count AFTER INSERT OR DELETE ON forum_replies
  FOR EACH ROW EXECUTE FUNCTION sync_thread_reply_count();

-- Sync business review count & avg rating (skip when google_place_id set — Places totals stay authoritative)
CREATE OR REPLACE FUNCTION sync_business_reviews()
RETURNS TRIGGER AS $$
DECLARE
  bid uuid := COALESCE(NEW.business_id, OLD.business_id);
  has_google boolean;
BEGIN
  SELECT (google_place_id IS NOT NULL AND btrim(google_place_id) <> '')
  INTO has_google
  FROM businesses
  WHERE id = bid;

  IF has_google THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE businesses
  SET
    review_count = (
      SELECT COUNT(*)::int
      FROM reviews
      WHERE business_id = bid
        AND status = 'approved'
    ),
    avg_rating = (
      SELECT AVG(rating)::numeric(3, 2)
      FROM reviews
      WHERE business_id = bid
        AND status = 'approved'
    )
  WHERE id = bid;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_business_reviews AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION sync_business_reviews();

-- Queue AI jobs automatically for new articles/threads/businesses
CREATE OR REPLACE FUNCTION queue_ai_job()
RETURNS TRIGGER AS $$
DECLARE v_job_type TEXT;
BEGIN
  IF TG_TABLE_NAME = 'articles' THEN
    v_job_type := 'summarize_translate';
  ELSIF TG_TABLE_NAME = 'forum_threads' THEN
    v_job_type := 'thread_process';
  ELSIF TG_TABLE_NAME = 'businesses' THEN
    v_job_type := 'generate_profile';
  ELSIF TG_TABLE_NAME = 'reviews' THEN
    v_job_type := 'review_sentiment';
  END IF;
  INSERT INTO ai_jobs (job_type, entity_type, entity_id, status)
  VALUES (v_job_type, TG_TABLE_NAME, NEW.id, 'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_queue_article_ai AFTER INSERT ON articles
  FOR EACH ROW WHEN (NEW.editorial_status IN ('draft','ai_drafted'))
  EXECUTE FUNCTION queue_ai_job();

CREATE TRIGGER trg_queue_thread_ai AFTER INSERT ON forum_threads
  FOR EACH ROW EXECUTE FUNCTION queue_ai_job();

CREATE TRIGGER trg_queue_business_ai AFTER INSERT ON businesses
  FOR EACH ROW WHEN (NEW.status = 'claimed')
  EXECUTE FUNCTION queue_ai_job();

CREATE TRIGGER trg_queue_review_ai AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION queue_ai_job();


-- ============================================================
-- SECTION 16: USEFUL VIEWS
-- ============================================================

-- Published articles with region info
CREATE VIEW v_published_articles AS
  SELECT a.*, r.name_en AS region_name_en, r.name_zh AS region_name_zh,
    c.name_en AS category_name_en, c.name_zh AS category_name_zh
  FROM articles a
  LEFT JOIN regions r ON a.region_id = r.id
  LEFT JOIN categories c ON a.category_id = c.id
  WHERE a.editorial_status = 'published'
    AND (a.expires_at IS NULL OR a.expires_at > NOW());

-- Active businesses with primary location
CREATE VIEW v_businesses_with_location AS
  SELECT b.*,
    l.latitude, l.longitude, l.city, l.state, l.zip_code, l.address_line1, l.hours_json,
    r.name_en AS region_name_en, r.name_zh AS region_name_zh
  FROM businesses b
  LEFT JOIN business_locations l ON b.id = l.business_id AND l.is_primary = TRUE
  LEFT JOIN regions r ON l.region_id = r.id
  WHERE b.is_active = TRUE AND b.status = 'active';

-- Hot forum threads (for homepage)
CREATE VIEW v_hot_threads AS
  SELECT t.*,
    p.display_name AS author_name, p.avatar_url AS author_avatar,
    c.name_en AS board_name_en, c.name_zh AS board_name_zh
  FROM forum_threads t
  JOIN profiles p ON t.author_id = p.id
  JOIN categories c ON t.board_id = c.id
  WHERE t.status = 'published'
  ORDER BY (t.reply_count * 2 + t.view_count * 0.5 + t.vote_count * 3) DESC,
           t.last_replied_at DESC;

-- Featured voices with recent post
CREATE VIEW v_featured_voices AS
  SELECT p.*,
    r.name_en AS region_name_en, r.name_zh AS region_name_zh,
    (SELECT vp.title FROM voice_posts vp
     WHERE vp.author_id = p.id AND vp.status = 'published'
     ORDER BY vp.published_at DESC LIMIT 1) AS latest_post_title,
    (SELECT vp.published_at FROM voice_posts vp
     WHERE vp.author_id = p.id AND vp.status = 'published'
     ORDER BY vp.published_at DESC LIMIT 1) AS latest_post_at
  FROM profiles p
  LEFT JOIN regions r ON p.preferred_region_id = r.id
  WHERE p.profile_type IN ('creator','expert','professional','community_leader','business_owner')
    AND p.is_featured = TRUE;


-- ============================================================
-- SECTION 17: ADMIN HELPER FUNCTIONS
-- ============================================================

-- Get following feed for a user (paginated)
CREATE OR REPLACE FUNCTION get_following_feed(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  post_id UUID, author_id UUID, author_name TEXT, author_avatar TEXT,
  post_type voice_post_type, title TEXT, excerpt TEXT, cover_image_url TEXT,
  like_count INT, comment_count INT, published_at TIMESTAMPTZ,
  feed_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.id, vp.author_id, pr.display_name, pr.avatar_url,
    vp.post_type, vp.title, vp.excerpt, vp.cover_image_url,
    vp.like_count, vp.comment_count, vp.published_at,
    (
      -- freshness (0-1 over 7 days)
      GREATEST(0, 1 - EXTRACT(EPOCH FROM (NOW() - vp.published_at)) / 604800.0) * 0.40
      -- engagement
      + LEAST(1, (vp.like_count + vp.comment_count * 2)::FLOAT / 50) * 0.30
      -- recency bonus for very new posts
      + CASE WHEN vp.published_at > NOW() - INTERVAL '6 hours' THEN 0.30 ELSE 0 END
    ) AS feed_score
  FROM follows f
  JOIN voice_posts vp ON vp.author_id = f.followed_profile_id
  JOIN profiles pr ON pr.id = vp.author_id
  WHERE f.follower_user_id = p_user_id
    AND vp.status = 'published'
    AND vp.visibility = 'public'
  ORDER BY feed_score DESC, vp.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full-text + vector hybrid search (basic version, enhance with pgvector in Phase 2)
CREATE OR REPLACE FUNCTION search_all(
  p_query TEXT,
  p_region_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (entity_type TEXT, entity_id UUID, title TEXT, summary TEXT, score FLOAT) AS $$
BEGIN
  RETURN QUERY
  -- Search articles
  SELECT 'article'::TEXT, a.id,
    COALESCE(a.title_en, a.title_zh),
    COALESCE(a.ai_summary_en, a.summary_en),
    ts_rank(to_tsvector('english', COALESCE(a.title_en,'')||' '||COALESCE(a.summary_en,'')),
            plainto_tsquery('english', p_query))::FLOAT
  FROM articles a
  WHERE a.editorial_status = 'published'
    AND (p_region_id IS NULL OR a.region_id = p_region_id)
    AND to_tsvector('english', COALESCE(a.title_en,'')||' '||COALESCE(a.summary_en,''))
        @@ plainto_tsquery('english', p_query)
  UNION ALL
  -- Search businesses
  SELECT 'business'::TEXT, b.id,
    b.display_name,
    COALESCE(b.ai_summary_en, b.short_desc_en),
    ts_rank(to_tsvector('english', COALESCE(b.display_name,'')||' '||COALESCE(b.short_desc_en,'')),
            plainto_tsquery('english', p_query))::FLOAT
  FROM businesses b
  WHERE b.is_active = TRUE AND b.status = 'active'
    AND to_tsvector('english', COALESCE(b.display_name,'')||' '||COALESCE(b.short_desc_en,''))
        @@ plainto_tsquery('english', p_query)
  UNION ALL
  -- Search forum threads
  SELECT 'thread'::TEXT, t.id,
    t.title,
    t.ai_summary_en,
    ts_rank(to_tsvector('simple', t.title), plainto_tsquery('simple', p_query))::FLOAT
  FROM forum_threads t
  WHERE t.status = 'published'
    AND (p_region_id IS NULL OR t.region_id = p_region_id)
    AND to_tsvector('simple', t.title) @@ plainto_tsquery('simple', p_query)
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- DONE — Schema created successfully
-- Total tables: 36  |  Views: 4  |  Functions: 8  |  Triggers: 12
-- ============================================================
