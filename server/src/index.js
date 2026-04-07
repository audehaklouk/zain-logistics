import express from 'express';
import cors from 'cors';
import session from 'express-session';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import orderRoutes from './routes/orders.js';
import supplierRoutes from './routes/suppliers.js';
import documentRoutes from './routes/documents.js';
import reportRoutes from './routes/reports.js';
import trackingRoutes from './routes/tracking.js';
import activityRoutes from './routes/activity.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import claimRoutes from './routes/claims.js';
import calendarRoutes from './routes/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// ── Session middleware ─────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  name: 'zl_session',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 3 * 60 * 60 * 1000, // 3 hours
  },
}));

// Initialize database
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/shipping', trackingRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/calendar', calendarRoutes);

// Serve client build in production only
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zain Logistics API running on port ${PORT}`);
  });
}

export default app;
