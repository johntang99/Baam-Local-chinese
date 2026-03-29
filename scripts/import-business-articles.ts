/**
 * Import Business Website Articles into Baam
 *
 * Scrapes blog articles from a business's website, translates to Chinese
 * via Claude, and creates articles linked to the business.
 *
 * Usage:
 *   # Dry run
 *   source apps/web/.env.local && npx tsx scripts/import-business-articles.ts --business=natural-life-acupuncture-pc
 *
 *   # Apply
 *   source apps/web/.env.local && npx tsx scripts/import-business-articles.ts --business=natural-life-acupuncture-pc --apply
 */

import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const businessSlug = args.find(a => a.startsWith('--business='))?.split('=')[1];
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const LIMIT = limitArg ? parseInt(limitArg) : 3;

if (!businessSlug) {
  console.error('Usage: npx tsx scripts/import-business-articles.ts --business=<slug> [--apply] [--limit=N]');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

async function supaFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options?.method === 'DELETE' ? 'return=minimal' : 'return=representation',
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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractBlogLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];

  // Find all href links containing /blog/ with a slug after it
  const linkMatches = html.matchAll(/href=["']([^"']*\/blog\/[a-z0-9][a-z0-9-]+[a-z0-9])["']/gi);
  for (const m of linkMatches) {
    let url = m[1];
    if (url.startsWith('/')) url = new URL(url, baseUrl).href;
    if (url.startsWith('http')) links.push(url);
  }

  // Also look for /post/, /article/, /news/ patterns with slugs
  const otherPatterns = html.matchAll(/href=["']([^"']*\/(?:post|article|news)\/[a-z0-9][a-z0-9-]+[a-z0-9])["']/gi);
  for (const m of otherPatterns) {
    let url = m[1];
    if (url.startsWith('/')) url = new URL(url, baseUrl).href;
    if (url.startsWith('http') && !links.includes(url)) links.push(url);
  }

  // Deduplicate: prefer /en/ over /zh/ versions
  const seen = new Set<string>();
  return [...new Set(links)].filter(url => {
    const slug = url.replace(/.*\/blog\//, '').replace(/.*\/post\//, '');
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function extractArticleContent(html: string): { title: string; body: string; image: string | null } {
  // Extract title
  // Extract title — try og:title first, then h1, then <title>
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = ogTitle?.[1] || h1Match?.[1] || titleTag?.[1] || '';
  const title = rawTitle.trim().replace(/\s*[|]\s*.*$/, '').trim();

  // Extract cover image — prefer in-content images over OG default
  const contentImages = html.matchAll(/(?:src|srcSet)=["']([^"']*(?:supabase|unsplash|cloudinary|amazonaws)[^"']*\.(?:jpg|jpeg|png|webp))[^"']*/gi);
  let image: string | null = null;
  for (const m of contentImages) {
    const url = m[1].split(/[&?]w=/)[0]; // strip Next.js image params
    if (!url.includes('logo') && !url.includes('icon') && !url.includes('svg')) {
      image = url;
      break;
    }
  }
  // Fallback to OG image (but skip generic defaults)
  if (!image) {
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImage && !ogImage[1].includes('og-default')) image = ogImage[1];
  }

  // Extract article body — collect all meaningful paragraphs
  let body = '';
  const paragraphs = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  const texts: string[] = [];
  for (const m of paragraphs) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length >= 15) texts.push(text);
  }

  // Also grab h2/h3 headings for structure
  const headings = html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi);
  for (const m of headings) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length >= 3 && text.length <= 100) texts.push(`## ${text}`);
  }

  body = texts.join('\n\n');

  // Clean HTML tags from body
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return { title, body, image };
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

