/**
 * Batch generate seed articles for Baam Local
 * Run with: npx tsx scripts/generate-seed-articles.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing env vars. Run with: source apps/web/.env.local && npx tsx scripts/generate-seed-articles.ts');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SECTION_DELIMITER = '===SECTION===';

const CHINESE_WRITER_SYSTEM = `你是一位资深的华人社区媒体编辑，在纽约华文媒体工作多年。
- 写"原生中文"，不是翻译腔
- 像澎湃新闻、新京报的记者那样写作
- 语言自然流畅，像和朋友聊天
- 禁止"在...方面"、"值得注意的是"等翻译腔
- 用具体例子和数字说话
- 用短句，节奏明快`;

interface ArticleInput {
  topic: string;
  keywords: string;
  category: string;
  vertical: string;
  style: string;
  tone: string;
  audience: string;
}

const ARTICLES_TO_GENERATE: ArticleInput[] = [
  // Medical/Health
  { topic: '纽约看急诊全攻略：什么情况该去ER，什么情况去Urgent Care', keywords: '急诊,ER,Urgent Care,保险', category: '医疗与健康', vertical: 'guide_howto', style: '实用指导', tone: '专业严谨', audience: '所有人' },
  { topic: '法拉盛中医推荐：针灸、推拿、中药哪家靠谱', keywords: '中医,针灸,法拉盛,推拿', category: '医疗与健康', vertical: 'guide_bestof', style: '实用指导', tone: '亲切友好', audience: '所有人' },
  { topic: '在纽约生孩子：从产检到生产的完整指南', keywords: '怀孕,产检,生孩子,Medicaid', category: '医疗与健康', vertical: 'guide_howto', style: '实用指导', tone: '亲切友好', audience: '家庭' },
  // Immigration/Legal
  { topic: '绿卡排期怎么看？2025年最新排期表解读', keywords: '绿卡,排期,移民,EB', category: '移民法律', vertical: 'guide_howto', style: '深度分析', tone: '专业严谨', audience: '新移民' },
  { topic: '在纽约开公司：LLC注册全流程（华人创业必读）', keywords: '开公司,LLC,创业,注册', category: '移民法律', vertical: 'guide_howto', style: '实用指导', tone: '专业严谨', audience: '商家' },
  // Housing
  { topic: '法拉盛租房防坑指南：签约前必须检查的10件事', keywords: '租房,法拉盛,合同,押金', category: '租房安家', vertical: 'guide_checklist', style: '实用指导', tone: '亲切友好', audience: '新移民' },
  { topic: '纽约买房全攻略：从看房到过户一文搞懂', keywords: '买房,贷款,过户,地产', category: '租房安家', vertical: 'guide_howto', style: '深度分析', tone: '专业严谨', audience: '家庭' },
  { topic: '纽约搬家清单：找搬家公司、转地址、办水电一站式指南', keywords: '搬家,水电,地址,USPS', category: '租房安家', vertical: 'guide_checklist', style: '实用指导', tone: '轻松活泼', audience: '所有人' },
  // Finance/Tax
  { topic: '2025年纽约州报税：W-2、1099、自雇人士分别怎么报', keywords: '报税,W-2,1099,自雇', category: '报税理财', vertical: 'guide_howto', style: '实用指导', tone: '专业严谨', audience: '所有人' },
  { topic: '新移民理财入门：信用分怎么建、银行怎么选、保险怎么买', keywords: '信用分,银行,保险,理财', category: '报税理财', vertical: 'guide_howto', style: '实用指导', tone: '亲切友好', audience: '新移民' },
  // Education
  { topic: '纽约公立学校择校指南：学区、排名、入学申请全解析', keywords: '学区,公立学校,择校,排名', category: '教育培训', vertical: 'guide_howto', style: '深度分析', tone: '亲切友好', audience: '家庭' },
  { topic: '法拉盛课后班推荐：数学、钢琴、画画、体育哪家强', keywords: '课后班,补习,法拉盛,才艺', category: '教育培训', vertical: 'guide_bestof', style: '生活分享', tone: '亲切友好', audience: '家庭' },
  // Daily Life
  { topic: '纽约考驾照完全攻略：笔试题库、5小时课、路考技巧', keywords: '驾照,笔试,路考,DMV', category: '日常生活', vertical: 'guide_howto', style: '实用指导', tone: '轻松活泼', audience: '所有人' },
  { topic: '法拉盛超市大比拼：H Mart vs 大中华 vs 金城发 vs 中国城超市', keywords: '超市,法拉盛,买菜,性价比', category: '日常生活', vertical: 'guide_comparison', style: '生活分享', tone: '轻松活泼', audience: '所有人' },
  { topic: '纽约地铁公交全攻略：MetroCard、OMNY、怎么换乘最省时间', keywords: '地铁,公交,MetroCard,OMNY', category: '日常生活', vertical: 'guide_howto', style: '实用指导', tone: '轻松活泼', audience: '新移民' },
  // Food
  { topic: '法拉盛深夜食堂：10点后还开门的中餐馆推荐', keywords: '深夜,宵夜,法拉盛,中餐', category: '美食推荐', vertical: 'guide_bestof', style: '生活分享', tone: '轻松活泼', audience: '所有人' },
  { topic: '法拉盛早茶哪家强？5家粤式茶楼横向对比', keywords: '早茶,茶楼,粤菜,法拉盛', category: '美食推荐', vertical: 'guide_comparison', style: '生活分享', tone: '轻松活泼', audience: '所有人' },
  // Seasonal
  { topic: '纽约夏天遛娃好去处：免费水上乐园、公园、博物馆推荐', keywords: '遛娃,夏天,免费,公园', category: '亲子活动', vertical: 'guide_seasonal', style: '生活分享', tone: '亲切友好', audience: '家庭' },
  { topic: '纽约冬天取暖指南：暖气不够热怎么投诉、电费怎么省', keywords: '取暖,暖气,冬天,电费', category: '日常生活', vertical: 'guide_seasonal', style: '实用指导', tone: '亲切友好', audience: '所有人' },
  // Services
  { topic: '在纽约找月嫂/保姆：价格、渠道、注意事项一文搞懂', keywords: '月嫂,保姆,育儿嫂,价格', category: '生活服务', vertical: 'guide_howto', style: '实用指导', tone: '亲切友好', audience: '家庭' },
];

function cleanSummary(text: string): string {
  return text
    .replace(/^#+\s*(摘要|Summary|概要)\s*/i, '')
    .replace(/^(摘要|Summary)[：:]\s*/i, '')
    .trim();
}

