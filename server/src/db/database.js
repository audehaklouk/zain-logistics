import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createTables } from './schema.js';
import { seedInline } from './seedInline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isVercel = !!process.env.VERCEL;
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', '..', 'data');
if (!isVercel && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'zain-logistics.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    // Detect old schema — if orders table lacks 'containers' column, migrate
    let needsMigration = false;
    try {
      db.prepare('SELECT containers FROM orders LIMIT 1').get();
    } catch {
      needsMigration = true;
    }

    if (needsMigration) {
      // Disable foreign keys temporarily for drop
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS activity_log;
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS notification_settings;
        DROP TABLE IF EXISTS documents;
        DROP TABLE IF EXISTS document_types;
        DROP TABLE IF EXISTS order_status_log;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS suppliers;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS login_history;
        DROP TABLE IF EXISTS payments;
        DROP TABLE IF EXISTS claims;
        DROP TABLE IF EXISTS claim_documents;
        DROP TABLE IF EXISTS calendar_events;
        DROP TABLE IF EXISTS report_counter;
        DROP TABLE IF EXISTS users;
      `);
      db.pragma('foreign_keys = ON');
    }

    createTables(db);

    // Auto-seed if no users
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (count.c === 0) {
      seedInline(db);
    }
  }
  return db;
}
