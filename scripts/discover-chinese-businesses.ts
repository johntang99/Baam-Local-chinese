/**
 * Discover Chinese Businesses (NYC Chinese corridors)
 *
 * Uses Chinese-language Google Places searches to find Chinese-relevant businesses.
 *
 * Strategy:
 * - Search using Chinese terms (place prefix + category, e.g. 法拉盛川菜, 八大道火锅)
 * - Use zh-CN language to get Chinese names from Google
 * - Grid zones per region for coverage
 * - Auto-categorize using Google primaryType
 *
 * Usage:
 *   npx tsx scripts/discover-chinese-businesses.ts [--region=flushing-ny] [--list-regions]
 *   npx tsx scripts/discover-chinese-businesses.ts --region=sunset-park-ny --apply
 *
 * Regions require matching `regions.slug` in Supabase (see migrations
 * 20260401_business_data_regions_and_review_trigger.sql, 20260402_nyc_chinese_corridors_p0_p1.sql).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const listRegions = args.includes('--list-regions');
const regionArg = args.find((a) => a.startsWith('--region='));
const regionSlug = regionArg ? regionArg.slice('--region='.length).trim() : 'flushing-ny';

type AnyRow = Record<string, any>;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// ─── Supabase helpers ────────────────────────────────────────────

async function supaGet(path: string): Promise<AnyRow[]> {
  const all: AnyRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: H });
    if (!res.ok) throw new Error(`Supabase GET ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

async function supaInsert(table: string, data: AnyRow): Promise<AnyRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('duplicate') || text.includes('unique')) return null;
    throw new Error(`INSERT ${res.status}: ${text.slice(0, 100)}`);
  }
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function supaPatch(table: string, id: string, data: AnyRow) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(data),
  });
}

// ─── Google Places API ───────────────────────────────────────────

const SEARCH_FIELDS = 'places.id,places.displayName,places.primaryType,places.businessStatus,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.types,places.location,places.websiteUri,places.regularOpeningHours,places.editorialSummary';

async function searchChinesePlaces(query: string, lat: number, lng: number, radius: number): Promise<AnyRow[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      languageCode: 'zh-CN',
      maxResultCount: 20,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Google ${res.status}`);
  return (await res.json()).places || [];
}

// Also get English name for display_name
async function getEnglishName(placeId: string): Promise<string | null> {
  const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'displayName',
        'X-Goog-Api-Language': 'en',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.displayName?.text || null;
  } catch { return null; }
}

// ─── Google type → category mapping ──────────────────────────────

const TYPE_MAP: Record<string, string> = {
  chinese_restaurant: 'food-chinese', japanese_restaurant: 'food-japanese',
  korean_restaurant: 'food-korean', vietnamese_restaurant: 'food-vietnamese',
  thai_restaurant: 'food-thai', indian_restaurant: 'food-indian',
  mexican_restaurant: 'food-mexican', american_restaurant: 'food-american',
  pizza_restaurant: 'food-pizza', seafood_restaurant: 'food-seafood',
  restaurant: 'food-dining', cafe: 'food-coffee', coffee_shop: 'food-coffee',
  bakery: 'food-bakery', bar: 'food-bar-nightlife',
  meal_takeaway: 'food-fast-food', meal_delivery: 'food-fast-food',
  ice_cream_shop: 'food-dessert', supermarket: 'food-grocery',
  grocery_or_supermarket: 'food-grocery',
  dentist: 'medical-dental', doctor: 'medical-primary-care',
  hospital: 'medical-health', pharmacy: 'medical-pharmacy',
  physiotherapist: 'medical-physical-therapy',
  lawyer: 'legal-immigration', law_firm: 'legal-immigration',
  accounting: 'finance-accounting', insurance_agency: 'finance-insurance',
  real_estate_agency: 'realestate-agent', school: 'education',
  plumber: 'home-plumbing', electrician: 'home-electrical',
  locksmith: 'home-locksmith', moving_company: 'home-moving',
  general_contractor: 'home-general-contractor',
  hair_salon: 'beauty-hair-salon', beauty_salon: 'beauty-wellness',
  nail_salon: 'beauty-nail-salon', spa: 'beauty-spa-massage',
  gym: 'beauty-fitness-gym',
  car_dealer: 'auto-dealer', car_repair: 'auto-repair',
  car_wash: 'auto-car-wash',
  travel_agency: 'svc-travel', pet_store: 'svc-pet',
  laundry: 'svc-dry-cleaning', jewelry_store: 'svc-jewelry',
  church: 'svc-religious',
};

function mapType(types: string[]): string | null {
  for (const t of types) { if (TYPE_MAP[t]) return TYPE_MAP[t]; }
  return null;
}

// ─── Hours conversion ────────────────────────────────────────────

function convertHours(h: AnyRow | undefined): AnyRow | null {
  if (!h?.periods) return null;
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const result: AnyRow = {};
  for (const p of h.periods) {
    const d = days[p.open?.day];
    if (d && p.open && p.close) {
      result[d] = {
        open: String(p.open.hour).padStart(2, '0') + ':' + String(p.open.minute || 0).padStart(2, '0'),
        close: String(p.close.hour).padStart(2, '0') + ':' + String(p.close.minute || 0).padStart(2, '0'),
      };
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// ─── Chinese search queries ──────────────────────────────────────
// Comprehensive Chinese terms to discover Chinese businesses

const CHINESE_QUERIES = [
  // ─── Food (the biggest category) ───
  '法拉盛中餐', '法拉盛川菜', '法拉盛粤菜', '法拉盛东北菜', '法拉盛湘菜',
  '法拉盛上海菜', '法拉盛北京菜', '法拉盛江浙菜', '法拉盛客家菜', '法拉盛云南菜',
  '法拉盛福建菜', '法拉盛台湾菜', '法拉盛小吃',
  '法拉盛火锅', '法拉盛麻辣烫', '法拉盛串串香', '法拉盛烧烤', '法拉盛烤肉',
  '法拉盛饺子', '法拉盛面馆', '法拉盛拉面', '法拉盛米粉', '法拉盛螺蛳粉',
  '法拉盛早茶', '法拉盛点心', '法拉盛小笼包', '法拉盛包子',
  '法拉盛奶茶', '法拉盛茶饮', '法拉盛甜品', '法拉盛蛋糕', '法拉盛面包店',
  '法拉盛咖啡', '法拉盛日料', '法拉盛韩餐', '法拉盛越南菜', '法拉盛泰餐',
  '法拉盛海鲜', '法拉盛大排档', '法拉盛夜宵', '法拉盛外卖',
  '法拉盛华人超市', '法拉盛中国超市', '法拉盛亚洲超市',
  // ─── Medical ───
  '法拉盛中医', '法拉盛针灸', '法拉盛推拿', '法拉盛中药',
  '法拉盛华人牙医', '法拉盛中文牙医', '法拉盛牙科',
  '法拉盛华人医生', '法拉盛家庭医生', '法拉盛内科',
  '法拉盛儿科', '法拉盛妇产科', '法拉盛皮肤科', '法拉盛眼科',
  '法拉盛骨科', '法拉盛心理咨询', '法拉盛药房', '法拉盛物理治疗',
  // ─── Legal ───
  '法拉盛华人律师', '法拉盛移民律师', '法拉盛离婚律师',
  '法拉盛房产律师', '法拉盛刑事律师', '法拉盛工伤律师',
  '法拉盛公证翻译',
  // ─── Finance ───
  '法拉盛华人会计', '法拉盛报税', '法拉盛CPA',
  '法拉盛华人保险', '法拉盛贷款', '法拉盛房贷',
  // ─── Real Estate ───
  '法拉盛华人房产', '法拉盛地产经纪', '法拉盛房产中介',
  // ─── Education ───
  '法拉盛补习班', '法拉盛辅导班', '法拉盛中文学校',
  '法拉盛钢琴', '法拉盛舞蹈', '法拉盛画画', '法拉盛武术',
  '法拉盛驾校', '法拉盛幼儿园', '法拉盛学英语',
  '法拉盛SAT培训', '法拉盛升学顾问',
  // ─── Home Services ───
  '法拉盛华人装修', '法拉盛装修公司', '法拉盛水管工', '法拉盛电工',
  '法拉盛搬家', '法拉盛搬家公司', '法拉盛清洁', '法拉盛油漆',
  // ─── Beauty ───
  '法拉盛华人美发', '法拉盛理发', '法拉盛美甲', '法拉盛美容',
  '法拉盛按摩', '法拉盛SPA', '法拉盛纹眉', '法拉盛医美',
  // ─── Auto ───
  '法拉盛华人修车', '法拉盛汽车维修', '法拉盛车行',
  // ─── Other Services ───
  '法拉盛旅行社', '法拉盛快递', '法拉盛寄包裹', '法拉盛摄影',
  '法拉盛婚纱照', '法拉盛翻译', '法拉盛印刷', '法拉盛裁缝',
  '法拉盛宠物', '法拉盛洗衣', '法拉盛修手机', '法拉盛珠宝',
  '法拉盛老人日托', '法拉盛教会', '法拉盛寺庙',
];

/** Suffix only (after 法拉盛) — recombined with each region's Chinese query prefix */
const CHINESE_QUERY_SUFFIXES = CHINESE_QUERIES.map((q) =>
  q.startsWith('法拉盛') ? q.slice('法拉盛'.length) : q
);

