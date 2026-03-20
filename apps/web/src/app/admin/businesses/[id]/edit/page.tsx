import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import BusinessForm from '../../BusinessForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  // Fetch categories for business type
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name_zh, name, slug, type')
    .eq('type', 'business')
    .order('sort_order', { ascending: true });
  const categories = (rawCategories || []) as AnyRow[];

  return (
    <BusinessForm
      business={business}
      categories={categories}
      isNew={false}
      siteParams={siteParamsObj.toString()}
    />
  );
}
