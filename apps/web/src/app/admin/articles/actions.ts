'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

function generateSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

export async function createArticle(formData: FormData) {
  const supabase = db();
  const titleZh = formData.get('title_zh') as string;
  const slug = (formData.get('slug') as string) || generateSlug(titleZh || 'article');

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title_zh: titleZh,
      title_en: formData.get('title_en') as string,
      content_vertical: formData.get('content_vertical') as string,
      body_zh: formData.get('body_zh') as string,
      body_en: formData.get('body_en') as string,
      editorial_status: (formData.get('editorial_status') as string) || 'draft',
      category_id: formData.get('category_id') as string || null,
      region_id: formData.get('region_id') as string || null,
      source_type: formData.get('source_type') as string || null,
      source_name: formData.get('source_name') as string || null,
      source_url: formData.get('source_url') as string || null,
      seo_title_zh: formData.get('seo_title_zh') as string || null,
      seo_desc_zh: formData.get('seo_desc_zh') as string || null,
      audience_types: JSON.parse((formData.get('audience_types') as string) || '[]'),
      slug,
    })
    .select('id')
    .single();

  revalidatePath('/admin/articles');

  if (error) {
    return { id: null, error: error.message };
  }
  return { id: data?.id, error: null };
}

export async function updateArticle(articleId: string, formData: FormData) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({
      title_zh: formData.get('title_zh') as string,
      title_en: formData.get('title_en') as string,
      content_vertical: formData.get('content_vertical') as string,
      body_zh: formData.get('body_zh') as string,
      body_en: formData.get('body_en') as string,
      editorial_status: formData.get('editorial_status') as string,
      category_id: formData.get('category_id') as string || null,
      region_id: formData.get('region_id') as string || null,
      source_type: formData.get('source_type') as string || null,
      source_name: formData.get('source_name') as string || null,
      source_url: formData.get('source_url') as string || null,
      seo_title_zh: formData.get('seo_title_zh') as string || null,
      seo_desc_zh: formData.get('seo_desc_zh') as string || null,
      audience_types: JSON.parse((formData.get('audience_types') as string) || '[]'),
    })
    .eq('id', articleId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteArticle(articleId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', articleId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function publishArticle(articleId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({
      editorial_status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', articleId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function archiveArticle(articleId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({ editorial_status: 'archived' })
    .eq('id', articleId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function bulkPublish(articleIds: string[]) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({
      editorial_status: 'published',
      published_at: new Date().toISOString(),
    })
    .in('id', articleIds);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function bulkArchive(articleIds: string[]) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({ editorial_status: 'archived' })
    .in('id', articleIds);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function generateAISummary(articleId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('articles')
    .update({
      ai_summary_zh: '[AI摘要占位] 这是一篇关于本地社区资讯的文章摘要，将在AI服务接入后自动生成。',
    })
    .eq('id', articleId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
