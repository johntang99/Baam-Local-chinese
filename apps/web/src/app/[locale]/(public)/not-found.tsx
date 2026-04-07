import { Link } from '@/lib/i18n/routing';
import { PageContainer } from '@/components/layout/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <main>
      <PageContainer className="max-w-2xl py-20 text-center">
        <p className="text-6xl mb-6">🔍</p>
        <h1 className="text-3xl font-bold mb-3">页面未找到</h1>
        <p className="text-text-secondary mb-8">
          抱歉，你访问的页面不存在或已被移除。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-6 text-sm')}>
            返回首页
          </Link>
          <Link href="/ask" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-6 text-sm')}>
            问问小邻 AI
          </Link>
          <Link href="/search" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-6 text-sm')}>
            搜索内容
          </Link>
        </div>
      </PageContainer>
    </main>
  );
}
