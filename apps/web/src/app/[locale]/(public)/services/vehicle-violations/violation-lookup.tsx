'use client';

import { useState, useCallback } from 'react';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { cn } from '@/lib/utils';

interface Violation {
  summons_number: string;
  issue_date: string;
  violation: string;
  fine_amount: number;
  penalty_amount: number;
  interest_amount: number;
  reduction_amount: number;
  payment_amount: number;
  amount_due: number;
  precinct: string;
  county: string;
  issuing_agency: string;
  summons_image: { url: string } | null;
}

interface ViolationResponse {
  plate: string;
  state: string;
  total: number;
  violations: Violation[];
  summary: {
    totalFines: number;
    totalReduction: number;
    totalPaid: number;
    totalDue: number;
    openCount: number;
    paidCount: number;
  };
}

const US_STATES = [
  { code: 'NY', name: 'New York' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'PA', name: 'Pennsylvania' },
  '---',
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'Washington DC' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
] as const;

const COUNTY_MAP: Record<string, string> = {
  // Code forms
  'NY': 'Manhattan',
  'BX': 'Bronx',
  'K': 'Brooklyn',
  'Q': 'Queens',
  'QN': 'Queens',
  'QNS': 'Queens',
  'R': 'Staten Island',
  'ST': 'Staten Island',
  'MN': 'Manhattan',
  'BK': 'Brooklyn',
  // Full name forms (Socrata returns both)
  'New York': 'Manhattan',
  'Bronx': 'Bronx',
  'Kings': 'Brooklyn',
  'Queens': 'Queens',
  'Richmond': 'Staten Island',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Socrata returns MM/DD/YYYY format
  return dateStr.split('T')[0] || dateStr;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function ViolationLookup() {
  const { convert } = useChineseScript();
  const [plate, setPlate] = useState('');
  const [state, setState] = useState('NY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ViolationResponse | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlate = plate.trim().toUpperCase();
    if (!trimmedPlate) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/services/vehicle-violations?plate=${encodeURIComponent(trimmedPlate)}&state=${encodeURIComponent(state)}`);
      if (res.status === 429) {
        setError('查询过于频繁，请稍后再试');
        return;
      }
      if (!res.ok) {
        setError('查询失败，请稍后重试');
        return;
      }
      const data: ViolationResponse = await res.json();
      setResult(data);
    } catch {
      setError('网络错误，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [plate, state]);

  return (
    <div>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('车牌号码')}</label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1234"
              maxLength={10}
              className="w-full h-11 px-4 border border-gray-300 rounded-xl text-base font-mono tracking-wider focus:ring-2 focus:ring-primary focus:border-primary outline-none transition uppercase"
              required
            />
          </div>
          <div className="sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('车牌所属州')}</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            >
              {US_STATES.map((s, i) =>
                s === '---' ? (
                  <option key={i} disabled>──────</option>
                ) : (
                  <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                )
              )}
            </select>
          </div>
          <div className="sm:self-end">
            <button
              type="submit"
              disabled={loading || !plate.trim()}
              className="w-full sm:w-auto h-11 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  {convert('查询中...')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  {convert('查询违规')}
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {convert(error)}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{result.total}</div>
              <div className="text-xs text-gray-500 mt-1">{convert('违规记录')}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{formatMoney(result.summary.totalFines)}</div>
              <div className="text-xs text-gray-500 mt-1">{convert('罚款总额')}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{formatMoney(result.summary.totalPaid)}</div>
              <div className="text-xs text-gray-500 mt-1">{convert('已付总额')}</div>
            </div>
            <div className={cn(
              'border rounded-xl p-4 text-center',
              result.summary.totalDue > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            )}>
              <div className={cn(
                'text-2xl font-bold',
                result.summary.totalDue > 0 ? 'text-red-600' : 'text-green-600'
              )}>
                {result.summary.totalDue > 0 ? formatMoney(result.summary.totalDue) : convert('全部付清')}
              </div>
              <div className="text-xs text-gray-500 mt-1">{convert('未付总额')}</div>
            </div>
          </div>

          {/* No results */}
          {result.total === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-lg font-bold text-green-800 mb-1">{convert('未找到违规记录')}</h3>
              <p className="text-sm text-green-600">{convert('该车牌在纽约市没有停车或摄像头违规记录')}</p>
            </div>
          )}

          {/* Violations List */}
          {result.total > 0 && (
            <div className="space-y-2">
              {/* Desktop header */}
              <div className="hidden md:grid md:grid-cols-[120px_1fr_100px_100px_100px_80px] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                <span>{convert('日期')}</span>
                <span>{convert('违规类型')}</span>
                <span className="text-right">{convert('罚款')}</span>
                <span className="text-right">{convert('已付')}</span>
                <span className="text-right">{convert('欠款')}</span>
                <span className="text-right">{convert('区域')}</span>
              </div>

              {result.violations.map((v) => {
                const isExpanded = expandedRow === v.summons_number;
                return (
                  <div key={v.summons_number} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : v.summons_number)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition"
                    >
                      {/* Mobile layout */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-500">{formatDate(v.issue_date)}</span>
                          <span className={cn(
                            'text-sm font-semibold',
                            v.amount_due > 0 ? 'text-red-600' : 'text-green-600'
                          )}>
                            {v.amount_due > 0 ? formatMoney(v.amount_due) : convert('已付清')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 truncate">{v.violation}</p>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid md:grid-cols-[120px_1fr_100px_100px_100px_80px] gap-3 items-center">
                        <span className="text-sm text-gray-600">{formatDate(v.issue_date)}</span>
                        <span className="text-sm text-gray-900 truncate">{v.violation}</span>
                        <span className="text-sm text-gray-700 text-right">{formatMoney(v.fine_amount)}</span>
                        <span className="text-sm text-green-600 text-right">{formatMoney(v.payment_amount)}</span>
                        <span className={cn(
                          'text-sm font-semibold text-right',
                          v.amount_due > 0 ? 'text-red-600' : 'text-green-600'
                        )}>
                          {v.amount_due > 0 ? formatMoney(v.amount_due) : convert('已付清')}
                        </span>
                        <span className="text-sm text-gray-500 text-right">{COUNTY_MAP[v.county] || v.county}</span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">{convert('罚单号')}</span>
                          <p className="font-mono text-gray-900">{v.summons_number}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{convert('区域')}</span>
                          <p className="text-gray-900">{COUNTY_MAP[v.county] || v.county}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{convert('开票机构')}</span>
                          <p className="text-gray-900">{v.issuing_agency}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{convert('附加罚款')}</span>
                          <p className="text-gray-900">{formatMoney(v.penalty_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{convert('利息')}</span>
                          <p className="text-gray-900">{formatMoney(v.interest_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{convert('减免')}</span>
                          <p className="text-gray-900">{formatMoney(v.reduction_amount)}</p>
                        </div>
                        {v.summons_image?.url && (
                          <div className="col-span-2 sm:col-span-3">
                            <a href={v.summons_image.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                              {convert('查看罚单原件')} &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
