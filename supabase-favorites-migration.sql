-- ================================================
-- FAVORITES SYSTEM MIGRATION
-- ================================================
-- This migration adds the favorites/likes system
-- Run this in Supabase SQL Editor or via CLI
-- ================================================

-- ====================
-- USER FAVORITES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Ensure a user can only favorite a product once
  UNIQUE(user_id, product_id)
);

-- ====================
-- CREATE INDEXES
-- ====================
-- Fast lookup for user's favorites
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id
  ON user_favorites(user_id);

-- Fast lookup for favorite status check
CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id
  ON user_favorites(product_id);

-- Efficient sorting by recently added
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at
  ON user_favorites(created_at DESC);

-- Composite index for frequent query pattern
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_product
  ON user_favorites(user_id, product_id);

-- ====================
-- ENABLE ROW LEVEL SECURITY
-- ====================
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- ====================
-- RLS POLICIES
-- ====================
-- Users can view only their own favorites
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add products to their own favorites
CREATE POLICY "Users can add to own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove products from their own favorites
CREATE POLICY "Users can remove from own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all favorites (for analytics/moderation)
CREATE POLICY "Admins can view all favorites"
  ON user_favorites FOR SELECT
  USING (is_admin());

-- ====================
-- VERIFICATION QUERIES
-- ====================
-- Run these to verify the migration succeeded

-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_favorites'
) as table_exists;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_favorites';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_favorites';

-- Check policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'user_favorites';
