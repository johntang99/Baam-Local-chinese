import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { ClaimForm } from './form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: '商家入驻 · Baam',
  description: '免费入驻 Baam，创建商家主页，AI 自动优化，精准触达本地华人客户',
};

export default async function BusinessClaimPage() {
  const user = await getCurrentUser().catch(() => null);
  const supabase = await createClient();

  // Fetch parent business categories
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, slug, name_zh, name_en, name')
    .eq('type', 'business')
    .eq('site_scope', 'zh')
    .is('parent_id', null)
    .order('sort_order', { ascending: true });

  const categories = (rawCategories || []) as AnyRow[];

  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary to-orange-600 text-white">
        <PageContainer className="max-w-4xl py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">免费入驻 Baam</h1>
          <p className="text-lg text-orange-100 mb-2">让更多纽约华人发现你的商家</p>
          <p className="text-sm text-orange-200">AI 自动优化商家主页 · 精准触达本地客户 · 免费获取咨询线索</p>
        </PageContainer>
      </section>

      <PageContainer className="max-w-3xl py-8">
        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 text-center">
            <p className="text-3xl mb-2">🆓</p>
            <h3 className="font-semibold text-sm mb-1">永久免费</h3>
            <p className="text-xs text-text-muted">基础商家主页完全免费</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl mb-2">🤖</p>
            <h3 className="font-semibold text-sm mb-1">AI 优化</h3>
            <p className="text-xs text-text-muted">AI 自动生成中英文简介和FAQ</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl mb-2">📈</p>
            <h3 className="font-semibold text-sm mb-1">精准获客</h3>
            <p className="text-xs text-text-muted">出现在搜索、指南、论坛中</p>
          </Card>
        </div>

        {/* Form */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-6">{user ? '提交入驻申请' : '请先登录'}</h2>
          {!user ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-4">🔒</p>
              <p className="text-text-secondary mb-2">入驻前请先登录或注册账号</p>
              <p className="text-sm text-text-muted">点击右上角「登录/注册」按钮</p>
            </div>
          ) : (
            <ClaimForm categories={categories} />
          )}
        </Card>

        <p className="text-xs text-text-muted text-center mt-4">
          提交即表示您同意 Baam 的 <Link href="/" className="text-primary">使用条款</Link> 和 <Link href="/" className="text-primary">隐私政策</Link>。我们将在 1-3 个工作日内审核。
        </p>
      </PageContainer>
    </main>
  );
}
