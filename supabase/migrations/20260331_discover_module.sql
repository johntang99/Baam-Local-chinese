-- Discover Module: Schema changes for xiaohongshu-style content discovery
-- Date: 2026-03-31

-- 1. Add new post types to voice_post_type enum
ALTER TYPE voice_post_type ADD VALUE IF NOT EXISTS 'note';
ALTER TYPE voice_post_type ADD VALUE IF NOT EXISTS 'video';

-- 2. Add new columns to voice_posts
ALTER TABLE voice_posts
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_duration_seconds SMALLINT,
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '4:3',
  ADD COLUMN IF NOT EXISTS cover_images TEXT[],
  ADD COLUMN IF NOT EXISTS location_text TEXT;

-- 3. Create discover_topics table
CREATE TABLE IF NOT EXISTS discover_topics (
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

-- 4. Create discover_post_topics (M2M: posts ↔ topics)
CREATE TABLE IF NOT EXISTS discover_post_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES discover_topics(id) ON DELETE CASCADE,
  UNIQUE(post_id, topic_id)
);

-- 5. Create discover_post_businesses (posts → businesses)
CREATE TABLE IF NOT EXISTS discover_post_businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES voice_posts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  relation_note TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_discover_topics_trending ON discover_topics(is_trending) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_discover_topics_featured ON discover_topics(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_discover_post_topics_post ON discover_post_topics(post_id);
CREATE INDEX IF NOT EXISTS idx_discover_post_topics_topic ON discover_post_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_discover_post_businesses_post ON discover_post_businesses(post_id);
CREATE INDEX IF NOT EXISTS idx_discover_post_businesses_biz ON discover_post_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_voice_posts_post_type ON voice_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_voice_posts_cover_images ON voice_posts USING gin(cover_images) WHERE cover_images IS NOT NULL;

-- 7. Enable RLS
ALTER TABLE discover_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE discover_post_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE discover_post_businesses ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "discover_topics_public_read" ON discover_topics FOR SELECT USING (true);
CREATE POLICY "discover_post_topics_public_read" ON discover_post_topics FOR SELECT USING (true);
CREATE POLICY "discover_post_businesses_public_read" ON discover_post_businesses FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "discover_post_topics_auth_insert" ON discover_post_topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "discover_post_businesses_auth_insert" ON discover_post_businesses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Seed trending topics
INSERT INTO discover_topics (slug, name_zh, name_en, icon_emoji, is_trending, is_featured, sort_order) VALUES
  ('flushing-food',     '法拉盛美食',   'Flushing Food',          '🍜', TRUE, TRUE, 1),
  ('new-immigrant',     '新移民攻略',   'New Immigrant Guide',    '✈️', TRUE, TRUE, 2),
  ('store-visit',       '探店分享',     'Store Visits',           '📸', TRUE, TRUE, 3),
  ('flushing-rent',     '法拉盛租房',   'Flushing Rentals',       '🏠', TRUE, FALSE, 4),
  ('chinese-doctor',    '华人医生推荐', 'Chinese Doctor Picks',   '🩺', TRUE, FALSE, 5),
  ('save-money',        '省钱攻略',     'Money Saving Tips',      '💰', TRUE, FALSE, 6),
  ('weekend-spots',     '周末好去处',   'Weekend Spots',          '🎯', TRUE, TRUE, 7),
  ('flushing-reno',     '法拉盛装修',   'Flushing Renovation',    '🔨', TRUE, FALSE, 8),
  ('immigration-lawyer','移民律师',     'Immigration Lawyers',    '⚖️', TRUE, FALSE, 9),
  ('ny-school',         '纽约学区',     'NYC School Districts',   '🎓', TRUE, FALSE, 10),
  ('chinese-grocery',   '华人超市',     'Chinese Grocery',        '🛒', TRUE, FALSE, 11),
  ('postpartum',        '月子中心',     'Postpartum Care',        '👶', TRUE, FALSE, 12),
  ('drivers-license',   '驾照攻略',     'Driver''s License Guide','🚗', TRUE, FALSE, 13),
  ('tax-filing',        '报税指南',     'Tax Filing Guide',       '📋', TRUE, FALSE, 14),
  ('nail-salon',        '美甲推荐',     'Nail Salon Picks',       '💅', TRUE, FALSE, 15)
ON CONFLICT (slug) DO NOTHING;

-- 9. Updated_at trigger for discover_topics
CREATE OR REPLACE FUNCTION update_discover_topics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discover_topics_updated_at ON discover_topics;
CREATE TRIGGER trg_discover_topics_updated_at
  BEFORE UPDATE ON discover_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_discover_topics_updated_at();
