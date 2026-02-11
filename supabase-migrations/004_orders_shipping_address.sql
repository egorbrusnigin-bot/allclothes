-- Добавляем поле shipping_address в таблицу orders
-- Хранит JSON с адресом доставки: fullName, address, city, postalCode, country
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
