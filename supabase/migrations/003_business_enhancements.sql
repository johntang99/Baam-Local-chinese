-- ============================================================
-- BUSINESS ENHANCEMENTS
-- 1. Hierarchical categories (parent/child already exists via parent_id)
-- 2. Enhanced business fields: social media, video, multiple categories
-- 3. Run in Supabase SQL Editor
-- ============================================================

-- Add social media and enhanced fields to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address_full TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'NY';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);

-- Seed subcategories for Medical
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('medical-chinese-medicine', 'Chinese Medicine', '中医', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '🏥', 1),
('medical-dental', 'Dental', '牙科', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '🦷', 2),
('medical-internal', 'Internal Medicine', '内科', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '🩺', 3),
('medical-primary-care', 'Primary Care', '家庭医生', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '👨‍⚕️', 4),
('medical-pediatrics', 'Pediatrics', '儿科', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '👶', 5),
('medical-mental-health', 'Mental Health', '心理健康', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '🧠', 6),
('medical-optometry', 'Optometry', '眼科', 'business', (SELECT id FROM categories WHERE slug='medical-health'), '👁️', 7)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Food & Dining
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('food-chinese', 'Chinese Restaurant', '中餐', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🥡', 1),
('food-japanese', 'Japanese', '日料', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🍣', 2),
('food-korean', 'Korean', '韩餐', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🍲', 3),
('food-bakery', 'Bakery & Dessert', '烘焙甜品', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🍰', 4),
('food-hotpot', 'Hot Pot & BBQ', '火锅烧烤', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🍲', 5),
('food-bubble-tea', 'Bubble Tea', '奶茶', 'business', (SELECT id FROM categories WHERE slug='food-dining'), '🧋', 6)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Legal
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('legal-immigration', 'Immigration Law', '移民法', 'business', (SELECT id FROM categories WHERE slug='legal-immigration'), '🛂', 1),
('legal-business-law', 'Business Law', '商业法', 'business', (SELECT id FROM categories WHERE slug='legal-immigration'), '📋', 2),
('legal-real-estate', 'Real Estate Law', '房产法', 'business', (SELECT id FROM categories WHERE slug='legal-immigration'), '🏠', 3),
('legal-family', 'Family Law', '家庭法', 'business', (SELECT id FROM categories WHERE slug='legal-immigration'), '👨‍👩‍👧', 4)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Education
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('edu-tutoring', 'Tutoring', '课后辅导', 'business', (SELECT id FROM categories WHERE slug='education'), '📖', 1),
('edu-test-prep', 'Test Prep', '考试培训', 'business', (SELECT id FROM categories WHERE slug='education'), '📝', 2),
('edu-music-art', 'Music & Art', '音乐美术', 'business', (SELECT id FROM categories WHERE slug='education'), '🎨', 3),
('edu-language', 'Language School', '语言学校', 'business', (SELECT id FROM categories WHERE slug='education'), '🗣️', 4),
('edu-daycare', 'Daycare', '托管', 'business', (SELECT id FROM categories WHERE slug='education'), '👶', 5)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Finance & Tax
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('finance-tax-prep', 'Tax Preparation', '报税服务', 'business', (SELECT id FROM categories WHERE slug='finance-tax'), '📊', 1),
('finance-accounting', 'Accounting', '会计服务', 'business', (SELECT id FROM categories WHERE slug='finance-tax'), '💰', 2),
('finance-insurance', 'Insurance', '保险', 'business', (SELECT id FROM categories WHERE slug='finance-tax'), '🛡️', 3),
('finance-mortgage', 'Mortgage', '贷款', 'business', (SELECT id FROM categories WHERE slug='finance-tax'), '🏦', 4)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Real Estate
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('realestate-agent', 'Real Estate Agent', '地产经纪', 'business', (SELECT id FROM categories WHERE slug='real-estate'), '🏠', 1),
('realestate-property-mgmt', 'Property Management', '物业管理', 'business', (SELECT id FROM categories WHERE slug='real-estate'), '🏢', 2),
('realestate-home-inspection', 'Home Inspection', '验房', 'business', (SELECT id FROM categories WHERE slug='real-estate'), '🔍', 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories for Home & Renovation
INSERT INTO categories (slug, name_en, name_zh, type, parent_id, icon, sort_order) VALUES
('home-renovation', 'General Renovation', '综合装修', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '🔨', 1),
('home-plumbing', 'Plumbing', '水管', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '🚿', 2),
('home-electrical', 'Electrical', '电工', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '⚡', 3),
('home-painting', 'Painting', '油漆', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '🎨', 4),
('home-cleaning', 'Cleaning', '清洁', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '🧹', 5),
('home-moving', 'Moving', '搬家', 'business', (SELECT id FROM categories WHERE slug='home-renovation'), '🚚', 6)
ON CONFLICT (slug) DO NOTHING;
