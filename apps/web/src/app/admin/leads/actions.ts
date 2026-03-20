'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function updateLeadStatus(leadId: string, status: string) {
  const supabase = db();

  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId);

  revalidatePath('/admin/leads');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function assignLead(leadId: string, businessId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('leads')
    .update({ business_id: businessId })
    .eq('id', leadId);

  revalidatePath('/admin/leads');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteLead(leadId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId);

  revalidatePath('/admin/leads');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
