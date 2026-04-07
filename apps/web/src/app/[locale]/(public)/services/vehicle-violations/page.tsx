import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { ViolationLookup } from './violation-lookup';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '车辆违规查询 · Baam',
  description: '免费查询纽约市停车罚单和交通摄像头违规记录，输入车牌号即可查看罚款金额、缴费状态。',
};

export default function VehicleViolationsPage() {
  return (
    <main>
      <PageContainer className="max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">车辆违规查询</h1>
            <p className="text-sm text-gray-500">查询纽约市停车和交通摄像头违规记录</p>
          </div>
        </div>
      </div>

      {/* Lookup Component */}
      <ViolationLookup />

      {/* Coverage Notice */}
      <Card className="mt-8 bg-blue-50 border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">本工具查询范围：</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>NYC停车罚单（咪表过期、消防栓、扫街、双排停车等）</li>
          <li>NYC交通摄像头罚单（闯红灯摄像头、学校区域超速摄像头、公交车道摄像头）</li>
        </ul>
        <p className="mt-2 text-xs text-blue-600"><strong>不包含：</strong>警察现场开具的交通违规罚单（闯红灯、闯停车标志、超速等移动违规）、驾照扣分、暂停/吊销记录。</p>
        <Link href="/services/vehicle-violations/guide" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline">
          📋 如何查看完整驾驶违规记录（包括警察罚单和扣分）→
        </Link>
      </Card>

      {/* Disclaimer */}
      <div className="mt-4 text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p className="mb-2">
          <strong>数据来源：</strong>NYC Open Data — Open Parking and Camera Violations（纽约市公开数据平台）。
        </p>
        <p className="mb-2">
          数据可能存在延迟，仅供参考。如需确认罚款金额或缴费状态，请访问{' '}
          <a href="https://a836-citypay.nyc.gov/citypay/violations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            NYC Finance
          </a>
          {' '}官方网站。
        </p>
        <p>本服务免费提供，Baam 不对查询结果的准确性承担责任。</p>
      </div>
      </PageContainer>
    </main>
  );
}
