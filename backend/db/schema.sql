CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'staff', 'kitchen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin', 'staff', 'kitchen'));

CREATE TABLE IF NOT EXISTS restaurant_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL DEFAULT 'The Green Table',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  table_count INTEGER NOT NULL DEFAULT 24 CHECK (table_count BETWEEN 1 AND 200),
  upi_id TEXT NOT NULL DEFAULT 'your-restaurant@upi',
  upi_name TEXT NOT NULL DEFAULT 'The Green Table',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  customer_name TEXT NOT NULL DEFAULT 'Guest',
  customer_email TEXT,
  customer_phone TEXT,
  tracking_token_hash TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  kitchen_sent_at TIMESTAMPTZ,
  prep_minutes INTEGER,
  prep_started_at TIMESTAMPTZ,
  table_number INTEGER NOT NULL CHECK (table_number > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'prepared', 'ready', 'unavailable', 'served', 'all_done', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'counter',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_minutes INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
UPDATE orders o SET customer_name=u.name, customer_email=u.email, customer_phone=u.phone FROM users u WHERE o.user_id=u.id AND o.customer_name IS NULL;
ALTER TABLE orders ALTER COLUMN customer_name SET DEFAULT 'Guest';
ALTER TABLE orders ALTER COLUMN customer_name SET NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'counter';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'preparing', 'prepared', 'ready', 'unavailable', 'served', 'all_done', 'cancelled'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_prep_minutes_check;
ALTER TABLE orders ADD CONSTRAINT orders_prep_minutes_check CHECK (prep_minutes IS NULL OR prep_minutes IN (5, 10, 15, 20));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('counter','upi','card','online','netbanking','wallet'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_hash ON orders(tracking_token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_active_table ON orders(table_number) WHERE status NOT IN ('all_done','cancelled');
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_queue ON orders(kitchen_sent_at, created_at) WHERE kitchen_sent_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS waiter_alerts (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waiter_alerts_open_order ON waiter_alerts(order_id) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_waiter_alerts_open ON waiter_alerts(created_at) WHERE acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS order_reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
