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
    db.pragma('foreign_keys = ON');
    createTables(db);

    // Auto-seed if empty (handles Vercel cold starts + fresh installs)
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (count.c === 0) {
      seedInline(db);
    }
  }
  return db;
}
