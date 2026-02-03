-- ===========================================================
-- ТЕСТОВЫЙ ЗАКАЗ
-- ===========================================================

-- ── ШАГ 1: сначала запуска это, чтобы найти свой user_id ──
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- ── ШАГ 2: скопируй свой id сверху и замени 'PASTE_YOUR_USER_ID_HERE'
--           потом запуска блок ниже ────────────────────────────────────

WITH picked AS (
  SELECT
    p.id            AS product_id,
    p.name          AS product_name,
    p.price         AS price,
    p.currency      AS currency,
    b.name          AS brand_name,
    ps.size         AS size,
    pi.image_url    AS image_url
  FROM products p
  JOIN brands b          ON b.id = p.brand_id
  JOIN product_sizes ps  ON ps.product_id = p.id AND ps.in_stock = true
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = true
  WHERE p.status = 'approved'
  LIMIT 1
),
new_order AS (
  INSERT INTO orders (user_id, status, total, currency)
  SELECT '69111009-9871-426a-a418-0999b458d927'::UUID, 'delivered', price, currency
  FROM picked
  RETURNING *
)
INSERT INTO order_items (order_id, product_id, product_name, brand_name, price, currency, size, quantity, image_url)
SELECT
  no.id,
  picked.product_id,
  picked.product_name,
  picked.brand_name,
  picked.price,
  picked.currency,
  picked.size,
  1,
  picked.image_url
FROM new_order no, picked
RETURNING *;

-- ── ШАГ 3: проверка ────────────────────────────────────────
SELECT
  o.order_number,
  o.status,
  o.total,
  o.currency,
  o.user_id,
  oi.product_name,
  oi.brand_name,
  oi.size,
  oi.image_url
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC;
