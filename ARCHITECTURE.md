# Zain Logistics Portal — Technical Architecture
**Version:** 1.0 | **Date:** April 7, 2026 | **Author:** Audeh

---

## 1. System Overview

An internal logistics portal for a food import/export distributor in Jordan. Replaces Excel-based manual workflows with a web application for managing orders, documents, payments, claims, and shipping tracking.

**Users:** 5-10 internal team members (admin + logistics staff)
**Work week:** Saturday → Thursday (Friday = weekend)
**Currencies:** EUR, USD, GBP (no JOD)
**Language:** English only (all UI)

---

## 2. Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | React 18 + Vite | Already built, fast dev experience |
| Styling | Tailwind CSS | Utility-first, rapid iteration |
| Charts | Recharts | Already integrated from demo |
| Maps | Leaflet + OpenStreetMap | Already integrated from demo |
| Backend | Node.js 20 + Express | Already built, simple API layer |
| Database | SQLite 3 (WAL mode) | Perfect for 5-10 users, zero config, file-based backup |
| ORM/Query | better-sqlite3 | Synchronous, fast, no connection pooling needed |
| Auth | bcrypt + express-session + speakeasy (TOTP) | Email/password + 2FA, no third-party OAuth dependency |
| File Storage | AWS S3 | Durable, cheap, separate from server |
| Process Manager | PM2 | Auto-restart, log management, startup on boot |
| Reverse Proxy | Nginx | SSL termination, static file serving |
| SSL | Let's Encrypt (Certbot) | Free, auto-renewing |
| Deployment | AWS Lightsail | $12/month, 2 vCPU, 2GB RAM, 60GB SSD |

---

## 3. Project Structure

```
zain-logistics/
├── client/                    # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # Sidebar, Header, Layout wrapper
│   │   │   ├── orders/        # OrderForm, OrderList, OrderDetail
│   │   │   ├── suppliers/     # SupplierList, SupplierSearch
│   │   │   ├── documents/     # SupplierFolders, InvoiceUpload
│   │   │   ├── payments/      # PaymentList, PaymentForm
│   │   │   ├── claims/        # ClaimsList, ClaimForm, ClaimWorkflow
│   │   │   ├── calendar/      # CalendarView, DailyView, WeeklyView
│   │   │   ├── reports/       # ReportTable, ColumnPicker, PDFExport
│   │   │   ├── admin/         # SessionsView, LoginHistory, UserManagement
│   │   │   ├── auth/          # Login, TwoFactorSetup, TwoFactorVerify
│   │   │   ├── dashboard/     # DashboardStats, DashboardCharts
│   │   │   ├── shipping/      # ShippingTracker, ManualEntry, APIStatus
│   │   │   └── shared/        # SearchBar, Modal, DataTable, Pagination
│   │   ├── contexts/          # AuthContext, AppContext
│   │   ├── hooks/             # useAuth, useFetch, useDebounce
│   │   ├── services/          # api.js, auth.js, shipping.js
│   │   ├── utils/             # formatCurrency, formatDate, constants
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── server/                    # Express backend
│   ├── config/
│   │   └── database.js        # SQLite connection + WAL mode
│   ├── middleware/
│   │   ├── auth.js            # Session validation + 2FA check
│   │   ├── requireAdmin.js    # Admin-only routes
│   │   └── sessionTracker.js  # Update last_active, log IP
│   ├── routes/
│   │   ├── auth.js            # Login, logout, 2FA setup/verify
│   │   ├── orders.js          # CRUD + search + filter
│   │   ├── suppliers.js       # CRUD + search
│   │   ├── documents.js       # Upload, list, search by invoice
│   │   ├── payments.js        # CRUD + order linking
│   │   ├── claims.js          # CRUD + workflow transitions
│   │   ├── calendar.js        # Aggregated dates + manual events
│   │   ├── reports.js         # Filtered data + PDF generation
│   │   ├── admin.js           # Sessions, login history, user mgmt
│   │   └── shipping.js        # Carrier API proxy + manual fallback
│   ├── services/
│   │   ├── pdfGenerator.js    # "Aqaba Reports" PDF creation
│   │   ├── s3.js              # S3 upload/download helpers
│   │   ├── totp.js            # 2FA secret generation, QR, verify
│   │   └── shipping/
│   │       ├── index.js       # Provider router
│   │       ├── maersk.js      # Maersk Track & Trace API
│   │       ├── hapagLloyd.js  # Hapag-Lloyd DCSA T&T API
│   │       ├── cmaCgm.js      # CMA CGM API
│   │       └── manual.js      # Manual entry fallback
│   ├── db/
│   │   ├── schema.sql         # Full database schema
│   │   ├── seed.sql           # Demo/test data
│   │   └── migrations/        # Version-tracked schema changes
│   ├── server.js              # Express app entry point
│   └── .env                   # Environment variables (NOT in git)
├── ARCHITECTURE.md            # This file
├── UPGRADES.md                # Full upgrade spec
├── BUILD_PROMPTS.md           # Claude Code session prompts
├── package.json
└── .gitignore
```

