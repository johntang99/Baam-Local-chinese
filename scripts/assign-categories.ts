/**
 * Assign Categories to Uncategorized Businesses
 *
 * Strategy:
 * 1. Fetch Google Place Details to get primaryType → map to our category
 * 2. For businesses where Google type doesn't map, use AI to classify from name + description
 *
 * Usage:
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/assign-categories.ts
 *   set -a && source <(grep -v '^#' apps/web/.env.local | grep -v '^$' | grep -v '@') && set +a && npx tsx scripts/assign-categories.ts --apply
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

type AnyRow = Record<string, any>;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(path: string): Promise<AnyRow[]> {
  const all: AnyRow[] = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${o}`, { headers: H });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const b = await r.json(); all.push(...b); if (b.length < 1000) break;
  }
  return all;
}

async function supaInsert(table: string, data: AnyRow): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(data),
  });
  if (!r.ok) {
    const t = await r.text();
    if (t.includes('duplicate') || t.includes('unique')) return false;
    throw new Error(`INSERT ${r.status}: ${t.slice(0, 100)}`);
  }
  return true;
}

// ─── Google type → our category ──────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  // Food
  chinese_restaurant: 'food-chinese', japanese_restaurant: 'food-japanese',
  korean_restaurant: 'food-korean', vietnamese_restaurant: 'food-vietnamese',
  thai_restaurant: 'food-thai', indian_restaurant: 'food-indian',
  mexican_restaurant: 'food-mexican', american_restaurant: 'food-american',
  pizza_restaurant: 'food-pizza', seafood_restaurant: 'food-seafood',
  restaurant: 'food-dining', ramen_restaurant: 'food-noodles',
  noodle_restaurant: 'food-noodles', sushi_restaurant: 'food-japanese',
  barbecue_restaurant: 'food-hotpot', brunch_restaurant: 'food-american',
  breakfast_restaurant: 'food-american', hamburger_restaurant: 'food-american',
  steak_house: 'food-american', sandwich_shop: 'food-fast-food',
  fast_food_restaurant: 'food-fast-food', food_court: 'food-dining',
  cafe: 'food-coffee', coffee_shop: 'food-coffee', tea_house: 'food-bubble-tea',
  bakery: 'food-bakery', ice_cream_shop: 'food-dessert',
  bar: 'food-bar-nightlife', night_club: 'food-bar-nightlife',
  meal_takeaway: 'food-fast-food', meal_delivery: 'food-fast-food',
  supermarket: 'food-grocery', grocery_or_supermarket: 'food-grocery',
  asian_grocery_store: 'food-grocery', food_store: 'food-grocery',
  // Medical
  dentist: 'medical-dental', dental_clinic: 'medical-dental',
  doctor: 'medical-primary-care', hospital: 'medical-health',
  medical_lab: 'medical-health', health: 'medical-health',
  pharmacy: 'medical-pharmacy', drugstore: 'medical-pharmacy',
  physiotherapist: 'medical-physical-therapy',
  chiropractor: 'medical-chiropractic',
  acupuncture_clinic: 'medical-chinese-medicine',
  // Legal
  lawyer: 'legal-immigration', law_firm: 'legal-immigration',
  notary_public: 'legal-notary',
  // Finance
  accounting: 'finance-accounting', tax_preparation: 'finance-tax-prep',
  insurance_agency: 'finance-insurance', financial_planner: 'finance-investment',
  mortgage_broker: 'finance-mortgage',
  // Real estate
  real_estate_agency: 'realestate-agent', real_estate_agent: 'realestate-agent',
  // Education
  school: 'education', preschool: 'edu-preschool', primary_school: 'education',
  language_school: 'edu-language', driving_school: 'edu-driving-school',
  dance_school: 'edu-dance', music_school: 'edu-music-art',
  art_school: 'edu-music-art', martial_arts_school: 'edu-sports',
  tutoring: 'edu-tutoring',
  // Home
  plumber: 'home-plumbing', electrician: 'home-electrical',
  locksmith: 'home-locksmith', moving_company: 'home-moving',
  general_contractor: 'home-general-contractor', painter: 'home-painting',
  roofing_contractor: 'home-roofing', hvac_contractor: 'home-hvac',
  pest_control_service: 'home-pest-control', house_mover: 'home-moving',
  cleaning_service: 'home-cleaning', furniture_store: 'home-furniture',
  // Beauty
  hair_salon: 'beauty-hair-salon', barber_shop: 'beauty-barber',
  beauty_salon: 'beauty-wellness', nail_salon: 'beauty-nail-salon',
  spa: 'beauty-spa-massage', gym: 'beauty-fitness-gym',
  yoga_studio: 'beauty-yoga-pilates', tattoo_shop: 'beauty-tattoo',
  // Auto
  car_dealer: 'auto-dealer', car_repair: 'auto-repair', auto_repair: 'auto-repair',
  car_wash: 'auto-car-wash', gas_station: 'auto',
  tire_shop: 'auto-tire',
  // Other
  travel_agency: 'svc-travel', pet_store: 'svc-pet', veterinary_care: 'svc-pet',
  laundry: 'svc-dry-cleaning', dry_cleaner: 'svc-dry-cleaning',
  tailor: 'svc-tailor', jewelry_store: 'svc-jewelry', watch_repair: 'svc-jewelry',
  church: 'svc-religious', hindu_temple: 'svc-religious', mosque: 'svc-religious',
  buddhist_temple: 'svc-religious', synagogue: 'svc-religious',
  funeral_home: 'svc-funeral', cemetery: 'svc-funeral',
  storage: 'svc-storage', self_storage: 'svc-storage',
  shipping_company: 'svc-shipping', courier_service: 'svc-shipping',
  photographer: 'svc-photography', photo_studio: 'svc-photography',
  print_shop: 'svc-printing',
  cell_phone_store: 'svc-phone-repair', electronics_store: 'svc-phone-repair',
  community_center: 'svc-community-org',
  child_care_agency: 'edu-daycare', day_care: 'edu-daycare',
  senior_citizen_center: 'svc-daycare-senior',
  nursing_home: 'svc-daycare-senior',
};

function mapGoogleTypes(types: string[]): string | null {
  for (const t of types) {
    if (TYPE_MAP[t]) return TYPE_MAP[t];
  }
  return null;
}

// ─── AI classification ───────────────────────────────────────────

let anthropic: any = null;

// Our category list for AI reference
const CATEGORY_LIST = `food-dining(餐饮), food-chinese(中餐), food-japanese(日料), food-korean(韩餐), food-hotpot(火锅), food-bubble-tea(奶茶), food-bakery(烘焙), food-dim-sum(早茶), food-noodles(面馆), food-seafood(海鲜), food-vietnamese(越南菜), food-thai(泰餐), food-coffee(咖啡), food-dessert(甜品), food-fast-food(快餐), food-grocery(超市), food-bar-nightlife(酒吧),
medical-health(医疗), medical-chinese-medicine(中医), medical-dental(牙科), medical-optometry(眼科), medical-pediatrics(儿科), medical-internal(内科), medical-primary-care(家庭医生), medical-mental-health(心理), medical-obgyn(妇产科), medical-dermatology(皮肤科), medical-orthopedic(骨科), medical-physical-therapy(物理治疗), medical-pharmacy(药房), medical-chiropractic(整脊),
legal-immigration(法律移民), legal-immigration-visa(移民签证), legal-business-law(商业法), legal-family(家庭法), legal-real-estate(房产法), legal-personal-injury(人身伤害), legal-criminal(刑事), legal-labor(劳工法), legal-notary(公证翻译),
finance-accounting(会计), finance-tax-prep(报税), finance-insurance(保险), finance-mortgage(贷款), finance-investment(投资),
realestate-agent(地产经纪), real-estate(地产),
education(教育), edu-tutoring(补习), edu-language(语言), edu-music-art(音乐美术), edu-daycare(托管), edu-stem(编程), edu-sports(体育), edu-dance(舞蹈), edu-driving-school(驾校), edu-preschool(幼儿园), edu-college-prep(升学),
home-renovation(装修), home-general-contractor(总承包), home-plumbing(水管), home-electrical(电工), home-painting(油漆), home-cleaning(清洁), home-moving(搬家), home-hvac(暖通), home-pest-control(害虫),
beauty-hair-salon(美发), beauty-barber(理发), beauty-nail-salon(美甲), beauty-spa-massage(SPA按摩), beauty-skincare(美容), beauty-fitness-gym(健身), beauty-medical-aesthetics(医美), beauty-tattoo(纹身),
auto-repair(汽修), auto-dealer(车行), auto-tire(轮胎), auto-car-wash(洗车),
svc-travel(旅行), svc-shipping(快递), svc-photography(摄影), svc-printing(印刷), svc-translation(翻译), svc-pet(宠物), svc-dry-cleaning(干洗), svc-phone-repair(手机维修), svc-tailor(裁缝), svc-wedding(婚庆), svc-jewelry(珠宝), svc-daycare-senior(老人护理), svc-religious(宗教), svc-community-org(社区), other-services(其他)`;

async function classifyWithAI(name: string, nameZh: string | null, desc: string | null): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }

  try {
    const r = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      system: `You classify businesses into categories. Reply with ONLY the category slug, nothing else.

Categories:
${CATEGORY_LIST}`,
      messages: [{
        role: 'user',
        content: `Business: ${nameZh || ''} ${name}\n${desc ? 'Description: ' + desc.slice(0, 100) : ''}\n\nCategory slug:`,
      }],
    });
    const text = r.content[0].type === 'text' ? r.content[0].text.trim() : '';
    // Extract just the slug (remove any extra text)
    const slug = text.split(/[\s,()（）]/)[0].trim();
    return slug || null;
  } catch { return null; }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('📁 Assign Categories to Uncategorized Businesses');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  // Get all businesses
  const allBiz = await supaGet('businesses?is_active=eq.true&select=id,display_name,display_name_zh,short_desc_zh,short_desc_en,google_place_id&order=review_count.desc.nullslast');
  const catLinks = await supaGet('business_categories?select=business_id');
  const hasCat = new Set(catLinks.map(l => l.business_id));
  const noCat = allBiz.filter(b => !hasCat.has(b.id));

  // Load categories
  const categories = await supaGet('categories?type=eq.business&select=id,slug');
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  const toProcess = limitArg ? noCat.slice(0, limitArg) : noCat;
  console.log(`📊 Total: ${allBiz.length} | Uncategorized: ${noCat.length} | Processing: ${toProcess.length}\n`);

  let byGoogle = 0, byAI = 0, failed = 0, errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const biz = toProcess[i];
    const name = (biz.display_name_zh || biz.display_name || '').slice(0, 35);
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${name.padEnd(37)} `);

    try {
      let catSlug: string | null = null;
      let source = '';

      // Strategy 1: Google primaryType
      if (biz.google_place_id) {
        const id = biz.google_place_id.startsWith('places/') ? biz.google_place_id : `places/${biz.google_place_id}`;
        const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
          headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': 'types,primaryType' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          catSlug = mapGoogleTypes(data.types || []);
          if (!catSlug && data.primaryType) catSlug = TYPE_MAP[data.primaryType] || null;
          if (catSlug) source = 'google';
        }
        await new Promise(r => setTimeout(r, 100));
      }

      // Strategy 2: AI classification
      if (!catSlug) {
        catSlug = await classifyWithAI(
          biz.display_name || '',
          biz.display_name_zh,
          biz.short_desc_zh || biz.short_desc_en,
        );
        if (catSlug) source = 'AI';
      }

      // Validate slug exists in our categories
      if (catSlug && !catMap.has(catSlug)) {
        // Try partial match
        const match = [...catMap.keys()].find(k => k.includes(catSlug!) || catSlug!.includes(k));
        if (match) catSlug = match;
        else catSlug = null;
      }

      if (catSlug && catMap.has(catSlug)) {
        if (source === 'google') byGoogle++;
        else byAI++;
        console.log(`✅ ${catSlug} (${source})`);

        if (applyChanges) {
          await supaInsert('business_categories', {
            business_id: biz.id,
            category_id: catMap.get(catSlug),
            is_primary: true,
          });
        }
      } else {
        failed++;
        console.log(`❌ could not classify`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('429')) {
        console.log('⏳ rate limited — waiting 30s');
        await new Promise(r => setTimeout(r, 30000));
        i--; continue;
      }
      errors++;
      console.log(`⚠️ ${err instanceof Error ? err.message.slice(0, 40) : 'error'}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  📍 Categorized by Google type: ${byGoogle}`);
  console.log(`  🤖 Categorized by AI:          ${byAI}`);
  console.log(`  ❌ Could not classify:          ${failed}`);
  console.log(`  ⚠️ Errors:                     ${errors}`);
  console.log(`  📊 Success rate: ${toProcess.length > 0 ? Math.round((byGoogle + byAI) * 100 / toProcess.length) : 0}%`);
  if (!applyChanges) console.log(`\n  👀 DRY RUN — add --apply to save`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
