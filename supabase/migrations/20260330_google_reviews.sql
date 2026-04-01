-- Add google_place_id to businesses for linking to Google Places API
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_place_id TEXT;
CREATE INDEX IF NOT EXISTS idx_businesses_google_place_id ON businesses(google_place_id) WHERE google_place_id IS NOT NULL;

-- Add source + external fields to reviews for Google reviews
-- source: 'user' (default, our platform) or 'google' (imported from Google)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user' CHECK (source IN ('user', 'google'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS google_author_name TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS google_review_id TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS google_publish_time TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS language TEXT;

-- Make author_id nullable for Google reviews (no local user account)
ALTER TABLE reviews ALTER COLUMN author_id DROP NOT NULL;

-- Drop the unique constraint on (business_id, author_id) since Google reviews have no author_id
-- and re-add a partial unique constraint for user reviews only
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_business_id_author_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_unique ON reviews(business_id, author_id) WHERE source = 'user' AND author_id IS NOT NULL;

-- Prevent duplicate Google reviews
CREATE UNIQUE INDEX IF NOT EXISTS reviews_google_unique ON reviews(business_id, google_review_id) WHERE source = 'google' AND google_review_id IS NOT NULL;
