import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('max-w-7xl mx-auto px-4', className)}>{children}</div>;
}

export function SectionBlock({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn(className)}>{children}</section>;
}

export function SectionHeader({
  title,
  right,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between mb-5', className)}>
      <h2 className="text-xl font-bold flex items-center gap-2">{title}</h2>
      {right}
    </div>
  );
}
