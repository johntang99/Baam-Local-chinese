import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getNavigationItems, getFooterConfig } from '@/lib/site-settings-public';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dbNavItems, dbFooterConfig] = await Promise.all([
    getNavigationItems(),
    getFooterConfig(),
  ]);

  return (
    <>
      <Navbar dbNavItems={dbNavItems.length > 0 ? dbNavItems : undefined} />
      {children}
      <Footer dbConfig={dbFooterConfig || undefined} />
    </>
  );
}
