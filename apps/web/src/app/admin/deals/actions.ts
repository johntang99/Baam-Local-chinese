'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import { generateSeoSlug } from '@/lib/slug-generator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function createDeal(formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();
  const titleZh = formData.get('title_zh') as string;
  const titleEn = formData.get('title_en') as string;
  const slug = await generateSeoSlug(titleZh || 'deal', titleEn, supabase, 'deals');

  const { data, error } = await supabase
    .from('deals')
    .insert({
      slug,
      site_id: ctx.siteId,
      title_zh: titleZh,
      title_en: formData.get('title_en') as string || null,
      short_desc_zh: formData.get('short_desc_zh') as string || null,
      long_desc_zh: formData.get('long_desc_zh') as string || null,
      discount_type: formData.get('discount_type') as string || 'price',
      original_price: parseFloat(formData.get('original_price') as string) || null,
      discount_price: parseFloat(formData.get('discount_price') as string) || null,
      discount_percent: parseInt(formData.get('discount_percent') as string) || null,
      discount_label: formData.get('discount_label') as string || null,
      business_id: formData.get('business_id') as string || null,
      cover_photo: formData.get('cover_photo') as string || null,
      external_url: formData.get('external_url') as string || null,
      start_date: formData.get('start_date') as string || new Date().toISOString().split('T')[0],
      end_date: formData.get('end_date') as string || null,
      status: formData.get('status') as string || 'pending',
      is_featured: formData.get('is_featured') === 'true',
    })
    .select('id')
    .single();

  revalidatePath('/admin/deals');

  if (error) return { id: null, error: error.message };
  return { id: data?.id, error: null };
}

export async function updateDeal(dealId: string, formData: FormData) {
  const supabase = db();

  const { error } = await supabase
    .from('deals')
    .update({
      title_zh: formData.get('title_zh') as string,
      title_en: formData.get('title_en') as string || null,
      short_desc_zh: formData.get('short_desc_zh') as string || null,
      long_desc_zh: formData.get('long_desc_zh') as string || null,
      discount_type: formData.get('discount_type') as string || 'price',
      original_price: parseFloat(formData.get('original_price') as string) || null,
      discount_price: parseFloat(formData.get('discount_price') as string) || null,
      discount_percent: parseInt(formData.get('discount_percent') as string) || null,
      discount_label: formData.get('discount_label') as string || null,
      business_id: formData.get('business_id') as string || null,
      cover_photo: formData.get('cover_photo') as string || null,
      external_url: formData.get('external_url') as string || null,
      start_date: formData.get('start_date') as string || null,
      end_date: formData.get('end_date') as string || null,
      status: formData.get('status') as string,
      is_featured: formData.get('is_featured') === 'true',
    })
    .eq('id', dealId);

  revalidatePath('/admin/deals');

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteDeal(dealId: string) {
  const supabase = db();
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  revalidatePath('/admin/deals');
  if (error) return { error: error.message };
  return { error: null };
}

export async function approveDeal(dealId: string) {
  const supabase = db();
  const { error } = await supabase
    .from('deals')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', dealId);
  revalidatePath('/admin/deals');
  if (error) return { error: error.message };
  return { error: null };
}

export async function rejectDeal(dealId: string, note?: string) {
  const supabase = db();
  const { error } = await supabase
    .from('deals')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      rejection_note: note || null,
    })
    .eq('id', dealId);
  revalidatePath('/admin/deals');
  if (error) return { error: error.message };
  return { error: null };
}

export async function toggleDealFeatured(dealId: string, currentValue: boolean) {
  const supabase = db();
  const { error } = await supabase
    .from('deals')
    .update({ is_featured: !currentValue })
    .eq('id', dealId);
  revalidatePath('/admin/deals');
  if (error) return { error: error.message };
  return { error: null, is_featured: !currentValue };
}
