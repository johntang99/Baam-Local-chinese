import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import BusinessForm from '../BusinessForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewBusinessPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch categories for business type
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name_zh, name, slug, type')
    .eq('type', 'business')
    .order('sort_order', { ascending: true });
  const categories = (rawCategories || []) as AnyRow[];

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (params.region) siteParamsObj.set('region', String(params.region));
  if (params.locale) siteParamsObj.set('locale', String(params.locale));

  return (
    <BusinessForm
      business={null}
      categories={categories}
      isNew={true}
      siteParams={siteParamsObj.toString()}
    />
  );
}
