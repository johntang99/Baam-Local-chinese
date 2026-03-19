import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type Model = 'haiku' | 'sonnet';

const MODELS: Record<Model, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
};

interface AIResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

async function callClaude<T>(params: {
  prompt: string;
  system?: string;
  model?: Model;
  maxTokens?: number;
  parseJson?: boolean;
}): Promise<AIResult<T>> {
  const model = params.model || 'haiku';
  const modelId = MODELS[model];

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: params.maxTokens || 1024,
    system: params.system,
    messages: [{ role: 'user', content: params.prompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const data = params.parseJson ? JSON.parse(text) : text;

  return {
    data: data as T,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: modelId,
  };
}

/**
 * Generate a 3-sentence summary of content.
 */
export async function generateSummary(
  text: string,
  language: 'zh' | 'en' = 'zh'
): Promise<AIResult<string>> {
  const langInstructions =
    language === 'zh'
      ? '用简体中文回答，生成3句话的摘要。'
      : 'Generate a 3-sentence summary in English.';

  return callClaude<string>({
    system: `You are a content summarizer for a local community portal. ${langInstructions} Be concise and focus on actionable information.`,
    prompt: `Summarize the following content in exactly 3 sentences:\n\n${text}`,
    model: 'haiku',
  });
}

/**
 * Translate content between Chinese and English.
 */
export async function translateContent(
  text: string,
  fromLang: 'zh' | 'en',
  toLang: 'zh' | 'en'
): Promise<AIResult<string>> {
  const direction =
    fromLang === 'zh' ? 'Translate from Chinese to English' : 'Translate from English to Chinese (Simplified)';

  return callClaude<string>({
    system: `You are a professional translator for a local community platform serving Chinese immigrants in New York. ${direction}. Maintain the original tone and meaning. For Chinese output, use Simplified Chinese.`,
    prompt: text,
    model: 'haiku',
  });
}

/**
 * Extract topic tags from content.
 */
export async function generateTags(
  text: string
): Promise<AIResult<string[]>> {
  return callClaude<string[]>({
    system:
      'Extract 3-5 topic tags from the content. Return as a JSON array of strings in Chinese. Example: ["租房","法拉盛","新移民"]',
    prompt: text,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Generate FAQ pairs from content.
 */
export async function generateFAQ(
  context: string,
  count: number = 5
): Promise<AIResult<Array<{ q: string; a: string }>>> {
  return callClaude<Array<{ q: string; a: string }>>({
    system: `You are an FAQ generator for a local community portal serving Chinese immigrants. Generate ${count} frequently asked questions and answers based on the provided content. Return as JSON array: [{"q":"问题","a":"回答"}]. Use Simplified Chinese.`,
    prompt: context,
    model: 'sonnet',
    maxTokens: 2048,
    parseJson: true,
  });
}

/**
 * Classify forum post intent.
 */
export async function classifyIntent(
  text: string
): Promise<
  AIResult<{
    intent: string;
    confidence: number;
    entities: string[];
  }>
> {
  return callClaude({
    system:
      'Classify the intent of this forum post. Return JSON: {"intent":"recommendation_request|question|complaint|review|news|discussion","confidence":0.0-1.0,"entities":["entity1","entity2"]}',
    prompt: text,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Match businesses to a query based on semantic similarity.
 */
export async function matchBusinesses(
  query: string,
  businesses: Array<{ id: string; name: string; description: string; tags: string[] }>
): Promise<AIResult<string[]>> {
  return callClaude<string[]>({
    system:
      'You are a business matching engine. Given a user query and a list of businesses, return the IDs of the top 3 most relevant businesses as a JSON array. Consider name, description, and tags.',
    prompt: `Query: ${query}\n\nBusinesses:\n${businesses.map((b) => `ID: ${b.id}, Name: ${b.name}, Desc: ${b.description}, Tags: ${b.tags.join(',')}`).join('\n')}`,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Generate an AI overview for search results.
 */
export async function generateSearchSummary(
  query: string,
  results: { type: string; count: number }[]
): Promise<AIResult<string>> {
  const resultSummary = results
    .map((r) => `${r.count}个${r.type}`)
    .join('，');

  return callClaude<string>({
    system:
      'You are an AI search assistant for a Chinese community portal in New York. Generate a helpful 2-3 sentence summary of search results in Simplified Chinese. Be specific and actionable.',
    prompt: `用户搜索了「${query}」，找到了：${resultSummary}。请生成一段简短的AI摘要，帮助用户理解搜索结果。`,
    model: 'haiku',
  });
}
