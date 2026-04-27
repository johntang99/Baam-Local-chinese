'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { cn } from '@/lib/utils';

interface PropertyResult {
  bbl: string;
  address: string;
  boro: string;
  owner: string;
  taxClass: string;
  buildingClass: string;
  stories: string;
  assessedTotal: number;
  marketValue: number;
  estimatedTax: number;
  year: string;
  county?: string;
  municipality?: string;
}

const REGIONS = [
  { group: '纽约市 NYC', options: [
    { value: 'queens', label: '皇后区 Queens' },
    { value: 'brooklyn', label: '布鲁克林 Brooklyn' },
    { value: 'manhattan', label: '曼哈顿 Manhattan' },
    { value: 'bronx', label: '布朗克斯 Bronx' },
    { value: 'staten island', label: '斯坦顿岛 Staten Island' },
  ]},
  { group: '长岛 Long Island', options: [
    { value: 'Nassau', label: 'Nassau County 纳苏郡' },
    { value: 'Suffolk', label: 'Suffolk County 萨福克郡' },
  ]},
  { group: '纽约近郊', options: [
    { value: 'Westchester', label: 'Westchester County 威彻斯特郡' },
    { value: 'Rockland', label: 'Rockland County' },
    { value: 'Orange', label: 'Orange County 橙郡' },
    { value: 'Dutchess', label: 'Dutchess County' },
    { value: 'Putnam', label: 'Putnam County' },
  ]},
  { group: '纽约州其他地区', options: [
    { value: 'Albany', label: 'Albany County' },
    { value: 'Erie', label: 'Erie County (Buffalo)' },
    { value: 'Monroe', label: 'Monroe County (Rochester)' },
    { value: 'Onondaga', label: 'Onondaga County (Syracuse)' },
    { value: 'Tompkins', label: 'Tompkins County (Ithaca)' },
    { value: 'Saratoga', label: 'Saratoga County' },
  ]},
];

const TAX_CLASS_LABELS: Record<string, string> = {
  '1': '1-3家庭住宅', '2': '公寓楼', '2A': '小型公寓', '2B': '中型公寓', '2C': '大型公寓',
  '3': '公用事业', '4': '商业地产',
};

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

const HISTORY_KEY = 'baam-property-search-history';
const MAX_HISTORY = 8;

