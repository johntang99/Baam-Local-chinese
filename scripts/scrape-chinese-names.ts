/**
 * Scrape Chinese Business Names from nychinaren.com
 *
 * Searches nychinaren.com by phone number to find Chinese names for our businesses.
 * Updates display_name_zh in the database.
 *
 * Usage:
 *   # Dry run — preview matches only
 *   source apps/web/.env.local && npx tsx scripts/scrape-chinese-names.ts
 *
 *   # Apply changes to DB
 *   source apps/web/.env.local && npx tsx scripts/scrape-chinese-names.ts --apply
 *
 *   # Test with single business
 *   source apps/web/.env.local && npx tsx scripts/scrape-chinese-names.ts --slug=apollo-bakery
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];

// ─── Supabase helper ──────────────────────────────────────────────────

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${options?.method || 'GET'} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Scrape nychinaren.com ────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

function formatPhoneForSearch(digits: string): string {
  // nychinaren search works with formats like: 718-888-0919
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}

function extractChineseName(html: string): { name_zh: string; name_en: string | null } | null {
  // Check for "no results" first
  if (html.includes('search_not_find.png') || html.includes('没有找到')) {
    return null;
  }

  // nychinaren HTML structure:
  // <div class='company-title'>
  //   <a ... title='阿波萝西点面包'>阿波萝西点面包</a>
  //   <span class="blue_font">-</span>
  //   <a ... title='Apollo Bakery'>Apollo Bakery</a>
  // </div>

  // Pattern 1: company-title div with paired Chinese/English links
  const companyTitleBlocks = html.match(/<div\s+class\s*=\s*'company-title'[^>]*>[\s\S]*?<\/div>/gi);
  if (companyTitleBlocks && companyTitleBlocks.length > 0) {
    // Use the first result (most relevant)
    const block = companyTitleBlocks[0];

    // Extract all title attributes from links within the block
    const titles: string[] = [];
    const titleMatches = block.matchAll(/title\s*=\s*'([^']+)'/gi);
    for (const m of titleMatches) {
      titles.push(m[1].trim());
    }

    // Also extract link text
    const linkTexts: string[] = [];
    const linkMatches = block.matchAll(/>([^<]+)<\/a>/gi);
    for (const m of linkMatches) {
      linkTexts.push(m[1].trim());
    }

    // Find the Chinese name (first title/text with Chinese characters)
    const allNames = [...titles, ...linkTexts];
    const zhName = allNames.find(n => /[\u4e00-\u9fff]/.test(n) && n.length >= 2 && n.length <= 50);
    const enName = allNames.find(n => /[a-zA-Z]{2,}/.test(n) && !/[\u4e00-\u9fff]/.test(n));

    if (zhName) {
      // Clean up: remove any trailing descriptions
      const cleaned = zhName.replace(/[,，].{20,}$/, '').trim();
      return { name_zh: cleaned, name_en: enName || null };
    }
  }

  // Pattern 2: Fallback — any link with title containing Chinese near regular_company class
  const regularBlocks = html.match(/<dl\s+class='regular_company'>[\s\S]*?<\/dl>/gi);
  if (regularBlocks && regularBlocks.length > 0) {
    const block = regularBlocks[0];
    const titleMatch = block.match(/title\s*=\s*'([^']*[\u4e00-\u9fff][^']*)'/i);
    if (titleMatch) {
      const name = titleMatch[1].trim();
      if (name.length >= 2 && name.length <= 50) {
        return { name_zh: name, name_en: null };
      }
    }
  }

  return null;
}

function parseChineseEnglishName(fullName: string): { name_zh: string; name_en: string | null } | null {
  // Skip navigation/UI text
  const skipPatterns = ['首页', '商家', '搜索', '登录', '注册', '查询', '请稍候', '发布', '论坛', '资讯',
    '纽约华人', '点击查看', '查看地图', '商家点评', '陈先生', '张先生', '李先生', '王先生'];
  if (skipPatterns.some(p => fullName === p || fullName.includes(p))) return null;
  // Reject names that are too short or too generic
  if (fullName.length <= 2) return null;

  // Check if it contains Chinese characters
  const hasChinese = /[\u4e00-\u9fff]/.test(fullName);
  if (!hasChinese) return null;

  // Try to split Chinese and English parts
  // Common patterns: "中文名 - English Name", "中文名/English Name", "中文名 English Name"
  const separators = [' - ', ' / ', '/', '|', '｜'];
  for (const sep of separators) {
    if (fullName.includes(sep)) {
      const parts = fullName.split(sep).map(s => s.trim());
      const zhPart = parts.find(p => /[\u4e00-\u9fff]/.test(p));
      const enPart = parts.find(p => /[a-zA-Z]{2,}/.test(p) && !/[\u4e00-\u9fff]/.test(p));
      if (zhPart) return { name_zh: zhPart, name_en: enPart || null };
    }
  }

  // If the whole string is mostly Chinese, use it as-is
  const chineseChars = (fullName.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseChars >= 2) {
    return { name_zh: fullName, name_en: null };
  }

  return null;
}

async function searchNychinaren(phone: string): Promise<{ name_zh: string; name_en: string | null } | null> {
  const formattedPhone = formatPhoneForSearch(phone);
  const url = `https://www.nychinaren.com/company/task_category/key_${formattedPhone}.html`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Check for "no results" indicator
    if (html.includes('search_not_find.png') || html.includes('没有找到')) {
      return null;
    }

    return extractChineseName(html);
  } catch (err) {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Chinese Name Scraper — nychinaren.com');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}`);
  if (slugArg) console.log(`   Target: ${slugArg}`);
  console.log('');

  // Load businesses
  let query = 'businesses?select=id,slug,display_name,display_name_zh,phone&is_active=eq.true&phone=neq.null&order=slug.asc';
  if (slugArg) query += `&slug=eq.${slugArg}`;

  const businesses = await supaFetch(query) as Array<{
    id: string; slug: string; display_name: string;
    display_name_zh: string | null; phone: string;
  }>;

  // Filter to businesses needing Chinese names
  const needsZhName = businesses.filter(b => {
    const hasZh = b.display_name_zh && b.display_name_zh.trim().length > 0;
    const hasZhInEn = /[\u4e00-\u9fff]/.test(b.display_name || '');
    return !hasZh && !hasZhInEn;
  });

  console.log(`📊 Total businesses with phone: ${businesses.length}`);
  console.log(`🔎 Need Chinese name: ${needsZhName.length}`);
  console.log('');

  let matched = 0;
  let notFound = 0;
  let errors = 0;
  let skipped = 0;
  const results: Array<{ slug: string; en: string; zh: string }> = [];

  for (let i = 0; i < needsZhName.length; i++) {
    const biz = needsZhName[i];
    const digits = normalizePhone(biz.phone);

    if (digits.length < 10) {
      skipped++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${needsZhName.length}] ${biz.display_name.slice(0, 40).padEnd(42)} `);

    try {
      const result = await searchNychinaren(digits);

      if (result && result.name_zh) {
        matched++;
        results.push({ slug: biz.slug, en: biz.display_name, zh: result.name_zh });
        console.log(`✅ → ${result.name_zh}`);

        if (applyChanges) {
          await supaFetch(`businesses?id=eq.${biz.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ display_name_zh: result.name_zh }),
          });
        }
      } else {
        notFound++;
        console.log('❌ not found');
      }
    } catch (err) {
      errors++;
      console.log(`⚠️ error`);
    }

    // Rate limit: 1.5 seconds between requests
    if (i < needsZhName.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  RESULTS');
  console.log('═'.repeat(70));
  console.log(`  ✅ Matched: ${matched}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  ⏭️ Skipped (bad phone): ${skipped}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  console.log(`  📊 Hit rate: ${needsZhName.length > 0 ? Math.round(matched * 100 / (matched + notFound)) : 0}%`);

  if (results.length > 0) {
    console.log('\n  MATCHES:');
    for (const r of results) {
      console.log(`    ${r.en.slice(0, 35).padEnd(37)} → ${r.zh}`);
    }
  }

  if (!applyChanges && matched > 0) {
    console.log(`\n  👀 DRY RUN — add --apply to save ${matched} Chinese names to DB`);
  }
  console.log('═'.repeat(70));
}

main().catch(console.error);
