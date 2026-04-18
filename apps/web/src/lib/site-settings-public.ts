import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

/**
 * Fetch a site setting for the current site.
 * Uses admin client to bypass RLS.
 */
export async function getPublicSiteSetting(key: string): Promise<AnyRow | null> {
  try {
    const site = await getCurrentSite();
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('site_settings')
      .select('setting_value')
      .eq('site_id', site.id)
      .eq('setting_key', key)
      .single();
    return data?.setting_value || null;
  } catch {
    return null;
  }
}

export async function getNavigationItems(): Promise<AnyRow[]> {
  const nav = await getPublicSiteSetting('navigation');
  if (!nav?.items) return [];
  return (nav.items as AnyRow[])
    .filter(item => item.visible !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

export async function getHeaderConfig(): Promise<AnyRow | null> {
  return getPublicSiteSetting('header');
}

export async function getFooterConfig(): Promise<AnyRow | null> {
  return getPublicSiteSetting('footer');
}

export async function getSeoConfig(): Promise<AnyRow | null> {
  return getPublicSiteSetting('seo');
}
