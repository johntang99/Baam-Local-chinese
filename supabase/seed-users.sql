-- ============================================================
-- BAAM SEED USERS
-- Run this in Supabase SQL Editor (as postgres role)
-- This creates auth users + profiles, then seeds forum/voices/reviews
-- ============================================================

-- Step 1: Create auth users directly in auth.users table
-- Using gen_random_uuid() for IDs, fixed password hash for 'BaamTest2025!'
-- Password hash for 'BaamTest2025!' using bcrypt
DO $$
DECLARE
  v_uid1 UUID; v_uid2 UUID; v_uid3 UUID; v_uid4 UUID; v_uid5 UUID;
  v_uid6 UUID; v_uid7 UUID; v_uid8 UUID; v_uid9 UUID; v_uid10 UUID;
BEGIN
  -- Create auth users (this triggers handle_new_user which creates profiles)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at, raw_user_meta_data)
  VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'xiaoli@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"新来的小李"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'foodie@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"美食猎人小王"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'drli@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"Dr. 李文华"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'kevin@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"Kevin 陈地产"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'jessica@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"纽约妈妈Jessica"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'zhanglaw@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"张明律师"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'nurse@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"护士小陈"}'::jsonb),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'teacher@baam.local', crypt('BaamTest2025!', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"full_name":"教育顾问Michelle"}'::jsonb)
  ON CONFLICT (email) DO NOTHING;

  -- Get the user IDs
  SELECT id INTO v_uid1 FROM auth.users WHERE email = 'xiaoli@baam.local';
  SELECT id INTO v_uid2 FROM auth.users WHERE email = 'foodie@baam.local';
  SELECT id INTO v_uid3 FROM auth.users WHERE email = 'drli@baam.local';
  SELECT id INTO v_uid4 FROM auth.users WHERE email = 'kevin@baam.local';
  SELECT id INTO v_uid5 FROM auth.users WHERE email = 'jessica@baam.local';
  SELECT id INTO v_uid6 FROM auth.users WHERE email = 'zhanglaw@baam.local';
  SELECT id INTO v_uid7 FROM auth.users WHERE email = 'nurse@baam.local';
  SELECT id INTO v_uid8 FROM auth.users WHERE email = 'teacher@baam.local';

  -- Step 2: Update profiles with full data
  UPDATE profiles SET username='xiaoli', display_name='新来的小李', bio='刚搬到法拉盛的新移民', profile_type='user', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny') WHERE id=v_uid1;
  UPDATE profiles SET username='foodie_wang', display_name='美食猎人小王', profile_type='creator', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny'), headline='美食达人 · 法拉盛 · 探店', bio_zh='法拉盛美食地图每周更新！从街头小吃到隐藏神店。', follower_count=1200, post_count=89, is_featured=true WHERE id=v_uid2;
  UPDATE profiles SET username='dr_li', display_name='Dr. 李文华', profile_type='expert', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny'), headline='内科专家 · 家庭医疗 · 双语达人', bio_zh='法拉盛执业内科医生，15年临床经验。', follower_count=328, post_count=42, blog_count=8, is_verified=true, is_featured=true WHERE id=v_uid3;
  UPDATE profiles SET username='kevin_chen', display_name='Kevin 陈地产', profile_type='professional', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='queens-ny'), headline='地产专家 · 法拉盛 · 10年经验', bio_zh='10年纽约地产经验，专注法拉盛及周边。', follower_count=562, post_count=35, is_verified=true, is_featured=true WHERE id=v_uid4;
  UPDATE profiles SET username='jessica_mom', display_name='纽约妈妈Jessica', profile_type='creator', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny'), headline='家庭博主 · 亲子活动 · 学区攻略', bio_zh='两个孩子的妈妈，分享学区选择和育儿经验。', follower_count=876, post_count=58, is_featured=true WHERE id=v_uid5;
  UPDATE profiles SET username='zhang_lawyer', display_name='张明律师', profile_type='professional', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny'), headline='移民律师 · 法拉盛 · 免费咨询', bio_zh='纽约州执业律师，专注移民法和商业法。', follower_count=245, post_count=18, is_verified=true WHERE id=v_uid6;
  UPDATE profiles SET username='nurse_chen', display_name='护士小陈', profile_type='expert', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='flushing-ny'), headline='注册护士 · 健康科普', bio_zh='纽约注册护士，分享日常保健知识。', follower_count=156, post_count=25 WHERE id=v_uid7;
  UPDATE profiles SET username='michelle_edu', display_name='教育顾问Michelle', profile_type='professional', primary_language='zh', region_id=(SELECT id FROM regions WHERE slug='queens-ny'), headline='教育顾问 · 学区 · 升学规划', bio_zh='10年教育咨询经验。', follower_count=312, post_count=22, is_verified=true WHERE id=v_uid8;

  -- Step 3: Forum threads
  INSERT INTO forum_threads (slug, title, body, board_id, author_id, region_id, language, status, reply_count, view_count, vote_count, ai_summary_zh, ai_tags, ai_intent, last_replied_at) VALUES
  ('flushing-sichuan-recommend', '法拉盛有没有推荐的川菜馆？最近新开的那几家如何？', '最近想吃川菜，听说法拉盛新开了几家川菜馆。有没有去过的朋友推荐一下？', (SELECT id FROM categories WHERE slug='forum-food'), v_uid1, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 5, 1234, 45, '多位用户推荐川味坊，性价比高、味道正宗。', ARRAY['川菜','法拉盛','推荐'], 'recommendation_request', NOW()-INTERVAL '2 hours'),
  ('flushing-rent-2025', '2025年法拉盛租房行情怎么样？一室一厅大概多少钱？', '刚来纽约准备找房子，想问问租房行情。', (SELECT id FROM categories WHERE slug='forum-housing'), v_uid1, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 3, 892, 32, '一室一厅$1800-2200，比去年涨10%。', ARRAY['租房','法拉盛','价格'], 'question', NOW()-INTERVAL '5 hours'),
  ('flushing-tcm-clinic', '法拉盛有没有推荐的中医诊所？最近肩颈不太舒服', '想找靠谱的中医做针灸，保险是Oscar Health。', (SELECT id FROM categories WHERE slug='forum-medical'), v_uid1, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 4, 456, 15, '推荐仁和堂和济世堂，针灸$80-120/次。', ARRAY['中医','针灸','法拉盛'], 'recommendation_request', NOW()-INTERVAL '3 hours'),
  ('queens-school-ranking', '皇后区学区排名分享，哪些学校适合华人家庭？', '孩子明年上小学，想了解学区情况。', (SELECT id FROM categories WHERE slug='forum-education'), v_uid5, (SELECT id FROM regions WHERE slug='queens-ny'), 'zh', 'published', 3, 567, 20, '26学区和25学区最推荐。', ARRAY['学区','教育','皇后区'], 'question', NOW()-INTERVAL '8 hours'),
  ('h1b-lottery-2025', 'H1B抽签结果出来了吗？有没有今年中签的分享经验？', '听说结果开始通知了。', (SELECT id FROM categories WHERE slug='forum-legal'), v_uid1, (SELECT id FROM regions WHERE slug='new-york-city'), 'zh', 'published', 2, 1890, 38, '部分用户已收到通知。', ARRAY['H1B','签证','移民'], 'discussion', NOW()-INTERVAL '1 day'),
  ('flushing-credit-card', '新移民办什么信用卡好？没有信用记录怎么办？', '刚来美国没有信用记录，第一张卡办什么好？', (SELECT id FROM categories WHERE slug='forum-finance'), v_uid1, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 4, 678, 28, '推荐Discover It Secured，无年费，$200押金。', ARRAY['信用卡','新移民'], 'question', NOW()-INTERVAL '6 hours'),
  ('flushing-road-test-tips', '刚考过路考！分享法拉盛附近路考经验', '上周在College Point考过了！分享经验。', (SELECT id FROM categories WHERE slug='forum-dmv'), v_uid2, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 6, 2345, 52, 'College Point考场经验，注意平行停车。', ARRAY['路考','驾照','法拉盛'], 'discussion', NOW()-INTERVAL '12 hours'),
  ('flushing-secondhand-furniture', '搬家清仓！沙发、书桌、床垫低价转让（法拉盛自取）', '沙发$150，书桌$80，床垫$100，自取可议价。', (SELECT id FROM categories WHERE slug='forum-secondhand'), v_uid7, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 8, 534, 12, '法拉盛搬家清仓，家具低价转让。', ARRAY['二手','家具','法拉盛'], 'discussion', NOW()-INTERVAL '4 hours'),
  ('flushing-expose-delivery', '曝光！某外卖平台收费不透明，多收了$15', '点了$35的餐实际扣了$50，各种隐藏费用。', (SELECT id FROM categories WHERE slug='forum-expose'), v_uid2, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 12, 1567, 65, '曝光外卖平台隐藏收费问题。', ARRAY['曝光','外卖','消费警告'], 'complaint', NOW()-INTERVAL '1 day'),
  ('flushing-weekend-events', '本周末法拉盛有什么好玩的？周六想带孩子出去', '这个周末想带孩子出门。', (SELECT id FROM categories WHERE slug='forum-events'), v_uid5, (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', 'published', 5, 345, 18, '推荐春季文化节和植物园亲子活动。', ARRAY['周末','亲子','活动'], 'question', NOW()-INTERVAL '10 hours')
  ON CONFLICT (slug) DO NOTHING;

  -- Step 4: Forum replies
  INSERT INTO forum_replies (thread_id, author_id, body, status, vote_count, is_best_reply) VALUES
  ((SELECT id FROM forum_threads WHERE slug='flushing-sichuan-recommend'), v_uid2, '强烈推荐川味坊！鸳鸯锅底绝了，人均$15，Main Street上很好找。', 'published', 23, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-sichuan-recommend'), v_uid5, '川渝人家也不错，带孩子去过几次。环境干净，服务好。周末需等位。', 'published', 15, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-sichuan-recommend'), v_uid3, '作为四川人推荐蜀香园，水煮鱼做得地道。辣度偏重注意。', 'published', 18, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-tcm-clinic'), v_uid3, '作为医生建议选有执照的中医诊所。仁和堂陈医生口碑不错，Oscar Health可覆盖部分针灸费用。', 'published', 35, true),
  ((SELECT id FROM forum_threads WHERE slug='flushing-tcm-clinic'), v_uid7, '我去过济世堂，针灸效果挺好。第一次做评估，之后每次45分钟，$80-100。', 'published', 12, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-rent-2025'), v_uid4, '作为地产经纪：法拉盛一室一厅$1800-2200/月，靠近7号线$2000起。推荐Murray Hill附近。', 'published', 28, false),
  ((SELECT id FROM forum_threads WHERE slug='queens-school-ranking'), v_uid8, '教育顾问分享：26学区(Bayside)评分最高，25学区(法拉盛)华人多中文资源丰富。目标好高中需考SHSAT。', 'published', 32, true),
  ((SELECT id FROM forum_threads WHERE slug='h1b-lottery-2025'), v_uid6, '移民律师分享：中签后60天内提交完整申请，准备好护照、I-94、学历认证。有问题可免费咨询。', 'published', 45, true),
  ((SELECT id FROM forum_threads WHERE slug='flushing-credit-card'), v_uid4, '推荐Discover It Secured：无年费，$200押金，第一年返现翻倍。半年后可升级。', 'published', 20, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-road-test-tips'), v_uid1, '谢谢分享！请问College Point考场难不难？平行停车空间大吗？', 'published', 5, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-expose-delivery'), v_uid5, '我也遇到过类似的！之后我都会先看总价再确认下单。大家注意了。', 'published', 8, false),
  ((SELECT id FROM forum_threads WHERE slug='flushing-weekend-events'), v_uid2, '推荐去春季文化节！市政厅广场，免费入场，有很多美食摊位。', 'published', 10, false);

  -- Step 5: Voice posts
  INSERT INTO voice_posts (author_id, post_type, title, slug, content, status, region_id, language, topic_tags, like_count, comment_count, view_count, published_at) VALUES
  (v_uid3, 'blog', '在美国看急诊你需要知道的5件事', 'er-visit-5-things', E'## 急诊 vs Urgent Care\n\n1. **去急诊**：胸痛、严重出血\n2. **去Urgent Care**：发烧、轻伤\n3. **急诊贵**：copay $150-500\n4. **UC便宜**：copay $25-75\n5. **不确定打911**', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['健康','急诊'], 89, 23, 567, NOW()-INTERVAL '2 days'),
  (v_uid3, 'blog', '如何选择适合你的健康保险计划', 'how-to-choose-insurance', E'## 保险类型\n- HMO：必须选PCP，保费低\n- PPO：可直接看专科，保费高\n- EPO：不需转介\n\n## 建议\n- 年轻人选HDHP\n- 有家庭选PPO\n- 预算有限考虑Medicaid', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['保险','医疗'], 134, 31, 890, NOW()-INTERVAL '5 days'),
  (v_uid2, 'short_post', NULL, 'foodie-malatang', '今天发现法拉盛新开了一家麻辣烫🌶️ 味道超正宗！推荐鸳鸯锅底。#法拉盛美食', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['美食','法拉盛'], 156, 34, 890, NOW()-INTERVAL '6 hours'),
  (v_uid2, 'blog', '法拉盛必吃的10家隐藏美食店（2025版）', 'flushing-hidden-gems', E'## 1. 川味坊 - 麻辣烫之王\n## 2. 金丰大酒楼 - 最佳早茶\n## 3. 麦香坊 - 中式面包\n## 4. 南翔小笼\n## 5. 溢香园 - 东北菜', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['美食','法拉盛','推荐'], 345, 67, 3456, NOW()-INTERVAL '3 days'),
  (v_uid5, 'blog', '法拉盛最好的3个儿童课外活动推荐', 'flushing-kids-activities', E'## 1. 小天才教育中心 - 数学和阅读\n## 2. 法拉盛YMCA - 游泳课\n## 3. 皇后区植物园 - 户外探索', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['亲子','教育'], 234, 45, 1234, NOW()-INTERVAL '4 days'),
  (v_uid5, 'short_post', NULL, 'jessica-school-tip', '择校建议：不要只看评分，一定要去Open House！和老师聊聊看校园环境👍 #择校 #学区', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['教育','择校'], 98, 15, 456, NOW()-INTERVAL '1 day'),
  (v_uid4, 'blog', '2025年法拉盛房价趋势分析', 'flushing-housing-2025', E'## 行情\n- 一室$350K-450K\n- 两室$500K-700K\n\n华人购房者占60%，自住不需等。', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['地产','房价'], 178, 56, 2345, NOW()-INTERVAL '1 day'),
  (v_uid6, 'blog', 'H1B签证常见问题解答（2025版）', 'h1b-faq-2025', E'## 抽签概率？\n约30%\n\n## 没抽中怎么办？\n考虑O1、L1\n\n## 换工作影响H1B？\n需要transfer', 'published', (SELECT id FROM regions WHERE slug='new-york-city'), 'zh', ARRAY['移民','H1B'], 267, 78, 4567, NOW()-INTERVAL '3 days'),
  (v_uid7, 'short_post', NULL, 'nurse-flu-tip', '流感季还没结束！CVS和Walgreens都可以免费打流感疫苗💉 特别是家有老人小孩的一定要打。#健康 #流感', 'published', (SELECT id FROM regions WHERE slug='flushing-ny'), 'zh', ARRAY['健康','流感'], 67, 8, 234, NOW()-INTERVAL '2 days'),
  (v_uid8, 'blog', 'SHSAT考试备考攻略：进入特殊高中', 'shsat-prep-guide', E'## SHSAT是什么\n纽约特殊高中入学考试\n\n## 备考建议\n1. 提前1年准备\n2. 买官方练习册\n3. 参加模拟考', 'published', (SELECT id FROM regions WHERE slug='queens-ny'), 'zh', ARRAY['SHSAT','教育'], 189, 42, 1567, NOW()-INTERVAL '5 days')
  ON CONFLICT (slug) DO NOTHING;

  -- Step 6: Reviews
  INSERT INTO reviews (business_id, author_id, rating, title, body, status, ai_sentiment, ai_highlights) VALUES
  ((SELECT id FROM businesses WHERE slug='wang-family-medical-center'), v_uid1, 5, '非常满意的就医体验', '王医生非常耐心，全程中文沟通。等待15分钟就看上了。', 'approved', 'positive', ARRAY['耐心','中文服务','等待时间短']),
  ((SELECT id FROM businesses WHERE slug='wang-family-medical-center'), v_uid5, 5, '带孩子看病首选', '医生护士对小朋友有耐心，接受保险copay $20。', 'approved', 'positive', ARRAY['适合儿童','接受保险']),
  ((SELECT id FROM businesses WHERE slug='sichuan-flavor-house'), v_uid2, 5, '法拉盛最好吃的麻辣烫', '汤底每天现熬，食材新鲜。推荐鸳鸯锅底，人均$15。', 'approved', 'positive', ARRAY['味道正宗','性价比高']),
  ((SELECT id FROM businesses WHERE slug='sichuan-flavor-house'), v_uid1, 4, '味道不错要排队', '味道好但周末排30分钟，建议工作日去。', 'approved', 'positive', ARRAY['味道好','需排队']),
  ((SELECT id FROM businesses WHERE slug='huaxin-accounting'), v_uid1, 4, '报税服务专业', '会计专业帮我找到抵扣项。报税季需预约，个人$180。', 'approved', 'positive', ARRAY['专业','价格合理']),
  ((SELECT id FROM businesses WHERE slug='zhang-law-office'), v_uid1, 5, '移民咨询专业', '张律师对移民法熟悉，首次咨询免费，态度好。', 'approved', 'positive', ARRAY['专业','免费咨询']),
  ((SELECT id FROM businesses WHERE slug='little-genius-education'), v_uid5, 5, '孩子进步很大', '大宝上了两年数学课进步明显，老师有方法能中文沟通。', 'approved', 'positive', ARRAY['效果好','中文沟通']),
  ((SELECT id FROM businesses WHERE slug='lao-li-renovation'), v_uid4, 4, '价格合理手艺好', '厨房翻新3周完工，比其他报价便宜20%。沟通需多催。', 'approved', 'positive', ARRAY['价格合理','手艺好']);

  -- Step 7: Profile-business links
  INSERT INTO profile_business_links (profile_id, business_id, relation_type) VALUES
  (v_uid3, (SELECT id FROM businesses WHERE slug='wang-family-medical-center'), 'owner'),
  (v_uid6, (SELECT id FROM businesses WHERE slug='zhang-law-office'), 'owner')
  ON CONFLICT (profile_id, business_id) DO NOTHING;

  RAISE NOTICE 'Seed complete! Created users, profiles, threads, replies, voice posts, reviews, and links.';
END $$;
