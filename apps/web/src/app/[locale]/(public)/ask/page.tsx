import { AskChat } from './chat';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '小邻 AI 助手 · Baam',
  description: '问我任何本地生活问题 — 找医生、租房、报税、美食、活动，AI 帮你快速找到答案',
};

export default function AskPage() {
  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🤖
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">小邻 AI 助手</h1>
          <p className="text-text-secondary text-sm">
            问我任何纽约本地生活问题 — 找医生、租房、报税、美食、活动
          </p>
        </div>

        {/* Chat Interface (includes suggested questions) */}
        <AskChat />
      </div>
    </main>
  );
}