type DiscoveryRegion = {
  regionSlug: string;
  /** Prepended to each suffix (e.g. 法拉盛, 八大道, 艾姆赫斯特) */
  queryPrefix: string;
  /** Default city on business_locations when not parsed from Google address */
  locationCityEn: string;
  gridZones: { name: string; lat: number; lng: number; radius: number }[];
};

const DISCOVERY_REGIONS: Record<string, DiscoveryRegion> = {
  'flushing-ny': {
    regionSlug: 'flushing-ny',
    queryPrefix: '法拉盛',
    locationCityEn: 'Flushing',
    gridZones: [
      { name: 'Flushing Center', lat: 40.7594, lng: -73.8303, radius: 1500 },
      { name: 'Flushing North', lat: 40.7680, lng: -73.8280, radius: 1500 },
      { name: 'Flushing South', lat: 40.751, lng: -73.832, radius: 1500 },
      { name: 'Flushing East', lat: 40.7594, lng: -73.815, radius: 1500 },
      { name: 'Flushing West', lat: 40.7594, lng: -73.845, radius: 1500 },
    ],
  },
  'sunset-park-ny': {
    regionSlug: 'sunset-park-ny',
    queryPrefix: '八大道',
    locationCityEn: 'Brooklyn',
    gridZones: [
      { name: '8th Ave core', lat: 40.641, lng: -73.995, radius: 1500 },
      { name: '8th Ave north', lat: 40.65, lng: -73.995, radius: 1500 },
      { name: '8th Ave south', lat: 40.632, lng: -73.995, radius: 1500 },
      { name: '8th Ave east', lat: 40.641, lng: -73.985, radius: 1500 },
      { name: '8th Ave west', lat: 40.641, lng: -74.005, radius: 1500 },
    ],
  },
  'elmhurst-ny': {
    regionSlug: 'elmhurst-ny',
    queryPrefix: '艾姆赫斯特',
    locationCityEn: 'Elmhurst',
    gridZones: [
      { name: 'Elmhurst core', lat: 40.737, lng: -73.88, radius: 1500 },
      { name: 'Elmhurst north', lat: 40.745, lng: -73.88, radius: 1500 },
      { name: 'Elmhurst south', lat: 40.729, lng: -73.88, radius: 1500 },
      { name: 'Elmhurst east', lat: 40.737, lng: -73.868, radius: 1500 },
      { name: 'Elmhurst west', lat: 40.737, lng: -73.892, radius: 1500 },
    ],
  },
  'manhattan-chinatown-ny': {
    regionSlug: 'manhattan-chinatown-ny',
    queryPrefix: '曼哈顿华埠',
    locationCityEn: 'New York',
    gridZones: [
      { name: 'Chinatown core', lat: 40.715, lng: -73.998, radius: 1200 },
      { name: 'Chinatown north', lat: 40.722, lng: -73.998, radius: 1200 },
      { name: 'Chinatown east', lat: 40.715, lng: -73.988, radius: 1200 },
      { name: 'Two Bridges', lat: 40.708, lng: -73.995, radius: 1200 },
    ],
  },
  // ─── P0 / P1 corridor expansion (v1) ─────────────────────────────
  'avenue-u-brooklyn-ny': {
    regionSlug: 'avenue-u-brooklyn-ny',
    queryPrefix: '布鲁克林U大道',
    locationCityEn: 'Brooklyn',
    gridZones: [
      { name: 'Ave U & Ocean Pkwy', lat: 40.595, lng: -73.965, radius: 1500 },
      { name: 'Ave U east (Homecrest)', lat: 40.599, lng: -73.952, radius: 1500 },
      { name: 'Gravesend west', lat: 40.591, lng: -73.976, radius: 1500 },
      { name: 'Kings Hwy north', lat: 40.606, lng: -73.958, radius: 1500 },
      { name: 'Sheepshead south', lat: 40.586, lng: -73.955, radius: 1500 },
    ],
  },
  'corona-ny': {
    regionSlug: 'corona-ny',
    queryPrefix: '可乐娜',
    locationCityEn: 'Corona',
    gridZones: [
      { name: 'Corona Plaza', lat: 40.7498, lng: -73.8706, radius: 1500 },
      { name: 'Corona north', lat: 40.756, lng: -73.875, radius: 1500 },
      { name: 'Corona south', lat: 40.742, lng: -73.865, radius: 1500 },
      { name: 'Corona east', lat: 40.748, lng: -73.858, radius: 1500 },
      { name: 'Corona west', lat: 40.748, lng: -73.882, radius: 1500 },
    ],
  },
  'bensonhurst-ny': {
    regionSlug: 'bensonhurst-ny',
    queryPrefix: '本森赫斯特',
    locationCityEn: 'Brooklyn',
    gridZones: [
      { name: '18th Ave core', lat: 40.620, lng: -73.998, radius: 1500 },
      { name: 'Bay Pkwy', lat: 40.603, lng: -73.996, radius: 1500 },
      { name: '86th St', lat: 40.601, lng: -74.012, radius: 1500 },
      { name: 'Bensonhurst north', lat: 40.630, lng: -73.985, radius: 1500 },
      { name: 'Bensonhurst south', lat: 40.588, lng: -73.985, radius: 1500 },
    ],
  },
  'long-island-city-ny': {
    regionSlug: 'long-island-city-ny',
    queryPrefix: '长岛市',
    locationCityEn: 'Long Island City',
    gridZones: [
      { name: 'Court Square', lat: 40.747, lng: -73.945, radius: 1200 },
      { name: 'Queens Plaza', lat: 40.749, lng: -73.937, radius: 1200 },
      { name: 'Vernon corridor', lat: 40.744, lng: -73.950, radius: 1200 },
      { name: 'Hunters Point', lat: 40.742, lng: -73.958, radius: 1200 },
    ],
  },
  'forest-hills-ny': {
    regionSlug: 'forest-hills-ny',
    queryPrefix: '森林小丘',
    locationCityEn: 'Forest Hills',
    gridZones: [
      { name: 'Queens Blvd / Continental', lat: 40.718, lng: -73.838, radius: 1500 },
      { name: 'Forest Hills 71st', lat: 40.721, lng: -73.844, radius: 1500 },
      { name: 'Rego Park', lat: 40.726, lng: -73.853, radius: 1500 },
      { name: 'Forest Hills north', lat: 40.728, lng: -73.835, radius: 1500 },
      { name: 'Kew Gardens slope', lat: 40.708, lng: -73.830, radius: 1500 },
    ],
  },
};

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  if (listRegions) {
    console.log('Regions (--region=slug):\n');
    for (const k of Object.keys(DISCOVERY_REGIONS)) {
      const r = DISCOVERY_REGIONS[k];
      console.log(`  ${r.regionSlug}  (${r.queryPrefix}…)  → ${r.locationCityEn}`);
    }
    return;
  }

  const preset = DISCOVERY_REGIONS[regionSlug];
  if (!preset) {
    console.error(`Unknown region "${regionSlug}". Use --list-regions.`);
    process.exit(1);
  }

  const queries = CHINESE_QUERY_SUFFIXES.map((s) => `${preset.queryPrefix}${s}`);
  const gridZones = preset.gridZones;

  console.log(`🇨🇳 Discover Chinese Businesses — ${preset.regionSlug}`);
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}`);
  console.log(`   Queries: ${queries.length} × ${gridZones.length} zones = ${queries.length * gridZones.length} searches\n`);

  // Load existing place IDs
  const existing = await supaGet('businesses?select=id,google_place_id&google_place_id=not.is.null');
  const existingPlaceIds = new Set(existing.map(b => b.google_place_id));
  const existingBizByPlaceId = new Map(existing.map(b => [b.google_place_id, b.id]));
  console.log(`📊 Existing businesses: ${existingPlaceIds.size}\n`);

  // Load categories
  const categories = await supaGet('categories?type=eq.business&select=id,slug');
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  const regions = await supaGet(`regions?slug=eq.${encodeURIComponent(preset.regionSlug)}&select=id`);
  const regionId = regions[0]?.id;
  if (!regionId && applyChanges) {
    console.warn(`⚠️ No region row for slug "${preset.regionSlug}". Run migration 20260401… then re-run, or inserts will miss region_id.`);
  }

  let discovered = 0, alreadyExist = 0, taggedExisting = 0, errors = 0;
  const newPlaceIds = new Set<string>();
  let totalSearches = 0;

  for (let zi = 0; zi < gridZones.length; zi++) {
    const zone = gridZones[zi];
    console.log(`\n📍 Zone: ${zone.name} (${zone.lat}, ${zone.lng})`);

    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi];
      totalSearches++;
      const progress = `[${totalSearches}/${queries.length * gridZones.length}]`;
      process.stdout.write(`  ${progress} ${query.padEnd(20)} `);

      try {
        const places = await searchChinesePlaces(query, zone.lat, zone.lng, zone.radius);
        let newCount = 0;

        for (const place of places) {
          if (place.businessStatus === 'CLOSED_PERMANENTLY') continue;
          if (newPlaceIds.has(place.id)) continue; // already found in this run

          if (existingPlaceIds.has(place.id)) {
            // Already in DB — just tag as chinese_relevant if not already
            alreadyExist++;
            if (applyChanges) {
              const bizId = existingBizByPlaceId.get(place.id);
              if (bizId) {
                // Tag existing business + add Chinese name if missing
                const zhName = place.displayName?.text || '';
                const hasChinese = /[\u4e00-\u9fff]/.test(zhName);
                const update: AnyRow = {};
                if (hasChinese) update.display_name_zh = zhName; // will be set even if already has one from Google
                await supaPatch('businesses', bizId, update);
                taggedExisting++;
              }
            }
            continue;
          }

          // New business!
          newPlaceIds.add(place.id);
          existingPlaceIds.add(place.id);
          discovered++;
          newCount++;

          if (applyChanges) {
            try {
              const zhName = place.displayName?.text || '';
              const hasChinese = /[\u4e00-\u9fff]/.test(zhName);

              // Get English name
              const enName = await getEnglishName(place.id);
              await new Promise(r => setTimeout(r, 100));

              const slug = slugify(enName || zhName || 'business') + '-' + place.id.slice(-6);
              const catSlug = mapType(place.types || []);
              const editorialDesc = place.editorialSummary?.text || '';

              const bizData: AnyRow = {
                display_name: enName || zhName,
                display_name_zh: hasChinese ? zhName : null,
                slug,
                phone: place.nationalPhoneNumber || null,
                website_url: place.websiteUri || null,
                google_place_id: place.id,
                avg_rating: place.rating || null,
                review_count: place.userRatingCount || 0,
                address_full: place.formattedAddress || null,
                latitude: place.location?.latitude || null,
                longitude: place.location?.longitude || null,
                short_desc_en: editorialDesc || null,
                status: place.businessStatus === 'CLOSED_TEMPORARILY' ? 'temporarily_closed' : 'active',
                is_active: true,
              };

              const newBiz = await supaInsert('businesses', bizData);
              if (!newBiz) continue;

              // Location
              const addrParts = (place.formattedAddress || '').split(',').map((s: string) => s.trim());
              const hours = convertHours(place.regularOpeningHours);
              await supaInsert('business_locations', {
                business_id: newBiz.id,
                region_id: regionId ?? null,
                address_line1: addrParts[0] || '',
                city: preset.locationCityEn,
                state: 'NY',
                zip_code: addrParts.find((p: string) => /\d{5}/.test(p))?.match(/\d{5}/)?.[0] || '',
                latitude: place.location?.latitude,
                longitude: place.location?.longitude,
                is_primary: true,
                hours_json: hours,
              });

              // Category
              if (catSlug && catMap.has(catSlug)) {
                await supaInsert('business_categories', {
                  business_id: newBiz.id,
                  category_id: catMap.get(catSlug),
                  is_primary: true,
                });
              }
            } catch {
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
        console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 40) : 'error'}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  🆕 New Chinese businesses discovered: ${discovered}`);
  console.log(`  🏷️ Existing businesses found in search: ${alreadyExist}`);
  if (applyChanges) console.log(`  🇨🇳 Existing tagged/updated: ${taggedExisting}`);
  console.log(`  🔍 Total Google searches: ${totalSearches}`);
  console.log(`  ⚠️ Errors: ${errors}`);
  console.log(`  💰 Est. Google cost: ~$${(totalSearches * 0.032).toFixed(2)}`);
  if (!applyChanges) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
