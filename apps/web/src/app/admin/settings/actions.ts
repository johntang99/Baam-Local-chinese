'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;
const reval = () => revalidatePath('/admin/settings');

// ============================================================
// CATEGORY CRUD
// ============================================================

export async function addCategory(formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const parent_id = (formData.get('parent_id') as string) || null;
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  if (!slug || !name_en) return { error: 'Slug and English name are required' };

  const { error } = await db().from('categories').insert({
    slug,
    name_en,
    name_zh: name_zh || null,
    type: 'business',
    parent_id: parent_id || null,
    icon: icon || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
  });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function updateCategory(categoryId: string, formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const parent_id = (formData.get('parent_id') as string) || null;
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  if (!name_en) return { error: 'English name is required' };

  const updates: Record<string, unknown> = {
    name_en,
    name_zh: name_zh || null,
    icon: icon || null,
    parent_id: parent_id || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
  };
  if (slug) updates.slug = slug;

  const { error } = await db().from('categories').update(updates).eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function deleteCategory(categoryId: string) {
  // Delete children first (if any), then the category itself
  await db().from('categories').delete().eq('parent_id', categoryId);
  const { error } = await db().from('categories').delete().eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}
