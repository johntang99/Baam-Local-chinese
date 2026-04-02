'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import { useChineseScript } from '@/lib/i18n/chinese-converter';

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const { convert } = useChineseScript();

  return (
    <footer className="bg-gray-900 text-gray-400 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-baam-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                B
              </div>
              <span className="text-xl font-bold text-white">Baam</span>
            </div>
            <p className="text-sm leading-relaxed">
              {convert('AI驱动的纽约华人本地生活与商家增长平台。新闻、资讯、论坛、商家、达人，一站式解决本地生活问题。')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {convert(t('quickLinks'))}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/news" className="hover:text-white transition">
                  {convert(nav('news'))}
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-white transition">
                  {convert(nav('guides'))}
                </Link>
              </li>
              <li>
                <Link href="/forum" className="hover:text-white transition">
                  {convert(nav('forum'))}
                </Link>
              </li>
              <li>
                <Link href="/businesses" className="hover:text-white transition">
                  {convert(nav('businesses'))}
                </Link>
              </li>
              <li>
                <Link href="/voices" className="hover:text-white transition">
                  {convert(nav('voices'))}
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition">
                  {convert(nav('services'))}
                </Link>
              </li>
            </ul>
          </div>

          {/* Business Services */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {convert(t('businessServices'))}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('businessRegister'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('adCooperation'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('voiceApply'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('productPlans'))}
                </a>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {convert(t('about'))}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('aboutBaam'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('contactUs'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('termsOfService'))}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {convert(t('privacyPolicy'))}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span>{convert('微信公众号')}</span>
            <span>Facebook</span>
            <span>Instagram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