function parseDelimitedArticle(text: string) {
  const sections = text.split(SECTION_DELIMITER).map(s => s.trim());
  const get = (i: number) => (sections[i] || '').trim();

  let tags: string[] = [];
  try { tags = JSON.parse(get(6)); } catch { tags = get(6).split(/[,，]/).map(t => t.trim()).filter(Boolean); }

  let faq: Array<{ q: string; a: string }> = [];
  try { faq = JSON.parse(get(7)); } catch { faq = []; }

  return {
    title_zh: get(0),
    title_en: get(1),
    body_zh: get(2),
    body_en: get(3),
    ai_summary_zh: cleanSummary(get(4)),
    ai_summary_en: cleanSummary(get(5)),
    ai_tags: tags,
    ai_faq: faq,
    seo_title_zh: get(8),
    seo_desc_zh: get(9),
  };
}

async function generateArticle(input: ArticleInput) {
  const styleMap: Record<string, string> = {
    '实用指导': '写一篇实用指导类文章，重点是"怎么做"，给出具体步骤和建议',
    '深度分析': '写一篇深度分析，帮读者理解来龙去脉和影响',
    '生活分享': '写一篇生活分享，用亲历者视角，有故事感',
  };
  const toneMap: Record<string, string> = {
    '亲切友好': '语气亲切，像邻居大姐在跟你聊天',
    '专业严谨': '语气专业，像医生/律师在给你建议',
    '轻松活泼': '语气轻松，像年轻博主在分享',
  };

  const prompt = `请为纽约华人社区门户网站 Baam 撰写一篇文章。

【主题】${input.topic}
【关键词】${input.keywords}
【地区】纽约/法拉盛
【分类】${input.category}
【目标读者】${input.audience}
【写作要求】${styleMap[input.style] || styleMap['实用指导']}。${toneMap[input.tone] || toneMap['亲切友好']}。

请按以下格式输出，每个部分用 ${SECTION_DELIMITER} 分隔。不要加任何其他标记或解释。

中文标题（15-25字，吸引人）
${SECTION_DELIMITER}
English Title
${SECTION_DELIMITER}
中文正文（Markdown格式，800-1500字，用##做小标题）
${SECTION_DELIMITER}
English body (Markdown, 500-1000 words)
${SECTION_DELIMITER}
中文3句话摘要
${SECTION_DELIMITER}
English 3-sentence summary
${SECTION_DELIMITER}
["标签1","标签2","标签3","标签4"]
${SECTION_DELIMITER}
[{"q":"常见问题1","a":"回答1"},{"q":"常见问题2","a":"回答2"},{"q":"常见问题3","a":"回答3"},{"q":"常见问题4","a":"回答4"},{"q":"常见问题5","a":"回答5"}]
${SECTION_DELIMITER}
SEO标题
${SECTION_DELIMITER}
SEO描述`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: CHINESE_WRITER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseDelimitedArticle(text);
}

async function saveArticle(article: ReturnType<typeof parseDelimitedArticle>, input: ArticleInput) {
  const slug = article.title_zh
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  // Get region ID for NYC
  const regionRes = await fetch(`${SUPABASE_URL}/rest/v1/regions?slug=eq.new-york-city&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const regions = await regionRes.json();
  const regionId = regions[0]?.id || null;

  const body = {
    slug,
    title_zh: article.title_zh,
    title_en: article.title_en,
    body_zh: article.body_zh,
    body_en: article.body_en,
    content_vertical: input.vertical,
    editorial_status: 'published',
    ai_summary_zh: article.ai_summary_zh,
    ai_summary_en: article.ai_summary_en,
    ai_tags: article.ai_tags,
    ai_faq: article.ai_faq,
    seo_title_zh: article.seo_title_zh,
    seo_desc_zh: article.seo_desc_zh,
    region_id: regionId,
    published_at: new Date().toISOString(),
    source_type: 'ai_assisted',
    source_name: 'Baam AI',
    audience_types: [input.audience === '新移民' ? 'new_immigrant' : input.audience === '家庭' ? 'family' : input.audience === '商家' ? 'business' : 'all'],
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to save: ${err}`);
  }

  return await res.json();
}

async function main() {
  console.log(`\n🚀 Generating ${ARTICLES_TO_GENERATE.length} seed articles...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < ARTICLES_TO_GENERATE.length; i++) {
    const input = ARTICLES_TO_GENERATE[i];
    const num = `[${i + 1}/${ARTICLES_TO_GENERATE.length}]`;

    try {
      process.stdout.write(`${num} Generating: ${input.topic}...`);
      const article = await generateArticle(input);

      if (!article.title_zh || !article.body_zh) {
        console.log(' ❌ Empty content');
        failed++;
        continue;
      }

      await saveArticle(article, input);
      console.log(` ✅ ${article.title_zh}`);
      success++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(` ❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${success} success, ${failed} failed out of ${ARTICLES_TO_GENERATE.length} total`);
}

main().catch(console.error);
