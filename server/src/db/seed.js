import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';
import { seedInline } from './seedInline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = getDb();

db.pragma('foreign_keys = OFF');
db.exec(`
  DELETE FROM calendar_events;
  DELETE FROM claim_documents;
  DELETE FROM claims;
  DELETE FROM payments;
  DELETE FROM documents;
  DELETE FROM activity_log;
  DELETE FROM notifications;
  DELETE FROM orders;
  DELETE FROM suppliers;
  DELETE FROM login_history;
  DELETE FROM sessions;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);
db.pragma('foreign_keys = ON');

seedInline(db);

console.log('Database seeded successfully!');
console.log(`  - Demo login: admin@zainlogistics.com / admin123`);
console.log(`  - Demo login: team@zainlogistics.com / team123`);

process.exit(0);
