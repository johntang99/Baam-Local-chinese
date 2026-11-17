import { createAdminClient } from '@/lib/supabase/admin';
import { getDefaultSite } from '@/lib/sites';
import type { MetadataRoute } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://baam.us';

function getStaticPages(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/zh`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/zh/news`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/zh/guides`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/zh/businesses`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/zh/forum`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/zh/voices`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/zh/events`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = getStaticPages();

  // Build should not fail if Supabase env vars are missing in this environment.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return staticPages;
  }

  let supabase;
  let defaultSiteId = '';
  try {
    supabase = createAdminClient();
    const defaultSite = await getDefaultSite();
    defaultSiteId = defaultSite?.id ?? '';
  } catch {
    return staticPages;
  }

  // Fetch all published content slugs
  let articles: AnyRow[] = [];
  let businesses: AnyRow[] = [];
  let events: AnyRow[] = [];
  try {
    const [articleRes, businessRes, eventRes] = await Promise.all([
      supabase.from('articles').select('slug, updated_at, content_vertical').eq('editorial_status', 'published').eq('site_id', defaultSiteId),
      supabase.from('businesses').select('slug, updated_at').eq('site_id', defaultSiteId).eq('is_active', true).eq('status', 'active'),
      supabase.from('events').select('slug, updated_at').eq('status', 'published').eq('site_id', defaultSiteId),
    ]);
    articles = (articleRes.data || []) as AnyRow[];
    businesses = (businessRes.data || []) as AnyRow[];
    events = (eventRes.data || []) as AnyRow[];
  } catch {
    return staticPages;
  }

  const articlePages = articles
    .filter((a) => String(a.content_vertical || '').startsWith('news_'))
    .map((a) => ({
    url: `${BASE_URL}/zh/news/${a.slug}`,
    lastModified: new Date(a.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    }));

  const guidePages = articles
    .filter((a) => String(a.content_vertical || '').startsWith('guide_'))
    .map((a) => ({
      url: `${BASE_URL}/zh/guides/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

  const businessPages = businesses.map((b) => ({
    url: `${BASE_URL}/zh/businesses/${b.slug}`,
    lastModified: new Date(b.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const eventPages = events.map((e) => ({
    url: `${BASE_URL}/zh/events/${e.slug}`,
    lastModified: new Date(e.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages, ...guidePages, ...businessPages, ...eventPages];
}
