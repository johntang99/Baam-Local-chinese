import { DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface DiscoverMediaModerationConfig {
  enabled: boolean;
  provider: 'rekognition';
  moderateImages: boolean;
  moderateVideoThumbnail: boolean;
  moderateFullVideo: boolean;
  minConfidence: number;
  blockConfidence: number;
  maxImagesPerPost: number;
}

export interface MediaModerationResult {
  pass: boolean;
  score: number;
  reason: string | null;
  checked: boolean;
  provider: 'rekognition' | null;
  checkedAt: string | null;
  checkedTargets: number;
  mode: 'disabled' | 'images_only' | 'video_thumbnail_only' | 'images_and_video_thumbnail' | 'none';
}

const DEFAULT_CONFIG: DiscoverMediaModerationConfig = {
  enabled: false,
  provider: 'rekognition',
  moderateImages: true,
  moderateVideoThumbnail: true,
  moderateFullVideo: false,
  minConfidence: 70,
  blockConfidence: 85,
  maxImagesPerPost: 4,
};

const MAX_REKOGNITION_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const UNSAFE_KEYWORDS = [
  'nudity',
  'explicit',
  'sexual',
  'violence',
  'graphic',
  'gore',
  'blood',
  'weapon',
  'self harm',
  'self-harm',
  'hate symbol',
  'drugs',
];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getMode(config: DiscoverMediaModerationConfig): MediaModerationResult['mode'] {
  if (!config.enabled) return 'disabled';
  if (config.moderateImages && config.moderateVideoThumbnail) return 'images_and_video_thumbnail';
  if (config.moderateImages) return 'images_only';
  if (config.moderateVideoThumbnail) return 'video_thumbnail_only';
  return 'none';
}

export function normalizeDiscoverMediaModerationConfig(raw: AnyRow | null | undefined): DiscoverMediaModerationConfig {
  const source = raw || {};
  return {
    enabled: Boolean(source.enabled),
    provider: 'rekognition',
    moderateImages: source.moderate_images !== false,
    moderateVideoThumbnail: source.moderate_video_thumbnail !== false,
    moderateFullVideo: source.moderate_full_video === true,
    minConfidence: clamp(asNumber(source.min_confidence, DEFAULT_CONFIG.minConfidence), 0, 100),
    blockConfidence: clamp(asNumber(source.block_confidence, DEFAULT_CONFIG.blockConfidence), 0, 100),
    maxImagesPerPost: clamp(asNumber(source.max_images_per_post, DEFAULT_CONFIG.maxImagesPerPost), 1, 10),
  };
}

function getRekognitionClient(): RekognitionClient | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  if (!accessKeyId || !secretAccessKey) return null;

  return new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function isUnsafeLabel(name?: string, parentName?: string): boolean {
  const joined = `${name || ''} ${parentName || ''}`.toLowerCase();
  return UNSAFE_KEYWORDS.some((kw) => joined.includes(kw));
}

async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('unsupported_media_type');

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_REKOGNITION_IMAGE_BYTES) throw new Error('image_too_large_for_rekognition');
    return buf;
  } finally {
    clearTimeout(timeout);
  }
}

async function moderateImageUrl(
  client: RekognitionClient,
  url: string,
  config: DiscoverMediaModerationConfig,
): Promise<{ pass: boolean; score: number; reason: string | null }> {
  const bytes = await fetchImageBytes(url);
  const command = new DetectModerationLabelsCommand({
    Image: { Bytes: bytes },
    MinConfidence: config.minConfidence,
  });
  const out = await client.send(command);
  const labels = out.ModerationLabels || [];

  let maxRisk = 0;
  let blockedLabel: string | null = null;
  for (const row of labels) {
    const confidence = Number(row.Confidence || 0);
    const isUnsafe = isUnsafeLabel(row.Name, row.ParentName);
    if (!isUnsafe) continue;
    if (confidence > maxRisk) maxRisk = confidence;
    if (confidence >= config.blockConfidence && !blockedLabel) {
      blockedLabel = row.Name || row.ParentName || 'unsafe_media';
    }
  }

  if (blockedLabel) {
    return {
      pass: false,
      score: clamp(maxRisk / 100, 0, 1),
      reason: `媒体疑似不健康内容（${blockedLabel}）`,
    };
  }

  return { pass: true, score: clamp(maxRisk / 100, 0, 1), reason: null };
}

export async function moderateDiscoverMediaAssets(input: {
  imageUrls: string[];
  videoThumbnailUrl?: string | null;
  config: DiscoverMediaModerationConfig;
}): Promise<MediaModerationResult> {
  const { imageUrls, videoThumbnailUrl, config } = input;
  const mode = getMode(config);
  if (!config.enabled) {
    return {
      pass: true,
      score: 0,
      reason: null,
      checked: false,
      provider: null,
      checkedAt: null,
      checkedTargets: 0,
      mode,
    };
  }
  if (config.provider !== 'rekognition') {
    return {
      pass: true,
      score: 0,
      reason: null,
      checked: false,
      provider: null,
      checkedAt: null,
      checkedTargets: 0,
      mode,
    };
  }

  const client = getRekognitionClient();
  if (!client) {
    // AWS credentials not configured — skip media moderation, allow post through
    return {
      pass: true,
      score: 0,
      reason: null,
      checked: false,
      provider: null,
      checkedAt: null,
      checkedTargets: 0,
      mode,
    };
  }

  const checks: Array<{ kind: 'image' | 'video_thumbnail'; url: string }> = [];
  if (config.moderateImages && imageUrls.length > 0) {
    for (const url of imageUrls.slice(0, config.maxImagesPerPost)) {
      if (typeof url === 'string' && url.trim()) checks.push({ kind: 'image', url: url.trim() });
    }
  }
  if (config.moderateVideoThumbnail && videoThumbnailUrl && String(videoThumbnailUrl).trim()) {
    checks.push({ kind: 'video_thumbnail', url: String(videoThumbnailUrl).trim() });
  }
  if (checks.length === 0) {
    return {
      pass: true,
      score: 0,
      reason: null,
      checked: false,
      provider: 'rekognition',
      checkedAt: null,
      checkedTargets: 0,
      mode,
    };
  }

  let maxScore = 0;
  const reasons: string[] = [];
  let checkedTargets = 0;
  const checkedAt = new Date().toISOString();

  for (const target of checks) {
    try {
      const result = await moderateImageUrl(client, target.url, config);
      checkedTargets += 1;
      if (result.score > maxScore) maxScore = result.score;
      if (!result.pass) {
        reasons.push(target.kind === 'video_thumbnail' ? `视频封面：${result.reason}` : `图片：${result.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      return {
        pass: false,
        score: 1,
        reason: `媒体审核失败（${target.kind === 'video_thumbnail' ? '视频封面' : '图片'}）：${message}`,
        checked: checkedTargets > 0,
        provider: 'rekognition',
        checkedAt: checkedTargets > 0 ? checkedAt : null,
        checkedTargets,
        mode,
      };
    }
  }

  if (reasons.length > 0) {
    return {
      pass: false,
      score: clamp(maxScore, 0, 1),
      reason: reasons.join('；'),
      checked: true,
      provider: 'rekognition',
      checkedAt,
      checkedTargets,
      mode,
    };
  }
  return {
    pass: true,
    score: clamp(maxScore, 0, 1),
    reason: null,
    checked: true,
    provider: 'rekognition',
    checkedAt,
    checkedTargets,
    mode,
  };
}
