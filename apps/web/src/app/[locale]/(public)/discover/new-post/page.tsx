import { getCurrentUser } from '@/lib/auth';
import { Link } from '@/lib/i18n/routing';
import { VoicePostForm } from './form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '发布笔记 · 发现 · Baam',
  description: '发布你的本地见解、推荐、经验分享',
};

export default async function DiscoverNewPostPage() {
  const user = await getCurrentUser();

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/discover" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">返回发现</span>
          </Link>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <h1 className="text-lg font-bold text-gray-900">发布笔记</h1>
        </div>

        <VoicePostForm isLoggedIn={!!user} />
      </div>
    </main>
  );
}
