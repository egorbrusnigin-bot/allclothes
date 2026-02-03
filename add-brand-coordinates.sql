-- Добавление координат для брендов
-- Вена, Австрия: 48.2082, 16.3738

UPDATE brands
SET
  latitude = 48.2082,
  longitude = 16.3738
WHERE
  (city ILIKE '%vienna%' OR city ILIKE '%wien%' OR city ILIKE '%вена%')
  AND latitude IS NULL;

-- Проверка результатов
SELECT id, name, city, country, latitude, longitude
FROM brands
WHERE latitude IS NOT NULL;
