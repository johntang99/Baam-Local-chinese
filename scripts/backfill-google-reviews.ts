/**
 * Backfill Google Reviews for businesses
 *
 * 1. For each business, search Google Places API to find the place
 * 2. Save google_place_id to businesses table
 * 3. Fetch up to 5 reviews per place (Chinese preferred)
 * 4. Store reviews in the reviews table with source='google'
 *
 * Prerequisites:
 *   Run the migration: supabase/migrations/20260330_google_reviews.sql
 *   (via Supabase Dashboard → SQL Editor)
 *
 * Usage:
 *   # Dry run (shows what would happen)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-google-reviews.ts
 *
 *   # Apply changes
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-google-reviews.ts --apply
 *
 *   # Only fetch reviews (skip place search, use existing google_place_id)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-google-reviews.ts --apply --reviews-only
 *
 *   # Skip businesses that already have at least one stored Google review (faster re-runs)
 *   npx tsx scripts/backfill-google-reviews.ts --apply --reviews-only --skip-existing
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const reviewsOnly = args.includes('--reviews-only');
const skipExisting = args.includes('--skip-existing');

type AnyRow = Record<string, any>;

// ─── Supabase helpers ────────────────────────────────────────────

async function supaFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options?.method === 'PATCH' || options?.method === 'POST' ? 'return=minimal' : '',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Paginated GET (PostgREST default limit can truncate large tables). */
async function supaGetAll(pathBase: string): Promise<AnyRow[]> {
  const out: AnyRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const sep = pathBase.includes('?') ? '&' : '?';
    const batch = (await supaFetch(`${pathBase}${sep}limit=1000&offset=${offset}`)) as AnyRow[];
    if (!Array.isArray(batch)) break;
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function supaUpsert(table: string, data: AnyRow, onConflict: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    // Ignore unique constraint violations (already exists)
    if (text.includes('duplicate') || text.includes('unique')) return;
    throw new Error(`Supabase upsert ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Google Places API ───────────────────────────────────────────

async function searchPlace(query: string): Promise<{ placeId: string; name: string } | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'en',
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    throw new Error(`Google search ${res.status}: ${text.slice(0, 100)}`);
  }

  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;

  return {
    placeId: place.id,
    name: place.displayName?.text || '',
  };
}

interface GoogleReview {
  name: string;          // review resource name
  rating: number;
  text: string;
  authorName: string;
  publishTime: string;
  language: string;
  originalText: string;
}

async function fetchReviews(placeId: string): Promise<GoogleReview[]> {
  // placeId can be "ChIJ..." or "places/ChIJ..." — normalize to "places/ChIJ..."
  const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${resourceName}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'reviews',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    throw new Error(`Google details ${res.status}: ${text.slice(0, 100)}`);
  }

  const data = await res.json();
  const reviews: GoogleReview[] = [];

  for (const r of (data.reviews || [])) {
    reviews.push({
      name: r.name || '',
      rating: r.rating || 0,
      text: r.text?.text || '',
      authorName: r.authorAttribution?.displayName || 'Google User',
      publishTime: r.publishTime || '',
      language: r.text?.languageCode || 'en',
      originalText: r.originalText?.text || r.text?.text || '',
    });
  }

  return reviews;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('📝 Google Reviews Backfill');
  console.log(
    `   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}${reviewsOnly ? ' (reviews only)' : ''}${skipExisting ? ' (skip existing)' : ''}\n`,
  );

  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set');
    process.exit(1);
  }

  // Fetch businesses (paginated — table is larger than default row limit)
  let businesses = await supaGetAll(
    'businesses?select=id,slug,display_name,display_name_zh,google_place_id,address_full,city,state&is_active=eq.true&order=review_count.desc.nullslast',
  );

  let skippedExisting = 0;
  if (skipExisting) {
    const withGoogle: Set<string> = new Set();
    const reviewRows = await supaGetAll('reviews?source=eq.google&select=business_id');
    for (const r of reviewRows) withGoogle.add(r.business_id);
    const before = businesses.length;
    businesses = businesses.filter(b => {
      if (withGoogle.has(b.id)) {
        skippedExisting++;
        return false;
      }
      return true;
    });
    console.log(`📊 Skip existing: ${skippedExisting} already have Google reviews | Remaining: ${businesses.length} (was ${before})\n`);
  }

  console.log(`📊 Total active businesses to process: ${businesses.length}\n`);

  let placeFound = 0, placeSkipped = 0, placeNotFound = 0;
  let reviewsFetched = 0, reviewsSaved = 0, errors = 0;

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    const name = biz.display_name_zh || biz.display_name || biz.slug;
    const displayName = name.slice(0, 35);

    // ─── Step 1: Find Google Place ID ───
    let placeId = biz.google_place_id;

    if (!placeId && !reviewsOnly) {
      const city = biz.city || 'Flushing';
      const state = biz.state || 'NY';
      const searchQuery = `${biz.display_name || name} ${city} ${state}`;

      process.stdout.write(`  [${i + 1}/${businesses.length}] ${displayName.padEnd(37)} `);

      try {
        const result = await searchPlace(searchQuery);
        if (result) {
          placeId = result.placeId;
          placeFound++;
          process.stdout.write(`📍 ${result.placeId.slice(0, 20)}... `);

          if (applyChanges) {
            await supaFetch(`businesses?id=eq.${biz.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ google_place_id: placeId }),
            });
          }
        } else {
          placeNotFound++;
          console.log('❌ no match');
          continue;
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'RATE_LIMITED') {
          console.log('⏳ rate limited — waiting 30s');
          await new Promise(r => setTimeout(r, 30000));
          i--; continue;
        }
        errors++;
        console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 50) : 'error'}`);
        continue;
      }
    } else if (!placeId && reviewsOnly) {
      placeSkipped++;
      continue;
    } else {
      if (!reviewsOnly) {
        placeSkipped++;
      }
      process.stdout.write(`  [${i + 1}/${businesses.length}] ${displayName.padEnd(37)} 📍 cached `);
    }

    // ─── Step 2: Fetch Reviews ───
    try {
      const reviews = await fetchReviews(placeId);
      reviewsFetched += reviews.length;

      if (reviews.length === 0) {
        console.log('→ 0 reviews');
        continue;
      }

      // Pick: prefer Chinese reviews, then highest rated
      const sorted = reviews.sort((a, b) => {
        const aZh = a.language.startsWith('zh') ? 1 : 0;
        const bZh = b.language.startsWith('zh') ? 1 : 0;
        if (aZh !== bZh) return bZh - aZh;
        return b.rating - a.rating;
      });

      const toSave = sorted.slice(0, 5);
      const zhCount = toSave.filter(r => r.language.startsWith('zh')).length;

      console.log(`→ ${reviews.length} reviews (${zhCount} zh), saving ${toSave.length}`);

      if (applyChanges) {
        for (const review of toSave) {
          try {
            // Use google_review_id for dedup
            const reviewId = review.name || `${placeId}-${review.authorName}-${review.rating}`;
            await supaUpsert('reviews', {
              business_id: biz.id,
              author_id: null,
              rating: review.rating,
              title: review.authorName,
              body: review.originalText || review.text,
              status: 'approved',
              source: 'google',
              google_author_name: review.authorName,
              google_review_id: reviewId,
              google_publish_time: review.publishTime || null,
              language: review.language,
              ai_sentiment: review.rating >= 4 ? 'positive' : review.rating >= 3 ? 'neutral' : 'negative',
            }, 'business_id,google_review_id');
            reviewsSaved++;
          } catch (err) {
            // Skip individual review errors (e.g. constraint violations)
            const msg = err instanceof Error ? err.message : '';
            if (!msg.includes('duplicate') && !msg.includes('unique')) {
              console.log(`     ⚠️ review save error: ${msg.slice(0, 80)}`);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        console.log('⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        i--; continue;
      }
      errors++;
      console.log(`⚠️ reviews: ${err instanceof Error ? err.message.slice(0, 50) : 'error'}`);
    }

    // Rate limit: 500ms between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // ─── Summary ───
  console.log('\n' + '═'.repeat(60));
  if (!reviewsOnly) {
    console.log(`  📍 Places found: ${placeFound} | not found: ${placeNotFound} | cached: ${placeSkipped}`);
  }
  console.log(`  📝 Reviews fetched: ${reviewsFetched} | saved: ${reviewsSaved}`);
  console.log(`  ⚠️ Errors: ${errors}`);

  if (!applyChanges) {
    console.log(`\n  👀 DRY RUN — add --apply to save changes`);
  }
  console.log('═'.repeat(60));
}

main().catch(console.error);
