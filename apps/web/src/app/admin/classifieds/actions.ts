'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import { generateSeoSlug } from '@/lib/slug-generator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function createClassified(formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();
  const title = formData.get('title') as string;
  const slug = await generateSeoSlug(title || 'listing', null, supabase, 'classifieds');

  const metadata: Record<string, unknown> = {};
  const category = formData.get('category') as string;
  // Cover photo and photos
  if (formData.get('cover_photo')) metadata.cover_photo = formData.get('cover_photo') as string;
  try { const p = JSON.parse(formData.get('photos') as string || '[]'); if (Array.isArray(p) && p.length > 0) metadata.photos = p; } catch {}
  // Category-specific metadata
  if (category === 'housing_rent' || category === 'housing_buy') {
    if (formData.get('bedrooms')) metadata.bedrooms = parseInt(formData.get('bedrooms') as string);
    if (formData.get('bathrooms')) metadata.bathrooms = parseInt(formData.get('bathrooms') as string);
    if (formData.get('rent_amount')) metadata.rent_amount = parseFloat(formData.get('rent_amount') as string);
    if (formData.get('neighborhood')) metadata.neighborhood = formData.get('neighborhood') as string;
  } else if (category === 'jobs') {
    if (formData.get('salary_range')) metadata.salary_range = formData.get('salary_range') as string;
    if (formData.get('job_type')) metadata.job_type = formData.get('job_type') as string;
    if (formData.get('company')) metadata.company = formData.get('company') as string;
  } else if (category === 'secondhand') {
    if (formData.get('condition')) metadata.condition = formData.get('condition') as string;
    if (formData.get('original_price')) metadata.original_price = parseFloat(formData.get('original_price') as string);
  }

  const { data, error } = await supabase
    .from('classifieds')
    .insert({
      slug,
      site_id: ctx.siteId,
      title,
      body: formData.get('body') as string || null,
      category,
      sub_category: formData.get('sub_category') as string || null,
      price_text: formData.get('price_text') as string || null,
      contact_name: formData.get('contact_name') as string || null,
      contact_phone: formData.get('contact_phone') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_wechat: formData.get('contact_wechat') as string || null,
      status: formData.get('status') as string || 'active',
      is_featured: formData.get('is_featured') === 'true',
      author_id: formData.get('author_id') as string || null,
      metadata,
    })
    .select('id')
    .single();

  revalidatePath('/admin/classifieds');
  if (error) return { id: null, error: error.message };
  return { id: data?.id, error: null };
}

export async function updateClassified(id: string, formData: FormData) {
  const supabase = db();
  const category = formData.get('category') as string;

  const metadata: Record<string, unknown> = {};
  // Cover photo and photos
  if (formData.get('cover_photo')) metadata.cover_photo = formData.get('cover_photo') as string;
  try { const p = JSON.parse(formData.get('photos') as string || '[]'); if (Array.isArray(p) && p.length > 0) metadata.photos = p; } catch {}
  if (category === 'housing_rent' || category === 'housing_buy') {
    if (formData.get('bedrooms')) metadata.bedrooms = parseInt(formData.get('bedrooms') as string);
    if (formData.get('bathrooms')) metadata.bathrooms = parseInt(formData.get('bathrooms') as string);
    if (formData.get('rent_amount')) metadata.rent_amount = parseFloat(formData.get('rent_amount') as string);
    if (formData.get('neighborhood')) metadata.neighborhood = formData.get('neighborhood') as string;
  } else if (category === 'jobs') {
    if (formData.get('salary_range')) metadata.salary_range = formData.get('salary_range') as string;
    if (formData.get('job_type')) metadata.job_type = formData.get('job_type') as string;
    if (formData.get('company')) metadata.company = formData.get('company') as string;
  } else if (category === 'secondhand') {
    if (formData.get('condition')) metadata.condition = formData.get('condition') as string;
    if (formData.get('original_price')) metadata.original_price = parseFloat(formData.get('original_price') as string);
  }

  const { error } = await supabase
    .from('classifieds')
    .update({
      title: formData.get('title') as string,
      body: formData.get('body') as string || null,
      category,
      sub_category: formData.get('sub_category') as string || null,
      price_text: formData.get('price_text') as string || null,
      contact_name: formData.get('contact_name') as string || null,
      contact_phone: formData.get('contact_phone') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_wechat: formData.get('contact_wechat') as string || null,
      status: formData.get('status') as string,
      is_featured: formData.get('is_featured') === 'true',
      metadata,
    })
    .eq('id', id);

  revalidatePath('/admin/classifieds');
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteClassified(id: string) {
  const supabase = db();
  const { error } = await supabase.from('classifieds').delete().eq('id', id);
  revalidatePath('/admin/classifieds');
  if (error) return { error: error.message };
  return { error: null };
}

export async function toggleClassifiedFeatured(id: string, current: boolean) {
  const supabase = db();
  const { error } = await supabase.from('classifieds').update({ is_featured: !current }).eq('id', id);
  revalidatePath('/admin/classifieds');
  if (error) return { error: error.message };
  return { error: null, is_featured: !current };
}

export async function setClassifiedStatus(id: string, status: string) {
  const supabase = db();
  const { error } = await supabase.from('classifieds').update({ status }).eq('id', id);
  revalidatePath('/admin/classifieds');
  if (error) return { error: error.message };
  return { error: null };
}
