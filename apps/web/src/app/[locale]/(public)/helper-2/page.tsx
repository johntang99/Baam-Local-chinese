import type { Metadata } from 'next';
import { Helper2Chat } from './chat';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '小帮手-2 · Baam',
  description: '中文聊天式本地智能助手。结合 Baam 站内内容与网页补充，回答本地生活、商家推荐、办事和最新信息问题。',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function Helper2Page({ searchParams }: Props) {
  const sp = await searchParams;
  const initialQuery = sp.q?.trim() || '';

  return (
    <main>
      <PageContainer className="max-w-4xl py-8">
        <Card className="text-center mb-8 p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-blue-50 border-primary/20">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🧭
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">小帮手-2</h1>
          <p className="text-text-secondary text-sm max-w-2xl mx-auto">
            一个新的中文聊天式本地智能助手。它会先利用 Baam 的新闻、生活资讯、发现、商家、论坛和活动内容，
            再在需要时补充网页信息，而不是只做站内搜索。
          </p>
        </Card>

        <Helper2Chat initialQuery={initialQuery} />
      </PageContainer>
    </main>
  );
}