---

## 4. Database Schema

SQLite with WAL mode enabled for concurrent reads. All timestamps stored as ISO 8601 strings.

### 4.1 — users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt hashed
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  must_change_password INTEGER DEFAULT 1, -- 1 = force change on first login
  totp_secret TEXT,                  -- Encrypted TOTP secret
  totp_enabled INTEGER DEFAULT 0,    -- 0 = not set up, 1 = active
  backup_codes TEXT,                 -- JSON array of hashed backup codes
  is_active INTEGER DEFAULT 1,       -- 0 = disabled, 1 = active
  last_login TEXT,                   -- Last successful login timestamp
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.2 — sessions
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,             -- Session token (UUID)
  user_id INTEGER NOT NULL REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_active TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,        -- created_at + 3 hours
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 4.3 — login_history
```sql
CREATE TABLE login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  email TEXT,                       -- Capture even for failed attempts
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL,         -- 1 = success, 0 = failed
  failure_reason TEXT,              -- 'bad_password', 'bad_totp', 'locked_out'
  timestamp TEXT DEFAULT (datetime('now'))
);
```

### 4.4 — orders
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL, -- Auto-generated: ORD-YYYY-NNN
  containers TEXT NOT NULL,          -- JSON: [{"type":"40ft","count":3},{"type":"20ft","count":1}]
  destination TEXT NOT NULL,         -- Preset code: 'aqaba','ksa','um_qaser','mersin','lattakia','lebanon','other'
  destination_custom TEXT,           -- Free text if destination = 'other'
  bank TEXT,                         -- Free text, optional
  amount REAL,                       -- Optional, can be NULL
  currency TEXT,                     -- 'EUR','USD','GBP' or NULL
  date TEXT NOT NULL,                -- Auto: today's date on creation
  category TEXT NOT NULL,            -- 'brands','nuts','all_tasty','other'
  shipping_tracking_number TEXT,     -- Optional free text
  expected_arrival TEXT,             -- Date, optional
  shipping_line TEXT,                -- 'maersk','hapag_lloyd','cma_cgm','msc' or custom text
  shipping_line_custom TEXT,         -- If not one of the major carriers
  shipping_data TEXT,                -- JSON: API response or manual entry
  tracking_source TEXT DEFAULT 'manual', -- 'manual' or 'api'
  original_docs_received INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
  status TEXT DEFAULT 'pending',     -- 'pending','confirmed','shipped','in_transit','delivered','cancelled'
  product_name TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.5 — suppliers
```sql
CREATE TABLE suppliers (
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
```

