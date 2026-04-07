import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Baam · 纽约华人本地生活门户',
  description: 'AI驱动的纽约华人本地生活与商家增长平台。新闻、资讯、论坛、商家、达人，一站式解决本地生活问题。',
  icons: {
    icon: '/icon',
    shortcut: '/icon',
    apple: '/icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
