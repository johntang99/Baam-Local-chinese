import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export type SettingKey = 'header' | 'navigation' | 'footer' | 'seo';

export async function getSiteSetting(siteId: string, key: SettingKey): Promise<AnyRow | null> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('site_settings')
    .select('setting_value')
    .eq('site_id', siteId)
    .eq('setting_key', key)
    .single();
  return data?.setting_value || null;
}

export async function getAllSiteSettings(siteId: string): Promise<Record<SettingKey, AnyRow | null>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .eq('site_id', siteId);

  const result: Record<string, AnyRow | null> = { header: null, navigation: null, footer: null, seo: null };
  for (const row of (data || [])) {
    result[row.setting_key] = row.setting_value;
  }
  return result as Record<SettingKey, AnyRow | null>;
}

export async function saveSiteSetting(siteId: string, key: SettingKey, value: AnyRow): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from('site_settings')
    .update({ setting_value: value, updated_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .eq('setting_key', key);

  if (error) return { error: error.message };
  return {};
}
