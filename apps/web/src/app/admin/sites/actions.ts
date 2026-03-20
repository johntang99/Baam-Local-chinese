'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// Use untyped client for admin mutations (schema types incomplete)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

// ============================================================
// REGION ACTIONS
// ============================================================

export async function addRegion(formData: FormData) {
  const supabase = adminDb();

  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const type = (formData.get('type') as string) || 'city';
  const parent_id = (formData.get('parent_id') as string) || null;

  if (!slug || !name_en) {
    return { error: 'Slug and English name are required' };
  }

  const { error } = await supabase.from('regions').insert({
    slug,
    name_en,
    name_zh: name_zh || null,
    type,
    parent_id: parent_id || null,
    timezone: 'America/New_York',
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/sites');
  return { success: true };
}

export async function deleteRegion(regionId: string) {
  const supabase = adminDb();
  const { error } = await supabase.from('regions').delete().eq('id', regionId);
  if (error) return { error: error.message };
  revalidatePath('/admin/sites');
  return { success: true };
}

// ============================================================
// SITE-REGION LINK ACTIONS
// ============================================================

export async function addRegionToSite(siteId: string, regionId: string) {
  const supabase = adminDb();
  const { error } = await supabase.from('site_regions').insert({
    site_id: siteId,
    region_id: regionId,
    is_primary: false,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/sites');
  return { success: true };
}

export async function removeRegionFromSite(siteId: string, regionId: string) {
  const supabase = adminDb();
  const { error } = await supabase
    .from('site_regions')
    .delete()
    .eq('site_id', siteId)
    .eq('region_id', regionId);
  if (error) return { error: error.message };
  revalidatePath('/admin/sites');
  return { success: true };
}

// ============================================================
// SITE ACTIONS
// ============================================================

export async function addSite(formData: FormData) {
  const supabase = adminDb();

  const slug = (formData.get('slug') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const locale = (formData.get('locale') as string) || 'zh';
  const domain = (formData.get('domain') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();

  if (!slug || !name) {
    return { error: 'Slug and name are required' };
  }

  const { error } = await supabase.from('sites').insert({
    slug, name, name_zh: name_zh || null, locale, domain: domain || null,
    description: description || null, status: 'planned',
  });

  if (error) return { error: error.message };
  revalidatePath('/admin/sites');
  return { success: true };
}

export async function updateSiteStatus(siteId: string, status: string) {
  const supabase = adminDb();
  const { error } = await supabase.from('sites').update({ status }).eq('id', siteId);
  if (error) return { error: error.message };
  revalidatePath('/admin/sites');
  return { success: true };
}
