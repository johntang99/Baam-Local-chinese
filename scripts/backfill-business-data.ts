/**
 * Backfill Business Data from Google Places API
 *
 * Phase 1: Enrich existing 335 businesses with missing data
 *   - address_full, latitude, longitude (sync from business_locations → businesses table)
 *   - website, phone, Chinese name, business status, editorial description
 *   - hours_json (update business_locations from Google)
 *
 * Phase 2: Discover new businesses in Flushing (and other regions)
 *   - Search Google Places by category terms
 *   - Auto-categorize using Google primaryType
 *   - Create new business + location + category records
 *
 * Usage:
 *   # Phase 1: Enrich existing (dry run)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-data.ts --enrich
 *
 *   # Phase 1: Enrich existing (apply)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-data.ts --enrich --apply
 *
 *   # Phase 2: Discover new businesses (dry run)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-data.ts --discover
 *
 *   # Phase 2: Discover new businesses (apply)
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/backfill-business-data.ts --discover --apply
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const doEnrich = args.includes('--enrich');
const doDiscover = args.includes('--discover');
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

type AnyRow = Record<string, any>;

// ─── Supabase helpers ────────────────────────────────────────────

const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(path: string): Promise<AnyRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${(await res.text()).slice(0, 100)}`);
  return res.json();
}

async function supaPatch(table: string, id: string, data: AnyRow) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${(await res.text()).slice(0, 100)}`);
}

async function supaInsert(table: string, data: AnyRow): Promise<AnyRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('duplicate') || text.includes('unique')) return null;
    throw new Error(`Supabase INSERT ${res.status}: ${text.slice(0, 100)}`);
  }
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

// ─── Google Places API ───────────────────────────────────────────

const DETAIL_FIELDS = 'displayName,primaryType,primaryTypeDisplayName,businessStatus,nationalPhoneNumber,formattedAddress,shortFormattedAddress,websiteUri,regularOpeningHours,rating,userRatingCount,editorialSummary,types,location,reviews';

async function getPlaceDetails(placeId: string): Promise<AnyRow | null> {
  const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (res.status === 404) return null; // place ID expired
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 100)}`);
  return res.json();
}

async function searchPlaces(query: string, lat: number, lng: number, radius: number): Promise<AnyRow[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.businessStatus,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.types,places.location,places.websiteUri' },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      languageCode: 'en',
      maxResultCount: 20,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Google search ${res.status}: ${(await res.text()).slice(0, 100)}`);
  const data = await res.json();
  return data.places || [];
}

// Get Chinese name via zh-CN search
async function getChineseName(placeId: string): Promise<string | null> {
  const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': 'displayName' },
    signal: AbortSignal.timeout(10000),
  });
  // Request in Chinese
  if (!res.ok) return null;
  const data = await res.json();
  const name = data.displayName?.text || '';
  // Only return if it contains Chinese characters
  return /[\u4e00-\u9fff]/.test(name) ? name : null;
}

// ─── Google type → our category mapping ──────────────────────────

const GOOGLE_TYPE_MAP: Record<string, string> = {
  // Food
  'chinese_restaurant': 'food-chinese',
  'japanese_restaurant': 'food-japanese',
  'korean_restaurant': 'food-korean',
  'vietnamese_restaurant': 'food-vietnamese',
  'thai_restaurant': 'food-thai',
  'indian_restaurant': 'food-indian',
  'mexican_restaurant': 'food-mexican',
  'american_restaurant': 'food-american',
  'pizza_restaurant': 'food-pizza',
  'seafood_restaurant': 'food-seafood',
  'restaurant': 'food-dining',
  'cafe': 'food-coffee',
  'coffee_shop': 'food-coffee',
  'bakery': 'food-bakery',
  'bar': 'food-bar-nightlife',
  'meal_takeaway': 'food-fast-food',
  'meal_delivery': 'food-fast-food',
  'ice_cream_shop': 'food-dessert',
  'grocery_or_supermarket': 'food-grocery',
  'supermarket': 'food-grocery',
  // Medical
  'dentist': 'medical-dental',
  'doctor': 'medical-primary-care',
  'hospital': 'medical-health',
  'pharmacy': 'medical-pharmacy',
  'physiotherapist': 'medical-physical-therapy',
  'veterinary_care': 'svc-pet',
  // Legal
  'lawyer': 'legal-immigration',
  'law_firm': 'legal-immigration',
  // Finance
  'accounting': 'finance-accounting',
  'insurance_agency': 'finance-insurance',
  'bank': 'finance-tax',
  // Real estate
  'real_estate_agency': 'realestate-agent',
  // Education
  'school': 'education',
  'university': 'edu-college-prep',
  // Home
  'plumber': 'home-plumbing',
  'electrician': 'home-electrical',
  'locksmith': 'home-locksmith',
  'moving_company': 'home-moving',
  'painter': 'home-painting',
  'roofing_contractor': 'home-roofing',
  'general_contractor': 'home-general-contractor',
  // Beauty
  'hair_salon': 'beauty-hair-salon',
  'beauty_salon': 'beauty-wellness',
  'nail_salon': 'beauty-nail-salon',
  'spa': 'beauty-spa-massage',
  'gym': 'beauty-fitness-gym',
  // Auto
  'car_dealer': 'auto-dealer',
  'car_repair': 'auto-repair',
  'car_wash': 'auto-car-wash',
  // Other
  'travel_agency': 'svc-travel',
  'pet_store': 'svc-pet',
  'laundry': 'svc-dry-cleaning',
  'church': 'svc-religious',
  'funeral_home': 'svc-funeral',
  'storage': 'svc-storage',
  'jewelry_store': 'svc-jewelry',
};

function mapGoogleType(types: string[]): string | null {
  for (const t of types) {
    if (GOOGLE_TYPE_MAP[t]) return GOOGLE_TYPE_MAP[t];
  }
  return null;
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

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ─── Phase 1: Enrich existing businesses ─────────────────────────

async function enrichExisting() {
  console.log('📦 Phase 1: Enrich Existing Businesses');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  const businesses = await supaGet('businesses?is_active=eq.true&google_place_id=not.is.null&select=id,slug,display_name,display_name_zh,phone,website_url,short_desc_en,address_full,latitude,longitude,google_place_id,status&order=review_count.desc.nullslast');
  const locations = await supaGet('business_locations?is_primary=eq.true&select=id,business_id,address_line1,city,state,zip_code,latitude,longitude,hours_json');
  const locMap = new Map(locations.map(l => [l.business_id, l]));

  const toProcess = limit ? businesses.slice(0, limit) : businesses;
  console.log(`📊 Processing ${toProcess.length} of ${businesses.length} businesses\n`);

  let updated = 0, closed = 0, errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const biz = toProcess[i];
    const displayName = (biz.display_name_zh || biz.display_name || '').slice(0, 35);
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${displayName.padEnd(37)} `);

    try {
      const details = await getPlaceDetails(biz.google_place_id);
      if (!details) {
        console.log('⚠️ place ID expired');
        errors++;
        continue;
      }

      // Check if closed
      if (details.businessStatus === 'CLOSED_PERMANENTLY') {
        closed++;
        console.log('❌ PERMANENTLY CLOSED');
        if (applyChanges) {
          await supaPatch('businesses', biz.id, { status: 'closed', is_active: false });
        }
        continue;
      }

      // Build update for businesses table
      const bizUpdate: AnyRow = {};

      // Address (from Google if missing)
      if (!biz.address_full && details.formattedAddress) {
        bizUpdate.address_full = details.formattedAddress;
      }

      // Lat/Lng
      if ((!biz.latitude || !biz.longitude) && details.location) {
        bizUpdate.latitude = details.location.latitude;
        bizUpdate.longitude = details.location.longitude;
      }

      // Phone
      if (!biz.phone && details.nationalPhoneNumber) {
        bizUpdate.phone = details.nationalPhoneNumber;
      }

      // Website
      if (!biz.website_url && details.websiteUri) {
        bizUpdate.website_url = details.websiteUri;
      }

      // Chinese name
      if (!biz.display_name_zh) {
        // Try zh-CN search for Chinese name
        const zhName = await getChineseName(biz.google_place_id);
        if (zhName) bizUpdate.display_name_zh = zhName;
        await new Promise(r => setTimeout(r, 200));
      }

      // English description
      if (!biz.short_desc_en && details.editorialSummary?.text) {
        bizUpdate.short_desc_en = details.editorialSummary.text;
      }

      // Status
      if (details.businessStatus === 'CLOSED_TEMPORARILY') {
        bizUpdate.status = 'temporarily_closed';
      }

      // Update business_locations hours
      const loc = locMap.get(biz.id);
      const newHours = convertHours(details.regularOpeningHours);
      const locUpdate: AnyRow = {};

      if (loc && newHours && (!loc.hours_json || Object.keys(loc.hours_json).length === 0)) {
        locUpdate.hours_json = newHours;
      }
      // Also sync address/coords to location if missing
      if (loc && !loc.address_line1 && details.shortFormattedAddress) {
        locUpdate.address_line1 = details.shortFormattedAddress;
      }
      if (loc && (!loc.latitude || !loc.longitude) && details.location) {
        locUpdate.latitude = details.location.latitude;
        locUpdate.longitude = details.location.longitude;
      }

      const bizFields = Object.keys(bizUpdate);
      const locFields = Object.keys(locUpdate);

      if (bizFields.length > 0 || locFields.length > 0) {
        updated++;
        const summary = [...bizFields, ...locFields.map(f => 'loc.' + f)].join(', ');
        console.log(`✅ ${summary}`);

        if (applyChanges) {
          if (bizFields.length > 0) await supaPatch('businesses', biz.id, bizUpdate);
          if (locFields.length > 0 && loc) await supaPatch('business_locations', loc.id, locUpdate);
        }
      } else {
        console.log('— complete');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        console.log('⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        i--; continue;
      }
      errors++;
      console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 50) : 'error'}`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Closed: ${closed}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  if (!applyChanges && updated > 0) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

// ─── Phase 2: Discover new businesses ────────────────────────────

async function discoverNew() {
  console.log('🔍 Phase 2: Discover New Businesses');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  // Get existing google_place_ids to avoid duplicates
  const existing = await supaGet('businesses?select=google_place_id&google_place_id=not.is.null');
  const existingIds = new Set(existing.map(b => b.google_place_id));
  console.log(`📊 Existing businesses: ${existingIds.size}`);

  // Get Flushing region ID
  const regions = await supaGet("regions?name_en=like.*Flushing*&select=id");
  const flushingRegionId = regions[0]?.id;

  // Get category slug → id mapping
  const categories = await supaGet('categories?type=eq.business&select=id,slug');
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  // Search queries — use our subcategory names + location
  const searchQueries = [
    // Food
    'Chinese restaurant Flushing NY', 'Korean restaurant Flushing NY', 'Japanese restaurant Flushing NY',
    'bubble tea Flushing NY', 'bakery Flushing NY', 'hot pot Flushing NY', 'dim sum Flushing NY',
    'noodle shop Flushing NY', 'seafood restaurant Flushing NY', 'Vietnamese restaurant Flushing NY',
    'Thai restaurant Flushing NY', 'dessert Flushing NY', 'supermarket Flushing NY',
    'coffee shop Flushing NY', 'bar Flushing NY',
    // Medical
    'dentist Flushing NY', 'doctor Flushing NY', 'acupuncture Flushing NY',
    'pharmacy Flushing NY', 'optometrist Flushing NY', 'dermatologist Flushing NY',
    'pediatrician Flushing NY', 'chiropractor Flushing NY', 'mental health Flushing NY',
    'physical therapy Flushing NY', 'urgent care Flushing NY',
    // Legal
    'lawyer Flushing NY', 'immigration lawyer Flushing NY', 'notary Flushing NY',
    // Finance
    'accountant Flushing NY', 'CPA Flushing NY', 'insurance Flushing NY',
    'tax preparation Flushing NY', 'mortgage Flushing NY',
    // Real estate
    'real estate agent Flushing NY', 'property management Flushing NY',
    // Education
    'tutoring Flushing NY', 'driving school Flushing NY', 'music school Flushing NY',
    'preschool Flushing NY', 'dance school Flushing NY', 'martial arts Flushing NY',
    'swimming class Flushing NY',
    // Home services
    'plumber Flushing NY', 'electrician Flushing NY', 'contractor Flushing NY',
    'moving company Flushing NY', 'locksmith Flushing NY', 'cleaning service Flushing NY',
    'pest control Flushing NY', 'HVAC Flushing NY',
    // Beauty
    'hair salon Flushing NY', 'nail salon Flushing NY', 'spa Flushing NY',
    'gym Flushing NY', 'barber Flushing NY',
    // Auto
    'auto repair Flushing NY', 'car dealer Flushing NY', 'tire shop Flushing NY',
    // Other
    'travel agency Flushing NY', 'shipping Flushing NY', 'photography Flushing NY',
    'pet store Flushing NY', 'dry cleaner Flushing NY', 'tailor Flushing NY',
    'phone repair Flushing NY', 'jewelry store Flushing NY',
  ];

  // Flushing center
  const LAT = 40.7594, LNG = -73.8303, RADIUS = 3000;

  let discovered = 0, skipped = 0, errors = 0;
  const allNewPlaces: AnyRow[] = [];

  for (let qi = 0; qi < searchQueries.length; qi++) {
    const query = searchQueries[qi];
    process.stdout.write(`  [${qi + 1}/${searchQueries.length}] ${query.padEnd(45)} `);

    try {
      const places = await searchPlaces(query, LAT, LNG, RADIUS);
      let newCount = 0;

      for (const place of places) {
        // Skip if already exists
        if (existingIds.has(place.id)) { skipped++; continue; }
        // Skip if permanently closed
        if (place.businessStatus === 'CLOSED_PERMANENTLY') continue;

        existingIds.add(place.id); // prevent duplicates within this run
        discovered++;
        newCount++;
        allNewPlaces.push(place);

        if (applyChanges) {
          try {
            // Determine category
            const catSlug = mapGoogleType(place.types || []);
            const slug = slugify(place.displayName?.text || 'business') + '-' + place.id.slice(-6);

            // Create business
            const bizData: AnyRow = {
              display_name: place.displayName?.text || '',
              slug,
              phone: place.nationalPhoneNumber || null,
              website_url: place.websiteUri || null,
              google_place_id: place.id,
              avg_rating: place.rating || null,
              review_count: place.userRatingCount || 0,
              address_full: place.formattedAddress || null,
              latitude: place.location?.latitude || null,
              longitude: place.location?.longitude || null,
              status: place.businessStatus === 'CLOSED_TEMPORARILY' ? 'temporarily_closed' : 'active',
              is_active: true,
            };

            const newBiz = await supaInsert('businesses', bizData);
            if (!newBiz) continue;

            // Create location
            const addrParts = (place.formattedAddress || '').split(',').map((s: string) => s.trim());
            await supaInsert('business_locations', {
              business_id: newBiz.id,
              region_id: flushingRegionId,
              address_line1: addrParts[0] || '',
              city: 'Flushing',
              state: 'NY',
              zip_code: addrParts.find((p: string) => /\d{5}/.test(p))?.match(/\d{5}/)?.[0] || '',
              latitude: place.location?.latitude,
              longitude: place.location?.longitude,
              is_primary: true,
            });

            // Create category link
            if (catSlug && catMap.has(catSlug)) {
              await supaInsert('business_categories', {
                business_id: newBiz.id,
                category_id: catMap.get(catSlug),
                is_primary: true,
              });
            }
          } catch (insertErr) {
            // Skip insert errors
          }
        }
      }

      console.log(`→ ${places.length} results, ${newCount} new`);
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        console.log('⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        qi--; continue;
      }
      errors++;
      console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 50) : 'error'}`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  🆕 New businesses discovered: ${discovered}`);
  console.log(`  ⏭️ Already existed: ${skipped}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  if (!applyChanges && discovered > 0) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  if (!GOOGLE_API_KEY) { console.error('❌ GOOGLE_PLACES_API_KEY not set'); process.exit(1); }
  if (!doEnrich && !doDiscover) {
    console.log('Usage:');
    console.log('  --enrich     Enrich existing businesses with Google data');
    console.log('  --discover   Discover new businesses from Google');
    console.log('  --apply      Apply changes (default: dry run)');
    console.log('  --limit=N    Process only first N businesses (for testing)');
    process.exit(0);
  }
  if (doEnrich) await enrichExisting();
  if (doDiscover) await discoverNew();
}

main().catch(console.error);
