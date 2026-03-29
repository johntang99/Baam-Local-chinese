/**
 * Scrape Chinese Business Names from nychinaren.com — Pass 2: Search by English Name
 *
 * For businesses that weren't matched by phone in pass 1,
 * try matching by English business name.
 *
 * Usage:
 *   # Dry run
 *   source apps/web/.env.local && npx tsx scripts/scrape-chinese-names-by-name.ts
 *
 *   # Apply
 *   source apps/web/.env.local && npx tsx scripts/scrape-chinese-names-by-name.ts --apply
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');

async function supaFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options?.method === 'PATCH' ? 'return=minimal' : '',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Skip patterns for bad results
const SKIP_PATTERNS = ['首页', '商家', '搜索', '登录', '注册', '查询', '请稍候', '发布', '论坛',
  '资讯', '纽约华人', '点击查看', '查看地图', '商家点评'];

function extractChineseName(html: string): string | null {
  if (html.includes('search_not_find.png') || html.includes('没有找到')) return null;

  // Look for company-title blocks
  const blocks = html.match(/<div\s+class\s*=\s*'company-title'[^>]*>[\s\S]*?<\/div>/gi);
  if (!blocks || blocks.length === 0) return null;

  const block = blocks[0];
  const titles: string[] = [];
  const titleMatches = block.matchAll(/title\s*=\s*'([^']+)'/gi);
  for (const m of titleMatches) titles.push(m[1].trim());

  const linkMatches = block.matchAll(/>([^<]+)<\/a>/gi);
  for (const m of linkMatches) titles.push(m[1].trim());

  // Find Chinese name
  for (const t of titles) {
    if (/[\u4e00-\u9fff]/.test(t) && t.length >= 2 && t.length <= 50) {
      if (SKIP_PATTERNS.some(p => t.includes(p))) continue;
      return t.replace(/[,，].{20,}$/, '').trim();
    }
  }
  return null;
}

function extractPhoneFromHtml(html: string): string[] {
  // Extract phone numbers from nychinaren result to verify match
  const phones: string[] = [];
  const phoneMatches = html.matchAll(/电话[：:&nbsp;\s]*([^<\n]{7,20})/gi);
  for (const m of phoneMatches) {
    phones.push(m[1].replace(/[^0-9]/g, ''));
  }
  return phones;
}

function cleanSearchName(name: string): string {
  // Remove common suffixes that pollute search
  return name
    .replace(/\s*[-–—|]\s*(Flushing|Queens|NYC|New York|Brooklyn|Bayside).*/i, '')
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s*[,，].*$/, '')
    .replace(/\s+(Inc\.?|Corp\.?|LLC|PLLC|PC|P\.?C\.?)$/i, '')
    .trim();
}

async function searchByName(name: string): Promise<string | null> {
  const searchName = cleanSearchName(name);
  if (searchName.length < 3) return null;

  const url = `https://www.nychinaren.com/company/task_category/key_${encodeURIComponent(searchName)}.html`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractChineseName(html);
  } catch {
    return null;
  }
}

async function main() {
  console.log('🔍 Chinese Name Scraper — Pass 2: Search by English Name');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  // Get businesses still missing Chinese names
  const businesses = await supaFetch(
    'businesses?select=id,slug,display_name,display_name_zh,phone&is_active=eq.true&order=slug.asc'
  ) as Array<{ id: string; slug: string; display_name: string; display_name_zh: string | null; phone: string | null }>;

  const needsName = businesses.filter(b => {
    const hasZh = (b.display_name_zh || '').trim().length > 0;
    const hasZhInEn = /[\u4e00-\u9fff]/.test(b.display_name || '');
    return !hasZh && !hasZhInEn;
  });

  console.log(`📊 Total businesses: ${businesses.length}`);
  console.log(`🔎 Still need Chinese name: ${needsName.length}\n`);

  let matched = 0, notFound = 0, errors = 0;
  const results: Array<{ slug: string; en: string; zh: string }> = [];

  for (let i = 0; i < needsName.length; i++) {
    const biz = needsName[i];
    process.stdout.write(`  [${i + 1}/${needsName.length}] ${biz.display_name.slice(0, 40).padEnd(42)} `);

    try {
      const zhName = await searchByName(biz.display_name);

      if (zhName) {
        matched++;
        results.push({ slug: biz.slug, en: biz.display_name, zh: zhName });
        console.log(`✅ → ${zhName}`);

        if (applyChanges) {
          await supaFetch(`businesses?id=eq.${biz.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ display_name_zh: zhName }),
          });
        }
      } else {
        notFound++;
        console.log('❌');
      }
    } catch {
      errors++;
      console.log('⚠️ error');
    }

    // Rate limit
    if (i < needsName.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  ✅ Matched: ${matched}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  console.log(`  📊 Hit rate: ${needsName.length > 0 ? Math.round(matched * 100 / (matched + notFound)) : 0}%`);

  if (results.length > 0) {
    console.log('\n  MATCHES:');
    for (const r of results) {
      console.log(`    ${r.en.slice(0, 35).padEnd(37)} → ${r.zh}`);
    }
  }

  if (!applyChanges && matched > 0) {
    console.log(`\n  👀 DRY RUN — add --apply to save ${matched} names`);
  }
  console.log('═'.repeat(70));
}

main().catch(console.error);
