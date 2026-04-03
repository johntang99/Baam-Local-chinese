-- P0/P1 NYC Chinese business corridors (v1 geographic expansion)
-- P0: Avenue U (Brooklyn), Corona (Queens)
-- P1: Bensonhurst (Brooklyn), Long Island City (Queens), Forest Hills / Rego belt (Queens)

-- ─── Brooklyn → parent: new-york-city ───────────────────────────

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'avenue-u-brooklyn-ny',
  'Avenue U / Homecrest (Brooklyn)',
  '布鲁克林U大道',
  'neighborhood',
  'America/New_York',
  40.5950,
  -73.9650,
  (SELECT id FROM regions WHERE slug = 'new-york-city' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'avenue-u-brooklyn-ny');

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'bensonhurst-ny',
  'Bensonhurst, Brooklyn',
  '本森赫斯特',
  'neighborhood',
  'America/New_York',
  40.6080,
  -73.9970,
  (SELECT id FROM regions WHERE slug = 'new-york-city' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'bensonhurst-ny');

-- ─── Queens → parent: queens-ny ───────────────────────────────────

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'corona-ny',
  'Corona, Queens',
  '可乐娜',
  'neighborhood',
  'America/New_York',
  40.7490,
  -73.8700,
  (SELECT id FROM regions WHERE slug = 'queens-ny' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'corona-ny');

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'long-island-city-ny',
  'Long Island City, Queens',
  '长岛市',
  'neighborhood',
  'America/New_York',
  40.7447,
  -73.9485,
  (SELECT id FROM regions WHERE slug = 'queens-ny' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'long-island-city-ny');

INSERT INTO regions (slug, name_en, name_zh, type, timezone, latitude, longitude, parent_id)
SELECT
  'forest-hills-ny',
  'Forest Hills & Rego Park, Queens',
  '森林小丘',
  'neighborhood',
  'America/New_York',
  40.7210,
  -73.8440,
  (SELECT id FROM regions WHERE slug = 'queens-ny' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE slug = 'forest-hills-ny');
