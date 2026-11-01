PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Car', 'Bike', 'Scooter')),
  location TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  rating REAL NOT NULL DEFAULT 5 CHECK (rating >= 0 AND rating <= 5),
  trips INTEGER NOT NULL DEFAULT 0 CHECK (trips >= 0),
  tag TEXT NOT NULL DEFAULT 'NEW LISTING',
  image TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_name TEXT NOT NULL,
  pickup_date TEXT NOT NULL,
  return_date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS bookings_vehicle_dates
  ON bookings(vehicle_id, pickup_date, return_date);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry
  ON admin_sessions(expires_at);
