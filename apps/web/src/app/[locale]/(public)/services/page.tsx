import { Suspense } from 'react';
import { ServicesHub } from './services-hub';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '实用工具 · Baam',
  description: '纽约华人常用查询工具 — 车辆违规查询、餐厅卫生评分、房产税查询、签证资格AI评估，免费使用。',
};

export default function ServicesIndexPage() {
  return (
    <main>
      <Suspense>
        <ServicesHub />
      </Suspense>
    </main>
  );
}
