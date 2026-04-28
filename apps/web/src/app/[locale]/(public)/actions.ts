'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { generateSeoSlug } from '@/lib/slug-generator';
import { revalidatePath } from 'next/cache';
import { moderateDiscoverPost } from '@/lib/ai/moderate-post';
import { getSiteSetting } from '@/lib/site-settings';
import {
  moderateDiscoverMediaAssets,
  normalizeDiscoverMediaModerationConfig,
  type MediaModerationResult,
} from '@/lib/ai/moderate-media';
import { startDiscoverVideoModerationJob } from '@/lib/ai/moderate-video';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> extends infer T ? T : any;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function buildModerationMetadata(input: {
  previousMetadata?: unknown;
  text: { pass: boolean; score: number; reason: string | null };
  media: MediaModerationResult;
  fullVideoScanEnabled?: boolean;
}): Record<string, unknown> {
  const base = asRecord(input.previousMetadata) || {};
  return {
    ...base,
    moderation: {
      text: {
        pass: input.text.pass,
        score: input.text.score,
        reason: input.text.reason,
      },
      media: {
        pass: input.media.pass,
        score: input.media.score,
        reason: input.media.reason,
        checked: input.media.checked,
        provider: input.media.provider,
        checked_at: input.media.checkedAt,
        checked_targets: input.media.checkedTargets,
        mode: input.media.mode,
        full_video_scan: input.fullVideoScanEnabled === true,
      },
    },
  };
}

function withVideoModerationMeta(
  metadata: Record<string, unknown>,
  videoMeta: Record<string, unknown>,
): Record<string, unknown> {
  const base = asRecord(metadata) || {};
  const moderation = asRecord(base.moderation) || {};
  return {
    ...base,
    moderation: {
      ...moderation,
      video: videoMeta,
    },
  };
}

// ─── Newsletter Subscription ──────────────────────────────────────────

export async function subscribeNewsletter(formData: FormData) {
  const email = formData.get('email') as string;
  if (!email || !email.includes('@')) {
    return { error: '请输入有效的邮箱地址' };
  }

  const source = (formData.get('source') as string) || 'footer';
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('newsletter_subscribers')
    .upsert(
      { email, source, language: 'zh', status: 'active' },
      { onConflict: 'email,region_id' }
    );

  if (error) {
    if (error.code === '23505') {
      return { success: true, message: '你已经订阅过了' };
    }
    return { error: '订阅失败，请稍后重试' };
  }

  return { success: true, message: '订阅成功！感谢你的关注' };
}

// ─── Forum: Create Thread ─────────────────────────────────────────────

export async function createForumThread(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const boardId = formData.get('board_id') as string;
  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const tagsRaw = (formData.get('tags') as string)?.trim();

  if (!boardId || !title || !body) {
    return { error: '请填写版块、标题和内容' };
  }

  if (title.length > 120) {
    return { error: '标题不能超过120个字符' };
  }

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // Get board slug for redirect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: board } = await (supabase as any)
    .from('categories_forum')
    .select('slug')
    .eq('id', boardId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread, error } = await (supabase as any)
    .from('forum_threads')
    .insert({
      slug,
      title,
      body,
      board_id: boardId,
      author_id: user.id,
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      status: 'published',
      ai_tags: tags,
    })
    .select('slug')
    .single();

  if (error) {
    return { error: '发帖失败：' + error.message };
  }

  const boardSlug = board?.slug || 'general';
  revalidatePath(`/forum/${boardSlug}`);

  return { success: true, redirect: `/forum/${boardSlug}/${thread?.slug}` };
}

// ─── Forum: Create Reply ──────────────────────────────────────────────

export async function createForumReply(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const threadId = formData.get('thread_id') as string;
  const body = (formData.get('body') as string)?.trim();

  if (!threadId || !body) {
    return { error: '请输入回复内容' };
  }

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('forum_replies')
    .insert({
      thread_id: threadId,
      author_id: user.id,
      body,
      site_id: site.id,
      status: 'published',
    });

  if (error) {
    return { error: '回复失败：' + error.message };
  }

  // Update thread's last_replied_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('forum_threads')
    .update({ last_replied_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('site_id', site.id);

  revalidatePath(`/forum`);
  return { success: true };
}

// ─── Voices: Create Post ──────────────────────────────────────────────

export async function createVoicePost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const postType = (formData.get('post_type') as string) || 'short_post';
  const tagsRaw = (formData.get('tags') as string)?.trim();

  if (!content) {
    return { error: '请输入内容' };
  }

  const slug = (title || content.slice(0, 30))
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error } = await (supabase as any)
    .from('voice_posts')
    .insert({
      author_id: user.id,
      post_type: postType,
      title: title || null,
      slug,
      content,
      content_zh: content,
      visibility: 'public',
      status: 'published',
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      topic_tags: tags,
    })
    .select('slug')
    .single();

  if (error) {
    return { error: '发布失败：' + error.message };
  }

  revalidatePath(`/voices/${user.username}`);
  return { success: true, redirect: `/voices/${user.username}/posts/${post?.slug}` };
}

