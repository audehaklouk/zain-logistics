export function createTables(db) {
  db.exec(`
    -- Users (kept compatible with JWT auth; Phase 6 migrates to sessions)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'team',
      is_active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      backup_codes TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sessions (Phase 6 — created now for schema completeness)
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_active TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Login History (Phase 6)
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL,
      failure_reason TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      country TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      containers TEXT NOT NULL DEFAULT '[]',
      destination TEXT NOT NULL,
      destination_custom TEXT,
      bank TEXT,
      amount REAL,
      currency TEXT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      shipping_tracking_number TEXT,
      expected_arrival TEXT,
      shipping_line TEXT,
      shipping_line_custom TEXT,
      shipping_data TEXT,
      tracking_source TEXT DEFAULT 'manual',
      original_docs_received INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      product_name TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Documents (supplier-based, invoice-searchable)
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      order_id INTEGER REFERENCES orders(id),
      invoice_number TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      upload_date TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_documents_supplier ON documents(supplier_id);

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      delivery_date TEXT NOT NULL,
      amount REAL,
      currency TEXT,
      payment_date TEXT NOT NULL,
      payment_term TEXT,
      status TEXT DEFAULT 'not_transferred',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Claims
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      dn_number TEXT UNIQUE NOT NULL,
      brand TEXT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      claim_type TEXT NOT NULL,
      claim_type_other TEXT,
      reference TEXT,
      status TEXT DEFAULT 'draft',
      amount REAL,
      currency TEXT,
      applied INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Claim Documents
    CREATE TABLE IF NOT EXISTS claim_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      upload_date TEXT DEFAULT (datetime('now'))
    );

    -- Calendar Events
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      color TEXT,
      source_type TEXT,
      source_id INTEGER,
      all_day INTEGER DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(event_date);

    -- Report Counter (singleton row, never resets)
    CREATE TABLE IF NOT EXISTS report_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_number INTEGER DEFAULT 0
    );

    -- Activity Log (for dashboard)
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      user_id TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Notifications (for existing notifications page)
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id),
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Singleton report counter
  db.prepare('INSERT OR IGNORE INTO report_counter (id, last_number) VALUES (1, 0)').run();
}
