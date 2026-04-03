import { Suspense } from 'react';
import { Link } from '@/lib/i18n/routing';
import { PropertyTaxClient } from './property-tax-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '纽约州房产税查询 | NY Property Tax Lookup · Baam',
  description: '免费查询纽约州任何房产的评估值、房产税和交易历史。覆盖纽约市五区、长岛、威彻斯特等全州地区。',
  keywords: ['纽约房产税查询', 'NY property tax lookup', '房产评估值', 'property assessment', 'STAR减免', '长岛房产税', '威彻斯特房产税'],
  openGraph: {
    title: '纽约房产税查询',
    description: '免费查询纽约市房产评估值、税额和交易历史',
    locale: 'zh_CN',
  },
};

const FAQ_ITEMS = [
  {
    question: '纽约房产税税率是多少？',
    answer: '纽约市房产税率按税务等级不同：Class 1（1-3家庭住宅）约20.3%，Class 2（公寓楼）约12.3%，Class 4（商业地产）约10.6%。税率每年由市议会调整。注意：税率是基于评估值而非市场价值计算的。',
  },
  {
    question: '怎么查自己房子的评估值？',
    answer: '在上方的查询工具中输入你的房产地址和所在区域，即可查看最新的评估值。评估值由纽约市财政局（DOF）每年1月公布。你也可以在NYC Finance官方网站查看完整税单。',
  },
  {
    question: '房产评估值太高怎么申诉？',
    answer: '你可以向税务审查委员会（Tax Commission）提出申诉。申诉截止日期：Class 1为每年3月1日，Class 2-4为3月15日。需提供市场价值证据（如近期同类房产成交价、独立评估报告）。约40%的申诉会获得下调，平均每年可节省$1,000-$5,000。',
  },
  {
    question: 'STAR减免怎么申请？',
    answer: 'STAR（学区税减免）适用于自住房业主。基本STAR不限收入，增强型STAR面向65岁以上、年收入低于$107,300的业主。新申请通过纽约州税务局网站提交，房产必须是主要住所。减免以退税支票形式发放。',
  },
];

export default function PropertyTaxPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">实用工具</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">房产税查询</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏠</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">纽约州房产税查询</h1>
        <p className="text-gray-500">New York State Property Tax & Assessment Lookup</p>
        <p className="text-xs text-gray-400 mt-1">覆盖纽约市五区 · 长岛 · 威彻斯特 · 全纽约州62个郡</p>
      </div>

      {/* Guide Content (SEO) */}
      <article className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">纽约房产税怎么算？</h2>
        <p>在纽约市拥有房产的业主每年需要缴纳房产税（Property Tax）。计算方式基于房产的<strong>评估值（Assessed Value）</strong>而非市场价值。评估值通常远低于市场价值，比例取决于税务等级。计算公式：<strong>年度房产税 = 评估值 × 税率</strong>。</p>

        <h3 className="text-base font-bold text-gray-900">四种房产税等级（Tax Class）</h3>
        <div className="not-prose overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">等级</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">适用类型</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">2025/26税率</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 1</td><td className="px-3 py-2 border border-gray-200">1-3家庭住宅</td><td className="px-3 py-2 border border-gray-200">20.309%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 2</td><td className="px-3 py-2 border border-gray-200">公寓楼（含Co-op、Condo）</td><td className="px-3 py-2 border border-gray-200">12.267%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 3</td><td className="px-3 py-2 border border-gray-200">公用事业设施</td><td className="px-3 py-2 border border-gray-200">12.826%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 4</td><td className="px-3 py-2 border border-gray-200">商业地产</td><td className="px-3 py-2 border border-gray-200">10.646%</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-bold text-gray-900">什么是STAR减免？</h3>
        <p>STAR（School Tax Relief）是纽约州为自住房业主提供的学区税减免。<strong>基本STAR</strong>适用于所有自住房业主，<strong>增强型STAR</strong>面向65岁以上低收入老年业主。新申请通过纽约州税务局网站提交。</p>

        <h3 className="text-base font-bold text-gray-900">评估值太高怎么申诉？</h3>
        <p>可向税务审查委员会（Tax Commission）申诉，截止日期为每年3月。约40%的申诉获得下调，平均每年可节省$1,000-$5,000。需提供市场价值证据。</p>
      </article>

      {/* Search Tool */}
      <Suspense fallback={<div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />}>
        <PropertyTaxClient />
      </Suspense>

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Baam Integration */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">相关资源</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/businesses" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🏪</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">找地产经纪</h3>
            <p className="text-xs text-gray-500">浏览Baam认证地产经纪</p>
          </Link>
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">问AI小邻</h3>
            <p className="text-xs text-gray-500">&ldquo;法拉盛房产税一般多少？&rdquo;</p>
          </Link>
          <Link href="/services/vehicle-violations" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🚗</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">停车罚单查询</h3>
            <p className="text-xs text-gray-500">查看车辆违规记录</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>数据来源：NYC Department of Finance via NYC Open Data。税率为2025/26财年预估值，实际税额可能因减免和调整而不同。以NYC Finance官方税单为准。</p>
      </div>
    </main>
  );
}
