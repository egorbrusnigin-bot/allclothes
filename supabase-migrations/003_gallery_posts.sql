-- Gallery posts table for brand lookbooks and photos
CREATE TABLE IF NOT EXISTS gallery_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_gallery_posts_brand_id ON gallery_posts(brand_id);
CREATE INDEX idx_gallery_posts_status ON gallery_posts(status);

-- RLS
ALTER TABLE gallery_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved posts
CREATE POLICY "gallery_posts_select_approved" ON gallery_posts
  FOR SELECT USING (status = 'approved');

-- Brand owners can view all their own posts (any status)
CREATE POLICY "gallery_posts_select_own" ON gallery_posts
  FOR SELECT USING (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));

-- Brand owners can insert posts for their brand
CREATE POLICY "gallery_posts_insert_own" ON gallery_posts
  FOR INSERT WITH CHECK (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));

-- Brand owners can update their own posts
CREATE POLICY "gallery_posts_update_own" ON gallery_posts
  FOR UPDATE USING (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));

-- Brand owners can delete their own posts
CREATE POLICY "gallery_posts_delete_own" ON gallery_posts
  FOR DELETE USING (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));

-- Админы используют service role key (supabaseAdmin), который обходит RLS