### 4.6 — documents
```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  order_id INTEGER REFERENCES orders(id),  -- Optional link to order
  invoice_number TEXT NOT NULL,             -- Globally searchable
  file_path TEXT NOT NULL,                  -- S3 key
  file_name TEXT NOT NULL,                  -- Original filename
  file_size INTEGER,                        -- Bytes
  mime_type TEXT,                            -- 'application/pdf' etc.
  upload_date TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_invoice ON documents(invoice_number);
CREATE INDEX idx_documents_supplier ON documents(supplier_id);
```

### 4.7 — payments
```sql
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  delivery_date TEXT NOT NULL,        -- Date picker value
  amount REAL,                         -- Optional
  currency TEXT,                       -- 'EUR','USD','GBP' or NULL
  payment_date TEXT NOT NULL,          -- Free text: "NET 30", "15/04/2026", etc.
  payment_term TEXT,                   -- Free text: "NET 60", "COD", etc.
  status TEXT DEFAULT 'not_transferred', -- 'transferred' or 'not_transferred'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.8 — claims
```sql
CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  dn_number TEXT UNIQUE NOT NULL,     -- Auto: DDMMYY-NN format
  brand TEXT,                          -- Category: 'brands','nuts','all_tasty','other'
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  claim_type TEXT NOT NULL,            -- 'quality','warehouse','shipping','fumigation','marketing','sales_rebate','debit_note','other'
  claim_type_other TEXT,               -- Free text if claim_type = 'other'
  reference TEXT,                      -- Description: "FUMIGATION / DEMURRAGE", "2025 REBATE"
  status TEXT DEFAULT 'draft',         -- 'draft','submitted','under_review','confirmed','rejected'
  amount REAL,                         -- Optional
  currency TEXT,                       -- 'EUR','USD','GBP' or NULL
  applied INTEGER DEFAULT 0,           -- 0 = No, 1 = Yes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.9 — claim_documents
```sql
CREATE TABLE claim_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,             -- S3 key
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  upload_date TEXT DEFAULT (datetime('now'))
);
```

### 4.10 — calendar_events
```sql
CREATE TABLE calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,            -- YYYY-MM-DD
  event_type TEXT NOT NULL,            -- 'payment','delivery','claim','order','manual'
  color TEXT,                           -- Hex color for display
  source_type TEXT,                     -- 'order','payment','claim',NULL (for manual)
  source_id INTEGER,                    -- ID of linked record, NULL for manual
  all_day INTEGER DEFAULT 1,            -- 1 = all day event
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_date ON calendar_events(event_date);
```

### 4.11 — report_counter
```sql
CREATE TABLE report_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton row
  last_number INTEGER DEFAULT 0           -- Increments forever, never resets
);

INSERT INTO report_counter (id, last_number) VALUES (1, 0);
```

### Database initialization
```sql
-- Enable WAL mode for concurrent reads
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

---

## 5. Authentication & Security Architecture

### 5.1 — Login Flow
```
User submits email + password
  → Server validates credentials (bcrypt compare)
    → Invalid → Log failed attempt → Return 401
    → Valid → Check must_change_password flag
      → Yes → Return 'password_change_required' → Show change password form
        → User sets new password → Server updates hash, sets must_change_password = 0
      → No → Check if user has 2FA enabled (totp_enabled = 1)
        → No 2FA (first login) → Return 'totp_setup_required' → Force 2FA setup
        → Has 2FA → Return 'totp_required' status
          → User enters 6-digit code from authenticator app
            → Server verifies TOTP code (30-second window, ±1 window tolerance)
              → Valid → Create session → Return session token → Dashboard
              → Invalid → Check attempts (max 5) → Return error or lockout
```

### 5.1b — First Login Sequence
```
Admin creates user account (email + temp password + role)
  → User receives temp password (via phone call or in person, NEVER over chat)
  → User goes to portal login page
  → Enters email + temp password
  → STEP 1: Forced to set a new password (min 8 chars)
  → STEP 2: Forced to set up 2FA:
     - Sees QR code for authenticator app
     - Scans with Google Authenticator / Authy / Microsoft Authenticator
     - Enters 6-digit code to verify
     - Receives 10 backup codes (displayed ONCE, downloadable)
  → STEP 3: Redirected to Dashboard
  → All subsequent logins: email + password + 2FA code