async function translateAndFormat(
  client: Anthropic,
  title: string,
  body: string,
  businessName: string,
): Promise<{ title_zh: string; title_en: string; body_zh: string; summary_zh: string }> {
  const prompt = `You are translating a business blog article for a Chinese community platform in NYC.

Business: ${businessName}
Original Title: ${title}
Original Content (excerpt):
${body.slice(0, 3000)}

Please provide:
1. Chinese title (natural, not literal translation)
2. English title (clean version of original)
3. Chinese article body in Markdown format (translate the full content naturally, 300-500 characters, keep it informative and useful)
4. Chinese summary (2-3 sentences, 80-120 characters)

Respond in JSON format (no markdown fencing):
{"title_zh":"...","title_en":"...","body_zh":"...","summary_zh":"..."}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (response.content[0] as { text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Fallback: extract fields with regex
    const titleZh = jsonStr.match(/"title_zh"\s*:\s*"([^"]+)"/)?.[1] || title;
    const titleEn = jsonStr.match(/"title_en"\s*:\s*"([^"]+)"/)?.[1] || title;
    const bodyZh = jsonStr.match(/"body_zh"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"summary|"\s*})/)?.[1] || '';
    const summaryZh = jsonStr.match(/"summary_zh"\s*:\s*"([^"]+)"/)?.[1] || '';
    return { title_zh: titleZh, title_en: titleEn, body_zh: bodyZh.replace(/\\n/g, '\n'), summary_zh: summaryZh };
  }
}

async function main() {
  console.log('📰 Business Article Importer');
  console.log(`   Business: ${businessSlug}`);
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}`);
  console.log(`   Limit: ${LIMIT} articles\n`);

  // Get business
  const businesses = await supaFetch(`businesses?select=id,slug,display_name,display_name_zh,website_url&slug=eq.${businessSlug}`) as AnyRow[];
  if (!businesses || businesses.length === 0) {
    console.error(`❌ Business "${businessSlug}" not found`);
    process.exit(1);
  }
  const biz = businesses[0];
  const bizName = biz.display_name_zh || biz.display_name;

  if (!biz.website_url) {
    console.error(`❌ Business "${bizName}" has no website_url`);
    process.exit(1);
  }

  console.log(`🏪 ${bizName} — ${biz.website_url}\n`);

  // Find blog page
  const baseUrl = biz.website_url.replace(/\/$/, '');
  let blogLinks: string[] = [];

  // Try common blog URLs
  const blogUrls = [`${baseUrl}/blog`, `${baseUrl}/en/blog`, `${baseUrl}/news`, `${baseUrl}/articles`];

  for (const blogUrl of blogUrls) {
    try {
      console.log(`🔍 Checking ${blogUrl}...`);
      const html = await fetchPage(blogUrl);
      blogLinks = extractBlogLinks(html, baseUrl);
      if (blogLinks.length > 0) {
        console.log(`   Found ${blogLinks.length} article links\n`);
        break;
      }
    } catch {
      // Try next URL
    }
  }

  // Also try main page for blog links
  if (blogLinks.length === 0) {
    try {
      const html = await fetchPage(baseUrl);
      blogLinks = extractBlogLinks(html, baseUrl);
    } catch {}
  }

  if (blogLinks.length === 0) {
    console.log('❌ No blog articles found on the website');
    process.exit(0);
  }

  // Limit articles
  blogLinks = blogLinks.slice(0, LIMIT);
  console.log(`📝 Processing ${blogLinks.length} articles:\n`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let imported = 0;

  for (let i = 0; i < blogLinks.length; i++) {
    const url = blogLinks[i];
    console.log(`  [${i + 1}/${blogLinks.length}] ${url}`);

    try {
      // Fetch article page
      const html = await fetchPage(url);
      const { title, body, image } = extractArticleContent(html);

      if (!title || body.length < 50) {
        console.log(`     ⏭️ Too short or no content\n`);
        continue;
      }

      console.log(`     Title: ${title.slice(0, 60)}`);

      // Translate with AI
      const translated = await translateAndFormat(client, title, body, bizName);
      console.log(`     中文: ${translated.title_zh}`);

      if (applyChanges) {
        const slug = generateSlug(translated.title_en || title);
        const domain = new URL(url).hostname.replace(/^www\./, '');

        // Insert article
        const articleData = await supaFetch('articles', {
          method: 'POST',
          body: JSON.stringify({
            slug,
            title_zh: translated.title_zh,
            title_en: translated.title_en,
            body_zh: translated.body_zh,
            ai_summary_zh: translated.summary_zh,
            content_vertical: 'guide_howto',
            source_type: 'business_website',
            source_url: url,
            source_name: bizName,
            editorial_status: 'published',
            published_at: new Date().toISOString(),
            cover_image_url: image,
          }),
        }) as AnyRow[];

        if (articleData && articleData[0]?.id) {
          // Link to business
          await supaFetch('guide_business_links', {
            method: 'POST',
            body: JSON.stringify({
              article_id: articleData[0].id,
              business_id: biz.id,
              relation_type: 'featured',
            }),
          });
          console.log(`     ✅ Saved (id: ${articleData[0].id.slice(0, 8)})`);
        }
      } else {
        console.log(`     👀 Would save (dry run)`);
      }

      imported++;
      console.log('');
    } catch (err) {
      console.log(`     ⚠️ ${err instanceof Error ? err.message.slice(0, 60) : 'error'}\n`);
    }

    // Rate limit
    if (i < blogLinks.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('═'.repeat(60));
  console.log(`  ✅ Imported: ${imported}/${blogLinks.length}`);
  if (!applyChanges && imported > 0) console.log(`  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
