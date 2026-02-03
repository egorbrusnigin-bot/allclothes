-- Добавляем колонку status к таблице brands, если её нет
-- (колонка была в миграции, но не была создана в БД)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brands' AND column_name = 'status'
    ) THEN
        ALTER TABLE brands ADD COLUMN status TEXT DEFAULT 'approved';
    END IF;
END $$;

-- Все существующие бренды помечаем как approved
UPDATE brands SET status = 'approved' WHERE status IS NULL;

-- Проверка: покажем все бренды и их статусы
SELECT id, name, status FROM brands;
