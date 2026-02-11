-- Add link_url column to gallery_posts for external links
ALTER TABLE gallery_posts ADD COLUMN IF NOT EXISTS link_url TEXT;
