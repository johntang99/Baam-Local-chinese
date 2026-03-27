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

export async function askXiaoLin(query: string): Promise<{ error?: string; data?: AskResult }> {
  if (!query?.trim() || query.length < 2) {
    return { error: '请输入你的问题' };
  }

  const supabase = createAdminClient();
  const searchPattern = `%${query}%`;

  // ─── RAG: Search all 6 content sources in parallel ──────────────

  const [bizResult, newsResult, guideResult, forumResult, voiceResult, eventResult] = await Promise.all([
    // Businesses
    (supabase as any)
      .from('businesses')
      .select('slug, display_name, display_name_zh, short_desc_zh, ai_tags, avg_rating, review_count, phone')
      .eq('status', 'active')
      .eq('is_active', true)
      .or(`display_name.ilike.${searchPattern},display_name_zh.ilike.${searchPattern},short_desc_zh.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
      .limit(5),

    // News
    (supabase as any)
      .from('articles')
      .select('slug, title_zh, ai_summary_zh, content_vertical, published_at')
      .eq('editorial_status', 'published')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .or(`title_zh.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
      .order('published_at', { ascending: false })
      .limit(3),

    // Guides
    (supabase as any)
      .from('articles')
      .select('slug, title_zh, ai_summary_zh, content_vertical')
      .eq('editorial_status', 'published')
      .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
      .or(`title_zh.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern},body_zh.ilike.${searchPattern}`)
      .limit(5),

    // Forum threads
    (supabase as any)
      .from('forum_threads')
      .select('slug, title, ai_summary_zh, reply_count, board_id, categories:board_id(slug)')
      .eq('status', 'published')
      .or(`title.ilike.${searchPattern},body.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
      .order('reply_count', { ascending: false })
      .limit(3),

    // Voice posts
    (supabase as any)
      .from('voice_posts')
      .select('slug, title, excerpt, author_id')
      .eq('status', 'published')
      .or(`title.ilike.${searchPattern},content.ilike.${searchPattern}`)
      .limit(3),

    // Events
    (supabase as any)
      .from('events')
      .select('slug, title_zh, title_en, summary_zh, venue_name, start_at, is_free')
      .eq('status', 'published')
      .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},summary_zh.ilike.${searchPattern},venue_name.ilike.${searchPattern}`)
      .order('start_at', { ascending: true })
      .limit(3),
  ]);

  const businesses = (bizResult.data || []) as AnyRow[];
  const news = (newsResult.data || []) as AnyRow[];
  const guides = (guideResult.data || []) as AnyRow[];
  const threads = (forumResult.data || []) as AnyRow[];
  const voices = (voiceResult.data || []) as AnyRow[];
  const events = (eventResult.data || []) as AnyRow[];

  // ─── Build context for AI ───────────────────────────────────────

  const contextParts: string[] = [];

  if (businesses.length > 0) {
    contextParts.push('【商家信息】\n' + businesses.map(b =>
      `- ${b.display_name_zh || b.display_name}：${b.short_desc_zh || ''} ${b.avg_rating ? `评分${b.avg_rating}` : ''} ${b.phone ? `电话${b.phone}` : ''}`
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
- 语气像朋友聊天，不要太正式`;

    const userPrompt = totalResults > 0
      ? `用户问：${query}\n\n以下是从我们社区平台搜索到的相关信息：\n\n${contextParts.join('\n\n')}\n\n请基于以上信息回答用户的问题。如果信息不够，也可以补充你的通用知识。`
      : `用户问：${query}\n\n我们平台暂时没有搜索到完全匹配的信息。请根据你的知识，给出对纽约华人社区有帮助的回答，并建议用户可以在论坛发帖询问更多经验。`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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
