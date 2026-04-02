/**
 * Fix Review Counts — Restore real Google review counts and ratings
 *
 * Problem (historical): Before migration 20260401…, sync_business_reviews recalculated
 * review_count and avg_rating from `reviews` (max 5 Google samples), overwriting Places totals.
 *
 * Fix:
 * 1. Fetch real rating + userRatingCount from Google Place Details
 * 2. PATCH businesses (after migration 20260401…, trigger skips Google-backed rows when reviews change)
 * 3. One-off repair for rows corrupted before the trigger fix (~1 Place Details call per business)
 *
 * Usage:
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/fix-review-counts.ts
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/fix-review-counts.ts --apply
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');

type AnyRow = Record<string, any>;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(path: string): Promise<AnyRow[]> {
  const all: AnyRow[] = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${o}`, { headers: H });
    const b = await r.json(); all.push(...b); if (b.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log('🔧 Fix Review Counts — Restore Google Values');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  const businesses = await supaGet('businesses?is_active=eq.true&google_place_id=not.is.null&select=id,display_name,display_name_zh,avg_rating,review_count,google_place_id&order=id');
  console.log(`📊 Total businesses: ${businesses.length}\n`);

  let fixed = 0, unchanged = 0, errors = 0;

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    const name = (biz.display_name_zh || biz.display_name || '').slice(0, 30);

    if (i % 100 === 0 && i > 0) {
      console.log(`  ... processed ${i}/${businesses.length}, fixed ${fixed}`);
    }

    try {
      const placeId = biz.google_place_id.startsWith('places/') ? biz.google_place_id : `places/${biz.google_place_id}`;
      const res = await fetch(`https://places.googleapis.com/v1/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 429) {
        console.log('  ⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        i--; continue;
      }
      if (!res.ok) { errors++; continue; }

      const data = await res.json();
      const googleRating = data.rating;
      const googleCount = data.userRatingCount || 0;

      // Check if different from current
      const ratingDiff = googleRating && Math.abs((biz.avg_rating || 0) - googleRating) > 0.01;
      const countDiff = googleCount !== (biz.review_count || 0);

      if (ratingDiff || countDiff) {
        fixed++;
        if (fixed <= 20) {
          console.log(`  ✅ ${name.padEnd(32)} ${biz.avg_rating}(${biz.review_count}) → ${googleRating}(${googleCount})`);
        }

        if (applyChanges) {
          await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${biz.id}`, {
            method: 'PATCH',
            headers: { ...H, Prefer: 'return=minimal' },
            body: JSON.stringify({
              avg_rating: googleRating || biz.avg_rating,
              review_count: googleCount,
            }),
          });
        }
      } else {
        unchanged++;
      }
    } catch {
      errors++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  ✅ Fixed: ${fixed}`);
  console.log(`  — Unchanged: ${unchanged}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  if (!applyChanges) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));

  console.log('\n⚠️  Ensure migration is applied: supabase/migrations/20260401_business_data_regions_and_review_trigger.sql');
  console.log('    It skips sync_business_reviews updates when google_place_id is set (Google totals stay authoritative).');
}

main().catch(console.error);
