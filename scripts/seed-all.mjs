/**
 * Complete seed script — creates auth users first, then all content
 * Run with: node scripts/seed-all.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read env
const envPath = resolve('apps/web/.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Helper
const upsert = async (table, data, conflict) => {
  const { error } = await supabase.from(table).upsert(data, conflict ? { onConflict: conflict } : {});
  return error;
};

async function seed() {
  console.log('🌱 Complete Baam Seed — Creating everything...\n');

  // Get region/category maps
  const { data: regions } = await supabase.from('regions').select('id, slug');
  const R = {}; (regions || []).forEach(r => R[r.slug] = r.id);
  const { data: categories } = await supabase.from('categories').select('id, slug');
  const C = {}; (categories || []).forEach(c => C[c.slug] = c.id);
  console.log(`Regions: ${Object.keys(R).length}, Categories: ${Object.keys(C).length}\n`);

  // ================================================================
  // 1. CREATE AUTH USERS (this creates profiles via trigger)
  // ================================================================
  console.log('👥 Creating auth users...');
  const users = [
    { email: 'xiaoli@baam.local', name: '新来的小李' },
    { email: 'foodie@baam.local', name: '美食猎人小王' },
    { email: 'drli@baam.local', name: 'Dr. 李文华' },
    { email: 'kevin@baam.local', name: 'Kevin 陈地产' },
    { email: 'jessica@baam.local', name: '纽约妈妈Jessica' },
    { email: 'zhanglaw@baam.local', name: '张明律师' },
    { email: 'chef@baam.local', name: '川味大厨老赵' },
    { email: 'nurse@baam.local', name: '护士小陈' },
    { email: 'teacher@baam.local', name: '教育顾问Michelle' },
    { email: 'admin@baam.local', name: 'Admin' },
  ];

  const U = {}; // email -> user_id map
  for (const u of users) {
    // Check if exists
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    const existing = list?.users?.find(eu => eu.email === u.email);
    if (existing) {
      U[u.email] = existing.id;
      console.log(`  ℹ ${u.name} exists (${existing.id.slice(0,8)}...)`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email, password: 'BaamTest2025!', email_confirm: true,
        user_metadata: { full_name: u.name }
      });
      if (error) { console.log(`  ⚠ ${u.name}: ${error.message}`); continue; }
      U[u.email] = data.user.id;
      console.log(`  ✓ ${u.name} (${data.user.id.slice(0,8)}...)`);
    }
  }

  // Short aliases
  const uid = (email) => U[email];

  // ================================================================
  // 2. UPDATE PROFILES with full data
  // ================================================================
  console.log('\n📋 Updating profiles...');
  const profileUpdates = [
    { id: uid('xiaoli@baam.local'), username: 'xiaoli', display_name: '新来的小李', bio: '刚搬到法拉盛的新移民，正在适应纽约生活', profile_type: 'user', primary_language: 'zh', region_id: R['flushing-ny'] },
    { id: uid('foodie@baam.local'), username: 'foodie_wang', display_name: '美食猎人小王', bio: '法拉盛美食地图每周更新', profile_type: 'creator', primary_language: 'zh', region_id: R['flushing-ny'], headline: '美食达人 · 法拉盛 · 探店', bio_zh: '法拉盛美食地图每周更新！从街头小吃到隐藏神店，带你吃遍皇后区。', follower_count: 1200, post_count: 89, is_featured: true },
    { id: uid('drli@baam.local'), username: 'dr_li', display_name: 'Dr. 李文华', bio: '法拉盛执业内科医生', profile_type: 'expert', primary_language: 'zh', region_id: R['flushing-ny'], headline: '内科专家 · 家庭医疗 · 双语达人', bio_zh: '法拉盛执业内科医生，15年临床经验。在Baam分享健康知识和就医经验，帮助华人社区更好理解美国医疗系统。美国内科医师协会会员。', follower_count: 328, post_count: 42, blog_count: 8, is_verified: true, is_featured: true },
    { id: uid('kevin@baam.local'), username: 'kevin_chen', display_name: 'Kevin 陈地产', bio: '10年纽约地产经验', profile_type: 'professional', primary_language: 'zh', region_id: R['queens-ny'], headline: '地产专家 · 法拉盛 · 10年经验', bio_zh: '10年纽约地产经验，专注法拉盛及周边区域买卖房和投资。持有纽约州地产经纪执照。', follower_count: 562, post_count: 35, is_verified: true, is_featured: true },
    { id: uid('jessica@baam.local'), username: 'jessica_mom', display_name: '纽约妈妈Jessica', bio: '两个孩子的妈妈', profile_type: 'creator', primary_language: 'zh', region_id: R['flushing-ny'], headline: '家庭博主 · 亲子活动 · 学区攻略', bio_zh: '两个孩子的妈妈，分享学区选择、课外活动和育儿经验。在法拉盛生活8年。', follower_count: 876, post_count: 58, is_featured: true },
    { id: uid('zhanglaw@baam.local'), username: 'zhang_lawyer', display_name: '张明律师', bio: '移民法专家', profile_type: 'professional', primary_language: 'zh', region_id: R['flushing-ny'], headline: '移民律师 · 法拉盛 · 免费咨询', bio_zh: '纽约州执业律师，专注移民法和商业法。为华人社区提供专业法律服务。', follower_count: 245, post_count: 18, is_verified: true, is_featured: false },
    { id: uid('nurse@baam.local'), username: 'nurse_chen', display_name: '护士小陈', bio: '纽约注册护士', profile_type: 'expert', primary_language: 'zh', region_id: R['flushing-ny'], headline: '注册护士 · 健康科普', bio_zh: '纽约注册护士，分享日常保健知识和就医技巧。', follower_count: 156, post_count: 25, is_featured: false },
    { id: uid('teacher@baam.local'), username: 'michelle_edu', display_name: '教育顾问Michelle', bio: '教育咨询', profile_type: 'professional', primary_language: 'zh', region_id: R['queens-ny'], headline: '教育顾问 · 学区 · 升学规划', bio_zh: '10年教育咨询经验，专注纽约学区分析和升学规划。', follower_count: 312, post_count: 22, is_verified: true, is_featured: false },
  ];

  for (const p of profileUpdates) {
    if (!p.id) continue;
    const { error } = await supabase.from('profiles').update(p).eq('id', p.id);
    if (error) console.log(`  ⚠ ${p.display_name}: ${error.message}`);
    else console.log(`  ✓ ${p.display_name}`);
  }

  // ================================================================
  // 3. FORUM THREADS + REPLIES
  // ================================================================
  console.log('\n💬 Seeding forum threads...');
  const threads = [
    { slug: 'flushing-sichuan-recommend', title: '法拉盛有没有推荐的川菜馆？最近新开的那几家如何？', body: '最近想吃川菜，听说法拉盛新开了几家川菜馆。有没有去过的朋友推荐一下？最好是味道正宗、性价比高的。谢谢大家！', board_id: C['forum-food'], author_id: uid('xiaoli@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 5, view_count: 1234, vote_count: 45, ai_summary_zh: '多位用户推荐川味坊和川渝人家，性价比高、味道正宗。也有推荐新开的蜀香园。', ai_tags: ['川菜','法拉盛','推荐','美食'], ai_intent: 'recommendation_request' },
    { slug: 'flushing-rent-2025', title: '2025年法拉盛租房行情怎么样？一室一厅大概多少钱？', body: '刚来纽约准备在法拉盛找房子，想问问现在的租房行情。一室一厅大概什么价位？哪个区域比较好？有没有推荐的租房渠道？', board_id: C['forum-housing'], author_id: uid('xiaoli@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 3, view_count: 892, vote_count: 32, ai_summary_zh: '法拉盛一室一厅月租约$1800-2200，比去年上涨约10%。推荐Murray Hill和Kissena附近。', ai_tags: ['租房','法拉盛','价格'], ai_intent: 'question' },
    { slug: 'flushing-tcm-clinic', title: '法拉盛有没有推荐的中医诊所？最近肩颈不太舒服', body: '最近肩颈特别不舒服，想找个靠谱的中医诊所做针灸。有人有推荐吗？最好在法拉盛附近，能说中文的。保险是Oscar Health，不知道中医诊所收不收。', board_id: C['forum-medical'], author_id: uid('xiaoli@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 4, view_count: 456, vote_count: 15, ai_summary_zh: '推荐仁和堂和济世堂，都接受部分保险。针灸每次$80-120。', ai_tags: ['中医','针灸','法拉盛'], ai_intent: 'recommendation_request' },
    { slug: 'queens-school-ranking', title: '皇后区学区排名分享，哪些学校适合华人家庭？', body: '家里孩子明年要上小学了，想了解皇后区的学区情况。哪些学区比较好？华人家庭多的学区有哪些？', board_id: C['forum-education'], author_id: uid('jessica@baam.local'), region_id: R['queens-ny'], language: 'zh', status: 'published', reply_count: 3, view_count: 567, vote_count: 20, ai_summary_zh: '26学区和25学区最受推荐，Stuyvesant和Bronx Science高中成绩突出。', ai_tags: ['学区','教育','皇后区'], ai_intent: 'question' },
    { slug: 'h1b-lottery-2025', title: 'H1B抽签结果出来了吗？有没有今年中签的分享经验？', body: '听说今年H1B抽签结果已经开始通知了。有没有中签的朋友分享经验？', board_id: C['forum-legal'], author_id: uid('xiaoli@baam.local'), region_id: R['new-york-city'], language: 'zh', status: 'published', reply_count: 2, view_count: 1890, vote_count: 38, ai_summary_zh: '部分用户已收到通知，讨论了后续流程和时间线。', ai_tags: ['H1B','签证','移民'], ai_intent: 'discussion' },
    { slug: 'flushing-credit-card-recommend', title: '新移民办什么信用卡好？没有信用记录怎么办？', body: '刚来美国，没有任何信用记录。想问问大家新移民第一张信用卡办什么好？怎么开始建立信用？', board_id: C['forum-finance'], author_id: uid('xiaoli@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 4, view_count: 678, vote_count: 28, ai_summary_zh: '推荐Discover It Secured和Capital One作为第一张信用卡，建议每月按时还款建立信用。', ai_tags: ['信用卡','新移民','信用'], ai_intent: 'question' },
    { slug: 'flushing-dmv-road-test-tips', title: '刚考过路考！分享法拉盛附近路考经验和注意事项', body: '上周在College Point考过了路考！分享一下经验给正在准备的朋友。考场不算难，但有几个注意事项...', board_id: C['forum-dmv'], author_id: uid('foodie@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 6, view_count: 2345, vote_count: 52, ai_summary_zh: 'College Point考场路考经验分享，注意平行停车和三点掉头，建议提前踩点熟悉路线。', ai_tags: ['路考','驾照','法拉盛'], ai_intent: 'discussion', is_featured: true },
    { slug: 'flushing-secondhand-furniture', title: '搬家清仓！沙发、书桌、床垫低价转让（法拉盛自取）', body: '下个月搬家，以下家具低价转让：\n- 三人沙发 $150（原价$800）\n- 书桌+椅子 $80\n- Queen床垫 $100（9成新）\n\n法拉盛自取，可议价。有意者微信联系。', board_id: C['forum-secondhand'], author_id: uid('nurse@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 8, view_count: 534, vote_count: 12, ai_summary_zh: '法拉盛搬家清仓，沙发$150、书桌$80、床垫$100，自取可议价。', ai_tags: ['二手','家具','法拉盛'], ai_intent: 'discussion' },
    { slug: 'flushing-expose-scam-delivery', title: '曝光！法拉盛某外卖平台收费不透明，多收了我$15', body: '今天在某外卖平台点了$35的餐，结果实际扣了$50！仔细一看有各种隐藏费用。大家注意了。', board_id: C['forum-expose'], author_id: uid('foodie@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 12, view_count: 1567, vote_count: 65, ai_summary_zh: '用户曝光某外卖平台隐藏收费问题，多位用户反映类似经历，建议点餐前仔细查看总价。', ai_tags: ['曝光','外卖','消费警告'], ai_intent: 'complaint' },
    { slug: 'flushing-weekend-events-march', title: '本周末法拉盛有什么好玩的？周六想带孩子出去', body: '这个周末想带孩子出门，法拉盛附近有什么适合亲子的活动吗？', board_id: C['forum-events'], author_id: uid('jessica@baam.local'), region_id: R['flushing-ny'], language: 'zh', status: 'published', reply_count: 5, view_count: 345, vote_count: 18, ai_summary_zh: '推荐法拉盛春季文化节和皇后区植物园亲子活动，都适合带孩子。', ai_tags: ['周末','亲子','活动'], ai_intent: 'question' },
  ];

  for (const t of threads) {
    if (!t.author_id) { console.log(`  ⚠ Skip ${t.slug} (no author)`); continue; }
    const err = await upsert('forum_threads', t, 'slug');
    if (err) console.log(`  ⚠ ${t.slug}: ${err.message}`); else console.log(`  ✓ ${t.title.slice(0,30)}...`);
  }

  // Get thread IDs for replies
  const { data: threadRows } = await supabase.from('forum_threads').select('id, slug');
  const T = {}; (threadRows || []).forEach(t => T[t.slug] = t.id);

  // Forum replies
  console.log('\n💬 Seeding forum replies...');
  const replies = [
    { thread_id: T['flushing-sichuan-recommend'], author_id: uid('foodie@baam.local'), body: '强烈推荐川味坊！他们的鸳鸯锅底绝了，麻辣和番茄各一半，人均$15左右，性价比超高。就在Main Street上，很好找。', status: 'published', vote_count: 23 },
    { thread_id: T['flushing-sichuan-recommend'], author_id: uid('jessica@baam.local'), body: '川渝人家也不错，带孩子去过几次。环境比较干净，服务态度也好。就是周末人比较多需要等位。', status: 'published', vote_count: 15 },
    { thread_id: T['flushing-sichuan-recommend'], author_id: uid('drli@baam.local'), body: '作为四川人，推荐试试新开的蜀香园，水煮鱼做得很地道。不过辣度偏重，不太能吃辣的朋友注意。', status: 'published', vote_count: 18 },
    { thread_id: T['flushing-tcm-clinic'], author_id: uid('drli@baam.local'), body: '作为医生，建议选择有执照的中医诊所。仁和堂的陈医生口碑不错，针灸经验丰富。Oscar Health确实可以覆盖部分针灸费用，建议提前打电话确认。', status: 'published', vote_count: 35, is_best_reply: true },
    { thread_id: T['flushing-tcm-clinic'], author_id: uid('nurse@baam.local'), body: '我去过济世堂，针灸效果挺好的。第一次去需要做评估，之后每次针灸大约45分钟，$80-100一次。', status: 'published', vote_count: 12 },
    { thread_id: T['flushing-rent-2025'], author_id: uid('kevin@baam.local'), body: '作为地产经纪分享一下：目前法拉盛一室一厅$1800-2200/月，好地段（靠近地铁7号线）$2000起。建议看看Murray Hill附近，相对安静而且房源较新。StreetEasy和我们Baam论坛都有房源信息。', status: 'published', vote_count: 28 },
    { thread_id: T['queens-school-ranking'], author_id: uid('teacher@baam.local'), body: '作为教育顾问，分享几个重点：\n1. 26学区（Bayside）整体评分最高\n2. 25学区（法拉盛）华人比例高，中文资源丰富\n3. 如果目标是好高中，Stuyvesant需要考SHSAT\n\n建议先确定住址，再查具体学区。', status: 'published', vote_count: 32, is_best_reply: true },
    { thread_id: T['h1b-lottery-2025'], author_id: uid('zhanglaw@baam.local'), body: '作为移民律师分享几点：\n1. 中签后需要在60天内提交完整申请\n2. 建议找经验丰富的移民律师协助\n3. 准备好护照、I-94、学历认证等材料\n\n有问题可以来我事务所免费咨询。', status: 'published', vote_count: 45, is_best_reply: true },
    { thread_id: T['flushing-credit-card-recommend'], author_id: uid('kevin@baam.local'), body: '推荐Discover It Secured卡作为第一张：\n- 无年费\n- $200押金即可申请\n- 自动帮你建立信用记录\n- 第一年返现翻倍\n\n半年后可以升级为普通Discover卡。', status: 'published', vote_count: 20 },
  ];

  for (const r of replies) {
    if (!r.thread_id || !r.author_id) continue;
    const { error } = await supabase.from('forum_replies').insert(r);
    if (error) console.log(`  ⚠ Reply: ${error.message}`); else console.log(`  ✓ Reply in thread`);
  }

  // ================================================================
  // 4. VOICE POSTS
  // ================================================================
  console.log('\n🎙️ Seeding voice posts...');
  const voicePosts = [
    { author_id: uid('drli@baam.local'), post_type: 'blog', title: '在美国看急诊你需要知道的5件事', slug: 'er-visit-5-things', content: '## 急诊 vs Urgent Care\n\n很多新移民分不清Emergency Room和Urgent Care的区别。\n\n1. **去急诊**：胸痛、严重出血、呼吸困难、中风症状\n2. **去Urgent Care**：发烧、轻伤、皮疹、轻度食物中毒\n3. **急诊贵**：copay $150-500\n4. **UC便宜**：copay $25-75\n5. **不确定打911**\n\nUrgent Care不需要预约，营业时间长，是非紧急情况的好选择。', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['健康','急诊','就医'], like_count: 89, comment_count: 23, view_count: 567 },
    { author_id: uid('drli@baam.local'), post_type: 'blog', title: '如何选择适合你的健康保险计划', slug: 'how-to-choose-health-insurance', content: '## 保险类型\n\n- **HMO**：必须选PCP，看专科需转介，保费较低\n- **PPO**：可直接看专科，保费较高\n- **EPO**：类似HMO但不需转介\n\n## 选择建议\n- 健康年轻人：选高免赔额计划（HDHP）\n- 有家庭：PPO更灵活\n- 预算有限：考虑Medicaid', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['保险','健康','医疗'], like_count: 134, comment_count: 31, view_count: 890 },
    { author_id: uid('foodie@baam.local'), post_type: 'short_post', slug: 'foodie-malatang', content: '今天发现法拉盛Main Street新开了一家麻辣烫🌶️ 味道超正宗！推荐招牌鸳鸯锅底，麻辣和番茄的组合绝了。排队的人不少，建议避开饭点。#法拉盛美食 #麻辣烫', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['美食','法拉盛','麻辣烫'], like_count: 156, comment_count: 34, view_count: 890 },
    { author_id: uid('foodie@baam.local'), post_type: 'blog', title: '法拉盛必吃的10家隐藏美食店（2025版）', slug: 'flushing-hidden-gems-2025', content: '## 1. 川味坊 - 麻辣烫之王\n## 2. 金丰大酒楼 - 最佳早茶\n## 3. 麦香坊 - 新开的中式面包\n## 4. 南翔小笼 - 经典小笼包\n## 5. 溢香园 - 东北菜\n## 6. 好运来 - 港式甜品\n## 7. 兰州拉面 - 手工拉面\n## 8. 四海好日子 - 海鲜\n## 9. 小肥羊 - 火锅\n## 10. 文和友 - 湖南菜', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['美食','法拉盛','推荐'], like_count: 345, comment_count: 67, view_count: 3456 },
    { author_id: uid('jessica@baam.local'), post_type: 'blog', title: '法拉盛最好的3个儿童课外活动推荐', slug: 'flushing-kids-activities', content: '## 1. 小天才教育中心\n数学和阅读辅导，老师有耐心\n\n## 2. 法拉盛YMCA游泳课\n性价比高，教练专业\n\n## 3. 皇后区植物园户外探索\n培养好奇心，春天种植活动很棒', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['亲子','教育','课外活动'], like_count: 234, comment_count: 45, view_count: 1234 },
    { author_id: uid('jessica@baam.local'), post_type: 'short_post', slug: 'jessica-school-tip', content: '给正在择校的家长一个小建议：不要只看学校评分，一定要实地去参观Open House。和老师聊聊，看看校园环境，了解课后活动。我家两个孩子的学校就是Open House时选定的，非常满意👍 #择校 #学区', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['教育','择校','家长'], like_count: 98, comment_count: 15, view_count: 456 },
    { author_id: uid('kevin@baam.local'), post_type: 'blog', title: '2025年法拉盛房价趋势分析：还能买吗？', slug: 'flushing-housing-2025', content: '## 当前行情\n- 一室公寓：$350K-450K\n- 两室公寓：$500K-700K\n- 独栋别墅：$800K-1.2M\n\n## 趋势\n利率回落但需求强劲，华人购房者占60%。\n\n## 建议\n自住不需要等，投资关注Murray Hill新公寓。', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['地产','房价','投资'], like_count: 178, comment_count: 56, view_count: 2345 },
    { author_id: uid('zhanglaw@baam.local'), post_type: 'blog', title: 'H1B签证常见问题解答（2025最新版）', slug: 'h1b-faq-2025', content: '## Q: H1B抽签概率？\n约30%左右。\n\n## Q: 没抽中怎么办？\n可以考虑O1、L1等替代方案。\n\n## Q: 绿卡排期多久？\nEB2/EB3目前排期约2-3年。\n\n## Q: 换工作影响H1B吗？\n需要新雇主重新申请transfer。', status: 'published', region_id: R['new-york-city'], language: 'zh', topic_tags: ['移民','H1B','签证'], like_count: 267, comment_count: 78, view_count: 4567 },
    { author_id: uid('nurse@baam.local'), post_type: 'short_post', slug: 'nurse-flu-tip', content: '提醒大家：流感季还没结束！如果你还没打流感疫苗，法拉盛的CVS和Walgreens都可以免费接种（大部分保险覆盖）。特别是家里有老人和小孩的，一定要打。💉 #健康 #流感 #疫苗', status: 'published', region_id: R['flushing-ny'], language: 'zh', topic_tags: ['健康','流感','疫苗'], like_count: 67, comment_count: 8, view_count: 234 },
    { author_id: uid('teacher@baam.local'), post_type: 'blog', title: '纽约SHSAT考试备考攻略：如何进入特殊高中', slug: 'shsat-prep-guide', content: '## 什么是SHSAT\n纽约市特殊高中入学考试\n\n## 考试内容\n- 英语语言艺术（ELA）\n- 数学\n\n## 备考建议\n1. 提前1年开始准备\n2. 买官方练习册\n3. 参加模拟考试\n4. 重点练习阅读理解和代数', status: 'published', region_id: R['queens-ny'], language: 'zh', topic_tags: ['SHSAT','教育','升学'], like_count: 189, comment_count: 42, view_count: 1567 },
  ];

  for (const vp of voicePosts) {
    if (!vp.author_id) continue;
    const err = await upsert('voice_posts', vp, 'slug');
    if (err) console.log(`  ⚠ ${vp.slug}: ${err.message}`); else console.log(`  ✓ ${(vp.title||vp.content).slice(0,25)}...`);
  }

  // ================================================================
  // 5. REVIEWS
  // ================================================================
  console.log('\n⭐ Seeding reviews...');
  const reviews = [
    { business_id: null, biz_slug: 'wang-family-medical-center', author_id: uid('xiaoli@baam.local'), rating: 5, title: '非常满意的就医体验', body: '王医生非常耐心，详细解释了每一项检查。全程中文沟通没有障碍。等待时间也不长，大概15分钟就看上了。强烈推荐！', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['耐心','中文服务','等待时间短'] },
    { business_id: null, biz_slug: 'wang-family-medical-center', author_id: uid('jessica@baam.local'), rating: 5, title: '带孩子看病的首选', body: '带两个孩子来做年度体检，医生和护士对小朋友很有耐心。接受我们的保险，copay只要$20。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['适合儿童','接受保险','服务好'] },
    { business_id: null, biz_slug: 'sichuan-flavor-house', author_id: uid('foodie@baam.local'), rating: 5, title: '法拉盛最好吃的麻辣烫！', body: '可以负责任地说这是法拉盛最正宗的麻辣烫。汤底每天现熬，食材新鲜。推荐鸳鸯锅底，人均$15。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['味道正宗','食材新鲜','性价比高'] },
    { business_id: null, biz_slug: 'sichuan-flavor-house', author_id: uid('xiaoli@baam.local'), rating: 4, title: '味道不错，就是要排队', body: '味道确实好，但周末去要排将近30分钟的队。建议工作日去或者提前外卖下单。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['味道好','需排队'] },
    { business_id: null, biz_slug: 'huaxin-accounting', author_id: uid('xiaoli@baam.local'), rating: 4, title: '报税服务专业', body: '今年第一次在华信报税，会计很专业，帮我找到几个抵扣项目。报税季人多需要预约，个人$180算合理。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['专业','价格合理','需预约'] },
    { business_id: null, biz_slug: 'zhang-law-office', author_id: uid('xiaoli@baam.local'), rating: 5, title: '移民咨询非常专业', body: '张律师对移民法非常熟悉，首次咨询免费，解答了我很多关于H1B的问题。态度也很好，推荐！', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['专业','免费咨询','态度好'] },
    { business_id: null, biz_slug: 'little-genius-education', author_id: uid('jessica@baam.local'), rating: 5, title: '孩子进步很大', body: '大宝在这里上了两年数学课，从班级中等到前几名。老师很有方法，而且能用中文和家长沟通。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['效果好','中文沟通','有方法'] },
    { business_id: null, biz_slug: 'lao-li-renovation', author_id: uid('kevin@baam.local'), rating: 4, title: '价格合理，手艺不错', body: '找老李做了厨房翻新，从设计到完工大概3周。价格比其他几家报价便宜约20%，手艺也可以。唯一是有时候沟通需要多催几次。', status: 'approved', ai_sentiment: 'positive', ai_highlights: ['价格合理','手艺好','沟通需改善'] },
  ];

  // Resolve business IDs
  const { data: bizRows } = await supabase.from('businesses').select('id, slug');
  const B = {}; (bizRows || []).forEach(b => B[b.slug] = b.id);

  for (const r of reviews) {
    r.business_id = B[r.biz_slug];
    delete r.biz_slug;
    if (!r.business_id || !r.author_id) continue;
    const { error } = await supabase.from('reviews').insert(r);
    if (error) console.log(`  ⚠ Review: ${error.message}`); else console.log(`  ✓ ${r.title}`);
  }

  // ================================================================
  // 6. PROFILE-BUSINESS LINKS
  // ================================================================
  console.log('\n🔗 Linking profiles to businesses...');
  const links = [
    { profile_id: uid('drli@baam.local'), business_id: B['wang-family-medical-center'], relation_type: 'owner' },
    { profile_id: uid('zhanglaw@baam.local'), business_id: B['zhang-law-office'], relation_type: 'owner' },
  ];
  for (const l of links) {
    if (!l.profile_id || !l.business_id) continue;
    const { error } = await supabase.from('profile_business_links').upsert(l, { onConflict: 'profile_id,business_id' });
    if (error) console.log(`  ⚠ Link: ${error.message}`); else console.log(`  ✓ Linked`);
  }

  console.log('\n✅ Complete seed finished!');
  console.log(`\nSummary:`);
  console.log(`  Users: ${Object.keys(U).length}`);
  console.log(`  Threads: ${threads.filter(t=>t.author_id).length}`);
  console.log(`  Replies: ${replies.length}`);
  console.log(`  Voice Posts: ${voicePosts.filter(v=>v.author_id).length}`);
  console.log(`  Reviews: ${reviews.filter(r=>r.business_id&&r.author_id).length}`);
}

seed().catch(console.error);
