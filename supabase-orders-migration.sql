-- ===========================================================
-- ORDERS MIGRATION — MAXIMUM SECURITY
-- Запустить в Supabase SQL Editor
-- ===========================================================

-- ── 1. Sequence для автогенерации номера заказа ────────────
CREATE SEQUENCE IF NOT EXISTS orders_number_seq
  START WITH 7000
  INCREMENT BY 1;

-- ── 2. Таблица заказов ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID          DEFAULT gen_random_uuid()                  PRIMARY KEY,
  user_id          UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number     TEXT          UNIQUE NOT NULL DEFAULT CAST(nextval('orders_number_seq') AS TEXT),
  status           TEXT          NOT NULL DEFAULT 'pending',
  total            DECIMAL(12,2) NOT NULL,
  currency         TEXT          NOT NULL DEFAULT 'EUR',
  shipping_address JSONB,
  notes            TEXT,
  created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,

  -- CHECK: допустимые статусы
  CONSTRAINT chk_orders_status   CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  -- CHECK: сумма >= 0
  CONSTRAINT chk_orders_total    CHECK (total >= 0),
  -- CHECK: валюта из белого списка
  CONSTRAINT chk_orders_currency CHECK (currency IN ('EUR', 'USD', 'GBP', 'CHF'))
);

-- ── 3. Товары внутри заказа (снэпшот цены/названия — неизменяемы) ──
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID          REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id    UUID          REFERENCES products(id) ON DELETE SET NULL,   -- NULL если товар удалён
  -- снэпшоты в момент оформления (нельзя изменить retroactively)
  product_name  TEXT          NOT NULL,
  brand_name    TEXT          NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  currency      TEXT          NOT NULL DEFAULT 'EUR',
  size          TEXT          NOT NULL,
  quantity      INTEGER       NOT NULL DEFAULT 1,
  image_url     TEXT,
  created_at    TIMESTAMPTZ   DEFAULT now() NOT NULL,

  CONSTRAINT chk_item_price CHECK (price >= 0),
  CONSTRAINT chk_item_qty   CHECK (quantity > 0)
);

-- ── 4. Audit-лог (append-only; пишет только триггер) ────────
CREATE TABLE IF NOT EXISTS order_audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    UUID        REFERENCES orders(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  old_data    JSONB,
  new_data    JSONB,
  actor_id    UUID,                -- auth.uid(); NULL = service role / система
  changed_at  TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT chk_audit_action CHECK (action IN ('created', 'updated', 'status_changed', 'deleted'))
);

-- ── 5. Индексы ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number         ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product   ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_order_id        ON order_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at      ON order_audit_log(changed_at DESC);

-- ── 6. Enable RLS ───────────────────────────────────────────
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_audit_log ENABLE ROW LEVEL SECURITY;

-- ── 7. SECURITY DEFINER helper ──────────────────────────────
-- Проверяет принадлежность заказа текущему пользователю.
-- SECURITY DEFINER чтобы не попадать под RLS таблицы orders
-- при использовании в политиках order_items / audit_log.
CREATE OR REPLACE FUNCTION order_belongs_to_current_user(p_order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM orders WHERE id = p_order_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION order_belongs_to_current_user TO anon, authenticated;

-- ── 8. RLS — orders ─────────────────────────────────────────
-- SELECT: юзер видит только свои заказы
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: админ видит всё
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (is_admin());

-- INSERT / UPDATE / DELETE: только админ.
-- Обычные пользователи не могут создавать/менять заказы клиентски.
-- Заказы создаются сервером через service_role.
CREATE POLICY "Admins can create orders"
  ON orders FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (is_admin());

-- ── 9. RLS — order_items ────────────────────────────────────
-- SELECT: юзер видит товары только своих заказов
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (order_belongs_to_current_user(order_id));

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  USING (is_admin());

-- INSERT: только админ / service_role
CREATE POLICY "Admins can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE / DELETE: нет политик → items неизменяемы после создания.

-- ── 10. RLS — audit log ─────────────────────────────────────
-- SELECT: юзер видит лог только своих заказов
CREATE POLICY "Users can view own order audit"
  ON order_audit_log FOR SELECT
  USING (order_belongs_to_current_user(order_id));

CREATE POLICY "Admins can view all audit logs"
  ON order_audit_log FOR SELECT
  USING (is_admin());

-- INSERT / UPDATE / DELETE: нет политик.
-- Единственный way в таблицу — через SECURITY DEFINER триггер ниже.

-- ── 11. Триггер: auto updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION orders_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_set_updated_at();

-- ── 12. Триггер: защита неизменяемых полей orders ──────────
-- Даже админ не может менять total, currency, user_id, order_number
-- после создания заказа. Допустимы изменения: status, notes, shipping_address.
CREATE OR REPLACE FUNCTION orders_protect_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'order_number is immutable after creation';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable after creation';
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    RAISE EXCEPTION 'total is immutable after creation';
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'currency is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_protect ON orders;
CREATE TRIGGER trg_orders_protect
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_protect_immutable_fields();

-- ── 13. Триггер: audit log (SECURITY DEFINER) ──────────────
-- Логирует каждый INSERT / UPDATE / DELETE в orders.
-- SECURITY DEFINER → пишет в audit_log даже при RLS без INSERT-policy.
CREATE OR REPLACE FUNCTION orders_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_audit_log (order_id, action, new_data, actor_id)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO order_audit_log (order_id, action, old_data, new_data, actor_id)
    VALUES (
      NEW.id,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed' ELSE 'updated' END,
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO order_audit_log (order_id, action, old_data, actor_id)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_orders_audit ON orders;
CREATE TRIGGER trg_orders_audit
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_audit_trigger();

-- ── 14. Верификация ─────────────────────────────────────────
-- Запустить после миграции для проверки:

SELECT 'TABLE' AS type, tablename AS name
FROM pg_tables
WHERE tablename IN ('orders', 'order_items', 'order_audit_log')
  AND schemaname = 'public';

SELECT 'POLICY' AS type, policyname AS name, tablename, cmd
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'order_audit_log');

SELECT 'TRIGGER' AS type, trigger_name AS name, event_object_table AS "table", event_manipulation AS event_type
FROM information_schema.triggers
WHERE event_object_table IN ('orders')
  AND trigger_schema = 'public';