```

### 5.2 — 2FA Setup Flow
```
User goes to Security Settings (or forced on first login)
  → Server generates TOTP secret using speakeasy
  → Server stores encrypted secret in users.totp_secret
  → Server generates otpauth:// URI
  → Server generates QR code image (qrcode npm package)
  → User scans QR with Google Authenticator / Authy
  → User enters verification code to confirm
    → Server verifies code against stored secret
      → Valid → Set totp_enabled = 1
             → Generate 10 backup codes
             → Hash backup codes with bcrypt
             → Store in users.backup_codes as JSON
             → Show backup codes to user ONCE
      → Invalid → Show error, let them retry
```

### 5.3 — Session Management
```
Every authenticated request:
  → Middleware checks session token in cookie
  → Looks up session in sessions table
  → Checks: is expires_at > now?
    → No → Delete session → Return 401
    → Yes → Update last_active to now()
          → Check: is (now - last_active) > 3 hours?
            → Yes → Delete session → Return 401 (auto-logout)
            → No → Continue to route handler
```

### 5.4 — Session Cookie Config
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,  // Random 64-char string
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,       // JS cannot access
    secure: true,         // HTTPS only
    sameSite: 'strict',   // CSRF protection
    maxAge: 3 * 60 * 60 * 1000  // 3 hours
  }
}));
```

### 5.5 — Password Requirements
- Minimum 8 characters
- Hashed with bcrypt (12 rounds)
- Never stored in plaintext anywhere

---

## 6. API Design

RESTful JSON API. All routes prefixed with `/api/`.

### 6.1 — Auth Routes
```
POST   /api/auth/login              # Email + password login
POST   /api/auth/logout             # Destroy session
POST   /api/auth/change-password    # Change password (first login or voluntary)
POST   /api/auth/totp/setup         # Generate TOTP secret + QR
POST   /api/auth/totp/verify        # Verify TOTP code (during login)
POST   /api/auth/totp/confirm       # Confirm TOTP setup (first time)
POST   /api/auth/backup-code        # Use a backup code
GET    /api/auth/me                 # Current user info
GET    /api/auth/heartbeat          # Keep session alive (called by client timer)
```

### 6.2 — Order Routes
```
GET    /api/orders              # List all (with search, filter, pagination)
GET    /api/orders/:id          # Single order detail
POST   /api/orders              # Create new order
PUT    /api/orders/:id          # Update order
DELETE /api/orders/:id          # Delete order (admin only)
```

### 6.3 — Supplier Routes
```
GET    /api/suppliers           # List all (with search)
GET    /api/suppliers/:id       # Single supplier + documents
POST   /api/suppliers           # Create supplier
PUT    /api/suppliers/:id       # Update supplier
DELETE /api/suppliers/:id       # Delete supplier (admin only)
```

### 6.4 — Document Routes
```
GET    /api/documents                     # List all (with search by invoice)
GET    /api/documents/supplier/:id        # Documents for a supplier
POST   /api/documents/upload              # Upload PDF + invoice number
GET    /api/documents/:id/download        # Download PDF from S3
DELETE /api/documents/:id                 # Delete document
GET    /api/documents/search?q=INV123     # Search by invoice number
```

### 6.5 — Payment Routes
```
GET    /api/payments            # List all
GET    /api/payments/order/:id  # Payments for an order
POST   /api/payments            # Create payment
PUT    /api/payments/:id        # Update payment
DELETE /api/payments/:id        # Delete payment
```

