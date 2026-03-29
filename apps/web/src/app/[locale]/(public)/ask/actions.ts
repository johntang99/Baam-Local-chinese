'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface AskResult {
  answer: string;
  sources: {
    type: string;
    title: string;
    url: string;
    snippet?: string;
  }[];
}

// Known business-related terms that map to category concepts
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '火锅': ['火锅', 'hotpot', 'hot pot', '麻辣烫', '串串'],
  '中餐': ['中餐', '中国菜', '川菜', '粤菜', '湘菜', '东北菜'],
  '日料': ['日料', '日本菜', '寿司', 'sushi', '拉面', 'ramen'],
  '韩餐': ['韩餐', '韩国菜', '烤肉', 'korean'],
  '奶茶': ['奶茶', '茶饮', '珍珠', 'bubble tea', 'boba'],
  '烘焙': ['面包', '蛋糕', '烘焙', '甜品', 'bakery'],
  '咖啡': ['咖啡', 'coffee', 'cafe'],
  '点心': ['点心', '早茶', 'dim sum', '饮茶'],
  '中医': ['中医', '针灸', 'acupuncture', '推拿', '拔罐'],
  '牙科': ['牙科', '牙医', 'dental', 'dentist'],
  '眼科': ['眼科', '配镜', '验光', 'optometry'],
  '律师': ['律师', '法律', 'lawyer', 'attorney', '移民'],
  '会计': ['会计', '报税', 'CPA', 'accountant', '税务'],
  '保险': ['保险', 'insurance'],
  '地产': ['地产', '房产', '买房', '租房', 'realtor', 'real estate'],
  '美发': ['美发', '理发', '发型', 'hair', 'salon'],
  '美甲': ['美甲', 'nail'],
  '按摩': ['按摩', 'spa', 'massage'],
  '搬家': ['搬家', 'moving'],
  '装修': ['装修', 'renovation', '水管', '电工'],
  '汽车': ['汽车', '修车', 'auto', 'car repair'],
  '驾校': ['驾校', '学车', 'driving school'],
  '补习': ['补习', '辅导', '培训', 'tutoring'],
  '超市': ['超市', '杂货', 'supermarket', 'grocery', '买菜', '菜市场'],
  '药房': ['药房', '药店', 'pharmacy'],
  '快递': ['快递', '物流', 'shipping'],
  '旅行': ['旅行社', '旅游', 'travel'],
  '摄影': ['摄影', '拍照', 'photography'],
  '宠物': ['宠物', 'pet'],
};

// Split Chinese query into searchable keywords
function extractKeywords(query: string): string[] {
  const q = query.trim();

  // Known location words
  const locations = ['法拉盛', '皇后区', '曼哈顿', '布鲁克林', '纽约', '唐人街', 'Flushing', 'Queens'];
  // Stop words (expanded)
  const stopWords = ['有', '哪些', '什么', '怎么', '如何', '哪里', '好吃的', '推荐', '附近', '本地',
    '的', '吗', '呢', '吧', '了', '在', '找', '去', '要', '想', '好', '能', '可以', '请问', '帮我',
    '告诉我', '请', '列出', '列出来', '多少', '家', '店', '排列', '按照', '分数', '评价', '评分',
    '排名', '最好', '给我', '哪个', '哪家', '介绍', '查一下', '搜一下', '看看'];

  // Extract locations
  const foundLocations: string[] = [];
  let remaining = q;
  for (const loc of locations) {
    if (remaining.includes(loc)) {
      foundLocations.push(loc);
      remaining = remaining.replace(loc, ' ');
    }
  }

  // Remove stop words
  stopWords.forEach(w => { remaining = remaining.replace(new RegExp(w, 'g'), ' '); });

  // Split remaining into 2-4 char segments for Chinese
  const segments = remaining.split(/[\s,，、.。!！?？·]+/).filter(w => w.length >= 2);

  // Also match known category keywords from the query
  // Push BOTH the matched term AND the category key (for DB category name matching)
  const matchedCategoryTerms: string[] = [];
  for (const [catKey, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const term of terms) {
      if (q.includes(term)) {
        matchedCategoryTerms.push(term);
        matchedCategoryTerms.push(catKey); // e.g., "牙医" → also add "牙科"
        break; // one match per category is enough
      }
    }
  }

  // Combine: locations + category terms + segments (NO full query — it's too long)
  const keywords = [...foundLocations, ...matchedCategoryTerms, ...segments];

  // Deduplicate and limit
  return [...new Set(keywords)].filter(k => k.length >= 2).slice(0, 8);
}

