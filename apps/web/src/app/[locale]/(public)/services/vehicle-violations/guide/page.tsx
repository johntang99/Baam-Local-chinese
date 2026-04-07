import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '如何查看纽约州完整驾驶违规记录 | NYS Driving Record Guide · Baam',
  description: '中文图文教程：如何在NYS DMV官网查看你的完整驾驶记录，包括警察开具的交通违规罚单、扣分、暂停/吊销记录。',
  keywords: ['纽约驾驶记录查询', 'NYS DMV abstract', '交通违规记录', '驾照扣分查询', 'MyDMV', '罚单查询'],
};

const FAQ_ITEMS = [
  {
    question: '驾驶记录（Abstract）上显示哪些信息？',
    answer: '标准驾驶记录包括：驾照类别和状态、所有交通违规定罪（保留3年+当年）、酒驾记录（DWI保留15年、DWAI保留10年）、暂停/吊销记录（保留4年）、事故记录、累计扣分等。这比我们的免费罚单查询工具覆盖范围更广，包括警察现场开具的所有移动违规罚单。',
  },
  {
    question: '查询费用是多少？',
    answer: '网上查询$7，DMV办公室现场查询$10。网上查询后，记录在MyDMV账户中保留5天，可随时查看和下载。',
  },
  {
    question: '我需要什么才能在网上查询？',
    answer: '你需要一个NY.gov ID账户（免费注册）。注册需要：驾照上的Client ID号码或Document Number、出生日期、DMV存档的地址信息（州和邮编）、社会安全号码后4位。首次注册还需要设置双因素认证。',
  },
  {
    question: '免费罚单查询工具和付费驾驶记录有什么区别？',
    answer: '我们的免费工具只能查询NYC停车罚单和摄像头罚单（闯红灯摄像头、超速摄像头）。付费的DMV驾驶记录（Abstract）包含所有类型的违规：警察现场开具的罚单（闯红灯、闯停车标志、超速等移动违规）、扣分情况、驾照暂停/吊销记录等。如果你想查看完整记录，需要通过DMV官网付费查询。',
  },
];

