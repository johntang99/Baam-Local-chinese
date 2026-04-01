'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> extends infer T ? T : any;

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

  // Get board slug for redirect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: board } = await (supabase as any)
    .from('categories')
    .select('slug')
    .eq('id', boardId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread, error } = await (supabase as any)
    .from('forum_threads')
    .insert({
      slug,
      title,
      title_zh: title,
      body,
      board_id: boardId,
      author_id: user.id,
      author_name: user.displayName,
      region_id: user.regionId,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('forum_replies')
    .insert({
      thread_id: threadId,
      author_id: user.id,
      author_name: user.displayName,
      body,
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
    .eq('id', threadId);

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

  if (!content && !title) {
    return { error: '请输入标题或内容' };
  }

  const slug = (title || content?.slice(0, 30) || '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const coverImages = coverImagesRaw
    ? JSON.parse(coverImagesRaw) as string[]
    : [];

  const businessIds = businessIdsRaw
    ? JSON.parse(businessIdsRaw) as string[]
    : [];

  const supabase = createAdminClient();

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
      status: 'published',
      published_at: new Date().toISOString(),
      region_id: user.regionId,
      language: 'zh',
      topic_tags: tags,
      cover_images: coverImages.length > 0 ? coverImages : null,
      cover_image_url: coverImages[0] || videoThumbnailUrl || null,
      video_url: videoUrl,
      video_thumbnail_url: videoThumbnailUrl,
      video_duration_seconds: videoDuration,
      location_text: locationText,
      aspect_ratio: postType === 'video' ? '16:9' : '4:3',
    })
    .select('id, slug')
    .single();

  if (error) {
    return { error: '发布失败：' + error.message };
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
  return { success: true, redirect: `/discover/${post?.slug}` };
}

// ─── Discover: Search Businesses (for business linker) ──

export async function searchBusinesses(query: string) {
  if (!query || query.length < 1) return { businesses: [] };

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('businesses')
    .select('id, slug, display_name, display_name_zh, short_desc_zh, address_line1')
    .or(`display_name.ilike.%${query}%,display_name_zh.ilike.%${query}%`)
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

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (supabase as any)
    .from('voice_posts')
    .select('id, author_id')
    .eq('id', postId)
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
    .eq('id', postId);

  if (error) return { error: '删除失败：' + error.message };

  revalidatePath('/discover');
  return { success: true };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_post_comments')
    .insert({
      post_id: postId,
      author_id: user.id,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('leads')
    .insert({
      business_id: businessId || null,
      source_type: sourceType,
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