export async function askXiaoLin(query: string): Promise<{ error?: string; data?: AskResult }> {
  if (!query?.trim() || query.length < 2) {
    return { error: '请输入你的问题' };
  }

  const supabase = createAdminClient();
  const keywords = extractKeywords(query);

  // Build OR conditions for each keyword across multiple columns
  function buildOr(columns: string[]): string {
    const conditions: string[] = [];
    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      for (const col of columns) {
        conditions.push(`${col}.ilike.${pattern}`);
      }
    }
    return conditions.join(',');
  }

  // ─── RAG: Search all 6 content sources in parallel ──────────────

  // ─── Smart business search: 3 parallel strategies ─────────────
  async function searchBusinesses(): Promise<AnyRow[]> {
    const results: AnyRow[] = [];
    const seenIds = new Set<string>();
    const bizFields = 'id, slug, display_name, display_name_zh, short_desc_zh, ai_tags, avg_rating, review_count, phone, is_featured';

    const addResults = (data: AnyRow[] | null) => {
      for (const b of (data || [])) {
        if (!seenIds.has(b.id)) { seenIds.add(b.id); results.push(b); }
      }
    };

    // Strategy 1: Match keywords against category names → find businesses by category
    const allCats: AnyRow[] = [];
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      const { data } = await (supabase as any)
        .from('categories')
        .select('id, name_zh, slug, parent_id')
        .eq('type', 'business')
        .ilike('name_zh', `%${kw}%`);
      if (data) allCats.push(...data);
    }

    if (allCats.length > 0) {
      const catIds = allCats.map(c => c.id);
      // Include children of matched parents
      const parentIds = allCats.filter(c => !c.parent_id).map(c => c.id);
      if (parentIds.length > 0) {
        const { data: children } = await supabase.from('categories').select('id').in('parent_id', parentIds);
        if (children) catIds.push(...children.map((c: AnyRow) => c.id));
      }
      const { data: bizCats } = await supabase
        .from('business_categories')
        .select('business_id')
        .in('category_id', [...new Set(catIds)]);
      const bizIds = (bizCats || []).map((bc: AnyRow) => bc.business_id);
      if (bizIds.length > 0) {
        const { data } = await (supabase as any)
          .from('businesses').select(bizFields)
          .eq('is_active', true).in('id', bizIds.slice(0, 50))
          .order('is_featured', { ascending: false })
          .order('avg_rating', { ascending: false }).limit(15);
        addResults(data);
      }
    }

    // Strategy 2: Search ai_tags array (run each keyword separately to avoid OR syntax issues)
    for (const kw of keywords) {
      if (kw.length < 2 || results.length >= 15) continue;
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true)
        .contains('ai_tags', [kw])
        .order('avg_rating', { ascending: false }).limit(10);
      addResults(data);
    }

    // Strategy 3: Text search (fallback)
    if (results.length < 5) {
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true)
        .or(buildOr(['display_name', 'display_name_zh', 'short_desc_zh', 'ai_summary_zh']))
        .order('avg_rating', { ascending: false }).limit(10);
      addResults(data);
    }

    // Sort: featured first, then by rating
    results.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.avg_rating || 0) - (a.avg_rating || 0);
    });
    return results.slice(0, 15);
  }

  const [bizData, newsResult, guideResult, forumResult, voiceResult, eventResult] = await Promise.all([
    searchBusinesses(),

    // News
    (supabase as any)
      .from('articles')
      .select('slug, title_zh, ai_summary_zh, content_vertical, published_at')
      .eq('editorial_status', 'published')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .or(buildOr(['title_zh', 'ai_summary_zh']))
      .order('published_at', { ascending: false })
      .limit(3),

    // Guides
    (supabase as any)
      .from('articles')
      .select('slug, title_zh, ai_summary_zh, content_vertical')
      .eq('editorial_status', 'published')
      .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
      .or(buildOr(['title_zh', 'ai_summary_zh', 'body_zh']))
      .limit(5),

    // Forum threads
    (supabase as any)
      .from('forum_threads')
      .select('slug, title, ai_summary_zh, reply_count, board_id, categories:board_id(slug)')
      .eq('status', 'published')
      .or(buildOr(['title', 'body', 'ai_summary_zh']))
      .order('reply_count', { ascending: false })
      .limit(3),

    // Voice posts
    (supabase as any)
      .from('voice_posts')
      .select('slug, title, excerpt, author_id')
      .eq('status', 'published')
      .or(buildOr(['title', 'content']))
      .limit(3),

    // Events
    (supabase as any)
      .from('events')
      .select('slug, title_zh, title_en, summary_zh, venue_name, start_at, is_free')
      .eq('status', 'published')
      .or(buildOr(['title_zh', 'title_en', 'summary_zh', 'venue_name']))
      .order('start_at', { ascending: true })
      .limit(3),
  ]);

  const businesses = bizData as AnyRow[];
  const news = (newsResult.data || []) as AnyRow[];
  const guides = (guideResult.data || []) as AnyRow[];
  const threads = (forumResult.data || []) as AnyRow[];
  const voices = (voiceResult.data || []) as AnyRow[];
  const events = (eventResult.data || []) as AnyRow[];

  // ─── Build context for AI ───────────────────────────────────────

  const contextParts: string[] = [];

  if (businesses.length > 0) {
    const tags = (b: AnyRow) => (b.ai_tags || []).filter((t: string) => t !== 'GBP已认领').slice(0, 4).join('、');
    contextParts.push(`【商家信息】共找到${businesses.length}家相关商家：\n` + businesses.map((b, i) =>
      `${i + 1}. ${b.display_name_zh || b.display_name}${b.avg_rating ? ` — 评分${b.avg_rating}分(${b.review_count || 0}条评价)` : ''} ${b.phone ? `电话${b.phone}` : ''} ${tags(b) ? `特色：${tags(b)}` : ''} ${b.short_desc_zh ? `简介：${b.short_desc_zh.slice(0, 60)}` : ''}`
    ).join('\n'));
  }

  if (guides.length > 0) {
    contextParts.push('【生活指南】\n' + guides.map(g =>
      `- ${g.title_zh}：${g.ai_summary_zh || ''}`
    ).join('\n'));
  }

  if (news.length > 0) {
    contextParts.push('【本地新闻】\n' + news.map(n =>
      `- ${n.title_zh}：${n.ai_summary_zh || ''}`
    ).join('\n'));
  }

  if (threads.length > 0) {
    contextParts.push('【论坛讨论】\n' + threads.map(t =>
      `- ${t.title}（${t.reply_count || 0}回复）：${t.ai_summary_zh || ''}`
    ).join('\n'));
  }

  if (events.length > 0) {
    contextParts.push('【本地活动】\n' + events.map(e => {
      const date = e.start_at ? new Date(e.start_at).toLocaleDateString('zh-CN') : '';
      return `- ${e.title_zh || e.title_en}：${date} ${e.venue_name || ''} ${e.is_free ? '免费' : ''}`;
    }).join('\n'));
  }

  if (voices.length > 0) {
    contextParts.push('【达人分享】\n' + voices.map(v =>
      `- ${v.title || ''}：${v.excerpt || ''}`
    ).join('\n'));
  }

  const totalResults = businesses.length + news.length + guides.length + threads.length + voices.length + events.length;

  // ─── Generate AI response ───────────────────────────────────────

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const systemPrompt = `你是"小邻"，Baam纽约华人社区的AI助手。你用亲切的中文回答问题，像一个在纽约生活多年的华人邻居。

【你的角色】
- 熟悉纽约（特别是法拉盛）的华人社区
- 了解本地商家、医疗、法律、教育、美食等资源
- 回答要具体、实用、有温度
- 如果找到相关信息，引用来源
- 如果没有找到相关信息，坦诚说明并给出一般性建议

【回答格式】
- 用简体中文回答
- 简洁明了，重点突出
- 如果有推荐商家，给出名字和联系方式
- 如果有相关指南，提到可以查看
- 语气像朋友聊天，不要太正式
- 当用户问"有多少"或"列出来"时，必须列出搜索结果中的所有商家，不要省略
- 用markdown表格展示列表数据（商家排名等），确保表格完整`;

    const userPrompt = totalResults > 0
      ? `用户问：${query}\n\n以下是从我们社区平台搜索到的相关信息：\n\n${contextParts.join('\n\n')}\n\n请基于以上信息回答用户的问题。如果信息不够，也可以补充你的通用知识。`
      : `用户问：${query}\n\n我们平台暂时没有搜索到完全匹配的信息。请根据你的知识，给出对纽约华人社区有帮助的回答，并建议用户可以在论坛发帖询问更多经验。`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';

    // Build sources list
    const sources: AskResult['sources'] = [];

    businesses.forEach(b => sources.push({
      type: '商家',
      title: b.display_name_zh || b.display_name,
      url: `/businesses/${b.slug}`,
      snippet: b.short_desc_zh,
    }));

    guides.forEach(g => sources.push({
      type: '指南',
      title: g.title_zh,
      url: `/guides/${g.slug}`,
      snippet: g.ai_summary_zh?.slice(0, 80),
    }));

    news.forEach(n => sources.push({
      type: '新闻',
      title: n.title_zh,
      url: `/news/${n.slug}`,
    }));

    threads.forEach(t => sources.push({
      type: '论坛',
      title: t.title,
      url: `/forum/${t.categories?.slug || 'general'}/${t.slug}`,
    }));

    events.forEach(e => sources.push({
      type: '活动',
      title: e.title_zh || e.title_en,
      url: `/events/${e.slug}`,
    }));

    return { data: { answer, sources } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error';
    return { error: `AI回答失败：${msg}` };
  }
}
