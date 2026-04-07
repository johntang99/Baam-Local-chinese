import { AskChat } from './chat';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '小邻 AI 助手 · Baam',
  description: '问我任何本地生活问题 — 找医生、租房、报税、美食、活动，AI 帮你快速找到答案',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AskPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialQuery = sp.q?.trim() || '';

  return (
    <main>
      <PageContainer className="max-w-3xl py-8">
        {/* Header */}
        <Card className="text-center mb-8 p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-orange-50 border-primary/20">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🤖
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">小邻 AI 助手</h1>
          <p className="text-text-secondary text-sm">
            问我任何纽约本地生活问题 — 找医生、租房、报税、美食、活动
          </p>
        </Card>

        {/* Chat Interface */}
        <AskChat initialQuery={initialQuery} />
      </PageContainer>
    </main>
  );
}
