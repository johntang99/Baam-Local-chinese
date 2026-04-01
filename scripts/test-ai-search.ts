/**
 * AI Search Self-Test & Training Script
 *
 * Runs test queries against the actual search logic, evaluates results,
 * and reports issues with keyword extraction, category matching, and business results.
 *
 * Usage:
 *   source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && npx tsx scripts/test-ai-search.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// ─── Keyword Extraction (mirrors actions.ts) ─────────────────────────

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
  '要吃', '要喝', '要买', '要找', '要去',
  '去吃', '去喝', '去买', '去找', '去看',
  '可以', '应该', '一下', '知道', '听说', '据说', '好像',
  '本地', '附近', '周围', '旁边',
  '请客吃饭', '请客', '吃饭', '地方', '方面', '时候', '问题',
  '能不能', '可不可以', '是不是', '会不会',
  '怎么处理', '怎么弄', '怎么搞',
  '去哪里', '去哪儿', '去哪', '在哪里', '在哪儿',
  '哪里订', '哪里买', '哪里学', '哪里修', '哪里看', '哪里找',
  '找谁', '问谁', '哪里有卖',
];

const stopChars = [
  '我', '你', '他', '她', '它', '您', '咱',
  '的', '了', '吗', '呢', '吧', '啊', '呀', '哦', '嘛', '哈', '着', '过', '地', '得',
  '是', '在', '把', '被', '从', '向', '跟', '与', '或',
  '很', '太', '都', '也', '就', '才', '又', '再', '还', '更',
  '这', '那', '些', '所', '每', '各', '个',
  '请', '让', '给', '叫', '去', '来', '到', '用', '能', '会', '要', '想',
  '找', '看', '说', '做', '有', '好', '对',
];
const stopCharSet = new Set(stopChars);

function extractKeywords(query: string): string[] {
  let remaining = query.trim();
  for (const loc of LOCATIONS) {
    if (remaining.includes(loc)) remaining = remaining.replace(loc, ' ');
  }
  const sorted = [...stopPhrases].sort((a, b) => b.length - a.length);
  sorted.forEach(w => { remaining = remaining.replace(new RegExp(w, 'g'), ' '); });
  let segments = remaining.split(/[\s,，、.。!！?？·；;：:""''「」【】（）()\-—]+/).filter(w => w.length >= 2);
  segments = segments.map(seg => {
    while (seg.length > 1 && stopCharSet.has(seg[0])) seg = seg.slice(1);
    while (seg.length > 1 && stopCharSet.has(seg[seg.length - 1])) seg = seg.slice(0, -1);
    return seg;
  }).filter(w => w.length >= 2);
  return [...new Set(segments)].filter(k => k.length >= 2).slice(0, 8);
}

// ─── Test Cases ──────────────────────────────────────────────────────

interface TestCase {
  query: string;
  // Expected keywords (at least one must match)
  expectKeywords: string[];
  // Expected category slugs to match (at least one)
  expectCategories: string[];
  // Expected: results should contain businesses with these terms in name/desc
  expectBusinessTerms?: string[];
  // If true, expect non-zero results
  expectResults: boolean;
}

const TEST_CASES: TestCase[] = [
  // ─── Food ───
  {
    query: '法拉盛有什么好吃的火锅',
    expectKeywords: ['火锅'],
    expectCategories: ['food-hotpot'],
    expectResults: true,
  },
  {
    query: '我要吃上海菜，找出所有上海餐馆',
    expectKeywords: ['上海菜', '上海餐馆'],
    expectCategories: ['food-chinese'],
    expectBusinessTerms: ['上海'],
    expectResults: true,
  },
  {
    query: '列举法拉盛饺子',
    expectKeywords: ['饺子'],
    expectCategories: ['food-noodles'],
    expectResults: true,
  },
  {
    query: '刀削面',
    expectKeywords: ['刀削面'],
    expectCategories: ['food-noodles'],
    expectResults: true,
  },
  {
    query: '哪里有好吃的川菜',
    expectKeywords: ['川菜'],
    expectCategories: ['food-chinese'],
    expectResults: true,
  },
  {
    query: '附近有没有奶茶店',
    expectKeywords: ['奶茶'],
    expectCategories: ['food-bubble-tea'],
    expectResults: true,
  },
  {
    query: '推荐几家好的日料店',
    expectKeywords: ['日料'],
    expectCategories: ['food-japanese'],
    expectResults: true,
  },
  {
    query: '想吃烧烤去哪里',
    expectKeywords: ['烧烤'],
    expectCategories: ['food-hotpot', 'food-chinese'],
    expectResults: true,
  },
  {
    query: '法拉盛最好吃的小笼包在哪',
    expectKeywords: ['小笼包'],
    expectCategories: ['food-dim-sum', 'food-chinese'],
    expectResults: true,
  },
  {
    query: '中餐',
    expectKeywords: ['中餐'],
    expectCategories: ['food-chinese'],
    expectResults: true,
  },
  {
    query: '韩国烤肉',
    expectKeywords: ['韩国烤肉'],
    expectCategories: ['food-korean'],
    expectResults: true,
  },
  {
    query: '法拉盛有什么好喝的奶茶',
    expectKeywords: ['奶茶'],
    expectCategories: ['food-bubble-tea'],
    expectResults: true,
  },
  {
    query: '哪里有越南粉',
    expectKeywords: ['越南粉'],
    expectCategories: ['food-vietnamese'],
    expectResults: true,
  },
  {
    query: '想喝咖啡去哪',
    expectKeywords: ['咖啡'],
    expectCategories: ['food-coffee'],
    expectResults: true,
  },
  {
    query: '生日蛋糕哪里订',
    expectKeywords: ['生日蛋糕'],
    expectCategories: ['food-bakery'],
    expectResults: true,
  },
  // ─── Medical ───
  {
    query: '帮我找一下牙医',
    expectKeywords: ['牙医'],
    expectCategories: ['medical-dental'],
    expectResults: true,
  },
  {
    query: '法拉盛有什么好的儿科医生',
    expectKeywords: ['儿科医生'],
    expectCategories: ['medical-pediatrics'],
    expectResults: true,
  },
  {
    query: '法拉盛中医师排名榜',
    expectKeywords: ['中医师'],
    expectCategories: ['medical-chinese-medicine'],
    expectResults: true,
  },
  {
    query: '哪里能看皮肤科',
    expectKeywords: ['皮肤科'],
    expectCategories: ['medical-dermatology'],
    expectResults: true,
  },
  {
    query: '附近有没有24小时药房',
    expectKeywords: ['24小时药房'],
    expectCategories: ['medical-pharmacy'],
    expectResults: true,
  },
  {
    query: '膝盖痛应该看什么科',
    expectKeywords: ['膝盖痛'],
    expectCategories: ['medical-orthopedic'],
    expectResults: true,
  },
  {
    query: '心理咨询',
    expectKeywords: ['心理咨询'],
    expectCategories: ['medical-mental-health'],
    expectResults: true,
  },
  {
    query: '针灸',
    expectKeywords: ['针灸'],
    expectCategories: ['medical-chinese-medicine'],
    expectResults: true,
  },
  {
    query: '孩子发烧了去哪里看',
    expectKeywords: ['孩子发烧'],
    expectCategories: ['medical-pediatrics'],
    expectResults: true,
  },
  {
    query: '配眼镜去哪里',
    expectKeywords: ['配眼镜'],
    expectCategories: ['medical-optometry'],
    expectResults: true,
  },
  // ─── Legal ───
  {
    query: '办绿卡找什么律师好',
    expectKeywords: ['办绿卡', '律师'],
    expectCategories: ['legal-immigration-visa', 'legal-immigration'],
    expectResults: true,
  },
  {
    query: '租房纠纷怎么处理',
    expectKeywords: ['租房纠纷'],
    expectCategories: ['legal-real-estate', 'legal-family'],
    expectResults: true,
  },
  {
    query: '离婚律师',
    expectKeywords: ['离婚律师'],
    expectCategories: ['legal-family'],
    expectResults: true,
  },
  {
    query: '老板欠我工资怎么办',
    expectKeywords: ['工资'],
    expectCategories: ['legal-labor'],
    expectResults: true,
  },
  // ─── Finance ───
  {
    query: '报税',
    expectKeywords: ['报税'],
    expectCategories: ['finance-tax-prep', 'finance-tax'],
    expectResults: true,
  },
  {
    query: '买房贷款',
    expectKeywords: ['买房贷款'],
    expectCategories: ['finance-mortgage'],
    expectResults: true,
  },
  {
    query: '买保险',
    expectKeywords: ['保险'],
    expectCategories: ['finance-insurance'],
    expectResults: true,
  },
  // ─── Education ───
  {
    query: '法拉盛哪里可以学钢琴',
    expectKeywords: ['学钢琴'],
    expectCategories: ['edu-music-art'],
    expectResults: true,
  },
  {
    query: '想给孩子报个补习班',
    expectKeywords: ['补习班'],
    expectCategories: ['edu-tutoring'],
    expectResults: true,
  },
  {
    query: '哪家驾校比较好',
    expectKeywords: ['驾校'],
    expectCategories: ['edu-driving-school'],
    expectResults: true,
  },
  {
    query: '学英语',
    expectKeywords: ['学英语'],
    expectCategories: ['edu-language'],
    expectResults: true,
  },
  // ─── Home Services ───
  {
    query: '搬家公司哪个靠谱',
    expectKeywords: ['搬家公司'],
    expectCategories: ['home-moving'],
    expectResults: true,
  },
  {
    query: '修车去哪里比较好',
    expectKeywords: ['修车'],
    expectCategories: ['auto-repair'],
    expectResults: true,
  },
  {
    query: '水管漏水找谁修',
    expectKeywords: ['水管漏水'],
    expectCategories: ['home-plumbing'],
    expectResults: true,
  },
  {
    query: '装修房子',
    expectKeywords: ['装修房子'],
    expectCategories: ['home-renovation'],
    expectResults: true,
  },
  // ─── Beauty ───
  {
    query: '剪头发去哪里',
    expectKeywords: ['剪头发'],
    expectCategories: ['beauty-hair-salon'],
    expectResults: true,
  },
  {
    query: '做美甲',
    expectKeywords: ['美甲'],
    expectCategories: ['beauty-nail-salon'],
    expectResults: true,
  },
  // ─── Other Services ───
  {
    query: '寄包裹回国',
    expectKeywords: ['寄包裹'],
    expectCategories: ['svc-shipping'],
    expectResults: true,
  },
  {
    query: '哪里有便宜的机票',
    expectKeywords: ['机票'],
    expectCategories: ['svc-travel'],
    expectResults: true,
  },
];

// ─── Search Logic (mirrors actions.ts) ───────────────────────────────

type AnyRow = Record<string, any>;
let allCategories: AnyRow[] = [];

async function fetchCategories() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?type=eq.business&select=id,name_zh,slug,parent_id,search_terms`, { headers: H });
  allCategories = await res.json();
}

function matchCategories(keywords: string[]): { cat: AnyRow; matchType: 'name' | 'terms' }[] {
  const matched: { cat: AnyRow; matchType: 'name' | 'terms' }[] = [];
  for (const cat of allCategories) {
    const n = cat.name_zh || '';
    const t: string[] = cat.search_terms || [];
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      const nm = n && (n.includes(kw) || kw.includes(n));
      const tm = t.some((x: string) => x.includes(kw) || kw.includes(x));
      if (nm || tm) {
        matched.push({ cat, matchType: nm ? 'name' : 'terms' });
        break;
      }
    }
  }
  return matched;
}

async function countBusinessesInCategory(catId: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/business_categories?category_id=eq.${catId}&select=business_id`, { headers: H });
  return (await res.json()).length;
}

async function searchBusinesses(keywords: string[]): Promise<{ businesses: AnyRow[]; categoryMatches: { slug: string; name: string; matchType: string; bizCount: number; included: boolean }[] }> {
  const matched = matchCategories(keywords);
  const MAX = 20;
  const categoryMatches: { slug: string; name: string; matchType: string; bizCount: number; included: boolean }[] = [];

  const includedBizIds = new Set<string>();

  for (const { cat, matchType } of matched) {
    const count = await countBusinessesInCategory(cat.id);
    const included = matchType === 'name' || count <= MAX;
    categoryMatches.push({ slug: cat.slug, name: cat.name_zh, matchType, bizCount: count, included });

    if (included) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/business_categories?category_id=eq.${cat.id}&select=business_id`, { headers: H });
      const links = await res.json();
      links.forEach((l: any) => includedBizIds.add(l.business_id));
    }
  }

  // Text search
  const orConds = keywords.flatMap(kw =>
    ['display_name', 'display_name_zh', 'short_desc_zh', 'ai_summary_zh'].map(col => `${col}.ilike.%${kw}%`)
  ).join(',');
  const textRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?is_active=eq.true&or=(${encodeURI(orConds)})&select=id&limit=10`, { headers: H });
  const textBiz = await textRes.json();
  textBiz.forEach((b: any) => includedBizIds.add(b.id));

  if (includedBizIds.size === 0) return { businesses: [], categoryMatches };

  const bizRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=in.(${[...includedBizIds].slice(0, 15).join(',')})&is_active=eq.true&select=id,display_name_zh,display_name,avg_rating,short_desc_zh&order=avg_rating.desc.nullslast&limit=15`, { headers: H });
  const businesses = await bizRes.json();

  return { businesses, categoryMatches };
}

// ─── Run Tests ───────────────────────────────────────────────────────

interface TestResult {
  query: string;
  keywords: string[];
  keywordPass: boolean;
  keywordIssue?: string;
  categoryMatches: { slug: string; name: string; matchType: string; bizCount: number; included: boolean }[];
  categoryPass: boolean;
  categoryIssue?: string;
  businessCount: number;
  resultPass: boolean;
  resultIssue?: string;
  businesses: string[];
}

async function runTest(tc: TestCase): Promise<TestResult> {
  const keywords = extractKeywords(tc.query);

  // Check keywords
  const keywordPass = tc.expectKeywords.some(ek => keywords.some(k => k.includes(ek) || ek.includes(k)));
  const keywordIssue = keywordPass ? undefined
    : `Expected one of [${tc.expectKeywords}] but got [${keywords}]`;

  // Run search
  const { businesses, categoryMatches } = await searchBusinesses(keywords);

  // Check categories
  const matchedSlugs = categoryMatches.map(m => m.slug);
  const categoryPass = tc.expectCategories.some(ec => matchedSlugs.some(s => s.includes(ec) || ec.includes(s)));
  const categoryIssue = categoryPass ? undefined
    : `Expected category [${tc.expectCategories}] but matched [${matchedSlugs.length ? matchedSlugs.join(', ') : 'NONE'}]`;

  // Check results
  const resultPass = tc.expectResults ? businesses.length > 0 : true;
  let resultIssue: string | undefined;
  if (!resultPass) {
    resultIssue = 'Expected results but got 0';
  } else if (tc.expectBusinessTerms && businesses.length > 0) {
    const allText = businesses.map((b: AnyRow) => [b.display_name_zh, b.display_name, b.short_desc_zh].filter(Boolean).join(' ')).join(' ');
    const hasTerm = tc.expectBusinessTerms.some(t => allText.includes(t));
    if (!hasTerm) {
      resultIssue = `Results don't contain expected terms [${tc.expectBusinessTerms}]`;
    }
  }

  return {
    query: tc.query,
    keywords,
    keywordPass,
    keywordIssue,
    categoryMatches,
    categoryPass,
    categoryIssue,
    businessCount: businesses.length,
    resultPass,
    resultIssue,
    businesses: businesses.slice(0, 5).map((b: AnyRow) => b.display_name_zh || b.display_name),
  };
}

async function main() {
  console.log('🔍 AI Search Self-Test\n');
  console.log('Fetching categories...');
  await fetchCategories();
  console.log(`Loaded ${allCategories.length} business categories\n`);

  const results: TestResult[] = [];
  let pass = 0, fail = 0;

  for (const tc of TEST_CASES) {
    const result = await runTest(tc);
    results.push(result);

    const allPass = result.keywordPass && result.categoryPass && result.resultPass;
    const icon = allPass ? '✅' : '❌';
    if (allPass) pass++; else fail++;

    console.log(`${icon} "${result.query}"`);
    console.log(`   Keywords: [${result.keywords.join(', ')}]${result.keywordIssue ? ' ⚠️ ' + result.keywordIssue : ''}`);

    if (result.categoryMatches.length > 0) {
      for (const cm of result.categoryMatches) {
        console.log(`   Category: ${cm.slug} (${cm.name}) [${cm.matchType}, ${cm.bizCount} biz] ${cm.included ? '✅ included' : '⏭️ skipped'}`);
      }
    } else {
      console.log(`   Category: NONE matched`);
    }
    if (result.categoryIssue) console.log(`   ⚠️ ${result.categoryIssue}`);

    console.log(`   Results: ${result.businessCount} businesses${result.resultIssue ? ' ⚠️ ' + result.resultIssue : ''}`);
    if (result.businesses.length > 0) {
      console.log(`   Top: ${result.businesses.slice(0, 3).join(' | ')}`);
    }
    console.log('');
  }

  // ─── Summary ───
  console.log('═'.repeat(60));
  console.log(`\n📊 Results: ${pass} pass, ${fail} fail out of ${TEST_CASES.length} tests\n`);

  // Report issues
  const keywordFails = results.filter(r => !r.keywordPass);
  const categoryFails = results.filter(r => !r.categoryPass);
  const resultFails = results.filter(r => !r.resultPass);

  if (keywordFails.length > 0) {
    console.log('🔤 KEYWORD EXTRACTION ISSUES:');
    for (const r of keywordFails) {
      console.log(`   "${r.query}" → [${r.keywords}] — ${r.keywordIssue}`);
    }
    console.log('   💡 Fix: Add stop words/phrases to extractKeywords()\n');
  }

  if (categoryFails.length > 0) {
    console.log('📁 CATEGORY MATCHING ISSUES:');
    for (const r of categoryFails) {
      console.log(`   "${r.query}" keywords=[${r.keywords}] — ${r.categoryIssue}`);
    }
    console.log('   💡 Fix: Add search_terms to categories via admin or populate-search-terms.ts\n');
  }

  if (resultFails.length > 0) {
    console.log('🏪 EMPTY RESULT ISSUES:');
    for (const r of resultFails) {
      console.log(`   "${r.query}" — matched categories: [${r.categoryMatches.map(m => m.slug).join(', ')}]`);
    }
    console.log('   💡 Fix: Add more businesses to matched categories, or check if category was skipped (terms-only + large)\n');
  }

  // Check for categories with 0 search_terms
  const emptyCats = allCategories.filter(c => !c.search_terms || c.search_terms.length === 0);
  if (emptyCats.length > 0) {
    console.log(`⚠️ ${emptyCats.length} categories have NO search_terms:`);
    emptyCats.forEach(c => console.log(`   - ${c.slug} (${c.name_zh})`));
    console.log('   💡 Fix: Run scripts/populate-search-terms.ts\n');
  }
}

main().catch(console.error);
