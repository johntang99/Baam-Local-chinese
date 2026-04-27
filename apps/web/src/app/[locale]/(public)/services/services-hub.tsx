'use client';

import { useState, Suspense, lazy } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';


const ViolationLookup = lazy(() => import('./vehicle-violations/violation-lookup').then(m => ({ default: m.ViolationLookup })));
const InspectionsClient = lazy(() => import('./restaurant-inspections/inspections-client').then(m => ({ default: m.InspectionsClient })));
const PropertyTaxClient = lazy(() => import('./property-tax/property-tax-client').then(m => ({ default: m.PropertyTaxClient })));
const ScreenerClient = lazy(() => import('../immigration/visa-screener/screener-client').then(m => ({ default: m.ScreenerClient })));

const TABS = [
  { key: 'violations', emoji: '🚗', label: '车辆违规查询', badge: '免费' },
  { key: 'property', emoji: '🏠', label: '房产税查询', badge: '免费' },
  { key: 'restaurants', emoji: '🍽️', label: '餐厅卫生评分', badge: '免费' },
  { key: 'visa', emoji: '🛡️', label: '签证资格评估', badge: 'AI' },
] as const;

type TabKey = typeof TABS[number]['key'];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--ed-line)] border-t-[var(--ed-accent)] rounded-full animate-spin mb-3" />
        <p style={{ fontSize: 13, color: 'var(--ed-ink-muted)' }}>加载中...</p>
      </div>
    </div>
  );
}

export function ServicesHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as TabKey) || 'violations';
  const [activeTab, setActiveTab] = useState<TabKey>(TABS.some(t => t.key === initialTab) ? initialTab : 'violations');

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    router.replace(`?tab=${key}`, { scroll: false });
  };

  return (
    <>
      {/* Sticky Tab Bar */}
      <div className="sticky top-[52px] z-40" style={{ background: 'var(--ed-paper)', borderBottom: '1px solid var(--ed-line)', marginTop: 16 }}>
        <div style={{ maxWidth: 'var(--ed-container-max)', margin: '0 auto', padding: '10px 16px' }}>
          <div className="flex justify-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className="flex-shrink-0 whitespace-nowrap transition-all flex items-center gap-1.5"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--ed-radius-pill)',
                    fontSize: 13,
                    fontWeight: 500,
                    background: isActive ? 'var(--ed-ink)' : 'transparent',
                    color: isActive ? 'var(--ed-paper)' : 'var(--ed-ink-soft)',
                    border: isActive ? '1px solid var(--ed-ink)' : '1px solid var(--ed-line)',
                    cursor: 'pointer',
                  }}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Service Content */}
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '32px 16px 80px' }}>
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'violations' && <ViolationLookup />}
          {activeTab === 'restaurants' && <InspectionsClient />}
          {activeTab === 'property' && <PropertyTaxClient />}
          {activeTab === 'visa' && <ScreenerClient />}
        </Suspense>
      </div>
    </>
  );
}
