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
  debugPrompt?: {
    keywords: string[];
    systemPrompt: string;
    userPrompt: string;
    model: string;
    totalResults: number;
  };
}

// ─── AI-powered keyword extraction ──────────────────────────────────
// Uses Claude Haiku to understand user intent and extract search keywords.
// Handles any phrasing naturally — no manual stop words needed.
// Falls back to regex-based extraction if AI call fails.

async function extractKeywordsWithAI(query: string): Promise<string[]> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a search keyword extractor for a Chinese community platform in NYC (Baam).
The platform has 6 content types: businesses, news articles, living guides, forum threads, local voices (influencer posts), and events.

Given a user's question, extract 1-5 core search keywords that would match across ALL content types.

Rules:
- Return ONLY the keywords, one per line, nothing else
- Remove filler words, questions, locations (法拉盛/纽约/曼哈顿 etc.)
- Keep specific nouns:
  · Business terms: food types (火锅, 饺子, 川菜), services (牙医, 律师, 搬家), specialties (针灸, 报税)
  · Article/guide topics: 移民, 租房, 报税, 驾照, 医保, 学区
  · Event terms: 春节, 演出, 讲座, 招聘会
  · Forum topics: 经验, 求助, 推荐
- Keep symptom/need terms: 膝盖痛, 发烧, 漏水, 脱发
- Shorten to category keywords when possible: "上海餐馆" → "上海菜", "办绿卡" → "绿卡"
- For English mixed queries, keep English terms too
- Maximum 5 keywords, prefer fewer and more precise`,
      messages: [{ role: 'user', content: query }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const keywords = text.split('\n').map(l => l.trim()).filter(l => l.length >= 2 && l.length <= 10);
    if (keywords.length > 0) return keywords.slice(0, 5);
  } catch {
    // AI extraction failed — fall through to regex fallback
  }
  return extractKeywordsFallback(query);
}

// Regex-based fallback (used if AI extraction fails)
function extractKeywordsFallback(query: string): string[] {
  const LOCATIONS = ['法拉盛', '皇后区', '曼哈顿', '布鲁克林', '纽约', '唐人街', 'Flushing', 'Queens'];
  const stopPhrases = [
    '请问一下', '请问', '帮我找', '帮我', '告诉我', '给我看', '给我', '帮忙', '麻烦',
    '哪些', '什么样', '什么', '怎么样', '怎么办', '怎么', '如何',
    '哪里有', '哪里', '哪儿', '哪个', '哪家', '谁知道',
    '哪有', '哪儿有', '有没有', '有什么', '是什么', '在哪里', '在哪',
    '找出来', '列出来', '列出', '列举', '找出', '找到',
    '搜一下', '查一下', '看一下', '看看', '查查', '搜搜',
    '推荐一下', '推荐', '介绍一下', '介绍', '求推荐', '求介绍', '说一下', '说说',
    '所有的', '所有', '全部', '一些', '几家', '几个', '多少',
    '好吃的', '好喝的', '好用的', '好的', '最好的', '最好',
    '排列', '按照', '排名', '排名榜', '评价', '评分', '分数',
    '比较好', '比较', '特别好', '特别', '非常', '真的', '一般', '不错', '靠谱', '正规',
    '我要吃', '我要喝', '我要买', '我要找', '我要去', '我要',
    '我想吃', '我想喝', '我想买', '我想找', '我想去', '我想',
    '想要', '需要', '想吃', '想喝', '想买', '想找', '想去',
    '要吃', '要喝', '要买', '要找', '要去', '去吃', '去喝', '去买', '去找', '去看',
    '可以', '应该', '一下', '知道', '听说', '据说', '好像',
    '本地', '附近', '周围', '旁边',
    '请客吃饭', '请客', '吃饭', '地方', '方面', '时候', '问题',
    '能不能', '可不可以', '是不是', '会不会',
    '怎么处理', '怎么弄', '怎么搞',
    '去哪里', '去哪儿', '去哪', '在哪里', '在哪儿',
    '哪里订', '哪里买', '哪里学', '哪里修', '哪里看', '哪里找',
    '找谁', '问谁', '哪里有卖',
  ];
  const stopCharSet = new Set([
    '我', '你', '他', '她', '它', '您', '咱',
    '的', '了', '吗', '呢', '吧', '啊', '呀', '哦', '嘛', '哈', '着', '过', '地', '得',
    '是', '在', '把', '被', '从', '向', '跟', '与', '或',
    '很', '太', '都', '也', '就', '才', '又', '再', '还', '更',
    '这', '那', '些', '所', '每', '各', '个',
    '请', '让', '给', '叫', '去', '来', '到', '用', '能', '会', '要', '想',
    '找', '看', '说', '做', '有', '好', '对',
  ]);

  let remaining = query.trim();
  for (const loc of LOCATIONS) {
    if (remaining.includes(loc)) remaining = remaining.replace(loc, ' ');
  }
  [...stopPhrases].sort((a, b) => b.length - a.length).forEach(w => {
    remaining = remaining.replace(new RegExp(w, 'g'), ' ');
  });
  let segments = remaining.split(/[\s,，、.。!！?？·；;：:""''「」【】（）()\-—]+/).filter(w => w.length >= 2);
  segments = segments.map(seg => {
    while (seg.length > 1 && stopCharSet.has(seg[0])) seg = seg.slice(1);
    while (seg.length > 1 && stopCharSet.has(seg[seg.length - 1])) seg = seg.slice(0, -1);
    return seg;
  }).filter(w => w.length >= 2);
  return [...new Set(segments)].filter(k => k.length >= 2).slice(0, 8);
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askXiaoLin(
  query: string,
  history: ChatMessage[] = [],
): Promise<{ error?: string; data?: AskResult }> {
  if (!query?.trim() || query.length < 2) {
    return { error: '请输入你的问题' };
  }

  // ─── AI-powered follow-up detection ─────────────────────────────
  // Ask AI: is this a continuation of the conversation, or a brand new topic?
  // If follow-up → skip RAG search, just continue the chat (fast, cheap)
  // If new topic → do full keyword extraction + RAG search
  if (history.length >= 2) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      // Quick classification: FOLLOWUP / SEARCH / NEW
      const lastAssistant = [...history].reverse().find(m => m.role === 'assistant')?.content.slice(0, 300) || '';
      const classifyResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: `Classify the user message into exactly one category. Reply with one word only:

