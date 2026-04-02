-- Business data: additional NYC Chinese-corridor regions + fix review sync for Google-backed listings
-- Google import sets review_count / avg_rating from Places; rows in `reviews` with source='google'
-- are display-only samples — they must not overwrite those aggregates via trigger.

-- ─── Regions (idempotent inserts) ─────────────────────────────────

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'sunset-park-ny',
  'Sunset Park, Brooklyn',
  '日落公园',
  'neighborhood',
  'America/New_York',
  40.6410,
  -73.9950,
  (SELECT id FROM regions WHERE slug = 'new-york-city' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'sunset-park-ny');

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'elmhurst-ny',
  'Elmhurst, Queens',
  '艾姆赫斯特',
  'neighborhood',
  'America/New_York',
  40.7370,
  -73.8800,
  (SELECT id FROM regions WHERE slug = 'queens-ny' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'elmhurst-ny');

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'manhattan-chinatown-ny',
  'Manhattan Chinatown',
  '曼哈顿华埠',
  'neighborhood',
  'America/New_York',
  40.7150,
  -73.9980,
  (SELECT id FROM regions WHERE slug = 'new-york-city' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'manhattan-chinatown-ny');

-- ─── Trigger: only recalc review aggregates for listings without Google Places ID ─────────────────

CREATE OR REPLACE FUNCTION sync_business_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  bid uuid := COALESCE(NEW.business_id, OLD.business_id);
  has_google boolean;
BEGIN
  SELECT (google_place_id IS NOT NULL AND btrim(google_place_id) <> '')
  INTO has_google
  FROM businesses
  WHERE id = bid;

  IF has_google THEN
    -- Totals come from Google Places (import / fix-review-counts.ts); skip overwrite.
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
$$;
