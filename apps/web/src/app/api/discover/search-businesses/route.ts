import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSiteByHost } from '@/lib/sites';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ businesses: [] });
  }

  const supabase = getSupabase();
  const host = request.headers.get('host');
  const site = await getSiteByHost(host);

  // Search by name, Chinese name, and address — increased limit for better results
  const safeQuery = query.replace(/[,%]/g, '');
  const { data, error } = await supabase
    .from('businesses')
    .select('id, slug, display_name, display_name_zh, short_desc_zh, address_full')
    .or(`display_name.ilike.%${safeQuery}%,display_name_zh.ilike.%${safeQuery}%,address_full.ilike.%${safeQuery}%`)
    .eq('site_id', site?.id ?? '')
    .eq('status', 'active')
    .order('avg_rating', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ businesses: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businesses: data || [] });
}
