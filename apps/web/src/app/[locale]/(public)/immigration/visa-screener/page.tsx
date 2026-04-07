import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { ScreenerClient } from './screener-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '签证资格智能评估 | AI Visa Eligibility Screener · Baam',
  description: '免费AI签证资格评估工具 — 回答几个简单问题，了解可能适合你的美国签证和移民类别。H1B、绿卡、家庭移民、投资移民等。',
  keywords: ['签证资格评估', '美国签证', '绿卡申请', 'H1B', 'EB2', 'EB3', '移民律师', 'visa eligibility screener'],
  openGraph: {
    title: '签证资格智能评估 — AI驱动',
    description: '回答6个简单问题，AI帮你分析可能适合的美国签证类别',
    locale: 'zh_CN',
  },
};

const FAQ_ITEMS = [
  {
    question: '这个评估工具准确吗？',
    answer: '本工具使用AI根据你提供的信息进行初步分析，给出可能适合的签证类别供参考。但移民法律非常复杂，每个案件都有独特之处。评估结果不构成法律建议，具体资格需要由持牌移民律师根据你的完整情况来判断。',
  },
  {
    question: '中国公民申请绿卡需要多久？',
    answer: '取决于类别：EB-1约1-2年，EB-2约2-4年，EB-3约3-5年。中国大陆出生的申请人面临排期等待，实际时间可能更长。家庭移民等待时间更长，有些类别可能需要10年以上。建议尽早启动申请。',
  },
  {
    question: 'H1B签证可以转绿卡吗？',
    answer: '可以。H1B是"双重意图"签证，允许在持H1B期间申请绿卡。最常见的路径是通过雇主申请EB-2或EB-3类绿卡。需要经过PERM劳工认证、I-140申请、然后等待排期到达后提交I-485。',
  },
  {
    question: '我的信息会被保存吗？',
    answer: '你的评估信息不会被保存或分享。所有数据仅用于当次AI分析，评估完成后不会存储任何个人信息。你可以放心使用。',
  },
];

export default function VisaScreenerPage() {
  return (
    <main>
      <PageContainer className="max-w-3xl py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">实用工具</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">签证资格评估</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🛂</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">签证资格智能评估</h1>
        <p className="text-gray-500 text-sm">AI Visa Eligibility Screener</p>
        <p className="text-gray-400 text-sm mt-1">回答几个简单问题，AI帮你分析可能适合的签证类别</p>
      </div>

      {/* Legal Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 flex items-start gap-2">
        <span className="text-base flex-shrink-0">⚠️</span>
        <p><strong>免责声明：</strong>本工具仅提供一般性信息参考，不构成法律建议。移民法律复杂且因人而异，请务必咨询持牌移民律师后再做决定。</p>
      </div>

      {/* Guide Content (SEO) */}
      <Card className="p-6 mb-8 rounded-2xl">
        <article className="prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">美国签证和移民类别简介</h2>
        <p>美国的签证和移民体系主要分为<strong>非移民签证</strong>（H-1B工作签证、L-1跨国调派、O-1杰出人才、F-1学生签证等）和<strong>移民签证/绿卡</strong>（EB类职业移民、家庭移民等）。对于中国大陆出生的申请人，大部分类别都存在排期等待。</p>
        <p>本评估工具通过AI分析你的个人情况（目标、学历、工作经验、家庭关系等），帮助你初步了解可能适合的签证类别，并提供下一步行动建议。</p>
        </article>
      </Card>

      {/* Screener Tool */}
      <ScreenerClient />

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Related */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">相关资源</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/ask" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">问AI小邻</h3>
            <p className="text-xs text-gray-500">&ldquo;H1B转绿卡需要多久？&rdquo;</p>
            </Card>
          </Link>
          <Link href="/services/property-tax" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🏠</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">房产税查询</h3>
            <p className="text-xs text-gray-500">纽约州房产评估值和税额</p>
            </Card>
          </Link>
          <Link href="/businesses" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">⚖️</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">找移民律师</h3>
            <p className="text-xs text-gray-500">Baam认证移民律师目录</p>
            </Card>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>本工具由AI驱动，评估结果仅供参考。移民法律复杂且经常变化，具体资格和申请策略需要由持牌移民律师根据您的详细情况来判断。Baam不对评估结果的准确性承担责任。</p>
      </div>
      </PageContainer>
    </main>
  );
}
