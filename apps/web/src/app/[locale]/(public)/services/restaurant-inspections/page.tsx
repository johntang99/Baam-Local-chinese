import { Suspense } from 'react';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { InspectionsClient } from './inspections-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '纽约餐厅卫生评分查询 | NYC Restaurant Health Inspection · Baam',
  description: '免费查询任何纽约市餐厅的卫生检查评分、违规记录和检查历史。输入餐厅名称即可查看A/B/C评级详情。',
  keywords: ['纽约餐厅卫生评分', '餐厅卫生检查', 'NYC restaurant health inspection', 'restaurant grade NYC', '纽约餐厅评分查询'],
  openGraph: {
    title: '纽约餐厅卫生评分查询',
    description: '免费查询任何纽约市餐厅的卫生检查评分和违规记录',
    locale: 'zh_CN',
  },
};

const FAQ_ITEMS = [
  {
    question: '纽约餐厅卫生评分在哪里查？',
    answer: '你可以通过本页面的搜索工具直接查询。我们的数据来源于纽约市卫生局（DOHMH）公开数据平台，与官方数据同步。每家餐厅的入口处也必须张贴最近一次的评分标志。',
  },
  {
    question: 'B级餐厅安全吗？可以吃吗？',
    answer: 'B级评分（14-27分）意味着餐厅存在一些卫生问题，但总体仍在可接受范围内。很多知名餐厅偶尔也会因个别项目扣分而得到B级。你可以查看具体违规项来判断——如果主要是"一般违规"（如地面清洁度不够），通常问题不大。',
  },
  {
    question: '评分多久更新一次？',
    answer: '纽约市卫生局每年会对每家餐厅进行至少一次例行检查。如果未获得A级评分，通常会在数周内安排复查。我们的数据每日从NYC Open Data同步。',
  },
  {
    question: '如果餐厅没有评分标志是什么意思？',
    answer: '根据纽约市法规，所有餐厅必须在入口处张贴评分标志。如果没有，可能是新开业尚未检查、正在等待复查、或违规未张贴（这本身就是一项违规）。你可以拨打311向卫生局举报。',
  },
];

export default function RestaurantInspectionsPage() {
  return (
    <main>
      <PageContainer className="max-w-4xl py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">实用工具</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">餐厅卫生评分</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🍽️</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">纽约餐厅卫生评分查询</h1>
        <p className="text-gray-500">NYC Restaurant Health Inspection Lookup</p>
      </div>

      {/* Guide Content (SEO) */}
      <Card className="rounded-2xl p-6 mb-8">
        <article className="prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">纽约餐厅卫生评分怎么看？</h2>
        <p>在纽约市，每家餐厅都会定期接受纽约市卫生局（NYC Department of Health and Mental Hygiene, DOHMH）的卫生检查。检查员根据食品处理、厨房卫生、害虫防控等标准评分。<strong>分数越低越好</strong>——分数直接决定了餐厅的A/B/C评级。</p>
        <p>纽约市从2010年开始实施餐厅卫生评分制度。目前有超过<strong>27,000家餐厅</strong>参与评分计划，每家平均每年接受1-3次检查。所有检查数据完全公开，你可以使用下方的工具免费查询。</p>

        {/* Grade Badges */}
        <h3 className="text-base font-bold text-gray-900">A / B / C 评级标准</h3>
        <div className="grid grid-cols-3 gap-3 not-prose mb-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">A</div>
            <div className="text-sm font-bold text-green-800">优秀</div>
            <div className="text-xs text-green-600">0 - 13 分</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-yellow-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">B</div>
            <div className="text-sm font-bold text-yellow-800">良好</div>
            <div className="text-xs text-yellow-600">14 - 27 分</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-orange-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">C</div>
            <div className="text-sm font-bold text-orange-800">需改进</div>
            <div className="text-xs text-orange-600">28 分以上</div>
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-900">常见违规类型</h3>
        <p><strong>关键违规（Critical）：</strong>可能直接导致食源性疾病，包括食品温度不达标、生熟交叉污染、老鼠活动迹象等。每项扣5-28分。</p>
        <p><strong>一般违规（Not Critical）：</strong>反映管理水平但不直接致病，包括地面不清洁、通风维护不当、垃圾桶未加盖等。每项扣2-5分。</p>
        </article>
      </Card>

      {/* Search Tool */}
      <Suspense fallback={<div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />}>
        <InspectionsClient />
      </Suspense>

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Baam Integration */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">在Baam上探索更多</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/businesses" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🍜</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">找更多美食商家</h3>
            <p className="text-xs text-gray-500">浏览纽约华人餐厅目录</p>
            </Card>
          </Link>
          <Link href="/discover/new-post" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">✍️</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">写一篇美食笔记</h3>
            <p className="text-xs text-gray-500">分享你的美食体验</p>
            </Card>
          </Link>
          <Link href="/ask" className="block">
            <Card className="rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">问AI小邻</h3>
            <p className="text-xs text-gray-500">&ldquo;法拉盛哪家中餐评分最高？&rdquo;</p>
            </Card>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>数据来源：NYC Department of Health and Mental Hygiene (DOHMH) via NYC Open Data。数据每日更新，仅供参考。评分标准：A级（0-13分）、B级（14-27分）、C级（28分以上）。</p>
      </div>
      </PageContainer>
    </main>
  );
}
