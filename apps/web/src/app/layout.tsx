import type { Metadata } from 'next';
import './globals.css';
import { getSeoConfig } from '@/lib/site-settings-public';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoConfig();

  return {
    title: seo?.default_title || 'Baam · 纽约华人本地生活门户',
    description: seo?.description || 'AI驱动的纽约华人本地生活与商家增长平台。新闻、资讯、论坛、商家、达人，一站式解决本地生活问题。',
    keywords: seo?.keywords || undefined,
    openGraph: {
      title: seo?.default_title || 'Baam · 纽约华人本地生活门户',
      description: seo?.description || undefined,
      images: seo?.og_image_url ? [{ url: seo.og_image_url }] : undefined,
      locale: seo?.locale || 'zh-CN',
    },
    verification: seo?.google_site_verification ? { google: seo.google_site_verification } : undefined,
    icons: {
      icon: '/icon',
      shortcut: '/icon',
      apple: '/icon',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
