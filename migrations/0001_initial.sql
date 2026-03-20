CREATE TABLE IF NOT EXISTS apartments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building_id TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  ical_url TEXT,
  is_external INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cleaners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cleaner_availability (
  id TEXT PRIMARY KEY,
  cleaner_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'off')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cleaner_id, date),
  FOREIGN KEY (cleaner_id) REFERENCES cleaners(id)
);

CREATE TABLE IF NOT EXISTS distance_matrix (
  from_apartment_id TEXT NOT NULL,
  to_apartment_id TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  PRIMARY KEY (from_apartment_id, to_apartment_id),
  FOREIGN KEY (from_apartment_id) REFERENCES apartments(id),
  FOREIGN KEY (to_apartment_id) REFERENCES apartments(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  apartment_id TEXT NOT NULL,
  source TEXT NOT NULL,
  external_ref TEXT,
  guest_name TEXT,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL,
  raw_ical_uid TEXT,
  raw_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(apartment_id, raw_hash),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id)
);

CREATE TABLE IF NOT EXISTS manual_clean_requests (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  apartment_id TEXT,
  task_date TEXT,
  weekday INTEGER,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id)
);

CREATE TABLE IF NOT EXISTS clean_tasks (
  id TEXT PRIMARY KEY,
  apartment_id TEXT,
  task_date TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('checkout_clean', 'external_clean', 'midstay_review')),
  source_booking_id TEXT,
  source_manual_request_id TEXT,
  requires_review INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id),
  FOREIGN KEY (source_booking_id) REFERENCES bookings(id),
  FOREIGN KEY (source_manual_request_id) REFERENCES manual_clean_requests(id)
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'needs_review')),
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  id TEXT PRIMARY KEY,
  schedule_run_id TEXT NOT NULL,
  clean_task_id TEXT NOT NULL,
  apartment_id TEXT,
  task_date TEXT NOT NULL,
  cleaner_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual', 'approved_patch')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_run_id) REFERENCES schedule_runs(id),
  FOREIGN KEY (clean_task_id) REFERENCES clean_tasks(id),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id),
  FOREIGN KEY (cleaner_id) REFERENCES cleaners(id)
);

CREATE TABLE IF NOT EXISTS schedule_change_sets (
  id TEXT PRIMARY KEY,
  schedule_run_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ical', 'chat')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY (schedule_run_id) REFERENCES schedule_runs(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
