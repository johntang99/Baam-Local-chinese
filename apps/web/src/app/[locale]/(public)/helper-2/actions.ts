'use server';

import { runHelper2, type HelperMessage } from '@baam/helper-core';
import { createAdminClient } from '@/lib/supabase/admin';

interface Helper2ActionResult {
  answer: string;
  sources: {
    type: string;
    title: string;
    url: string;
    snippet?: string;
    isExternal?: boolean;
  }[];
  intent: string;
  keywords: string[];
  usedWebFallback: boolean;
  provider: string;
}

export async function askHelper2(
  query: string,
  history: HelperMessage[] = [],
): Promise<{ error?: string; data?: Helper2ActionResult }> {
  if (!query?.trim() || query.trim().length < 2) {
    return { error: '请输入更具体一点的问题' };
  }

  try {
    const supabaseAdmin = createAdminClient();

    const result = await runHelper2({
      query,
      history,
      supabaseAdmin,
      config: {
        siteName: 'Baam',
        assistantName: 'Helper-2',
        assistantNameZh: '小帮手-2',
        locale: 'zh',
        providerStrategy: 'anthropic',
        openAiApiKey: process.env.OPENAI_API_KEY,
        openAiModel: process.env.HELPER2_OPENAI_MODEL || 'gpt-5.4',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        anthropicModel: process.env.HELPER2_ANTHROPIC_MODEL || 'claude-haiku-4-5',
        webFallbackEnabled: true,
        fastMode: false,
        answerMaxTokens: 1800,
      },
    });

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '小帮手-2 暂时无法回答，请稍后再试',
    };
  }
}
