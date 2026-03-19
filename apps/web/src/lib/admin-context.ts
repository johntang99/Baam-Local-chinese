/**
 * Admin site context — resolves region/locale from URL search params
 * Used by all site-scoped admin pages to filter data
 */

// Site definitions: each site has a set of region slugs and a locale
export const ADMIN_SITES = [
  {
    id: 'ny-zh',
    label: 'New York Chinese',
    regionSlugs: ['flushing-ny', 'queens-ny', 'new-york-city'],
    locale: 'zh',
  },
  {
    id: 'oc-en',
    label: 'Middletown OC English',
    regionSlugs: ['middletown-ny', 'orange-county-ny'],
    locale: 'en',
  },
] as const;

export type SiteId = typeof ADMIN_SITES[number]['id'];

export interface AdminSiteContext {
  siteId: string;
  locale: string;
  regionSlugs: string[];
}

/**
 * Parse site context from URL search params.
 * Returns the region slugs and locale for filtering queries.
 */
export function getAdminSiteContext(searchParams: Record<string, string | string[] | undefined>): AdminSiteContext {
  const regionParam = (typeof searchParams.region === 'string' ? searchParams.region : 'ny-zh');
  const localeParam = (typeof searchParams.locale === 'string' ? searchParams.locale : 'zh');

  const site = ADMIN_SITES.find(s => s.id === regionParam);

  return {
    siteId: site?.id || 'ny-zh',
    locale: localeParam,
    regionSlugs: site?.regionSlugs ? [...site.regionSlugs] : ['flushing-ny', 'queens-ny', 'new-york-city'],
  };
}
