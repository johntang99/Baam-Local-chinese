/**
 * AI Business Category Classifier
 *
 * Uses Claude AI to correctly assign parent category + subcategory
 * to businesses based on their name, tags, and description.
 *
 * Usage:
 *   # Classify all businesses (dry run — preview only)
 *   source apps/web/.env.local && npx tsx scripts/classify-businesses.ts
 *
 *   # Classify all businesses (apply changes)
 *   source apps/web/.env.local && npx tsx scripts/classify-businesses.ts --apply
 *
 *   # Classify a single business by slug
 *   source apps/web/.env.local && npx tsx scripts/classify-businesses.ts --slug=natural-life-acupuncture-pc --apply
 *
 *   # Classify only businesses missing categories
 *   source apps/web/.env.local && npx tsx scripts/classify-businesses.ts --missing-only --apply
 *
 * This script can be called after crawling new businesses to auto-fix categories.
 */

import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

// ─── Parse CLI args ───────────────────────────────────────────────────

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const missingOnly = args.includes('--missing-only');
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];

// ─── Supabase REST helper ─────────────────────────────────────────────

async function supaFetch(path: string, options?: RequestInit) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': (options?.method === 'POST' || options?.method === 'DELETE') ? 'return=minimal' : 'return=representation',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${options?.method || 'GET'} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204 || options?.method === 'DELETE') return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

// ─── Types ────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name_zh: string;
  slug: string;
  parent_id: string | null;
  children?: Category[];
}

interface Business {
  id: string;
  slug: string;
  display_name: string;
  display_name_zh: string;
  short_desc_zh: string;
  short_desc_en: string;
  ai_tags: string[];
  ai_summary_zh: string;
}

interface ClassifyResult {
  business_slug: string;
  business_name: string;
  parent_slug: string;
  parent_name: string;
  sub_slug: string | null;
  sub_name: string | null;
  confidence: string;
  reason: string;
}

// ─── Load category tree ───────────────────────────────────────────────

async function loadCategories(): Promise<{ parents: Category[]; all: Category[]; bySlug: Map<string, Category> }> {
  const data: Category[] = await supaFetch('categories?select=id,name_zh,slug,parent_id&order=name_zh.asc');

  // Only business-relevant parent categories (not guide/forum categories)
  const businessParentSlugs = [
    'food-dining', 'medical-health', 'legal-immigration', 'finance-tax',
    'real-estate', 'education', 'home-renovation', 'beauty-wellness',
    'auto', 'other-services',
  ];

  const parents = data.filter(c => !c.parent_id && businessParentSlugs.includes(c.slug));
  const children = data.filter(c => c.parent_id);

  // Attach children to parents
  for (const parent of parents) {
    parent.children = children.filter(c => c.parent_id === parent.id);
  }

  const bySlug = new Map<string, Category>();
  for (const c of data) bySlug.set(c.slug, c);

  return { parents, all: data, bySlug };
}

// ─── Build category reference for AI prompt ───────────────────────────

function buildCategoryReference(parents: Category[]): string {
  return parents.map(p => {
    const subs = (p.children || []).map(c => `    - ${c.slug}: ${c.name_zh}`).join('\n');
    return `  ${p.slug}: ${p.name_zh}\n${subs || '    (no subcategories)'}`;
  }).join('\n\n');
}

// ─── AI Classification ───────────────────────────────────────────────

