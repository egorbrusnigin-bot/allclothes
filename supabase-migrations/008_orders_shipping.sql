-- Поля для shipping label и трекинга
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_level TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shippo_transaction_id TEXT;
