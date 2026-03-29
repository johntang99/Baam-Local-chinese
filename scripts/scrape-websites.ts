/**
 * Scrape Business Websites from nychinaren.com
 *
 * For businesses missing website_url, searches nychinaren.com by phone number,
 * then visits the detail page to extract the business website URL.
 *
 * Usage:
 *   # Dry run
 *   source apps/web/.env.local && npx tsx scripts/scrape-websites.ts
 *
 *   # Apply
 *   source apps/web/.env.local && npx tsx scripts/scrape-websites.ts --apply
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

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

// Domains to exclude (navigation, ads, sister sites)
const EXCLUDE_DOMAINS = [
  'nychinaren', 'google', 'facebook', 'jquery', 'swiper', 'gstatic',
  'weixin', 'weibo', 'twitter', 'w3.org', 'chinesein', 'schema.org',
  'firebaseapp', 'cloudflare', 'bing', 'yahoo', 'baidu', 'dealtuan',
  'chicagochinaren', 'dallasren', 'dcchinaren', 'denverchinaren',
  'sdchinaren', 'seattlechinaren', 'vegaschinaren', 'chineseinla',
  'instagram.com', 'youtube.com', 'tiktok.com', 'yelp.com',
  'amazonaws.com', 'cdn.', 'fonts.', 'bootstrapcdn',
];

function formatPhone(digits: string): string {
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return digits;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function extractDetailUrl(html: string): string | null {
  // Find first detail page link: href='/company/task_view/id_XXXXX/...'
  // or href='/restaurant/task_view/id_XXXXX/...'
  const match = html.match(/href='(\/(?:company|restaurant|doctor|lawyer|school|auto_repair|insurance|accountant|realestate|beauty)[^']*task_view\/id_[^']*?)'/i);
  return match ? match[1] : null;
}

function extractWebsite(html: string): string | null {
  // Find all external URLs
  const urlMatches = html.matchAll(/https?:\/\/[a-zA-Z0-9./?=_&%#-]{5,200}/gi);
  const urls: string[] = [];

  for (const m of urlMatches) {
    const url = m[0].replace(/['")\]}>]+$/, ''); // strip trailing chars
    const domain = url.toLowerCase();

    // Skip excluded domains
    if (EXCLUDE_DOMAINS.some(d => domain.includes(d))) continue;

    // Must look like a real website (not an image/css/js)
    if (/\.(gif|png|jpg|jpeg|css|js|ico|svg|woff|ttf)(\?|$)/i.test(url)) continue;

    urls.push(url);
  }

  if (urls.length === 0) return null;

  // Prefer URLs that look like a homepage (shorter, no deep paths)
  const sorted = urls.sort((a, b) => a.length - b.length);
  return sorted[0];
}

async function findWebsite(phone: string): Promise<string | null> {
  const formatted = formatPhone(phone);

  // Step 1: Search by phone
  const searchHtml = await fetchPage(`https://www.nychinaren.com/company/task_category/key_${formatted}.html`);
  if (!searchHtml || searchHtml.includes('search_not_find.png')) return null;

  // Step 2: Get detail page URL
  const detailPath = extractDetailUrl(searchHtml);
  if (!detailPath) return null;

  // Step 3: Fetch detail page
  const detailHtml = await fetchPage(`https://www.nychinaren.com${detailPath}`);
  if (!detailHtml) return null;

  // Step 4: Extract website
  return extractWebsite(detailHtml);
}

async function main() {
  console.log('🌐 Website Scraper — nychinaren.com');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  // Get businesses missing website_url but having phone
  const businesses = await supaFetch(
    'businesses?select=id,slug,display_name,display_name_zh,phone,website_url&is_active=eq.true&phone=neq.null&order=slug.asc'
  ) as Array<{
    id: string; slug: string; display_name: string;
    display_name_zh: string | null; phone: string; website_url: string | null;
  }>;

  const needsWebsite = businesses.filter(b => !(b.website_url || '').trim());

  console.log(`📊 Total businesses with phone: ${businesses.length}`);
  console.log(`🔎 Missing website: ${needsWebsite.length}\n`);

  let matched = 0, notFound = 0, noDetailPage = 0, errors = 0;
  const results: Array<{ slug: string; name: string; website: string }> = [];

  for (let i = 0; i < needsWebsite.length; i++) {
    const biz = needsWebsite[i];
    const digits = biz.phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) continue;

    const name = (biz.display_name_zh || biz.display_name || '').slice(0, 35);
    process.stdout.write(`  [${i + 1}/${needsWebsite.length}] ${name.padEnd(37)} `);

    try {
      const website = await findWebsite(digits);

      if (website) {
        matched++;
        results.push({ slug: biz.slug, name: biz.display_name, website });
        console.log(`✅ → ${website}`);

        if (applyChanges) {
          await supaFetch(`businesses?id=eq.${biz.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ website_url: website }),
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

    // Rate limit: 2s (we're making 2 requests per business)
    if (i < needsWebsite.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  ✅ Websites found: ${matched}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  console.log(`  📊 Hit rate: ${needsWebsite.length > 0 ? Math.round(matched * 100 / (matched + notFound)) : 0}%`);

  if (results.length > 0) {
    console.log('\n  MATCHES:');
    for (const r of results) {
      console.log(`    ${r.name.slice(0, 30).padEnd(32)} → ${r.website}`);
    }
  }

  if (!applyChanges && matched > 0) {
    console.log(`\n  👀 DRY RUN — add --apply to save ${matched} websites`);
  }
  console.log('═'.repeat(70));
}

main().catch(console.error);
