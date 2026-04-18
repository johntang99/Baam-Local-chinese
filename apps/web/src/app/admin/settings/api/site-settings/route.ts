import { NextResponse } from 'next/server';
import { saveSiteSetting, type SettingKey } from '@/lib/site-settings';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { siteId, settingKey, value } = body;

    if (!siteId || !settingKey || !value) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validKeys: SettingKey[] = ['header', 'navigation', 'footer', 'seo'];
    if (!validKeys.includes(settingKey)) {
      return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 });
    }

    const result = await saveSiteSetting(siteId, settingKey as SettingKey, value);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