function getHistory(): { address: string; region: string }[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function addToHistory(address: string, region: string) {
  const h = getHistory().filter(i => !(i.address === address && i.region === region));
  h.unshift({ address, region });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}

export function PropertyTaxClient() {
  const { convert } = useChineseScript();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialAddr = searchParams.get('address') || '';
  const initialRegion = searchParams.get('region') || searchParams.get('boro') || 'queens';

  const [address, setAddress] = useState(initialAddr);
  const [region, setRegion] = useState(initialRegion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<PropertyResult[] | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ address: string; region: string }[]>([]);

  useEffect(() => { setHistory(getHistory()); }, []);
  useEffect(() => { if (initialAddr) doSearch(initialAddr, initialRegion); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (addr: string, b: string) => {
    if (!addr.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    setSuggestion('');
    try {
      // Always send region when selected — even if address has city/state/zip,
      // the region helps route to the correct NYS county-based search
      const params = new URLSearchParams({ address: addr.trim() });
      if (b) params.set('region', b);
      const res = await fetch(`/api/services/property-tax?${params}`);
      if (res.status === 429) { setError('查询过于频繁，请稍后再试'); return; }
      if (!res.ok) { setError('查询失败，请稍后重试'); return; }
      const data = await res.json();
      setResults(data.properties || []);
      if (data.suggestion) setSuggestion(data.suggestion);
    } catch { setError('网络错误，请检查网络连接'); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    const params = new URLSearchParams({ address: address.trim(), region });
    router.replace(`?${params.toString()}`, { scroll: false });
    addToHistory(address.trim(), region);
    setHistory(getHistory());
    setShowHistory(false);
    await doSearch(address.trim(), region);
  }, [address, region, router, doSearch]);

  const handleHistoryClick = (addr: string, r: string) => {
    setAddress(addr);
    setRegion(r);
    setShowHistory(false);
    router.replace(`?address=${encodeURIComponent(addr)}&region=${r}`, { scroll: false });
    doSearch(addr, r);
  };

  return (
    <div>
      {/* Search Form */}
      <div className="bg-secondary-50/50 border border-secondary-light r-xl p-5 sm:p-6 mb-6">
        <h2 className="text-base fw-bold text-text-primary mb-4">{convert('查询房产税')}</h2>
        <p className="text-xs text-text-muted mb-4">{convert('输入房产地址，查看评估值、税额和交易历史。NYC以外地区可加城市名精确搜索（如 "23 Main St, Middletown"）')}</p>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => { if (history.length > 0 && !address) setShowHistory(true); }}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder={convert('输入地址 (如 36-40 Main Street 或 23 Rivervale Rd, Middletown)')}
              className="w-full h-11 px-4 border border-border r-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              style={{ background: '#ffffff' }}
              required
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border r-xl elev-lg z-20 overflow-hidden">
                <div className="px-3 py-2 text-[10px] fw-semibold text-text-muted uppercase tracking-wider">{convert('最近搜索')}</div>
                {history.map((h, i) => (
                  <button key={i} type="button" onMouseDown={() => handleHistoryClick(h.address, h.region)}
                    className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-primary-50 hover:text-primary transition flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {h.address} · {h.region}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="h-10 px-3 border border-border r-xl text-sm bg-bg-card focus:ring-2 focus:ring-primary outline-none sm:w-64">
              {REGIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="submit" disabled={loading || !address.trim()}
              className="h-10 px-6 bg-primary text-text-inverse fw-semibold r-xl hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{convert('查询中...')}</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>{convert('查询房产税')}</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && <div className="bg-accent-red-light border border-accent-red text-accent-red r-xl p-4 mb-6 text-sm">{convert(error)}</div>}

      {/* Results */}
      {results !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base fw-bold text-text-primary">{convert('查询结果')}</h2>
            <span className="text-sm text-text-muted">{convert(`找到 ${results.length} 处房产`)}</span>
          </div>

          {results.length === 0 ? (
            <div className="bg-bg-page r-xl p-8 text-center">
              <div className="w-16 h-16 bg-bg-page r-full flex items-center justify-center mx-auto mb-4 text-2xl">🏠</div>
              <h3 className="text-base fw-bold text-text-secondary mb-1">{convert('未找到房产')}</h3>
              {suggestion ? (
                <div className="mt-3">
                  <p className="text-sm text-text-muted mb-2">{convert('您是不是要查找：')}</p>
                  <button type="button" onClick={() => { setAddress(suggestion); doSearch(suggestion, region); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary r-lg hover:bg-primary/20 transition fw-medium text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {suggestion}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-muted mb-2">{convert('请检查地址拼写，确保使用英文地址（如 123 Main Street）')}</p>
                  <p className="text-xs text-text-muted">{convert('提示：某些房产可能以不同地址格式登记（如联合地址"86-92"），或登记在不同的城镇名下。尝试只输入门牌号不加城市名，或使用相邻地址搜索。')}</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r, i) => {
                // All results link to detail page
                const qp = new URLSearchParams();
                if (r.county) qp.set('county', r.county);
                if (r.municipality) qp.set('municipality', r.municipality);
                const detailParams = qp.toString() ? `?${qp}` : '';
                const detailHref = r.bbl
                  ? `/zh/services/property-tax/${encodeURIComponent(r.bbl)}${detailParams}`
                  : undefined;
                const Wrapper = detailHref ? 'a' : 'div';
                const wrapperProps = detailHref ? { href: detailHref } : {};
                return (
                  <Wrapper key={r.bbl || i} {...wrapperProps}
                    className="block bg-bg-card border border-border r-xl p-5 hover:border-primary/30 hover:elev-md transition group">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm fw-bold text-text-primary group-hover:text-primary transition">{r.address}</h3>
                        <p className="text-xs text-text-muted">{r.boro} {r.owner ? `· ${convert('业主')}: ${r.owner}` : ''}</p>
                        {r.year && <p className="text-[10px] text-text-muted mt-0.5">{r.year}</p>}
                      </div>
                      <span className={cn('text-[10px] fw-semibold px-2 py-1 r-full max-w-[140px] text-right',
                        r.taxClass === '1' ? 'bg-accent-green-light text-accent-green' :
                        r.taxClass === '4' ? 'bg-accent-blue-light text-secondary-dark' :
                        'bg-accent-purple-light text-accent-purple'
                      )}>
                        {TAX_CLASS_LABELS[r.taxClass]
                          ? `Class ${r.taxClass} — ${convert(TAX_CLASS_LABELS[r.taxClass])}`
                          : r.taxClass?.length > 20 ? r.taxClass.slice(0, 25) + '...' : r.taxClass
                        }
                      </span>
                    </div>
                    <div className={cn('grid gap-4 text-center', r.estimatedTax > 0 ? 'grid-cols-3' : 'grid-cols-2')}>
                      <div>
                        <div className="text-base fw-bold text-text-primary">{formatMoney(r.assessedTotal)}</div>
                        <div className="text-[11px] text-text-muted">{convert('评估值')}</div>
                      </div>
                      <div>
                        <div className="text-base fw-bold text-secondary-dark">{formatMoney(r.marketValue)}</div>
                        <div className="text-[11px] text-text-muted">{convert('市场估值')}</div>
                      </div>
                      {r.estimatedTax > 0 && (
                        <div>
                          <div className="text-base fw-bold text-primary">{formatMoney(r.estimatedTax)}{convert('/年')}</div>
                          <div className="text-[11px] text-text-muted">{convert('预估税额')}</div>
                        </div>
                      )}
                    </div>
                    {detailHref && (
                      <div className="mt-4 pt-3 border-t border-border-light text-center">
                        <span className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-sm fw-semibold r-lg group-hover:bg-primary/90 transition">
                          {convert('查看房产税详情')} →
                        </span>
                      </div>
                    )}
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
