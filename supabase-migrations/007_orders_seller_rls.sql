-- Разрешаем продавцам видеть заказы по их брендам
-- (Дополнительная RLS policy — основной доступ через API с service role)

-- Policy: продавцы могут SELECT заказы, где brand_id принадлежит их бренду
CREATE POLICY "sellers_view_brand_orders" ON orders
  FOR SELECT USING (
    brand_id IN (
      SELECT id FROM brands WHERE owner_id = auth.uid()
    )
  );

-- Policy: продавцы могут видеть order_items для заказов их брендов
CREATE POLICY "sellers_view_brand_order_items" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE brand_id IN (
        SELECT id FROM brands WHERE owner_id = auth.uid()
      )
    )
  );