export default function DrivingRecordGuidePage() {
  return (
    <main>
      <PageContainer className="max-w-3xl py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">实用工具</Link>
        <span className="mx-2">/</span>
        <Link href="/services/vehicle-violations" className="hover:text-primary">车辆违规查询</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">完整驾驶记录查询指南</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">如何查看纽约州完整驾驶违规记录</h1>
        <p className="text-gray-500">NYS DMV Driving Record (Abstract) 查询中文指南</p>
      </div>

      {/* Why You Need This */}
      <Card className="bg-amber-50 border-amber-200 p-5 mb-8">
        <h2 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
          <span>⚠️</span> 为什么需要查看完整驾驶记录？
        </h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          我们的<Link href="/services/vehicle-violations" className="text-primary font-medium underline">免费罚单查询工具</Link>只能查到NYC停车罚单和摄像头罚单。
          如果你收到的是<strong>警察现场开具的交通罚单</strong>（如闯红灯、闯停车标志、超速、不让行人等），
          这些属于<strong>移动违规（Moving Violations）</strong>，不在NYC Open Data中，需要通过NYS DMV查看。
        </p>
      </Card>

      {/* Coverage Comparison */}
      <Card className="rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">两种查询方式对比</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">查询内容</th>
                <th className="text-center px-3 py-2 border border-gray-200 font-semibold">Baam免费工具</th>
                <th className="text-center px-3 py-2 border border-gray-200 font-semibold">DMV驾驶记录($7)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-gray-200">停车罚单（咪表、消防栓等）</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td><td className="px-3 py-2 border border-gray-200 text-center text-gray-400">✕</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">摄像头罚单（闯红灯、超速摄像头）</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">警察开具的移动违规罚单</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">驾照扣分情况</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">驾照暂停/吊销记录</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">酒驾/醉驾记录</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">事故记录</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr className="bg-gray-50"><td className="px-3 py-2 border border-gray-200 font-bold">费用</td><td className="px-3 py-2 border border-gray-200 text-center font-bold text-green-600">免费</td><td className="px-3 py-2 border border-gray-200 text-center font-bold">$7（网上）/ $10（现场）</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Step by Step Guide */}
      <Card className="rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">网上查询步骤（$7，最方便）</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">注册 NY.gov ID 账户（如果还没有）</h3>
              <p className="text-sm text-gray-600 mb-2">
                访问 <a href="https://my.ny.gov/" target="_blank" rel="noopener noreferrer" className="text-primary underline">my.ny.gov</a> 点击 &ldquo;Create Account&rdquo;
              </p>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">注册需要准备：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Client ID</strong> 或 <strong>Document Number</strong>（在驾照正面或背面）</li>
                  <li>出生日期</li>
                  <li>DMV存档的地址（州和邮编）</li>
                  <li>社会安全号码（SSN）后4位</li>
                </ul>
                <p className="mt-2 text-amber-600">💡 提示：Client ID是驾照正面的一组数字。如果找不到，带驾照去任何DMV办公室即可查询。</p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">登录 MyDMV</h3>
              <p className="text-sm text-gray-600">
                访问 <a href="https://my.dmv.ny.gov/" target="_blank" rel="noopener noreferrer" className="text-primary underline">my.dmv.ny.gov</a>，用你的 NY.gov ID 登录
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">选择 &ldquo;Get My Driving Record&rdquo;</h3>
              <p className="text-sm text-gray-600">
                在MyDMV仪表板中，找到 &ldquo;My Records&rdquo; 或 &ldquo;Get My Driving Record&rdquo; 选项
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">选择记录类型并付款</h3>
              <p className="text-sm text-gray-600 mb-2">
                选择 <strong>&ldquo;Standard Driving Abstract&rdquo;</strong>（标准驾驶记录），费用 $7，支持信用卡/借记卡
              </p>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-medium mb-1">三种记录类型：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Standard（标准）$7</strong> — 最近3年+当年的违规，推荐大多数人选择</li>
                  <li><strong>Lifetime（终身）$7</strong> — 所有历史违规记录</li>
                  <li><strong>CDL（商用驾照）$7</strong> — 商用驾照持有者专用</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">查看和下载记录</h3>
              <p className="text-sm text-gray-600">
                付款后立即可以查看记录。记录在MyDMV中保留<strong>5天</strong>，建议立即下载PDF保存。
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Understanding Your Record */}
      <Card className="rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">如何看懂驾驶记录</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">扣分系统（Point System）</h3>
            <p className="text-sm text-gray-600 mb-2">纽约州的交通违规扣分制度：18个月内累计11分将被暂停驾照。</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 border border-gray-200">违规类型</th>
                    <th className="text-left px-2 py-1.5 border border-gray-200">英文</th>
                    <th className="text-center px-2 py-1.5 border border-gray-200">扣分</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-2 py-1.5 border border-gray-200">超速1-10 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 1-10 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">超速11-20 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 11-20 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">4分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">超速21-30 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 21-30 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">6分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">超速31-40 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 31-40 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">8分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">超速40+ mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 41+ mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">11分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">闯红灯</td><td className="px-2 py-1.5 border border-gray-200">Failure to stop for red light</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">闯停车标志</td><td className="px-2 py-1.5 border border-gray-200">Failure to stop for stop sign</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">不当变道</td><td className="px-2 py-1.5 border border-gray-200">Improper lane change</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">尾随过近</td><td className="px-2 py-1.5 border border-gray-200">Following too closely</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">4分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">使用手机（手持）</td><td className="px-2 py-1.5 border border-gray-200">Cell phone use</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">5分</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">鲁莽驾驶</td><td className="px-2 py-1.5 border border-gray-200">Reckless driving</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">5分</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">记录保留时间</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-0.5">
              <li>普通交通违规：当年 + 3年</li>
              <li>酒后驾车（DWAI）：10年</li>
              <li>醉酒驾驶（DWI）：15年</li>
              <li>驾照暂停/吊销：结束后4年</li>
              <li>拒绝酒精测试：结束后5年</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* In-Person Alternative */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">不方便上网？去DMV现场查询</h2>
        <p className="text-sm text-gray-600 mb-3">
          你也可以到任何NYS DMV办公室现场查询，费用$10。
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-medium mb-1">现场查询需要带：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>填好的 <strong>MV-15C表格</strong>（可在DMV官网下载打印）</li>
            <li>身份证明（驾照、政府发的Photo ID、或6分ID文件）</li>
            <li>$10费用（现金、信用卡、支票均可）</li>
          </ul>
        </div>
        <a href="https://dmv.ny.gov/offices" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3 hover:underline">
          查找附近的DMV办公室 →
        </a>
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-primary to-orange-600 rounded-2xl p-6 text-center text-white mb-8 border-primary/40">
        <h3 className="text-lg font-bold mb-2">有交通罚单需要帮助？</h3>
        <p className="text-sm text-white/80 mb-4">交通违规可能影响驾照扣分和保险费率。咨询专业律师了解申诉选项。</p>
        <Link href="/businesses" className="inline-flex px-6 py-2.5 bg-white text-primary font-bold rounded-xl hover:bg-gray-50 transition">
          找交通律师
        </Link>
      </Card>

      {/* Quick Links */}
      <Card className="rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3">官方链接</h2>
        <div className="space-y-2">
          <a href="https://my.dmv.ny.gov/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> MyDMV 网上查询入口（需登录）
          </a>
          <a href="https://dmv.ny.gov/records/get-my-own-driving-record-abstract" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> DMV 驾驶记录查询说明（英文）
          </a>
          <a href="https://dmv.ny.gov/tickets/traffic-violations-bureau" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> NYC交通违规局(TVB)（缴纳/申诉移动违规罚单）
          </a>
          <a href="https://dmv.ny.gov/tickets/plead-or-pay-tvb-tickets" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> 缴纳或申诉TVB罚单
          </a>
        </div>
      </Card>

      {/* FAQ */}
      <ServiceFAQ items={FAQ_ITEMS} />

      {/* Related */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3">相关工具</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/services/vehicle-violations" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group">
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">🚗 免费停车罚单查询</h3>
            <p className="text-xs text-gray-500">查询NYC停车和摄像头罚单（免费）</p>
          </Link>
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group">
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">🤖 问AI小邻</h3>
            <p className="text-xs text-gray-500">&ldquo;收到交通罚单怎么申诉？&rdquo;</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>本指南仅供参考。NYS DMV可能随时更新流程和费用。如有疑问请直接联系DMV客服热线：(518) 486-9786。</p>
      </div>
      </PageContainer>
    </main>
  );
}
