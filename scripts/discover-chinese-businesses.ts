/**
 * Discover Chinese Businesses in Flushing
 *
 * Uses Chinese-language Google Places searches to find Chinese-relevant businesses.
 * Tags them as is_chinese_relevant: true and captures Chinese names directly.
 *
 * Strategy:
 * - Search using Chinese terms (法拉盛川菜, 法拉盛华人牙医, etc.)
 * - Use zh-CN language to get Chinese names from Google
 * - Subdivide Flushing into grid zones for broader coverage
 * - Auto-categorize using Google primaryType
 *
 * Usage:
 *   # Dry run
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/discover-chinese-businesses.ts
 *
 *   # Apply
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/discover-chinese-businesses.ts --apply
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');

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

// Grid zones: subdivide Flushing for broader coverage
const GRID_ZONES = [
  { name: 'Flushing Center', lat: 40.7594, lng: -73.8303, radius: 1500 },
  { name: 'Flushing North', lat: 40.7680, lng: -73.8280, radius: 1500 },
  { name: 'Flushing South', lat: 40.7510, lng: -73.8320, radius: 1500 },
  { name: 'Flushing East', lat: 40.7594, lng: -73.8150, radius: 1500 },
  { name: 'Flushing West', lat: 40.7594, lng: -73.8450, radius: 1500 },
];

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('🇨🇳 Discover Chinese Businesses in Flushing');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}`);
  console.log(`   Queries: ${CHINESE_QUERIES.length} × ${GRID_ZONES.length} zones = ${CHINESE_QUERIES.length * GRID_ZONES.length} searches\n`);

  // Load existing place IDs
  const existing = await supaGet('businesses?select=id,google_place_id&google_place_id=not.is.null');
  const existingPlaceIds = new Set(existing.map(b => b.google_place_id));
  const existingBizByPlaceId = new Map(existing.map(b => [b.google_place_id, b.id]));
  console.log(`📊 Existing businesses: ${existingPlaceIds.size}\n`);

  // Load categories
  const categories = await supaGet('categories?type=eq.business&select=id,slug');
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  // Get Flushing region
  const regions = await supaGet('regions?name_en=like.*Flushing*&select=id');
  const regionId = regions[0]?.id;

  let discovered = 0, alreadyExist = 0, taggedExisting = 0, errors = 0;
  const newPlaceIds = new Set<string>();
  let totalSearches = 0;

  for (let zi = 0; zi < GRID_ZONES.length; zi++) {
    const zone = GRID_ZONES[zi];
    console.log(`\n📍 Zone: ${zone.name} (${zone.lat}, ${zone.lng})`);

    for (let qi = 0; qi < CHINESE_QUERIES.length; qi++) {
      const query = CHINESE_QUERIES[qi];
      totalSearches++;
      const progress = `[${totalSearches}/${CHINESE_QUERIES.length * GRID_ZONES.length}]`;
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
                region_id: regionId,
                address_line1: addrParts[0] || '',
                city: 'Flushing',
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
