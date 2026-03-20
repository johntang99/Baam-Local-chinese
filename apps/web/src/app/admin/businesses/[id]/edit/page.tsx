import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import BusinessForm from '../../BusinessForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildCategoryTree(categories: AnyRow[]) {
  const parents = categories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, AnyRow[]>();

  for (const cat of categories) {
    if (cat.parent_id) {
      const list = childrenMap.get(cat.parent_id) || [];
      list.push(cat);
      childrenMap.set(cat.parent_id, list);
    }
  }

  return parents.map((parent) => ({
    parent,
    children: childrenMap.get(parent.id) || [],
  }));
}

export default async function EditBusinessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getAdminSiteContext(sp);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (sp.region) siteParamsObj.set('region', String(sp.region));
  if (sp.locale) siteParamsObj.set('locale', String(sp.locale));

  // Fetch the business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();

  if (!business) {
    return (
      <div className="p-12 text-center">
        <p className="text-lg font-medium">商家不存在</p>
        <p className="text-sm text-text-muted mt-1">ID: {id}</p>
        <a href={`/admin/businesses${siteParamsObj.toString() ? `?${siteParamsObj.toString()}` : ''}`} className="text-primary hover:underline text-sm mt-4 inline-block">
          返回商家列表
        </a>
      </div>
    );
  }

  // Fetch categories for business type (including parent_id for tree)
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name_zh, name, slug, type, parent_id')
    .eq('type', 'business')
    .order('sort_order', { ascending: true });
  const categories = (rawCategories || []) as AnyRow[];
  const categoryTree = buildCategoryTree(categories);

  // Fetch existing business_categories for this business
  const { data: rawBizCats } = await supabase
    .from('business_categories')
    .select('category_id')
    .eq('business_id', id);
  const selectedCategoryIds = ((rawBizCats || []) as AnyRow[]).map((r: AnyRow) => r.category_id as string);

  return (
    <BusinessForm
      business={business}
      categories={categories}
      categoryTree={categoryTree}
      selectedCategoryIds={selectedCategoryIds}
      isNew={false}
      siteParams={siteParamsObj.toString()}
    />
  );
}
