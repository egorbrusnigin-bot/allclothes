-- ====================
-- PROFILES TABLE (USER ROLES)
-- ====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'seller', 'admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================
-- BRANDS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  description TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================
-- PRODUCTS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  category TEXT, -- hoodie, t-shirt, pants, jacket, etc.
  description TEXT,
  details TEXT, -- JSON or text with details like "460 GSM Heavy Weight"
  model_info TEXT, -- model information "The model is 185cm tall and wears size XL"
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================
-- PRODUCT IMAGES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_main BOOLEAN DEFAULT false, -- main product photo
  display_order INTEGER DEFAULT 0, -- display order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================
-- PRODUCT SIZES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS product_sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL, -- S, M, L, XL, XXL
  in_stock BOOLEAN DEFAULT true,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================
-- ENABLE ROW LEVEL SECURITY
-- ====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

-- ====================
-- ADMIN CHECK FUNCTION
-- ====================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================
-- DROP OLD POLICIES (if they exist)
-- ====================
DROP POLICY IF EXISTS "Все могут просматривать бренды" ON brands;
DROP POLICY IF EXISTS "Все могут добавлять бренды" ON brands;
DROP POLICY IF EXISTS "Все могут обновлять бренды" ON brands;
DROP POLICY IF EXISTS "Все могут удалять бренды" ON brands;
DROP POLICY IF EXISTS "Все могут просматривать товары" ON products;
DROP POLICY IF EXISTS "Все могут добавлять товары" ON products;
DROP POLICY IF EXISTS "Все могут обновлять товары" ON products;
DROP POLICY IF EXISTS "Все могут удалять товары" ON products;
DROP POLICY IF EXISTS "Все могут просматривать фото товаров" ON product_images;
DROP POLICY IF EXISTS "Все могут добавлять фото товаров" ON product_images;
DROP POLICY IF EXISTS "Все могут обновлять фото товаров" ON product_images;
DROP POLICY IF EXISTS "Все могут удалять фото товаров" ON product_images;
DROP POLICY IF EXISTS "Все могут просматривать размеры" ON product_sizes;
DROP POLICY IF EXISTS "Все могут добавлять размеры" ON product_sizes;
DROP POLICY IF EXISTS "Все могут обновлять размеры" ON product_sizes;
DROP POLICY IF EXISTS "Все могут удалять размеры" ON product_sizes;

-- ====================
-- PROFILES POLICIES
-- ====================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- ====================
-- BRANDS POLICIES
-- ====================
-- Public: can view only approved brands
CREATE POLICY "Public can view approved brands"
  ON brands FOR SELECT
  USING (status = 'approved');

-- Sellers: can view own brands (any status)
CREATE POLICY "Sellers can view own brands"
  ON brands FOR SELECT
  USING (auth.uid() = owner_id);

-- Sellers: can create own brands
CREATE POLICY "Sellers can create brands"
  ON brands FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Sellers: can update own brands
CREATE POLICY "Sellers can update own brands"
  ON brands FOR UPDATE
  USING (auth.uid() = owner_id);

-- Sellers: can delete own brands
CREATE POLICY "Sellers can delete own brands"
  ON brands FOR DELETE
  USING (auth.uid() = owner_id);

-- Admins: can view all brands
CREATE POLICY "Admins can view all brands"
  ON brands FOR SELECT
  USING (is_admin());

-- Admins: can update any brand status
CREATE POLICY "Admins can update brand status"
  ON brands FOR UPDATE
  USING (is_admin());

-- ====================
-- PRODUCTS POLICIES
-- ====================
-- Public: can view only approved products from approved brands
CREATE POLICY "Public can view approved products"
  ON products FOR SELECT
  USING (
    status = 'approved' AND
    EXISTS (
      SELECT 1 FROM brands
      WHERE brands.id = products.brand_id
      AND brands.status = 'approved'
    )
  );

-- Sellers: can view own products (any status)
CREATE POLICY "Sellers can view own products"
  ON products FOR SELECT
  USING (auth.uid() = owner_id);

-- Sellers: can create own products
CREATE POLICY "Sellers can create products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Sellers: can update own products
CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  USING (auth.uid() = owner_id);

-- Sellers: can delete own products
CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  USING (auth.uid() = owner_id);

-- Admins: can view all products
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  USING (is_admin());

-- Admins: can update any product (for approval/rejection)
CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  USING (is_admin());

-- ====================
-- PRODUCT IMAGES POLICIES
-- ====================
-- Public: can view images of approved products
CREATE POLICY "Public can view approved product images"
  ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.status = 'approved'
    )
  );

-- Sellers: can view images of own products
CREATE POLICY "Sellers can view own product images"
  ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can insert images for own products
CREATE POLICY "Sellers can add images to own products"
  ON product_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can update images of own products
CREATE POLICY "Sellers can update own product images"
  ON product_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can delete images of own products
CREATE POLICY "Sellers can delete own product images"
  ON product_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Admins: can view all product images
CREATE POLICY "Admins can view all product images"
  ON product_images FOR SELECT
  USING (is_admin());

-- ====================
-- PRODUCT SIZES POLICIES
-- ====================
-- Public: can view sizes of approved products
CREATE POLICY "Public can view approved product sizes"
  ON product_sizes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_sizes.product_id
      AND products.status = 'approved'
    )
  );

-- Sellers: can view sizes of own products
CREATE POLICY "Sellers can view own product sizes"
  ON product_sizes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_sizes.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can add sizes to own products
CREATE POLICY "Sellers can add sizes to own products"
  ON product_sizes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_sizes.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can update sizes of own products
CREATE POLICY "Sellers can update own product sizes"
  ON product_sizes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_sizes.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Sellers: can delete sizes of own products
CREATE POLICY "Sellers can delete own product sizes"
  ON product_sizes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_sizes.product_id
      AND products.owner_id = auth.uid()
    )
  );

-- Admins: can view all product sizes
CREATE POLICY "Admins can view all product sizes"
  ON product_sizes FOR SELECT
  USING (is_admin());

-- ====================
-- СОЗДАЕМ STORAGE BUCKETS
-- ====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-logos', 'brand-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- ====================
-- STORAGE POLICIES
-- ====================
-- Drop old storage policies
DROP POLICY IF EXISTS "Все могут загружать логотипы брендов" ON storage.objects;
DROP POLICY IF EXISTS "Все могут просматривать логотипы брендов" ON storage.objects;
DROP POLICY IF EXISTS "Все могут удалять логотипы брендов" ON storage.objects;
DROP POLICY IF EXISTS "Все могут загружать фото товаров" ON storage.objects;
DROP POLICY IF EXISTS "Все могут просматривать фото товаров" ON storage.objects;
DROP POLICY IF EXISTS "Все могут удалять фото товаров" ON storage.objects;

-- Brand logos storage policies
CREATE POLICY "Authenticated users can upload brand logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view brand logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-logos');

CREATE POLICY "Users can delete own brand logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Product images storage policies
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ====================
-- SELLERS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS sellers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  seller_type TEXT, -- 'brand', 'store', 'creator'
  contact_email TEXT,
  shopify_link TEXT,
  telegram TEXT,
  instagram TEXT,
  paypal_email TEXT,
  legal_name TEXT,
  status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Enable ROW LEVEL SECURITY
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- ====================
-- SELLERS POLICIES
-- ====================
CREATE POLICY "Users can view own seller profile"
  ON sellers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own seller profile"
  ON sellers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seller profile"
  ON sellers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sellers"
  ON sellers FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update seller status"
  ON sellers FOR UPDATE
  USING (is_admin());
