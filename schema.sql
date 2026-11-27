CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'operator')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_access_requests (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    requested_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS menu_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS menu_addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL DEFAULT '',
    product_id TEXT NOT NULL REFERENCES menu_products(id),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 30),
    customizations TEXT NOT NULL DEFAULT '[]',
    addon_ids TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    fulfillment TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'cash', 'card')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending')),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'preparing', 'ready', 'delivering', 'completed')),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    estimated_ready_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (fulfillment <> 'delivery' OR length(trim(delivery_address)) > 0)
);

CREATE INDEX IF NOT EXISTS orders_customer_created_at_idx ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON orders (status, created_at);