### 6.6 — Claim Routes
```
GET    /api/claims              # List all (with filter by status, type)
GET    /api/claims/:id          # Single claim + documents
POST   /api/claims              # Create claim
PUT    /api/claims/:id          # Update claim (includes status transitions)
POST   /api/claims/:id/documents # Upload supporting document
DELETE /api/claims/:id          # Delete claim (admin only, draft only)
```

### 6.7 — Calendar Routes
```
GET    /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD  # Events in range
GET    /api/calendar/today      # Today's events
GET    /api/calendar/week       # This week (Sat-Thu)
POST   /api/calendar/events     # Create manual event
PUT    /api/calendar/events/:id # Update manual event
DELETE /api/calendar/events/:id # Delete manual event
```

### 6.8 — Report Routes
```
GET    /api/reports             # Paginated report data with column selection
GET    /api/reports/pdf         # Generate "Aqaba Reports" PDF
GET    /api/reports/search?q=   # Search by invoice number across reports
```

### 6.9 — Admin Routes
```
GET    /api/admin/sessions      # Active sessions (who's online)
GET    /api/admin/login-history # Login history log
POST   /api/admin/force-logout/:sessionId  # Force logout a user
GET    /api/admin/users         # List all users
POST   /api/admin/users         # Create new user (email + temp password + role)
PUT    /api/admin/users/:id     # Update user role, active status
POST   /api/admin/users/:id/reset-password  # Force password reset (sets must_change_password = 1)
POST   /api/admin/users/:id/reset-2fa       # Disable 2FA (user must re-setup on next login)
```

### 6.10 — Shipping Routes
```
GET    /api/shipping/track/:carrier/:containerNumber  # Query carrier API
GET    /api/shipping/carriers   # List supported carriers + API status
```

---

## 7. Shipping Integration Architecture

### 7.1 — Provider Pattern
```javascript
// server/services/shipping/index.js
const providers = {
  maersk: require('./maersk'),
  hapag_lloyd: require('./hapagLloyd'),
  cma_cgm: require('./cmaCgm'),
  manual: require('./manual')
};

async function trackContainer(carrier, containerNumber) {
  const provider = providers[carrier] || providers.manual;
  try {
    const data = await provider.track(containerNumber);
    return { source: 'api', data };
  } catch (err) {
    // Fallback to manual if API fails
    return { source: 'manual', data: null, error: err.message };
  }
}
```

### 7.2 — Carrier API Details

**Maersk** (developer.maersk.com)
- Auth: Consumer Key via developer portal (free registration)
- Endpoint: `GET /track-and-trace?containerNumber={number}`
- Response: JSON with events, ETA, vessel info
- Rate limit: Check docs after registration

**Hapag-Lloyd** (api-portal.hlag.com)
- Auth: API key via developer portal (free registration)
- Endpoint: `GET /hlag/external/v2/events/?equipmentReference={containerNumber}`
- Standard: DCSA Track & Trace v2
- Response: JSON array of transport events

**CMA CGM** (api-portal.cma-cgm.com)
- Auth: REST API credentials via portal
- Endpoint: Check portal after registration
- Response: Container tracking events

**Manual Fallback** (NVOCCs like Concordia, WAN, local agents)
- No API call — data comes from manual form fields on the order
- shipping_data JSON stores whatever the user types
- tracking_source = 'manual'

### 7.3 — Data Model
```javascript
// shipping_data JSON structure (same whether from API or manual)
{
  "status": "in_transit",           // current status
  "eta": "2026-05-15",             // expected arrival
  "vessel_name": "MSC ANNA",       // vessel (if known)
  "last_port": "Port Said",        // last known port
  "next_port": "Aqaba",            // next destination
  "events": [                       // event history
    {
      "date": "2026-04-01",
      "event": "Gate In",
      "location": "Mersin Port",
      "vessel": "MSC ANNA"
    }
  ],
  "last_updated": "2026-04-07T10:30:00Z"
}
```

---

## 8. File Storage (S3)

