'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

function generateSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

export async function createBusiness(formData: FormData) {
  const supabase = db();
  const displayName = formData.get('display_name') as string;
  const slug = generateSlug(displayName || 'business');

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      display_name: displayName,
      display_name_zh: formData.get('display_name_zh') as string,
      short_desc_zh: formData.get('short_desc_zh') as string || null,
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      website_url: formData.get('website_url') as string || null,
      wechat_id: formData.get('wechat_id') as string || null,
      status: (formData.get('status') as string) || 'active',
      verification_status: (formData.get('verification_status') as string) || 'unverified',
      current_plan: (formData.get('current_plan') as string) || 'free',
      category_id: formData.get('category_id') as string || null,
      slug,
    })
    .select('id')
    .single();

  revalidatePath('/admin/businesses');

  if (error) {
    return { id: null, error: error.message };
  }
  return { id: data?.id, error: null };
}

export async function updateBusiness(bizId: string, formData: FormData) {
  const supabase = db();

  const { error } = await supabase
    .from('businesses')
    .update({
      display_name: formData.get('display_name') as string,
      display_name_zh: formData.get('display_name_zh') as string,
      short_desc_zh: formData.get('short_desc_zh') as string || null,
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      website_url: formData.get('website_url') as string || null,
      wechat_id: formData.get('wechat_id') as string || null,
      status: formData.get('status') as string,
      verification_status: formData.get('verification_status') as string,
      current_plan: formData.get('current_plan') as string,
      category_id: formData.get('category_id') as string || null,
    })
    .eq('id', bizId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteBusiness(bizId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', bizId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function approveClaim(claimId: string) {
  const supabase = db();

  // Get the claim to find the business_id
  const { data: claim } = await supabase
    .from('business_claim_requests')
    .select('business_id')
    .eq('id', claimId)
    .single();

  if (!claim) {
    return { error: 'Claim not found' };
  }

  // Update claim status
  const { error: claimError } = await supabase
    .from('business_claim_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', claimId);

  if (claimError) {
    return { error: claimError.message };
  }

  // Update business status to claimed
  const { error: bizError } = await supabase
    .from('businesses')
    .update({ status: 'claimed' })
    .eq('id', claim.business_id);

  revalidatePath('/admin/businesses');

  if (bizError) {
    return { error: bizError.message };
  }
  return { error: null };
}

export async function rejectClaim(claimId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('business_claim_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', claimId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleFeatured(bizId: string, featured: boolean) {
  const supabase = db();

  const { error } = await supabase
    .from('businesses')
    .update({ is_featured: featured })
    .eq('id', bizId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
