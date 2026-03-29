/**
 * Expand Business Categories
 *
 * Inserts missing subcategories into the categories table to provide
 * comprehensive coverage for both Chinese and English community businesses.
 *
 * Usage:
 *   # Preview what will be added (dry run)
 *   source apps/web/.env.local && npx tsx scripts/expand-categories.ts
 *
 *   # Apply changes
 *   source apps/web/.env.local && npx tsx scripts/expand-categories.ts --apply
 *
 * Safe to run multiple times — skips existing slugs.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supaFetch(path: string, options?: RequestInit) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options?.method === 'POST' ? 'return=representation' : '',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Comprehensive category definitions ────────────────────────────────
// Each parent maps to its new subcategories { slug, name_zh, name_en }
// Existing subcategories are listed so we know to skip them.

interface SubcatDef {
  slug: string;
  name_zh: string;
  name_en: string;
}

interface ParentExpansion {
  parent_slug: string;
  parent_name_zh: string;
  parent_name_en: string;
  new_subcategories: SubcatDef[];
}

const EXPANSIONS: ParentExpansion[] = [
  // ═══ FOOD & DINING ═══
  {
    parent_slug: 'food-dining',
    parent_name_zh: '餐饮美食',
    parent_name_en: 'Food & Dining',
    new_subcategories: [
      // Existing: food-chinese, food-japanese, food-korean, food-hotpot, food-bakery, food-bubble-tea
      { slug: 'food-vietnamese', name_zh: '越南菜', name_en: 'Vietnamese' },
      { slug: 'food-thai', name_zh: '泰餐', name_en: 'Thai' },
      { slug: 'food-asian-fusion', name_zh: '亚洲融合', name_en: 'Asian Fusion' },
      { slug: 'food-american', name_zh: '美式餐厅', name_en: 'American' },
      { slug: 'food-pizza', name_zh: '披萨', name_en: 'Pizza' },
      { slug: 'food-mexican', name_zh: '墨西哥菜', name_en: 'Mexican' },
      { slug: 'food-indian', name_zh: '印度菜', name_en: 'Indian' },
      { slug: 'food-dessert', name_zh: '甜品冰淇淋', name_en: 'Dessert & Ice Cream' },
      { slug: 'food-fast-food', name_zh: '快餐', name_en: 'Fast Food' },
      { slug: 'food-seafood', name_zh: '海鲜', name_en: 'Seafood' },
      { slug: 'food-dim-sum', name_zh: '早茶点心', name_en: 'Dim Sum' },
      { slug: 'food-noodles', name_zh: '面馆', name_en: 'Noodles' },
      { slug: 'food-grocery', name_zh: '超市杂货', name_en: 'Grocery & Supermarket' },
      { slug: 'food-bar-nightlife', name_zh: '酒吧夜生活', name_en: 'Bar & Nightlife' },
      { slug: 'food-catering', name_zh: '宴会外烩', name_en: 'Catering' },
      { slug: 'food-coffee', name_zh: '咖啡', name_en: 'Coffee Shop' },
    ],
  },

  // ═══ MEDICAL & HEALTH ═══
  {
    parent_slug: 'medical-health',
    parent_name_zh: '医疗健康',
    parent_name_en: 'Medical & Health',
    new_subcategories: [
      // Existing: medical-chinese-medicine, medical-dental, medical-optometry, medical-pediatrics,
      //           medical-internal, medical-primary-care, medical-mental-health
      { slug: 'medical-obgyn', name_zh: '妇产科', name_en: 'OB/GYN' },
      { slug: 'medical-dermatology', name_zh: '皮肤科', name_en: 'Dermatology' },
      { slug: 'medical-orthopedic', name_zh: '骨科', name_en: 'Orthopedics' },
      { slug: 'medical-physical-therapy', name_zh: '物理治疗', name_en: 'Physical Therapy' },
      { slug: 'medical-pharmacy', name_zh: '药房', name_en: 'Pharmacy' },
      { slug: 'medical-urgent-care', name_zh: '急诊诊所', name_en: 'Urgent Care' },
      { slug: 'medical-chiropractic', name_zh: '脊椎治疗', name_en: 'Chiropractic' },
      { slug: 'medical-cardiology', name_zh: '心脏科', name_en: 'Cardiology' },
      { slug: 'medical-ent', name_zh: '耳鼻喉科', name_en: 'ENT' },
      { slug: 'medical-allergy', name_zh: '过敏科', name_en: 'Allergy & Immunology' },
    ],
  },

  // ═══ LEGAL & IMMIGRATION ═══
  {
    parent_slug: 'legal-immigration',
    parent_name_zh: '法律移民',
    parent_name_en: 'Legal & Immigration',
    new_subcategories: [
      // Existing: legal-business-law, legal-family, legal-real-estate
      { slug: 'legal-immigration-visa', name_zh: '移民签证', name_en: 'Immigration & Visa' },
      { slug: 'legal-personal-injury', name_zh: '人身伤害', name_en: 'Personal Injury' },
      { slug: 'legal-criminal', name_zh: '刑事辩护', name_en: 'Criminal Defense' },
      { slug: 'legal-labor', name_zh: '劳工法', name_en: 'Employment & Labor' },
      { slug: 'legal-estate-planning', name_zh: '遗产规划', name_en: 'Estate Planning' },
      { slug: 'legal-notary', name_zh: '公证翻译', name_en: 'Notary & Translation' },
    ],
  },

  // ═══ FINANCE & TAX ═══
  {
    parent_slug: 'finance-tax',
    parent_name_zh: '财税服务',
    parent_name_en: 'Finance & Tax',
    new_subcategories: [
      // Existing: finance-accounting, finance-insurance, finance-tax-prep, finance-mortgage
      { slug: 'finance-investment', name_zh: '投资理财', name_en: 'Investment & Wealth' },
      { slug: 'finance-bookkeeping', name_zh: '记账服务', name_en: 'Bookkeeping' },
      { slug: 'finance-payroll', name_zh: '薪资服务', name_en: 'Payroll Services' },
      { slug: 'finance-business-consulting', name_zh: '商业咨询', name_en: 'Business Consulting' },
    ],
  },

  // ═══ REAL ESTATE ═══
  {
    parent_slug: 'real-estate',
    parent_name_zh: '地产保险',
    parent_name_en: 'Real Estate',
    new_subcategories: [
      // Existing: realestate-agent, realestate-property-mgmt, realestate-home-inspection
      { slug: 'realestate-commercial', name_zh: '商业地产', name_en: 'Commercial Real Estate' },
      { slug: 'realestate-title-closing', name_zh: '过户服务', name_en: 'Title & Closing' },
      { slug: 'realestate-appraisal', name_zh: '房产评估', name_en: 'Appraisal' },
    ],
  },

  // ═══ EDUCATION & TRAINING ═══
  {
    parent_slug: 'education',
    parent_name_zh: '教育培训',
    parent_name_en: 'Education & Training',
    new_subcategories: [
      // Existing: edu-tutoring, edu-language, edu-daycare, edu-test-prep, edu-music-art
      { slug: 'edu-stem', name_zh: '编程科技', name_en: 'STEM & Coding' },
      { slug: 'edu-sports', name_zh: '体育培训', name_en: 'Sports & Martial Arts' },
      { slug: 'edu-dance', name_zh: '舞蹈', name_en: 'Dance' },
      { slug: 'edu-driving-school', name_zh: '驾校', name_en: 'Driving School' },
      { slug: 'edu-preschool', name_zh: '幼儿园', name_en: 'Preschool' },
      { slug: 'edu-college-prep', name_zh: '升学顾问', name_en: 'College Prep & Counseling' },
    ],
  },

  // ═══ HOME & RENOVATION ═══
  {
    parent_slug: 'home-renovation',
    parent_name_zh: '装修家居',
    parent_name_en: 'Home & Renovation',
    new_subcategories: [
      // Existing: home-moving, home-plumbing, home-painting, home-cleaning, home-electrical
      { slug: 'home-hvac', name_zh: '暖通空调', name_en: 'HVAC' },
      { slug: 'home-roofing', name_zh: '屋顶', name_en: 'Roofing' },
      { slug: 'home-flooring', name_zh: '地板', name_en: 'Flooring' },
      { slug: 'home-landscaping', name_zh: '园艺绿化', name_en: 'Landscaping' },
      { slug: 'home-pest-control', name_zh: '害虫防治', name_en: 'Pest Control' },
      { slug: 'home-locksmith', name_zh: '锁匠', name_en: 'Locksmith' },
      { slug: 'home-kitchen-bath', name_zh: '厨卫装修', name_en: 'Kitchen & Bath' },
      { slug: 'home-general-contractor', name_zh: '总承包商', name_en: 'General Contractor' },
      { slug: 'home-windows-doors', name_zh: '门窗', name_en: 'Windows & Doors' },
      { slug: 'home-furniture', name_zh: '家具家居', name_en: 'Furniture & Home Goods' },
    ],
  },

  // ═══ BEAUTY & WELLNESS ═══
  {
    parent_slug: 'beauty-wellness',
    parent_name_zh: '美容保健',
    parent_name_en: 'Beauty & Wellness',
    new_subcategories: [
      // Currently has NO subcategories
      { slug: 'beauty-hair-salon', name_zh: '美发沙龙', name_en: 'Hair Salon' },
      { slug: 'beauty-nail-salon', name_zh: '美甲店', name_en: 'Nail Salon' },
      { slug: 'beauty-spa-massage', name_zh: 'SPA按摩', name_en: 'Spa & Massage' },
      { slug: 'beauty-skincare', name_zh: '美容护肤', name_en: 'Skincare & Facial' },
      { slug: 'beauty-barber', name_zh: '理发店', name_en: 'Barber Shop' },
      { slug: 'beauty-fitness-gym', name_zh: '健身房', name_en: 'Fitness & Gym' },
      { slug: 'beauty-yoga-pilates', name_zh: '瑜伽普拉提', name_en: 'Yoga & Pilates' },
      { slug: 'beauty-tattoo', name_zh: '纹身纹眉', name_en: 'Tattoo & Microblading' },
      { slug: 'beauty-medical-aesthetics', name_zh: '医美', name_en: 'Medical Aesthetics' },
    ],
  },

  // ═══ AUTO SERVICES ═══
  {
    parent_slug: 'auto',
    parent_name_zh: '汽车服务',
    parent_name_en: 'Auto Services',
    new_subcategories: [
      // Currently has NO subcategories
      { slug: 'auto-repair', name_zh: '汽车维修', name_en: 'Auto Repair' },
      { slug: 'auto-body-shop', name_zh: '钣金喷漆', name_en: 'Auto Body Shop' },
      { slug: 'auto-dealer', name_zh: '车行', name_en: 'Auto Dealer' },
      { slug: 'auto-tire', name_zh: '轮胎', name_en: 'Tires' },
      { slug: 'auto-car-wash', name_zh: '洗车', name_en: 'Car Wash' },
      { slug: 'auto-towing', name_zh: '拖车', name_en: 'Towing' },
      { slug: 'auto-oil-change', name_zh: '换机油', name_en: 'Oil Change & Lube' },
    ],
  },

  // ═══ OTHER SERVICES (expanded into proper subcategories) ═══
  {
    parent_slug: 'other-services',
    parent_name_zh: '其他服务',
    parent_name_en: 'Other Services',
    new_subcategories: [
      { slug: 'svc-travel', name_zh: '旅行社', name_en: 'Travel Agency' },
      { slug: 'svc-shipping', name_zh: '快递物流', name_en: 'Shipping & Logistics' },
      { slug: 'svc-photography', name_zh: '摄影摄像', name_en: 'Photography & Videography' },
      { slug: 'svc-printing', name_zh: '印刷设计', name_en: 'Printing & Design' },
      { slug: 'svc-translation', name_zh: '翻译服务', name_en: 'Translation Services' },
      { slug: 'svc-pet', name_zh: '宠物服务', name_en: 'Pet Services' },
      { slug: 'svc-dry-cleaning', name_zh: '干洗洗衣', name_en: 'Dry Cleaning & Laundry' },
      { slug: 'svc-phone-repair', name_zh: '手机电脑维修', name_en: 'Phone & Computer Repair' },
      { slug: 'svc-tailor', name_zh: '裁缝改衣', name_en: 'Tailor & Alteration' },
      { slug: 'svc-wedding', name_zh: '婚庆服务', name_en: 'Wedding Services' },
      { slug: 'svc-funeral', name_zh: '殡葬服务', name_en: 'Funeral Services' },
      { slug: 'svc-storage', name_zh: '仓储自存', name_en: 'Storage' },
      { slug: 'svc-jewelry', name_zh: '珠宝钟表', name_en: 'Jewelry & Watch' },
      { slug: 'svc-daycare-senior', name_zh: '老人护理', name_en: 'Senior Care' },
      { slug: 'svc-religious', name_zh: '宗教场所', name_en: 'Religious & Spiritual' },
      { slug: 'svc-community-org', name_zh: '社区组织', name_en: 'Community Organization' },
    ],
  },
];

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const applyChanges = process.argv.includes('--apply');
  console.log('📂 Category Expansion Tool');
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  // Load existing categories
  const existing: Array<{ id: string; slug: string; name_zh: string; parent_id: string | null }> =
    await supaFetch('categories?select=id,slug,name_zh,parent_id');

  const existingSlugs = new Set(existing.map(c => c.slug));
  const parentBySlug = new Map(existing.filter(c => !c.parent_id).map(c => [c.slug, c]));

  console.log(`📊 Current: ${existing.length} categories (${existing.filter(c => !c.parent_id).length} parents, ${existing.filter(c => c.parent_id).length} subcategories)\n`);

  let totalNew = 0;
  let totalSkipped = 0;

  for (const expansion of EXPANSIONS) {
    const parent = parentBySlug.get(expansion.parent_slug);
    if (!parent) {
      console.log(`⚠️  Parent "${expansion.parent_slug}" not found — skipping`);
      continue;
    }

    console.log(`\n── ${expansion.parent_name_zh} / ${expansion.parent_name_en} (${parent.slug}) ──`);

    for (const sub of expansion.new_subcategories) {
      if (existingSlugs.has(sub.slug)) {
        console.log(`   ⏭️  ${sub.slug}: ${sub.name_zh} (already exists)`);
        totalSkipped++;
        continue;
      }

      console.log(`   ➕ ${sub.slug}: ${sub.name_zh} / ${sub.name_en}`);
      totalNew++;

      if (applyChanges) {
        await supaFetch('categories', {
          method: 'POST',
          body: JSON.stringify({
            name_zh: sub.name_zh,
            name_en: sub.name_en,
            slug: sub.slug,
            parent_id: parent.id,
          }),
        });
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  New: ${totalNew} | Skipped (exists): ${totalSkipped}`);
  if (!applyChanges && totalNew > 0) console.log(`  👀 DRY RUN — add --apply to insert`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
