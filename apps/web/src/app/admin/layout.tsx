import '../globals.css';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export const metadata = {
  title: 'Admin · Baam',
  description: 'Baam Admin Panel',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-bg-page text-text-primary antialiased">
        <div className="flex min-h-screen">
          <AdminSidebar />
          <main className="flex-1 ml-0 lg:ml-[var(--sidebar-width)]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
