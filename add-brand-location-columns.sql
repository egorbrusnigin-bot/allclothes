-- Добавление колонок для локации брендов на карте

-- Добавляем колонки
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_brands_location ON brands(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Добавляем координаты для существующих брендов (пример - Вена)
-- Можно обновить вручную для каждого бренда

-- Проверка
SELECT id, name, country, city, latitude, longitude
FROM brands
ORDER BY created_at DESC;
