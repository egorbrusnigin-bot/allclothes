-- Добавляем недостающие колонки в order_items
-- image_url — ссылка на фото товара (раньше был product_image, но код использует image_url)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- Копируем данные из product_image в image_url если product_image существует
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_image'
  ) THEN
    UPDATE order_items SET image_url = product_image WHERE image_url IS NULL AND product_image IS NOT NULL;
  END IF;
END $$;