FOLLOWUP — casual reply that can be answered from conversation context alone (e.g. "需要", "好的", "谢谢", "哪家最便宜")
SEARCH — references something from the conversation BUT needs fresh data like address, phone, hours, reviews, prices (e.g. "帮我查一下地址", "第三家电话多少", "营业时间是什么")
NEW — completely new topic unrelated to the conversation (e.g. "帮我找牙医", "火锅推荐")

Reply with exactly one word: FOLLOWUP or SEARCH or NEW`,
        messages: [{
          role: 'user',
          content: `Previous assistant reply (excerpt): "${lastAssistant}"\n\nNew user message: "${query}"`,
        }],
      });
      const classification = classifyResponse.content[0].type === 'text' ? classifyResponse.content[0].text.trim() : '';

      if (classification === 'FOLLOWUP') {
        // Continue conversation without RAG search
        const systemPrompt = `你是"小邻"，Baam纽约华人社区的AI助手。你用亲切的中文回答问题，像一个在纽约生活多年的华人邻居。
语气像朋友聊天，简洁明了。用简体中文回答。基于之前对话的上下文继续回答用户的问题。用markdown表格展示列表数据。`;

        const aiMessages: { role: 'user' | 'assistant'; content: string }[] = [];
        for (const msg of history.slice(-8)) {
          aiMessages.push({ role: msg.role, content: msg.content });
        }
        aiMessages.push({ role: 'user', content: query });

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          messages: aiMessages,
        });

        const answer = response.content[0].type === 'text' ? response.content[0].text : '';
        return { data: { answer, sources: [], debugPrompt: {
          keywords: ['(follow-up)'],
          systemPrompt: '(conversation continuation — no RAG search)',
          userPrompt: query,
          model: 'claude-haiku-4-5-20251001',
          totalResults: 0,
        } } };
      }
      // else: classification === 'NEW' → fall through to full RAG search
    } catch {
      // Classification failed → fall through to full search
    }
  }

  // ─── Full RAG search (new topic) ──────────────────────────────
  const supabase = createAdminClient();
  const keywords = await extractKeywordsWithAI(query);

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
    const categoryBizIds = new Set<string>(); // Track businesses from directly matched categories
    const bizFields = 'id, slug, display_name, display_name_zh, short_desc_zh, ai_tags, avg_rating, review_count, phone, is_featured, address_full, website_url';

    const addResults = (data: AnyRow[] | null) => {
      for (const b of (data || [])) {
        if (!seenIds.has(b.id)) { seenIds.add(b.id); results.push(b); }
      }
    };

    // Strategy 1: Match keywords against category search_terms + name → find businesses by category
    // Fetch all business categories once, then do bidirectional substring matching in JS
    const { data: allBizCats } = await (supabase as any)
      .from('categories')
      .select('id, name_zh, slug, parent_id, search_terms')
      .eq('type', 'business');

    // Match categories, tracking HOW they matched:
    // - 'name': keyword matches category name (e.g. "火锅" → "火锅烧烤") — core match
    // - 'terms': keyword only found in search_terms (e.g. "饺子" → food-chinese) — peripheral match
    const matchedCats: { cat: AnyRow; matchType: 'name' | 'terms' }[] = [];
    for (const cat of (allBizCats || [])) {
      const nameZh = cat.name_zh || '';
      const terms: string[] = cat.search_terms || [];
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        const nameMatch = nameZh && (nameZh.includes(kw) || kw.includes(nameZh));
        // For search_terms matching:
        // - t.includes(kw): search_term contains keyword (e.g. "韩国烤肉" contains "烤肉") ✓ always ok
        // - kw.includes(t): keyword contains search_term — require t ≥ 3 chars to avoid
        //   generic short words like "修剪","服务","维护" matching unrelated categories
        const termsMatch = terms.some((t: string) =>
          t.includes(kw) || (t.length >= 3 && kw.includes(t))
        );
        if (nameMatch || termsMatch) {
          matchedCats.push({ cat, matchType: nameMatch ? 'name' : 'terms' });
          break;
        }
      }
    }

    if (matchedCats.length > 0) {
      // Decide which categories to fully expand (list ALL businesses):
      // - Name match → always expand (it IS the right category)
      //   e.g. "火锅" → food-hotpot (火锅烧烤) → all 23 hotpot places ✓
      //   e.g. "中餐" → food-chinese (中餐) → all 27 Chinese restaurants ✓
      // - Terms-only match + small category (≤ 10 businesses) → expand
      //   e.g. "饺子" → food-noodles (面馆, 2 biz) → all 2 noodle shops ✓
      // - Terms-only match + large category (> 10 businesses) → skip
      //   e.g. "饺子" → food-chinese (中餐, 27 biz) → too broad, rely on text search ✗
      const MAX_TERMS_ONLY_SIZE = 20;

      // Get all category IDs including parent→children expansion
      const catIdsByMatch = new Map<string, 'name' | 'terms'>();
      for (const { cat, matchType } of matchedCats) {
        catIdsByMatch.set(cat.id, matchType);
      }
      // Expand parent categories to include children (inherit parent's match type)
      const parentMatches = matchedCats.filter(m => !m.cat.parent_id);
      if (parentMatches.length > 0) {
        const { data: children } = await (supabase as any).from('categories').select('id, parent_id').in('parent_id', parentMatches.map(m => m.cat.id));
        for (const child of (children || []) as AnyRow[]) {
          const parentType = catIdsByMatch.get(child.parent_id);
          if (parentType) catIdsByMatch.set(child.id, parentType);
        }
      }

      // Count businesses per category
      const { data: allBizCatLinks } = await (supabase as any)
        .from('business_categories')
        .select('business_id, category_id')
        .in('category_id', [...catIdsByMatch.keys()]);

      const bizPerCat = new Map<string, string[]>();
      for (const link of (allBizCatLinks || []) as AnyRow[]) {
        if (!bizPerCat.has(link.category_id)) bizPerCat.set(link.category_id, []);
        bizPerCat.get(link.category_id)!.push(link.business_id);
      }

      // Include businesses from qualifying categories
      const includedBizIds = new Set<string>();
      for (const [catId, matchType] of catIdsByMatch) {
        const bizList = bizPerCat.get(catId) || [];
        if (matchType === 'name' || bizList.length <= MAX_TERMS_ONLY_SIZE) {
          bizList.forEach(id => includedBizIds.add(id));
        }
        // else: terms-only + large category → skip (text search handles it)
      }

      categoryBizIds.forEach(id => includedBizIds.add(id)); // keep any previously added
      includedBizIds.forEach(id => categoryBizIds.add(id));

      if (includedBizIds.size > 0) {
        const { data } = await (supabase as any)
          .from('businesses').select(bizFields)
          .eq('is_active', true).in('id', [...includedBizIds].slice(0, 50))
          .order('is_featured', { ascending: false })
          .order('avg_rating', { ascending: false }).limit(15);
        addResults(data);
      }
    }

    // Strategy 2: Search ai_tags array
    for (const kw of keywords) {
      if (kw.length < 2 || results.length >= 15) continue;
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true)
        .contains('ai_tags', [kw])
        .order('avg_rating', { ascending: false }).limit(10);
      addResults(data);
    }

    // Strategy 3: Text search on name/description (always runs as supplement)
    // Catches businesses mentioning specific items like "刀削面" in their description
    {
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true)
        .or(buildOr(['display_name', 'display_name_zh', 'short_desc_zh', 'ai_summary_zh']))
        .order('avg_rating', { ascending: false }).limit(10);
      addResults(data);
    }

    // Sort priority:
    // 1. Businesses with keyword in name/description (explicit text match — most relevant)
    // 2. Businesses from directly matched category (e.g. all noodle shops for "饺子")
    // 3. Other businesses (from ai_tags or text fallback)
    // Within each tier: featured first, then by rating
    results.sort((a, b) => {
      const aText = [a.display_name_zh, a.display_name, a.short_desc_zh].filter(Boolean).join(' ');
      const bText = [b.display_name_zh, b.display_name, b.short_desc_zh].filter(Boolean).join(' ');
      const aHasKeyword = keywords.some((kw: string) => aText.includes(kw));
      const bHasKeyword = keywords.some((kw: string) => bText.includes(kw));
      const aInCategory = categoryBizIds.has(a.id);
      const bInCategory = categoryBizIds.has(b.id);

      // Tier: 0 = text match, 1 = category match, 2 = other
      const aTier = aHasKeyword ? 0 : aInCategory ? 1 : 2;
      const bTier = bHasKeyword ? 0 : bInCategory ? 1 : 2;
      if (aTier !== bTier) return aTier - bTier;

      // Within same tier: featured first, then by rating
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      // Then by rating
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

    // Voice posts / Discover posts
    (supabase as any)
      .from('voice_posts')
      .select('id, slug, title, excerpt, content, cover_images, cover_image_url, topic_tags, location_text, like_count, author_id, profiles:author_id(display_name)')
      .eq('status', 'published')
      .or(buildOr(['title', 'content']))
      .order('like_count', { ascending: false })
      .limit(5),

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

  // ─── Fetch Google reviews for top businesses ────────────────────

  let reviewsByBiz: Record<string, AnyRow[]> = {};
  if (businesses.length > 0) {
    const topBizIds = businesses.slice(0, 10).map(b => b.id);
    const { data: reviewData } = await (supabase as any)
      .from('reviews')
      .select('business_id, rating, body, google_author_name, language')
      .in('business_id', topBizIds)
      .eq('status', 'approved')
      .order('rating', { ascending: false })
      .limit(30);

    for (const r of (reviewData || []) as AnyRow[]) {
      if (!reviewsByBiz[r.business_id]) reviewsByBiz[r.business_id] = [];
      if (reviewsByBiz[r.business_id].length < 3) reviewsByBiz[r.business_id].push(r);
    }
  }

  // ─── Build context for AI ───────────────────────────────────────

  const contextParts: string[] = [];

  if (businesses.length > 0) {
    const tags = (b: AnyRow) => (b.ai_tags || []).filter((t: string) => t !== 'GBP已认领').slice(0, 4).join('、');
    contextParts.push(`【商家信息】共找到${businesses.length}家相关商家：\n` + businesses.map((b, i) => {
      let line = `${i + 1}. ${b.display_name_zh || b.display_name}${b.avg_rating ? ` — 评分${b.avg_rating}分(${b.review_count || 0}条评价)` : ''} ${b.phone ? `电话${b.phone}` : ''} ${b.address_full ? `地址：${b.address_full}` : ''} ${tags(b) ? `特色：${tags(b)}` : ''} ${b.short_desc_zh ? `简介：${b.short_desc_zh.slice(0, 60)}` : ''}`;
      // Add review snippets if available
      const reviews = reviewsByBiz[b.id];
      if (reviews && reviews.length > 0) {
        const snippets = reviews.map(r => `"${(r.body || '').slice(0, 50)}"(${r.google_author_name || '用户'},${r.rating}星)`).join(' ');
        line += ` 用户评价：${snippets}`;
      }
      return line;
    }).join('\n'));
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
    contextParts.push('【社区笔记/达人分享】\n' + voices.map((v, i) => {
      const author = v.profiles?.display_name || '匿名';
      const tags = (v.topic_tags || []).join('、');
      const loc = v.location_text || '';
      const likes = v.like_count || 0;
      const body = (v.content || v.excerpt || '').slice(0, 150);
      return `${i + 1}. ${v.title || '(无标题)'}（${author}${loc ? ' · ' + loc : ''}${likes ? ` · ${likes}赞` : ''}）${tags ? `\n   标签：${tags}` : ''}\n   ${body}`;
    }).join('\n'));
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

    // Build message history for conversation continuity
    // Include last few turns so the AI can understand follow-ups like "需要" or "再推荐几个"
    const aiMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    const recentHistory = history.slice(-6); // last 3 turns (6 messages)
    for (const msg of recentHistory) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }
    aiMessages.push({ role: 'user', content: userPrompt });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: aiMessages,
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

    voices.forEach(v => sources.push({
      type: '笔记',
      title: v.title || (v.content || '').slice(0, 30),
      url: `/discover/${v.slug}`,
      snippet: (v.content || v.excerpt || '').slice(0, 80),
    }));

    return { data: { answer, sources, debugPrompt: {
      keywords,
      systemPrompt,
      userPrompt,
      model: 'claude-haiku-4-5-20251001',
      totalResults,
    } } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error';
    return { error: `AI回答失败：${msg}` };
  }
}