### 8.1 — Bucket Structure
```
zain-logistics-uploads/
├── documents/
│   └── {supplier_id}/
│       └── {timestamp}_{original_filename}.pdf
├── claims/
│   └── {claim_id}/
│       └── {timestamp}_{original_filename}.pdf
└── reports/
    └── {report_id}/
        └── AQB-{year}-{number}.pdf
```

### 8.2 — Upload Flow
```
Client → multipart/form-data to Express → multer middleware (memory storage)
  → Validate file type (PDF, JPG, PNG only) and size (max 10MB)
  → Generate S3 key based on bucket structure
  → Upload to S3 using AWS SDK v3
  → Save S3 key + metadata to documents/claim_documents table
  → Return document record to client
```

### 8.3 — Download Flow
```
Client requests /api/documents/:id/download
  → Server looks up document record
  → Generates pre-signed S3 URL (expires in 5 minutes)
  → Redirects client to pre-signed URL
```

---

## 9. Calendar System

### 9.1 — Auto-Generated Events

The calendar aggregates dates from across the system. These are NOT stored in calendar_events — they're queried dynamically:

```sql
-- Get all events for a date range (pseudo-query, actual implementation combines multiple queries)
-- 1. Payment dates
SELECT 'payment' as type, payment_date as date, ... FROM payments
-- 2. Delivery dates from payments
SELECT 'delivery' as type, delivery_date as date, ... FROM payments
-- 3. Expected delivery from orders
SELECT 'delivery' as type, expected_arrival as date, ... FROM orders
-- 4. Claim dates
SELECT 'claim' as type, date, ... FROM claims
-- 5. Order creation dates
SELECT 'order' as type, date, ... FROM orders
-- 6. Manual events (these ARE stored in calendar_events)
SELECT * FROM calendar_events WHERE event_type = 'manual'
```

### 9.2 — Week Calculation (Saturday-Thursday)
```javascript
function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Saturday = 6, so offset = (day + 1) % 7 gives days since Saturday
  const daysSinceSaturday = (day + 1) % 7;
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - daysSinceSaturday);
  const thursday = new Date(saturday);
  thursday.setDate(saturday.getDate() + 5); // Sat + 5 = Thu
  return { start: saturday, end: thursday };
}
```

### 9.3 — Priority Order (daily view)
1. Payments due (red) — most urgent, involves money
2. Expected deliveries (blue) — operational
3. Claims dates (orange) — administrative
4. Order dates (gray) — informational
5. Manual events (green) — user-created

---

## 10. Report System

### 10.1 — Unique ID Generation
```javascript
function generateReportId() {
  const year = new Date().getFullYear();
  const db = getDatabase();
  const row = db.prepare('UPDATE report_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number').get();
  const number = String(row.last_number).padStart(3, '0');
  return `AQB-${year}-${number}`;
}
// Output: AQB-2026-001, AQB-2026-002, ... AQB-2027-154, etc.
// Number never resets.
```

### 10.2 — Column Order (Reports Tab)
```
1. Unique ID (AQB-2026-001)
2. Order Number
3. Container Size (20ft/40ft)
4. Number of Containers
5. Product Name
6. Supplier
7. Status
8. Shipping Line
9. Expected Delivery
10. Bank
11. Amount (with currency symbol)
12. Original Documents Received (Yes/No)
13. Destination
```

### 10.3 — PDF Export ("Aqaba Reports")
- Generated server-side using PDFKit or puppeteer
- Title: "Aqaba Reports"
- Header includes: report unique ID, generation date
- Font size: 14pt body, 18pt headers (larger than typical for readability)
- Column order matches report tab exactly
- Sequential numbering in footer

---

## 11. Environment Variables

