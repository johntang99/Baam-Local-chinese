import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '实用工具 · Baam',
  description: '纽约华人常用查询工具 — 车辆违规查询、停车罚单查询等免费服务。',
};

const services = [
  {
    href: '/services/vehicle-violations',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
    ),
    title: '车辆违规查询',
    description: '查询纽约市停车罚单、交通摄像头违规记录和缴费状态',
    badge: '免费',
  },
  // Future services placeholder
  // {
  //   href: '/services/property-lookup',
  //   icon: ...,
  //   title: '房产信息查询',
  //   description: '查询纽约市房产税、产权信息',
  //   badge: '即将上线',
  // },
];

export default function ServicesIndexPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">实用工具</h1>
        <p className="text-gray-500">纽约华人常用查询工具，免费使用</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {services.map((service) => (
          <Link
            key={service.href}
            href={service.href}
            className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary/20 transition">
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900 group-hover:text-primary transition">{service.title}</h2>
                  {service.badge && (
                    <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{service.badge}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-primary transition flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