async function classifyBatch(
  client: Anthropic,
  businesses: Business[],
  categoryRef: string,
): Promise<ClassifyResult[]> {
  const businessList = businesses.map((b, i) => {
    const name = b.display_name_zh || b.display_name || b.slug;
    const tags = (b.ai_tags || []).join(', ');
    const desc = b.short_desc_zh || b.ai_summary_zh || b.short_desc_en || '';
    return `${i + 1}. slug="${b.slug}" | name="${name}" | tags=[${tags}] | desc="${desc.slice(0, 100)}"`;
  }).join('\n');

  const prompt = `You are a business category classifier for a Chinese community platform in NYC.

Given the category hierarchy below, classify each business into the BEST matching parent category and subcategory.

## Category Hierarchy
${categoryRef}

## Rules
1. Choose the MOST SPECIFIC subcategory when possible
2. If no subcategory fits well, use parent_slug only and set sub_slug to null
3. Use business name, tags, and description to determine the category
4. Key name indicators:
   - 针灸/中医/草药 → medical-chinese-medicine
   - 牙科/牙医 → medical-dental
   - 眼科 → medical-optometry
   - 内科/家庭医生 → medical-primary-care or medical-internal
   - 心理/counseling → medical-mental-health
   - 火锅/烧烤/BBQ → food-hotpot
   - 奶茶/tea → food-bubble-tea
   - 面包/蛋糕/bakery → food-bakery
   - 日料/sushi/ramen → food-japanese
   - 韩餐/korean → food-korean
   - 中餐 → food-chinese
   - 律师/lawyer/immigration → legal-immigration
   - 会计/CPA/accountant → finance-accounting
   - 报税/tax → finance-tax-prep
   - 保险/insurance → finance-insurance
   - 贷款/mortgage/loan → finance-mortgage
   - 地产/realtor/real estate → realestate-agent
   - 搬家/moving → home-moving
   - 装修/renovation/contractor → home-renovation
   - 美容/spa/salon/hair → beauty-wellness
   - 驾校/auto/car → auto
   - 补习/tutoring → edu-tutoring
   - 语言/language school → edu-language
   - acupuncture → medical-chinese-medicine

## Businesses to classify
${businessList}

Respond with ONLY a JSON array (no markdown fencing). Each item:
{"slug":"<business_slug>","parent_slug":"<parent_category_slug>","sub_slug":"<subcategory_slug_or_null>","confidence":"high|medium|low","reason":"<brief reason in Chinese>"}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (response.content[0] as { text: string }).text.trim();

  // Parse JSON — strip markdown fences if present
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const results = JSON.parse(jsonStr) as Array<{
      slug: string;
      parent_slug: string;
      sub_slug: string | null;
      confidence: string;
      reason: string;
    }>;

    return results.map(r => {
      const biz = businesses.find(b => b.slug === r.slug);
      return {
        business_slug: r.slug,
        business_name: biz?.display_name_zh || biz?.display_name || r.slug,
        parent_slug: r.parent_slug,
        parent_name: '',
        sub_slug: r.sub_slug,
        sub_name: null,
        confidence: r.confidence,
        reason: r.reason,
      };
    });
  } catch (e) {
    console.error('Failed to parse AI response:', text.slice(0, 200));
    return [];
  }
}

// ─── Apply classification to DB ───────────────────────────────────────

async function applyClassification(
  businessId: string,
  categoryId: string,
  existingCatIds: Set<string>,
): Promise<'inserted' | 'updated' | 'skipped'> {
  if (existingCatIds.size === 0) {
    // No existing categories — insert as primary
    await supaFetch('business_categories', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, category_id: categoryId, is_primary: true }),
    });
    return 'inserted';
  }

  if (existingCatIds.has(categoryId)) {
    return 'skipped';
  }

  // Delete existing categories and insert new one
  await supaFetch(`business_categories?business_id=eq.${businessId}`, { method: 'DELETE' });
  await supaFetch('business_categories', {
    method: 'POST',
    body: JSON.stringify({ business_id: businessId, category_id: categoryId, is_primary: true }),
  });
  return 'updated';
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🏷️  AI Business Category Classifier');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY CHANGES' : '👀 DRY RUN (preview only)'}`);
  if (slugArg) console.log(`   Target: ${slugArg}`);
  if (missingOnly) console.log(`   Scope: Missing categories only`);
  console.log('');

  // Load categories
  const { parents, bySlug } = await loadCategories();
  const categoryRef = buildCategoryReference(parents);
  console.log(`📂 Loaded ${parents.length} parent categories with subcategories\n`);

  // Load businesses
  let query = 'businesses?select=id,slug,display_name,display_name_zh,short_desc_zh,short_desc_en,ai_tags,ai_summary_zh&is_active=eq.true&order=slug.asc';
  if (slugArg) query += `&slug=eq.${slugArg}`;

  const allBusinesses: Business[] = await supaFetch(query);
  console.log(`🏪 Found ${allBusinesses.length} businesses\n`);

  // If missing-only, filter to businesses without categories
  let businesses = allBusinesses;
  if (missingOnly) {
    const allCats = await supaFetch('business_categories?select=business_id');
    const bizWithCats = new Set((allCats as Array<{ business_id: string }>).map(c => c.business_id));
    businesses = allBusinesses.filter(b => !bizWithCats.has(b.id));
    console.log(`🔍 ${businesses.length} businesses missing categories\n`);
  }

  if (businesses.length === 0) {
    console.log('Nothing to classify.');
    return;
  }

  // Classify in batches of 20
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const batchSize = 20;
  const allResults: ClassifyResult[] = [];

  for (let i = 0; i < businesses.length; i += batchSize) {
    const batch = businesses.slice(i, i + batchSize);
    console.log(`🤖 Classifying batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(businesses.length / batchSize)} (${batch.length} businesses)...`);

    const results = await classifyBatch(client, batch, categoryRef);

    // Resolve names
    for (const r of results) {
      const parent = bySlug.get(r.parent_slug);
      r.parent_name = parent?.name_zh || r.parent_slug;
      if (r.sub_slug) {
        const sub = bySlug.get(r.sub_slug);
        r.sub_name = sub?.name_zh || r.sub_slug;
      }
    }

    allResults.push(...results);

    // Rate limiting
    if (i + batchSize < businesses.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Print results
  console.log('\n' + '═'.repeat(90));
  console.log('  CLASSIFICATION RESULTS');
  console.log('═'.repeat(90));

  let updated = 0, inserted = 0, skipped = 0, errors = 0;

  for (const r of allResults) {
    const catLabel = r.sub_name ? `${r.parent_name} > ${r.sub_name}` : r.parent_name;
    const conf = r.confidence === 'high' ? '🟢' : r.confidence === 'medium' ? '🟡' : '🔴';
    console.log(`  ${conf} ${r.business_slug}`);
    console.log(`     → ${catLabel}  (${r.reason})`);

    if (applyChanges) {
      const biz = businesses.find(b => b.slug === r.business_slug);
      if (!biz) continue;

      // Determine which category ID to use (prefer subcategory)
      const targetSlug = r.sub_slug || r.parent_slug;
      const targetCat = bySlug.get(targetSlug);
      if (!targetCat) {
        console.log(`     ⚠️  Category slug "${targetSlug}" not found in DB — skipping`);
        errors++;
        continue;
      }

      // Get existing categories
      const existing = await supaFetch(`business_categories?business_id=eq.${biz.id}&select=category_id`);
      const existingIds = new Set((existing as Array<{ category_id: string }>).map(c => c.category_id));

      const result = await applyClassification(biz.id, targetCat.id, existingIds);
      if (result === 'inserted') { inserted++; console.log(`     ✅ Inserted`); }
      else if (result === 'updated') { updated++; console.log(`     ✅ Updated`); }
      else { skipped++; console.log(`     ⏭️  Already correct`); }
    }
  }

  console.log('\n' + '═'.repeat(90));
  console.log(`  SUMMARY: ${allResults.length} classified`);
  if (applyChanges) {
    console.log(`  ✅ Updated: ${updated} | ➕ Inserted: ${inserted} | ⏭️ Skipped: ${skipped} | ⚠️ Errors: ${errors}`);
  } else {
    console.log(`  👀 DRY RUN — add --apply to save changes`);
  }
  console.log('═'.repeat(90));
}

main().catch(console.error);
