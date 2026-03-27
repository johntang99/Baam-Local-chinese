/**
 * Comprehensive business crawl v2 — Full details with Place Details API
 *
 * Strategy:
 * Phase 1: Text Search (Essentials, 10K free/month) → get business list
 * Phase 2: Place Details (Pro, 5K free/month) → get phone, email, hours, website, lat/lng
 * Phase 3: AI description generation (Claude Haiku)
 *
 * Run: source apps/web/.env.local && npx tsx scripts/crawl-businesses-v2.ts
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Run: source apps/web/.env.local && npx tsx scripts/crawl-businesses-v2.ts');
  process.exit(1);
}

// ─── Search queries: Area × Category ──────────────────────────────────

interface SearchQuery {
  query: string;
  categorySlug: string;
  categoryName: string;
  area: string;
}

const AREAS = ['Flushing NY', 'Sunset Park Brooklyn NY', 'Chinatown Manhattan NY', 'Elmhurst Queens NY'];

const CATEGORIES: { query: string; slug: string; name: string }[] = [
  // Food
  { query: 'Chinese restaurant', slug: 'food-dining', name: '餐饮美食' },
  { query: 'dim sum restaurant', slug: 'food-dining', name: '餐饮美食' },
  { query: 'hot pot restaurant', slug: 'food-hotpot', name: '火锅烧烤' },
  { query: 'bubble tea', slug: 'food-bubble-tea', name: '奶茶' },
  { query: 'Chinese bakery', slug: 'food-bakery', name: '烘焙甜品' },
  // Medical
  { query: 'Chinese doctor', slug: 'medical-health', name: '医疗健康' },
  { query: 'Chinese dentist', slug: 'medical-dental', name: '牙科' },
  { query: 'acupuncture', slug: 'medical-chinese-medicine', name: '中医' },
  // Legal
  { query: 'Chinese immigration lawyer', slug: 'legal-immigration', name: '法律移民' },
  // Finance
  { query: 'Chinese CPA accountant', slug: 'finance-accounting', name: '会计服务' },
  { query: 'Chinese tax preparation', slug: 'finance-tax-prep', name: '报税服务' },
  // Real Estate
  { query: 'Chinese real estate agent', slug: 'realestate-agent', name: '地产经纪' },
  // Education
  { query: 'Chinese tutoring center', slug: 'edu-tutoring', name: '课后辅导' },
  { query: 'Chinese language school', slug: 'edu-language', name: '语言学校' },
  // Services
  { query: 'Chinese moving company', slug: 'home-moving', name: '搬家' },
  { query: 'Chinese renovation contractor', slug: 'home-renovation', name: '装修家居' },
  { query: 'Chinese hair salon', slug: 'beauty-wellness', name: '美容保健' },
  { query: 'Chinese supermarket grocery', slug: 'food-dining', name: '餐饮美食' },
  // Insurance
  { query: 'Chinese insurance agent', slug: 'finance-insurance', name: '保险' },
  // Auto
  { query: 'Chinese auto repair', slug: 'auto', name: '汽车服务' },
];

// Build search queries: only Flushing for detailed crawl (expand later)
const SEARCH_QUERIES: SearchQuery[] = [];
const TARGET_AREA = AREAS[0]; // Start with Flushing

for (const cat of CATEGORIES) {
  SEARCH_QUERIES.push({
    query: `${cat.query} ${TARGET_AREA}`,
    categorySlug: cat.slug,
    categoryName: cat.name,
    area: TARGET_AREA,
  });
}

// ─── Types ────────────────────────────────────────────────────────────

interface PlaceBasic {
  placeId: string;
  name: string;
  nameZh: string;
  address: string;
  rating: number;
  ratingCount: number;
  types: string[];
}

interface PlaceDetails extends PlaceBasic {
  phone: string;
  email: string;
  website: string;
  lat: number | null;
  lng: number | null;
  hours: string[];
  city: string;
  state: string;
  zipCode: string;
}

// ─── Google Places API ────────────────────────────────────────────────

let textSearchCount = 0;
let detailsCount = 0;

async function searchPlaces(query: string, maxResults: number = 20): Promise<PlaceBasic[]> {
  textSearchCount++;

  // English search
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en', maxResultCount: maxResults }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  // Chinese names
  textSearchCount++;
  const resZh = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'zh-CN', maxResultCount: maxResults }),
  });
  const dataZh = await resZh.json();
  const zhNames: Record<string, string> = {};
  for (const p of dataZh.places || []) {
    zhNames[p.id] = p.displayName?.text || '';
  }

  return (data.places || []).map((p: any) => ({
    placeId: p.id,
    name: p.displayName?.text || '',
    nameZh: zhNames[p.id] || p.displayName?.text || '',
    address: p.formattedAddress || '',
    rating: p.rating || 0,
    ratingCount: p.userRatingCount || 0,
    types: p.types || [],
  }));
}

async function getPlaceDetails(placeId: string): Promise<Partial<PlaceDetails>> {
  detailsCount++;

  const res = await fetch(`https://places.googleapis.com/v1/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'nationalPhoneNumber,websiteUri,location,shortFormattedAddress,regularOpeningHours',
    },
  });

  const text = await res.text();
  if (!text || text.trim() === '') return {};
  const data = JSON.parse(text);

  // Parse city/state/zip from short address
  const shortAddr = data.shortFormattedAddress || '';
  let city = '', state = 'NY', zipCode = '';
  if (shortAddr.includes('Flushing')) city = 'Flushing';
  else if (shortAddr.includes('Brooklyn')) city = 'Brooklyn';
  else if (shortAddr.includes('Manhattan') || shortAddr.includes('New York')) city = 'New York';
  else if (shortAddr.includes('Elmhurst')) city = 'Elmhurst';
  else city = 'New York';

  // Parse hours
  const hours: string[] = [];
  for (const desc of data.regularOpeningHours?.weekdayDescriptions || []) {
    hours.push(desc);
  }

  return {
    phone: data.nationalPhoneNumber || '',
    email: '',  // Google Places API doesn't provide email
    website: data.websiteUri || '',
    lat: data.location?.latitude || null,
    lng: data.location?.longitude || null,
    city,
    state,
    zipCode,
    hours,
  };
}

// ─── AI Description ───────────────────────────────────────────────────

async function generateDescription(place: PlaceDetails, categoryName: string): Promise<{ descZh: string; descEn: string; tags: string[] }> {
  if (!ANTHROPIC_KEY) return { descZh: '', descEn: '', tags: [] };

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: '你是纽约华人社区平台的编辑。为商家写简短的中文介绍（2-3句话）和3-5个中文标签。返回纯JSON：{"desc_zh":"中文介绍","desc_en":"English desc","tags":["标签1","标签2"]}',
      messages: [{ role: 'user', content: `商家：${place.nameZh || place.name}\n地址：${place.address}\n类别：${categoryName}\n评分：${place.rating}（${place.ratingCount}条评价）\n电话：${place.phone}\n营业时间：${place.hours?.slice(0, 3).join(', ') || '未知'}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { descZh: parsed.desc_zh || '', descEn: parsed.desc_en || '', tags: parsed.tags || [] };
    }
  } catch {}
  return { descZh: '', descEn: '', tags: [] };
}

// ─── Supabase ─────────────────────────────────────────────────────────

async function getExistingSlugs(): Promise<Set<string>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/businesses?select=slug`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return new Set((await res.json()).map((d: any) => d.slug));
}

async function getCategoryId(slug: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?slug=eq.${slug}&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  return data[0]?.id || null;
}

async function getRegionId(area: string): Promise<string | null> {
  const slug = area.includes('Flushing') ? 'flushing-ny' : area.includes('Sunset') ? 'brooklyn-ny' : area.includes('Chinatown') ? 'manhattan-ny' : area.includes('Elmhurst') ? 'queens-ny' : 'new-york-city';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/regions?slug=eq.${slug}&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  return data[0]?.id || null;
}

async function saveBusiness(place: PlaceDetails, categorySlug: string, desc: { descZh: string; descEn: string; tags: string[] }, regionId: string | null): Promise<string | null> {
  const slug = (place.name || place.nameZh)
    .toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  const body = {
    slug,
    display_name: place.name,
    display_name_zh: place.nameZh !== place.name ? place.nameZh : null,
    short_desc_en: desc.descEn || null,
    short_desc_zh: desc.descZh || null,
    phone: place.phone || null,
    email: place.email || null,
    website_url: place.website || null,
    status: 'active',
    verification_status: 'unverified',
    current_plan: 'free',
    ai_tags: desc.tags.length > 0 ? desc.tags : null,
    ai_summary_zh: desc.descZh || null,
    avg_rating: place.rating || null,
    review_count: place.ratingCount || 0,
    is_featured: false,
    is_active: true,
    languages_served: ['zh', 'en'],
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await res.text());
  const saved = await res.json();
  const businessId = saved[0]?.id;

  if (businessId) {
    // Category link
    const categoryId = await getCategoryId(categorySlug);
    if (categoryId) {
      await fetch(`${SUPABASE_URL}/rest/v1/business_categories`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, category_id: categoryId, is_primary: true }),
      });
    }

    // Location with lat/lng
    await fetch(`${SUPABASE_URL}/rest/v1/business_locations`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        address_full: place.address,
        city: place.city || 'Flushing',
        state: place.state || 'NY',
        zip_code: place.zipCode || '',
        latitude: place.lat,
        longitude: place.lng,
        region_id: regionId,
        is_primary: true,
      }),
    });
  }

  return businessId;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏪 Comprehensive business crawl v2`);
  console.log(`📍 Area: ${TARGET_AREA}`);
  console.log(`📋 Categories: ${CATEGORIES.length}`);
  console.log(`🔍 Total searches: ${SEARCH_QUERIES.length}\n`);

  const existingSlugs = await getExistingSlugs();
  const regionId = await getRegionId(TARGET_AREA);

  let totalCrawled = 0, saved = 0, skipped = 0, failed = 0;
  const allPlaces = new Map<string, { basic: PlaceBasic; categorySlug: string; categoryName: string }>();

  // Phase 1: Text Search — collect all unique places
  console.log('=== Phase 1: Text Search ===\n');

  for (const sq of SEARCH_QUERIES) {
    process.stdout.write(`🔍 ${sq.categoryName}: "${sq.query}"...`);
    try {
      const places = await searchPlaces(sq.query);
      let newCount = 0;
      for (const p of places) {
        if (!allPlaces.has(p.placeId)) {
          allPlaces.set(p.placeId, { basic: p, categorySlug: sq.categorySlug, categoryName: sq.categoryName });
          newCount++;
        }
      }
      console.log(` ${places.length} found, ${newCount} new`);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(` ❌ ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  console.log(`\n📊 Phase 1: ${allPlaces.size} unique businesses found (${textSearchCount} API calls)\n`);

  // Phase 2: Place Details + AI Description + Save
  console.log('=== Phase 2: Details + Save ===\n');

  let i = 0;
  for (const [placeId, { basic, categorySlug, categoryName }] of allPlaces) {
    i++;
    totalCrawled++;
    const slug = (basic.name || basic.nameZh).toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

    if (existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    const num = `[${i}/${allPlaces.size}]`;
    process.stdout.write(`${num} ${basic.nameZh || basic.name}...`);

    try {
      // Get full details
      const details = await getPlaceDetails(placeId);
      const fullPlace: PlaceDetails = { ...basic, phone: '', email: '', website: '', lat: null, lng: null, hours: [], city: '', state: '', zipCode: '', ...details };

      // Generate AI description
      const desc = await generateDescription(fullPlace, categoryName);

      // Save
      await saveBusiness(fullPlace, categorySlug, desc, regionId);
      existingSlugs.add(slug);
      saved++;

      const email = fullPlace.email ? ` 📧` : '';
      const loc = fullPlace.lat ? ' 📍' : '';
      console.log(` ✅ ⭐${basic.rating}${email}${loc} ${fullPlace.phone || 'no phone'}`);

      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      failed++;
      console.log(` ❌ ${err instanceof Error ? err.message.slice(0, 60) : 'error'}`);
    }
  }

  console.log(`\n📊 Final Results:`);
  console.log(`  Saved: ${saved}`);
  console.log(`  Skipped (exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total crawled: ${totalCrawled}`);
  console.log(`  API calls — Text Search: ${textSearchCount}, Place Details: ${detailsCount}`);
}

main().catch(console.error);