```bash
# .env (NEVER commit to git)

# Server
NODE_ENV=production
PORT=3000
SESSION_SECRET=<random-64-char-string>

# Database
DB_PATH=./data/logistics.db

# AWS S3
AWS_ACCESS_KEY_ID=<from-iam>
AWS_SECRET_ACCESS_KEY=<from-iam>
AWS_REGION=eu-central-1
S3_BUCKET=zain-logistics-uploads

# TOTP Encryption
TOTP_ENCRYPTION_KEY=<random-32-char-string>

# Shipping APIs (Phase 7 — leave blank until you register)
MAERSK_CONSUMER_KEY=
HAPAG_LLOYD_API_KEY=
CMA_CGM_API_KEY=

# App
APP_URL=https://portal.yourdomain.com

# Initial Admin (used by seed script only)
ADMIN_EMAIL=zain@hercompany.com
ADMIN_TEMP_PASSWORD=<generate-a-random-one>
```

---

## 12. Deployment Architecture

```
                    ┌──────────────────┐
                    │   Cloudflare     │
                    │   (DNS + CDN)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  AWS Lightsail   │
                    │  Ubuntu 24.04   │
                    │  2 vCPU / 2GB   │
                    │                  │
                    │  ┌────────────┐  │
                    │  │   Nginx    │  │
                    │  │  :80/:443  │  │
                    │  └─────┬──────┘  │
                    │        │         │
                    │  ┌─────▼──────┐  │
                    │  │  Node.js   │  │
                    │  │  (PM2)     │  │
                    │  │  :3000     │  │
                    │  └─────┬──────┘  │
                    │        │         │
                    │  ┌─────▼──────┐  │
                    │  │  SQLite    │  │
                    │  │  (WAL)     │  │
                    │  └────────────┘  │
                    └──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │    AWS S3        │
                    │  (File uploads)  │
                    └──────────────────┘
```

### 12.1 — Backup Strategy
- **SQLite:** Daily cron job copies database file to S3
- **Uploads:** Already on S3 (inherently durable, 99.999999999%)
- **Code:** Git repository (GitHub/GitLab)

### 12.2 — Deploy Script
```bash
#!/bin/bash
# deploy.sh — run from server
cd /var/www/zain-logistics
git pull origin main
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
pm2 restart zain-logistics
echo "Deployed at $(date)"
```

### 12.3 — Seed Script (First-Time Setup)
```bash
# Run ONCE after first deployment to create the admin account
node server/db/seed.js
```

```javascript
// server/db/seed.js
const bcrypt = require('bcrypt');
const db = require('../config/database');

const email = process.env.ADMIN_EMAIL;
const tempPassword = process.env.ADMIN_TEMP_PASSWORD;

const hash = bcrypt.hashSync(tempPassword, 12);
db.prepare(`
  INSERT OR IGNORE INTO users (email, name, password_hash, role, must_change_password)
  VALUES (?, ?, ?, 'admin', 1)
`).run(email, 'Admin', hash);

console.log(`Admin account created: ${email}`);
console.log(`Temp password: ${tempPassword}`);
console.log('User will be forced to change password and set up 2FA on first login.');
```

---

## 13. Key Design Decisions & Rationale

| Decision | Why |
|----------|-----|
| SQLite over Postgres | 5-10 users, single server, zero config, trivial backups |
| S3 over local filesystem | Durable storage decoupled from server, survives server rebuild |
| TOTP over SMS 2FA | No per-SMS cost, works offline, more secure than SMS |
| Express-session over JWT | Server-side sessions enable admin "who's online" and force-logout |
| better-sqlite3 over Sequelize | Synchronous, faster, less abstraction for a simple schema |
| PM2 over Docker | Simpler for single-app deployment, auto-restart built in |
| Carrier APIs direct over MarineTraffic | Free (Maersk, Hapag-Lloyd, CMA CGM) vs $900+/year |
| Manual shipping fallback | NVOCCs and local agents won't have APIs — always need manual |
| Numbered reports never reset | Client confirmed: continuous numbering across all time |
| Saturday-Thursday week | Jordan work week, must be hardcoded in calendar logic |
