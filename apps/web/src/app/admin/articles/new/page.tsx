import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import ArticleForm from '../ArticleForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewArticlePage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch categories for article type
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name_zh, name, slug, type')
    .eq('type', 'article')
    .order('sort_order', { ascending: true });
  const categories = (rawCategories || []) as AnyRow[];

  // Fetch regions for this site
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('id, name_zh, slug')
    .in('id', ctx.regionIds);
  const regions = (rawRegions || []) as AnyRow[];

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (params.region) siteParamsObj.set('region', String(params.region));
  if (params.locale) siteParamsObj.set('locale', String(params.locale));

  return (
    <ArticleForm
      article={null}
      categories={categories}
      regions={regions}
      isNew={true}
      siteParams={siteParamsObj.toString()}
    />
  );
}
