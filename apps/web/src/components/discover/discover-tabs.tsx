'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from '@/lib/i18n/routing';
import Link from 'next/link';

const tabs = [
  { key: 'recommend', label: '推荐' },
  { key: 'following', label: '关注' },
  { key: 'notes', label: '笔记' },
  { key: 'videos', label: '视频' },
  { key: 'topics', label: '话题' },
] as const;

export function DiscoverTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'recommend';

  const handleTabClick = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'recommend') {
      params.delete('tab');
    } else {
      params.set('tab', key);
    }
    params.delete('page');
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key)}
          className={`relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? 'text-text-primary fw-semibold'
              : 'text-text-secondary hover:text-text-primary fw-medium'
          }`}
        >
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary r-full" />
          )}
        </button>
      ))}

      {/* Publish Button */}
      <Link
        href="/discover/new-post"
        className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm fw-semibold r-xl hover:bg-primary/90 transition-colors flex-shrink-0"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        发布晒晒
      </Link>
    </div>
  );
}
