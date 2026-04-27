import { Link } from '@/lib/i18n/routing';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; bbl: string }>;
  searchParams: Promise<{ county?: string; municipality?: string }>;
}

const BORO_NAMES: Record<string, string> = {
  '1': 'Manhattan', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island',
};

const TAX_CLASS_LABELS: Record<string, string> = {
  '1': '1-3家庭住宅', '2': '公寓楼', '2A': '小型公寓', '2B': '中型公寓',
  '3': '公用事业', '4': '商业地产',
};

const BUILDING_CLASS_LABELS: Record<string, string> = {
  'A': '一户住宅', 'B': '两户住宅', 'C': '合作公寓', 'D': '公寓大楼',
  'E': '仓库', 'F': '工厂', 'G': '车库', 'H': '酒店',
  'K': '商店', 'L': '阁楼', 'O': '办公楼', 'R': '公寓/住宅',
  'S': '混合用途', 'W': '教育设施',
};

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

async function fetchProperty(bbl: string, county?: string, municipality?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5001';
  const params = new URLSearchParams({ bbl });
  if (county) params.set('county', county);
  if (municipality) params.set('municipality', municipality);
  const res = await fetch(`${baseUrl}/api/services/property-tax?${params}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { bbl } = await params;
  const { county, municipality } = await searchParams;
  const data = await fetchProperty(bbl, county, municipality);
  if (!data?.property) return { title: 'Not Found' };

  const p = data.property;
  const isNYS = data.source === 'nys';
  const location = isNYS ? `${p.municipality}, ${p.county} County` : p.boro;
  const taxInfo = p.estimatedTax ? `预估年税${formatMoney(p.estimatedTax)}` : `市场估值${formatMoney(p.marketValue)}`;
  return {
    title: `${p.address} 房产税查询 | ${location} · Baam`,
    description: `${p.address}（${location}）房产信息：评估值${formatMoney(p.assessedTotal)}，${taxInfo}。`,
    openGraph: {
      title: `${p.address} — 房产税查询`,
      description: `${location} · ${taxInfo}`,
      locale: 'zh_CN',
    },
  };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { bbl } = await params;
  const { county, municipality } = await searchParams;
  const data = await fetchProperty(bbl, county, municipality);
  if (!data?.property) notFound();

  const p = data.property;
  const isNYS = data.source === 'nys';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history: any[] = data.history || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sales: any[] = data.sales || [];

  const assessmentRatio = p.marketValue > 0 ? ((p.assessedTotal / p.marketValue) * 100).toFixed(1) : '0';
  const monthlyTax = p.estimatedTax ? Math.round(p.estimatedTax / 12) : 0;
  const bldgClassLabel = isNYS ? (p.propertyClassDesc || p.propertyClass || '') : (BUILDING_CLASS_LABELS[p.buildingClass?.[0]] || p.buildingClass);
  const location = isNYS ? `${p.municipality}, ${p.county} County, NY` : `${p.boro}, NY ${p.zipCode || ''}`;

  return (
    <main>
      <PageContainer className="max-w-4xl py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: 'var(--ed-ink-soft)' }}>
        <Link href="/" className="hover:text-primary" style={{ fontWeight: 500 }}>首页</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary" style={{ fontWeight: 500 }}>实用工具</Link>
        <span className="mx-2">/</span>
        <Link href="/services/property-tax" className="hover:text-primary" style={{ fontWeight: 500 }}>房产税查询</Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--ed-ink)', fontWeight: 500 }}>{p.address}</span>
      </nav>

      {/* Property Header */}
      <Card className="r-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl fw-bold text-text-primary mb-1">{p.address}</h1>
            <p className="text-sm text-text-secondary mb-2">{location}</p>
            <p className="text-xs text-text-secondary">业主: {p.ownerName || p.owner}</p>
            {isNYS && p.schoolDistrict && (
              <p className="text-xs text-text-secondary">学区: {p.schoolDistrict}</p>
            )}
          </div>
          <span className="text-[10px] fw-semibold px-3 py-1.5 r-full flex-shrink-0 self-start bg-accent-purple-light text-accent-purple max-w-[180px] text-right">
            {isNYS
              ? (p.propertyClassDesc || `Class ${p.propertyClass}`)
              : `Class ${p.taxClass} — ${TAX_CLASS_LABELS[p.taxClass] || p.taxClass}`
            }
          </span>
        </div>

        {/* Property Details */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-text-secondary">
          {bldgClassLabel && <span>🏢 {bldgClassLabel}</span>}
          {p.yearBuilt && <span>📅 建于 {p.yearBuilt}</span>}
          {p.numFloors && <span>🏗️ {p.numFloors}层</span>}
          {p.unitsTotal && <span>🏠 {p.unitsTotal}单元</span>}
          {p.lotArea && <span>📐 占地 {p.lotArea.toLocaleString()} sqft</span>}
          {p.zoning && <span>📋 {p.zoning}</span>}
          {p.frontage && <span>📏 正面 {p.frontage}ft</span>}
          {p.depth && <span>📏 深度 {p.depth}ft</span>}
        </div>
      </Card>

      {/* Assessment & Tax Cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Assessment */}
        <Card className="r-xl p-5">
          <h3 className="text-sm fw-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="text-base">📊</span> 评估值
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">土地评估值</span>
              <span className="text-sm fw-semibold text-text-primary">{formatMoney(p.assessedLand)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">总评估值</span>
              <span className="text-sm fw-bold text-text-primary">{formatMoney(p.assessedTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">市场估值</span>
              <span className="text-sm fw-bold text-secondary-dark">{formatMoney(p.marketValue)}</span>
            </div>
            {p.exemptTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">减免金额</span>
                <span className="text-sm fw-semibold text-accent-green">-{formatMoney(p.exemptTotal)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-border-light">
              <div className="flex justify-between items-center text-xs text-text-secondary">
                <span>{isNYS ? '均衡税率 (Equalization Rate)' : '评估值/市场值比率'}</span>
                <span>{p.equalizationRate || assessmentRatio}%</span>
              </div>
              <div className="w-full bg-bg-page r-full h-1.5 mt-1.5">
                <div className="bg-primary h-1.5 r-full" style={{ width: `${Math.min(parseFloat(p.equalizationRate || assessmentRatio), 100)}%` }} />
              </div>
              {isNYS && parseFloat(assessmentRatio) < 50 && (
                <p className="text-[10px] text-text-muted mt-1.5">
                  纽约州许多地区的房产评估值远低于市场价值，这是正常的。评估值 ÷ 均衡税率 = 市场估值。
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Tax */}
        <Card className="r-xl p-5">
          <h3 className="text-sm fw-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="text-base">💰</span> {isNYS && p.estimatedTotalTax > 0 ? '年度税额' : isNYS ? '应税价值' : '税额'}
          </h3>
          <div className="space-y-3">
            {isNYS && p.estimatedTotalTax > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">年度总税额估算</span>
                  <span className="text-lg fw-bold text-primary">{formatMoney(p.estimatedTotalTax)}</span>
                </div>
                <div className="border-t border-border-light pt-2 mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-secondary">郡税 (County) <span className="text-text-secondary">{p.taxRateInfo?.countyRate ? `${p.taxRateInfo.countyRate}/‰` : ''}</span></span>
                    <span className="text-sm text-text-primary">{formatMoney(p.countyTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-secondary">市/镇税 (Municipal) <span className="text-text-secondary">{p.taxRateInfo?.municipalRate ? `${p.taxRateInfo.municipalRate}/‰` : ''}</span></span>
                    <span className="text-sm text-text-primary">{formatMoney(p.municipalTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-secondary">学区税 (School) <span className="text-text-secondary">{p.taxRateInfo?.schoolRate ? `${p.taxRateInfo.schoolRate.toFixed(2)}/‰` : ''}</span></span>
                    <span className="text-sm text-text-primary">{formatMoney(p.schoolTax)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border-light mt-2">
                  <span className="text-sm text-text-secondary">每月约</span>
                  <span className="text-sm fw-semibold text-text-primary">{formatMoney(Math.round(p.estimatedTotalTax / 12))} / 月</span>
                </div>
                {p.taxRateInfo && (
                  <p className="text-[10px] text-text-muted mt-2">
                    税率来源：FY{p.taxRateInfo.fiscalYear} · 基于{p.taxRateInfo.valueType === 'Full Value' ? '市场估值' : '评估值'}计算 · 仅供参考
                  </p>
                )}
              </>
            ) : p.estimatedTax > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">年度房产税估算</span>
                  <span className="text-lg fw-bold text-primary">{formatMoney(p.estimatedTax)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">税率 (Class {p.taxClass})</span>
                  <span className="text-sm text-text-secondary">{(p.taxRate * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">每月约</span>
                  <span className="text-sm fw-semibold text-text-primary">{formatMoney(monthlyTax)} / 月</span>
                </div>
              </>
            ) : (
              <>
                {p.countyTaxable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-secondary">郡应税价值 (County)</span>
                    <span className="text-sm fw-semibold text-text-primary">{formatMoney(p.countyTaxable)}</span>
                  </div>
                )}
                {p.schoolTaxable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-secondary">学区应税价值 (School)</span>
                    <span className="text-sm fw-semibold text-text-primary">{formatMoney(p.schoolTaxable)}</span>
                  </div>
                )}
                <p className="text-xs text-text-muted mt-2">税率数据暂不可用。实际税额请联系当地税务办公室。</p>
              </>
            )}
            <div className="pt-2 border-t border-border-light">
              {!isNYS && (
                <a href="https://a836-citypay.nyc.gov/citypay/PropertyTax" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  查看官方税单 →
                </a>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Exemptions */}
      <Card className="r-xl p-5 mb-6">
        <h3 className="text-sm fw-bold text-text-primary mb-3 flex items-center gap-2">
          <span className="text-base">🛡️</span> 税务减免状态
        </h3>
        {isNYS && p.exemptions?.length > 0 ? (
          <div className="space-y-2">
            {p.exemptions.map((ex: { code: string; countyAmt: number; schoolAmt: number }, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-text-secondary">减免代码 {ex.code}</span>
                <span className="text-xs text-accent-green">
                  {ex.countyAmt > 0 ? `郡减免 ${formatMoney(ex.countyAmt)}` : ''}
                  {ex.countyAmt > 0 && ex.schoolAmt > 0 ? ' · ' : ''}
                  {ex.schoolAmt > 0 ? `学区减免 ${formatMoney(ex.schoolAmt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : isNYS ? (
          <p className="text-sm text-text-secondary">无减免记录</p>
        ) : (
          <div className="space-y-2">
            {[
              { icon: '🏠', label: 'STAR基本减免', applicable: p.exemptCode === '6800' && (p.taxClass === '1' || p.taxClass?.startsWith('2')) },
              { icon: '👴', label: '老年减免', applicable: p.exemptCode === '6810' },
              { icon: '🎖️', label: '退伍军人减免', applicable: p.exemptCode === '4110' || p.exemptCode === '4120' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-text-secondary flex items-center gap-2"><span>{item.icon}</span> {item.label}</span>
                <span className={cn('text-xs fw-medium', item.applicable ? 'text-accent-green' : 'text-text-muted')}>
                  {item.applicable ? '✓ 已享受' : '✕ 不适用'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assessment History */}
      {history.length > 0 && (
        <Card className="r-xl p-5 mb-6">
          <h3 className="text-sm fw-bold text-text-primary mb-3 flex items-center gap-2">
            <span className="text-base">📈</span> 评估值历史
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-2 text-xs text-text-secondary fw-medium">年度</th>
                  <th className="text-right py-2 text-xs text-text-secondary fw-medium">评估值</th>
                  <th className="text-right py-2 text-xs text-text-secondary fw-medium">市场估值</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-border-light">
                    <td className="py-2 text-text-secondary">{h.year}</td>
                    <td className="py-2 text-right text-text-primary fw-medium">{formatMoney(h.assessedTotal)}</td>
                    <td className="py-2 text-right text-secondary-dark">{formatMoney(h.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sale History */}
      {sales.length > 0 && (
        <Card className="r-xl p-5 mb-6">
          <h3 className="text-sm fw-bold text-text-primary mb-3 flex items-center gap-2">
            <span className="text-base">🔄</span> 交易历史
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-2 text-xs text-text-secondary fw-medium">交易日期</th>
                  <th className="text-right py-2 text-xs text-text-secondary fw-medium">成交价格</th>
                  <th className="text-right py-2 text-xs text-text-secondary fw-medium">类型</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={i} className="border-b border-border-light">
                    <td className="py-2 text-text-secondary">{s.date ? s.date.split('T')[0] : ''}</td>
                    <td className="py-2 text-right text-text-primary fw-medium">{formatMoney(s.price)}</td>
                    <td className="py-2 text-right text-text-muted">{s.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lead Gen CTAs */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-orange-50 to-accent-yellow/20 border-primary-200 r-xl p-5">
          <h3 className="text-sm fw-bold text-text-primary mb-1">评估值太高？</h3>
          <p className="text-xs text-text-secondary mb-3">房主每年平均可节省<strong>$2,400</strong> — 免费咨询房产税律师</p>
          <Link href="/businesses" className="inline-flex text-xs fw-semibold text-primary hover:underline">免费咨询 →</Link>
        </Card>
        <Card className="bg-gradient-to-br from-secondary-50 to-secondary-50 border-secondary-light r-xl p-5">
          <h3 className="text-sm fw-bold text-text-primary mb-1">想在这个区买房？</h3>
          <p className="text-xs text-text-secondary mb-3">了解税务成本 — 联系Baam认证地产经纪</p>
          <Link href="/businesses" className="inline-flex text-xs fw-semibold text-primary hover:underline">联系经纪 →</Link>
        </Card>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-text-muted leading-relaxed border-t border-border-light pt-6 space-y-2">
        {isNYS ? (
          <>
            <p>数据来源：NYS Office of Real Property Tax Services via NY Open Data + NYS GIS。评估值数据来自<strong>{p.rollYear || p.year || '最新'}</strong>年度评估卷。税额基于各地方政府公布的税率估算，仅供参考。</p>
            <p>
              查看更多房产信息请访问{' '}
              <a href="https://www.tax.ny.gov/research/property/assess/valuation/index.htm" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYS税务局房产评估
              </a>
              {' '}或联系当地税务评估办公室。
            </p>
          </>
        ) : (
          <>
            <p>数据来源：NYC Department of Finance + MapPLUTO via NYC Open Data。评估值数据来自<strong>{p.year || '最新'}</strong>财年。税额为基于当前税率的预估值，实际以官方税单为准。</p>
            <p>
              查看最新评估值和官方税单请访问{' '}
              <a href="https://a836-acris.nyc.gov/bblsearch/bblsearch.asp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYC ACRIS
              </a>
              {' '}或{' '}
              <a href="https://a836-citypay.nyc.gov/citypay/PropertyTax" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYC Finance ePay
              </a>
              。
            </p>
          </>
        )}
      </div>
      </PageContainer>
    </main>
  );
}
