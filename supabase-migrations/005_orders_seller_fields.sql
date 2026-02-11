-- Добавляем поля для связи заказа с продавцом и отображения в Seller Dashboard
ALTER TABLE orders ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount INTEGER; -- сумма в центах
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT; -- JSON адрес доставки
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Добавляем product_image в order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_image TEXT;
