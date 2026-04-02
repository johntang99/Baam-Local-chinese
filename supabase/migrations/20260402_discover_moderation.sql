-- Add moderation columns to voice_posts
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS ai_spam_score FLOAT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- Index for admin review queue
CREATE INDEX IF NOT EXISTS idx_voice_posts_pending_review
  ON voice_posts(status, created_at DESC)
  WHERE status = 'pending_review';
