import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-shell';
import { SettingsForm } from './form';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: '个人设置 · Baam',
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/zh?auth=required&redirect=/settings');

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = data as AnyRow | null;
  if (!profile) redirect('/zh');

  return (
    <main>
      <PageContainer className="max-w-2xl py-8">
        <h1 className="text-2xl font-bold mb-6">个人设置</h1>
        <SettingsForm profile={profile} userEmail={user.email} />
      </PageContainer>
    </main>
  );
}
