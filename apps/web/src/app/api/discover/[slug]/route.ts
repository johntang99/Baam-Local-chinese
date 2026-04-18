import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSiteByHost } from '@/lib/sites';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const supabase = getSupabase();
  const host = request.headers.get('host');
  const site = await getSiteByHost(host);
  const siteId = site?.id ?? '';

  // Fetch post
  const { data: post, error } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('site_id', siteId)
    .in('status', ['published', 'pending_review'])
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch author profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_verified, headline, profile_type')
    .eq('id', post.author_id)
    .single();

  // Fetch comments with author profiles
  const { data: comments } = await supabase
    .from('voice_post_comments')
    .select('*, profiles:author_id(display_name, username, avatar_url)')
    .eq('post_id', post.id)
    .eq('site_id', siteId)
    .order('created_at', { ascending: true });

  // Fetch linked businesses
  const { data: linkedBusinesses } = await supabase
    .from('discover_post_businesses' as string)
    .select('*, businesses(*)')
    .eq('post_id', post.id)
    .order('sort_order', { ascending: true });

  // Fetch more posts from same author
  const { data: morePosts } = await supabase
    .from('voice_posts')
    .select('id, slug, title, cover_images, cover_image_url')
    .eq('author_id', post.author_id)
    .eq('site_id', siteId)
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(3);

  return NextResponse.json({
    post,
    profile: profile || null,
    comments: comments || [],
    linkedBusinesses: linkedBusinesses || [],
    morePosts: morePosts || [],
  });
}
