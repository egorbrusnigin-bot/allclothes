-- Brand Analytics Table
-- Run this in Supabase SQL Editor

-- Add analytics columns to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS product_views INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS total_favorites INTEGER DEFAULT 0;

-- Create brand_analytics table for detailed tracking
CREATE TABLE IF NOT EXISTS brand_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'product_view', 'favorite', 'order', 'sale'
  amount DECIMAL(10,2) DEFAULT 0, -- For sales/orders
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_brand_analytics_brand_id ON brand_analytics(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_analytics_event_type ON brand_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_brand_analytics_created_at ON brand_analytics(created_at);

-- Create brand_daily_stats table for aggregated daily stats
CREATE TABLE IF NOT EXISTS brand_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  page_views INTEGER DEFAULT 0,
  product_views INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  sales DECIMAL(10,2) DEFAULT 0,
  UNIQUE(brand_id, date)
);

CREATE INDEX IF NOT EXISTS idx_brand_daily_stats_brand_date ON brand_daily_stats(brand_id, date);

-- Function to update brand totals
CREATE OR REPLACE FUNCTION update_brand_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'page_view' THEN
    UPDATE brands SET page_views = page_views + 1 WHERE id = NEW.brand_id;
  ELSIF NEW.event_type = 'product_view' THEN
    UPDATE brands SET product_views = product_views + 1 WHERE id = NEW.brand_id;
  ELSIF NEW.event_type = 'favorite' THEN
    UPDATE brands SET total_favorites = total_favorites + 1 WHERE id = NEW.brand_id;
  ELSIF NEW.event_type = 'order' THEN
    UPDATE brands SET total_orders = total_orders + 1 WHERE id = NEW.brand_id;
  ELSIF NEW.event_type = 'sale' THEN
    UPDATE brands
    SET total_sales = total_sales + 1,
        balance = balance + NEW.amount
    WHERE id = NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_brand_analytics_insert ON brand_analytics;
CREATE TRIGGER on_brand_analytics_insert
AFTER INSERT ON brand_analytics
FOR EACH ROW EXECUTE FUNCTION update_brand_totals();

-- Enable RLS
ALTER TABLE brand_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_daily_stats ENABLE ROW LEVEL SECURITY;

-- Policies for brand_analytics
CREATE POLICY "Anyone can insert analytics" ON brand_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Brand owners can view their analytics" ON brand_analytics FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));

-- Policies for brand_daily_stats
CREATE POLICY "Brand owners can view their stats" ON brand_daily_stats FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE owner_id = auth.uid()));
