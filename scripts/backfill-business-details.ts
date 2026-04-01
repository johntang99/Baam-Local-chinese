/**
 * Backfill Business Details: Hours, Chinese Names, Descriptions
 *
 * Fills 3 major data gaps:
 * 1. hours_json — from Google Place Details
 * 2. display_name_zh — from Google Place Details (zh-CN language)
 * 3. short_desc_zh + short_desc_en — from Google editorial + AI generation
 *
 * Usage:
 *   # Dry run
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-details.ts
 *
 *   # Apply
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-details.ts --apply
 *
 *   # Limit for testing
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-details.ts --apply --limit=20
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;
const skipAI = args.includes('--skip-ai');

type AnyRow = Record<string, any>;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// ─── Supabase helpers ────────────────────────────────────────────

async function supaGet(path: string): Promise<AnyRow[]> {
  const allResults: AnyRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: H });
    if (!res.ok) throw new Error(`Supabase GET ${res.status}`);
    const batch = await res.json();
    allResults.push(...batch);
    if (batch.length < 1000) break;
  }
  return allResults;
}

async function supaPatch(table: string, id: string, data: AnyRow) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${(await res.text()).slice(0, 100)}`);
}

// ─── Google Places API ───────────────────────────────────────────

async function getPlaceDetailsEN(placeId: string): Promise<AnyRow | null> {
  const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'displayName,regularOpeningHours,editorialSummary,businessStatus,primaryType,primaryTypeDisplayName,types,websiteUri,nationalPhoneNumber',
      'X-Goog-Api-Language': 'en',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

async function getPlaceDetailsZH(placeId: string): Promise<AnyRow | null> {
  const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'displayName,editorialSummary,primaryTypeDisplayName',
      'X-Goog-Api-Language': 'zh-CN',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

// ─── Hours conversion ────────────────────────────────────────────

function convertHours(googleHours: AnyRow | undefined): AnyRow | null {
  if (!googleHours?.periods) return null;
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const result: AnyRow = {};
  for (const period of googleHours.periods) {
    const day = dayNames[period.open?.day];
    if (day && period.open && period.close) {
      const openH = String(period.open.hour).padStart(2, '0');
      const openM = String(period.open.minute || 0).padStart(2, '0');
      const closeH = String(period.close.hour).padStart(2, '0');
      const closeM = String(period.close.minute || 0).padStart(2, '0');
      result[day] = { open: `${openH}:${openM}`, close: `${closeH}:${closeM}` };
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// ─── AI Description Generation ───────────────────────────────────

let anthropic: any = null;

async function generateDescriptions(biz: AnyRow, googleEN: AnyRow | null, googleZH: AnyRow | null, reviews: AnyRow[]): Promise<{ zh: string; en: string } | null> {
  if (!ANTHROPIC_API_KEY) return null;

  if (!anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }

  // Build context from all available data
  const name = biz.display_name_zh || biz.display_name || '';
  const enName = biz.display_name || '';
  const addr = biz.address_full || '';
  const phone = biz.phone || '';
  const rating = biz.avg_rating ? `${biz.avg_rating}分(${biz.review_count || 0}条评价)` : '';
  const googleDesc = googleEN?.editorialSummary?.text || '';
  const googleDescZH = googleZH?.editorialSummary?.text || '';
  const googleType = googleEN?.primaryTypeDisplayName?.text || '';
  const googleTypeZH = googleZH?.primaryTypeDisplayName?.text || '';
  const website = biz.website_url || '';
  const tags = (biz.ai_tags || []).join('、');

  // Include review snippets
  const reviewSnippets = reviews
    .filter(r => r.body && r.body.length > 10)
    .slice(0, 3)
    .map(r => `"${r.body.slice(0, 80)}" (${r.rating}星)`)
    .join('\n');

  const prompt = `为以下商家撰写中文和英文简介。

商家信息：
- 名称：${name} / ${enName}
- 类型：${googleTypeZH || googleType || ''}
- 地址：${addr}
- 评分：${rating}
- 标签：${tags}
${googleDesc ? `- Google描述：${googleDesc}` : ''}
${googleDescZH ? `- Google中文描述：${googleDescZH}` : ''}
${reviewSnippets ? `- 用户评价摘录：\n${reviewSnippets}` : ''}
${website ? `- 网站：${website}` : ''}

要求：
1. 中文简介(50-100字)：用亲切自然的中文写，像本地华人介绍给朋友一样。提到特色、优势、适合什么人群。不要翻译腔。
2. 英文简介(30-60 words)：Professional, concise, highlight key features.
3. 内容要准确，只写有依据的信息，不要编造。如果信息不足，写简短精炼的介绍即可。

格式（严格遵守）：
ZH: [中文简介]
EN: [English description]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const zhMatch = text.match(/ZH:\s*(.+?)(?:\n|EN:)/s);
    const enMatch = text.match(/EN:\s*(.+?)$/s);

    const zh = zhMatch?.[1]?.trim();
    const en = enMatch?.[1]?.trim();

    if (zh && en && zh.length >= 10 && en.length >= 10) {
      return { zh, en };
    }
  } catch {
    // AI generation failed
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('📋 Backfill Business Details: Hours, Chinese Names, Descriptions');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}${skipAI ? ' (skip AI)' : ''}\n`);

  // Fetch all businesses with gaps
  const businesses = await supaGet('businesses?is_active=eq.true&google_place_id=not.is.null&select=id,display_name,display_name_zh,phone,website_url,short_desc_en,short_desc_zh,address_full,avg_rating,review_count,ai_tags,google_place_id&order=review_count.desc.nullslast');
  const locations = await supaGet('business_locations?is_primary=eq.true&select=id,business_id,hours_json');
  const locMap = new Map(locations.map(l => [l.business_id, l]));

  // Fetch reviews for AI descriptions
  let reviewMap: Map<string, AnyRow[]> = new Map();
  if (!skipAI) {
    const reviews = await supaGet('reviews?source=eq.google&status=eq.approved&select=business_id,body,rating&order=rating.desc');
    for (const r of reviews) {
      if (!reviewMap.has(r.business_id)) reviewMap.set(r.business_id, []);
      const list = reviewMap.get(r.business_id)!;
      if (list.length < 3) list.push(r);
    }
  }

  // Filter to businesses that need updates
  const needsWork = businesses.filter(b => {
    const loc = locMap.get(b.id);
    const needsHours = loc && (!loc.hours_json || Object.keys(loc.hours_json).length === 0);
    const needsZhName = !b.display_name_zh;
    const needsDesc = !b.short_desc_zh || !b.short_desc_en;
    return needsHours || needsZhName || needsDesc;
  });

  const toProcess = limitArg ? needsWork.slice(0, limitArg) : needsWork;
  console.log(`📊 Total: ${businesses.length} | Need updates: ${needsWork.length} | Processing: ${toProcess.length}\n`);

  let stats = { hours: 0, zhName: 0, descZh: 0, descEn: 0, website: 0, phone: 0, errors: 0 };

  for (let i = 0; i < toProcess.length; i++) {
    const biz = toProcess[i];
    const loc = locMap.get(biz.id);
    const displayName = (biz.display_name_zh || biz.display_name || '').slice(0, 30);
    const updates: string[] = [];

    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${displayName.padEnd(32)} `);

    try {
      const bizUpdate: AnyRow = {};
      const locUpdate: AnyRow = {};

      // ─── Google EN: hours, editorial, website, phone ───
      const detailEN = await getPlaceDetailsEN(biz.google_place_id);
      await new Promise(r => setTimeout(r, 100));

      if (detailEN) {
        // Hours
        if (loc && (!loc.hours_json || Object.keys(loc.hours_json).length === 0)) {
          const hours = convertHours(detailEN.regularOpeningHours);
          if (hours) { locUpdate.hours_json = hours; stats.hours++; updates.push('hours'); }
        }

        // English description from Google
        if (!biz.short_desc_en && detailEN.editorialSummary?.text) {
          bizUpdate.short_desc_en = detailEN.editorialSummary.text;
          stats.descEn++;
          updates.push('desc_en(google)');
        }

        // Fill website/phone gaps
        if (!biz.website_url && detailEN.websiteUri) {
          bizUpdate.website_url = detailEN.websiteUri;
          stats.website++;
          updates.push('website');
        }
        if (!biz.phone && detailEN.nationalPhoneNumber) {
          bizUpdate.phone = detailEN.nationalPhoneNumber;
          stats.phone++;
          updates.push('phone');
        }
      }

      // ─── Google ZH: Chinese name, Chinese editorial ───
      let detailZH: AnyRow | null = null;
      if (!biz.display_name_zh || (!biz.short_desc_zh && !skipAI)) {
        detailZH = await getPlaceDetailsZH(biz.google_place_id);
        await new Promise(r => setTimeout(r, 100));

        if (detailZH) {
          // Chinese name
          if (!biz.display_name_zh) {
            const zhName = detailZH.displayName?.text || '';
            // Only use if it contains Chinese characters
            if (/[\u4e00-\u9fff]/.test(zhName)) {
              bizUpdate.display_name_zh = zhName;
              stats.zhName++;
              updates.push('zh_name');
            }
          }
        }
      }

      // ─── AI: Generate Chinese + English descriptions ───
      if (!skipAI && (!biz.short_desc_zh || !biz.short_desc_en)) {
        const reviews = reviewMap.get(biz.id) || [];
        const descs = await generateDescriptions(
          { ...biz, ...bizUpdate }, // include any updates from above
          detailEN,
          detailZH,
          reviews,
        );
        if (descs) {
          if (!biz.short_desc_zh) {
            bizUpdate.short_desc_zh = descs.zh;
            stats.descZh++;
            updates.push('desc_zh(AI)');
          }
          if (!biz.short_desc_en && !bizUpdate.short_desc_en) {
            bizUpdate.short_desc_en = descs.en;
            stats.descEn++;
            updates.push('desc_en(AI)');
          }
        }
      }

      // ─── Apply updates ───
      if (updates.length > 0) {
        console.log(`✅ ${updates.join(', ')}`);
        if (applyChanges) {
          if (Object.keys(bizUpdate).length > 0) await supaPatch('businesses', biz.id, bizUpdate);
          if (Object.keys(locUpdate).length > 0 && loc) await supaPatch('business_locations', loc.id, locUpdate);
        }
      } else {
        console.log('— nothing new from Google');
      }

    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        console.log('⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        i--; continue;
      }
      stats.errors++;
      console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 60) : 'error'}`);
    }

    // Rate limit between businesses
    await new Promise(r => setTimeout(r, 300));
  }

  // ─── Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log(`  🕐 Hours filled:        ${stats.hours}`);
  console.log(`  🇨🇳 Chinese names added: ${stats.zhName}`);
  console.log(`  📝 Desc (zh) generated:  ${stats.descZh}`);
  console.log(`  📝 Desc (en) filled:     ${stats.descEn}`);
  console.log(`  🌐 Websites added:       ${stats.website}`);
  console.log(`  📞 Phones added:         ${stats.phone}`);
  console.log(`  ⚠️ Errors:              ${stats.errors}`);
  if (!applyChanges) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