// ─── Discover: Create Post (extended with images, businesses, topics, location) ──

export async function createDiscoverPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const postType = (formData.get('post_type') as string) || 'note';
  const tagsRaw = (formData.get('tags') as string)?.trim();
  const coverImagesRaw = (formData.get('cover_images') as string)?.trim();
  const videoUrl = (formData.get('video_url') as string)?.trim() || null;
  const videoThumbnailUrl = (formData.get('video_thumbnail_url') as string)?.trim() || null;
  const videoDurationRaw = (formData.get('video_duration') as string)?.trim();
  const videoDuration = videoDurationRaw ? parseInt(videoDurationRaw, 10) : null;
  const locationText = (formData.get('location_text') as string)?.trim() || null;
  const businessIdsRaw = (formData.get('business_ids') as string)?.trim();
  const categoryId = (formData.get('category_id') as string)?.trim() || null;

  if (!content && !title) {
    return { error: '请输入标题或内容' };
  }

  const supabase = createAdminClient();
  const site = await getCurrentSite();
  const slug = await generateSeoSlug(title || content?.slice(0, 30) || 'post', null, supabase, 'voice_posts');

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const coverImages = coverImagesRaw
    ? JSON.parse(coverImagesRaw) as string[]
    : [];

  const businessIds = businessIdsRaw
    ? JSON.parse(businessIdsRaw) as string[]
    : [];

  // AI moderation check (text + media)
  const textModeration = await moderateDiscoverPost(title || '', content || '');
  const rawModerationSetting = await getSiteSetting(site.id, 'moderation').catch(() => null);
  const mediaModerationConfig = normalizeDiscoverMediaModerationConfig(rawModerationSetting);
  const mediaModeration = await moderateDiscoverMediaAssets({
    imageUrls: coverImages,
    videoThumbnailUrl,
    config: mediaModerationConfig,
  });
  const needsFullVideoScan = Boolean(
    postType === 'video' &&
    videoUrl &&
    mediaModerationConfig.enabled &&
    mediaModerationConfig.moderateFullVideo,
  );
  // Don't block publish just because thumbnail is missing — text moderation is sufficient
  const videoNeedsManualReview = false;

  const moderationReasons: string[] = [];
  if (!textModeration.pass) moderationReasons.push(textModeration.reason || '文本疑似不合规');
  if (!mediaModeration.pass) moderationReasons.push(mediaModeration.reason || '媒体疑似不合规');
  if (videoNeedsManualReview) moderationReasons.push('视频缺少可审核封面，需人工审核');
  if (needsFullVideoScan && moderationReasons.length === 0) moderationReasons.push('视频内容审核中');

  // DEBUG: Log moderation results (remove after debugging)
  console.log('[MODERATION DEBUG]', JSON.stringify({
    textPass: textModeration.pass, textScore: textModeration.score, textReason: textModeration.reason,
    mediaPass: mediaModeration.pass, mediaScore: mediaModeration.score, mediaReason: mediaModeration.reason,
    mediaEnabled: mediaModerationConfig.enabled, moderateFullVideo: mediaModerationConfig.moderateFullVideo,
    needsFullVideoScan, videoNeedsManualReview,
    moderationReasons, videoUrl: videoUrl?.slice(0, 50), videoThumbnailUrl: videoThumbnailUrl?.slice(0, 50),
  }));

  const postStatus = moderationReasons.length > 0 ? 'pending_review' : 'published';
  const moderationReason = moderationReasons.length > 0 ? moderationReasons.join('；') : null;
  const moderationScore = Math.max(textModeration.score || 0, mediaModeration.score || 0);
  const mediaForMeta: MediaModerationResult = {
    ...mediaModeration,
    pass: mediaModeration.pass && !videoNeedsManualReview,
    reason: videoNeedsManualReview
      ? [mediaModeration.reason, '视频缺少可审核封面，需人工审核'].filter(Boolean).join('；')
      : mediaModeration.reason,
  };
  const moderationMetadata = buildModerationMetadata({
    text: {
      pass: textModeration.pass,
      score: textModeration.score,
      reason: textModeration.reason,
    },
    media: mediaForMeta,
    fullVideoScanEnabled: needsFullVideoScan,
  });

  // Insert post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error } = await (supabase as any)
    .from('voice_posts')
    .insert({
      author_id: user.id,
      post_type: postType,
      title: title || null,
      slug,
      content: content || '',
      visibility: 'public',
      status: postStatus,
      published_at: new Date().toISOString(),
      ai_spam_score: moderationScore,
      moderation_reason: moderationReason,
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      topic_tags: tags,
      cover_images: coverImages.length > 0 ? coverImages : null,
      cover_image_url: coverImages[0] || videoThumbnailUrl || null,
      video_url: videoUrl,
      video_thumbnail_url: videoThumbnailUrl,
      video_duration_seconds: videoDuration,
      location_text: locationText,
      aspect_ratio: postType === 'video' ? '16:9' : '4:3',
      category_id: categoryId,
      metadata: moderationMetadata,
    })
    .select('id, slug')
    .single();

  if (error) {
    return { error: '发布失败：' + error.message };
  }

  if (needsFullVideoScan && post?.id && videoUrl) {
    const start = await startDiscoverVideoModerationJob({
      postId: post.id,
      siteId: site.id,
      videoUrl,
      config: {
        enabled: mediaModerationConfig.enabled,
        moderateFullVideo: mediaModerationConfig.moderateFullVideo,
        minConfidence: mediaModerationConfig.minConfidence,
        blockConfidence: mediaModerationConfig.blockConfidence,
      },
    });

    let nextReason = moderationReason;
    const videoMeta: Record<string, unknown> = start.started
      ? {
          provider: start.provider,
          job_id: start.jobId,
          job_status: 'IN_PROGRESS',
          started_at: start.startedAt,
          checked_at: null,
          checked_targets: 0,
          pass: null,
          score: 0,
          reason: null,
          bucket: start.bucket,
          object_key: start.objectKey,
        }
      : {
          provider: start.provider,
          job_id: null,
          job_status: 'FAILED_TO_START',
          started_at: null,
          checked_at: null,
          checked_targets: 0,
          pass: false,
          score: 1,
          reason: start.reason || '视频审核未启动，需人工审核',
          bucket: start.bucket,
          object_key: start.objectKey,
        };

    if (!start.started) {
      nextReason = [nextReason, start.reason || '视频审核未启动，需人工审核'].filter(Boolean).join('；');
    }

    const metadataWithVideo = withVideoModerationMeta(moderationMetadata, videoMeta);
    await (supabase as any)
      .from('voice_posts')
      .update({
        metadata: metadataWithVideo,
        moderation_reason: nextReason,
        status: 'pending_review',
      })
      .eq('id', post.id)
      .eq('site_id', site.id);
  }

  // Link businesses
  if (businessIds.length > 0 && post?.id) {
    const bizLinks = businessIds.slice(0, 5).map((bizId: string, i: number) => ({
      post_id: post.id,
      business_id: bizId,
      sort_order: i,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('discover_post_businesses').insert(bizLinks);
  }

  // Link topics (match tags to discover_topics)
  if (tags.length > 0 && post?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchedTopics } = await (supabase as any)
      .from('discover_topics')
      .select('id, name_zh')
      .in('name_zh', tags);

    if (matchedTopics && matchedTopics.length > 0) {
      const topicLinks = matchedTopics.map((t: { id: string }) => ({
        post_id: post.id,
        topic_id: t.id,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('discover_post_topics').insert(topicLinks);
    }
  }

  revalidatePath('/discover');
  return { success: true, redirect: `/discover/${post?.slug}`, moderated: postStatus === 'pending_review' };
}

// ─── Discover: Search Businesses (for business linker) ──

export async function searchBusinesses(query: string) {
  if (!query || query.length < 1) return { businesses: [] };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('businesses')
    .select('id, slug, display_name, display_name_zh, short_desc_zh, address_line1')
    .or(`display_name.ilike.%${query}%,display_name_zh.ilike.%${query}%`)
    .eq('site_id', site.id)
    .eq('status', 'active')
    .limit(8);

  return { businesses: data || [] };
}

// ─── Discover: Delete Post ──

export async function deleteDiscoverPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  if (!postId) return { error: '缺少帖子ID' };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (supabase as any)
    .from('voice_posts')
    .select('id, author_id')
    .eq('id', postId)
    .eq('site_id', site.id)
    .single();

  if (!post || post.author_id !== user.id) {
    return { error: '无权删除此帖子' };
  }

  // Delete linked topics and businesses first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('discover_post_topics').delete().eq('post_id', postId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('discover_post_businesses').delete().eq('post_id', postId);

  // Delete the post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', site.id);

  if (error) return { error: '删除失败：' + error.message };

  revalidatePath('/discover');
  return { success: true };
}

// ─── Update Discover Post ─────────────────────────────────────────────

export async function updateDiscoverPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  if (!postId) return { error: '缺少帖子ID' };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (supabase as any)
    .from('voice_posts')
    .select('id, author_id, slug, status, post_type, metadata')
    .eq('id', postId)
    .eq('site_id', site.id)
    .single();

  if (!post || post.author_id !== user.id) {
    return { error: '无权编辑此帖子' };
  }

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const tagsRaw = (formData.get('tags') as string)?.trim();
  const coverImagesRaw = (formData.get('cover_images') as string)?.trim();
  const videoUrl = (formData.get('video_url') as string)?.trim() || null;
  const videoThumbnailUrl = (formData.get('video_thumbnail_url') as string)?.trim() || null;
  const locationText = (formData.get('location_text') as string)?.trim() || null;
  const businessIdsRaw = (formData.get('business_ids') as string)?.trim();
  const updateCategoryId = (formData.get('category_id') as string)?.trim() || null;

  if (!content && !title) {
    return { error: '请输入标题或内容' };
  }

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const coverImages = coverImagesRaw
    ? JSON.parse(coverImagesRaw) as string[]
    : [];

  const businessIds = businessIdsRaw
    ? JSON.parse(businessIdsRaw) as string[]
    : [];

  const textModeration = await moderateDiscoverPost(title || '', content || '');
  const rawModerationSetting = await getSiteSetting(site.id, 'moderation').catch(() => null);
  const mediaModerationConfig = normalizeDiscoverMediaModerationConfig(rawModerationSetting);
  const mediaModeration = await moderateDiscoverMediaAssets({
    imageUrls: coverImages,
    videoThumbnailUrl,
    config: mediaModerationConfig,
  });
  const needsFullVideoScan = Boolean(
    post.post_type === 'video' &&
    videoUrl &&
    mediaModerationConfig.enabled &&
    mediaModerationConfig.moderateFullVideo,
  );
  // Don't block publish just because thumbnail is missing — text moderation is sufficient
  const videoNeedsManualReview = false;
  const moderationReasons: string[] = [];
  if (!textModeration.pass) moderationReasons.push(textModeration.reason || '文本疑似不合规');
  if (!mediaModeration.pass) moderationReasons.push(mediaModeration.reason || '媒体疑似不合规');
  if (videoNeedsManualReview) moderationReasons.push('视频缺少可审核封面，需人工审核');
  if (needsFullVideoScan && moderationReasons.length === 0) moderationReasons.push('视频内容审核中');
  const moderationReason = moderationReasons.length > 0 ? moderationReasons.join('；') : null;
  const moderationScore = Math.max(textModeration.score || 0, mediaModeration.score || 0);
  const mediaForMeta: MediaModerationResult = {
    ...mediaModeration,
    pass: mediaModeration.pass && !videoNeedsManualReview,
    reason: videoNeedsManualReview
      ? [mediaModeration.reason, '视频缺少可审核封面，需人工审核'].filter(Boolean).join('；')
      : mediaModeration.reason,
  };
  const moderationMetadata = buildModerationMetadata({
    previousMetadata: post.metadata,
    text: {
      pass: textModeration.pass,
      score: textModeration.score,
      reason: textModeration.reason,
    },
    media: mediaForMeta,
    fullVideoScanEnabled: needsFullVideoScan,
  });
  const nextStatus = moderationReasons.length > 0
    ? 'pending_review'
    : post.status === 'published'
      ? 'published'
      : 'pending_review';

  // Update post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_posts')
    .update({
      title: title || null,
      content: content || '',
      topic_tags: tags,
      cover_images: coverImages.length > 0 ? coverImages : null,
      cover_image_url: coverImages[0] || videoThumbnailUrl || null,
      video_url: videoUrl,
      video_thumbnail_url: videoThumbnailUrl,
      location_text: locationText,
      category_id: updateCategoryId,
      ai_spam_score: moderationScore,
      moderation_reason: moderationReason,
      status: nextStatus,
      metadata: moderationMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) return { error: '更新失败：' + error.message };

  if (needsFullVideoScan && videoUrl) {
    const start = await startDiscoverVideoModerationJob({
      postId,
      siteId: site.id,
      videoUrl,
      config: {
        enabled: mediaModerationConfig.enabled,
        moderateFullVideo: mediaModerationConfig.moderateFullVideo,
        minConfidence: mediaModerationConfig.minConfidence,
        blockConfidence: mediaModerationConfig.blockConfidence,
      },
    });
    let nextReason = moderationReason;
    const videoMeta: Record<string, unknown> = start.started
      ? {
          provider: start.provider,
          job_id: start.jobId,
          job_status: 'IN_PROGRESS',
          started_at: start.startedAt,
          checked_at: null,
          checked_targets: 0,
          pass: null,
          score: 0,
          reason: null,
          bucket: start.bucket,
          object_key: start.objectKey,
        }
      : {
          provider: start.provider,
          job_id: null,
          job_status: 'FAILED_TO_START',
          started_at: null,
          checked_at: null,
          checked_targets: 0,
          pass: false,
          score: 1,
          reason: start.reason || '视频审核未启动，需人工审核',
          bucket: start.bucket,
          object_key: start.objectKey,
        };
    if (!start.started) {
      nextReason = [nextReason, start.reason || '视频审核未启动，需人工审核'].filter(Boolean).join('；');
    }
    await (supabase as any)
      .from('voice_posts')
      .update({
        metadata: withVideoModerationMeta(moderationMetadata, videoMeta),
        moderation_reason: nextReason,
        status: 'pending_review',
      })
      .eq('id', postId)
      .eq('site_id', site.id);
  }

  // Update linked businesses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('discover_post_businesses').delete().eq('post_id', postId);
  if (businessIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('discover_post_businesses').insert(
      businessIds.map((bizId, idx) => ({ post_id: postId, business_id: bizId, sort_order: idx }))
    );
  }

  revalidatePath(`/discover/${post.slug}`);
  revalidatePath('/discover');
  return { success: true, slug: post.slug };
}

// ─── Follow / Unfollow ────────────────────────────────────────────────

export async function toggleFollow(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const profileId = formData.get('profile_id') as string;
  if (!profileId || profileId === user.id) return { error: '无效操作' };

  const supabase = createAdminClient();

  // Check if already following
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('follows')
    .select('id')
    .eq('follower_user_id', user.id)
    .eq('followed_profile_id', profileId)
    .single();

  if (existing) {
    // Unfollow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('follows')
      .delete()
      .eq('follower_user_id', user.id)
      .eq('followed_profile_id', profileId);
    return { success: true, following: false };
  } else {
    // Follow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('follows')
      .insert({ follower_user_id: user.id, followed_profile_id: profileId });
    return { success: true, following: true };
  }
}

// ─── Like Voice Post ──────────────────────────────────────────────────

export async function toggleLike(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  if (!postId) return { error: '无效操作' };

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('voice_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('voice_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);
    return { success: true, liked: false };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('voice_post_likes')
      .insert({ post_id: postId, user_id: user.id });
    return { success: true, liked: true };
  }
}

// ─── Comment on Voice Post ────────────────────────────────────────────

export async function createVoiceComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  const content = (formData.get('content') as string)?.trim();

  if (!postId || !content) return { error: '请输入评论内容' };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_post_comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      site_id: site.id,
      content,
      status: 'approved',
    });

  if (error) return { error: '评论失败：' + error.message };

  revalidatePath('/voices');
  return { success: true };
}

// ─── Lead Capture Form ────────────────────────────────────────────────

export async function submitLead(formData: FormData) {
  const businessId = formData.get('business_id') as string;
  const sourceType = (formData.get('source_type') as string) || 'business_page';
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!name && !email && !phone) {
    return { error: '请至少填写一种联系方式' };
  }

  const user = await getCurrentUser().catch(() => null);
  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('leads')
    .insert({
      business_id: businessId || null,
      source_type: sourceType,
      site_id: site.id,
      source_article_id: formData.get('source_article_id') || null,
      user_id: user?.id || null,
      contact_name: name || null,
      contact_email: email || null,
      contact_phone: phone || null,
      message: message || null,
      preferred_contact: phone ? 'phone' : email ? 'email' : 'phone',
      status: 'new',
    });

  if (error) return { error: '提交失败，请稍后重试' };

  return { success: true, message: '提交成功！商家将尽快与您联系。' };
}
