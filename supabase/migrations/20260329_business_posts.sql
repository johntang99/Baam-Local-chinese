-- Business Posts: FB-style link cards and updates for business detail pages
-- Used by business owners and admins to share articles, promotions, and updates

CREATE TABLE IF NOT EXISTS business_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  post_type   TEXT NOT NULL DEFAULT 'link',  -- 'link' | 'text' | 'video' | 'promotion'
  title       TEXT,                           -- Post title / headline
  body        TEXT,                           -- Post text content (short, like FB status)
  link_url    TEXT,                           -- External URL (article, website page)
  link_title  TEXT,                           -- OG title from link preview
  link_desc   TEXT,                           -- OG description from link preview
  link_image  TEXT,                           -- OG image URL from link preview
  link_domain TEXT,                           -- Display domain (e.g., "acupunctureflushing.com")
  video_url   TEXT,                           -- YouTube or other video embed URL
  image_url   TEXT,                           -- Uploaded image for the post
  is_pinned   BOOLEAN DEFAULT FALSE,          -- Pin to top of business feed
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES profiles(id),   -- Admin or business owner who created
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bp_business ON business_posts(business_id);
CREATE INDEX idx_bp_created ON business_posts(created_at DESC);

-- RLS: public can read active posts, authenticated can create for their businesses
ALTER TABLE business_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active business posts" ON business_posts
  FOR SELECT USING (is_active = true);
