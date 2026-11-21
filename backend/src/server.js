
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import client from 'prom-client';

import { connectDB } from './config/db.js';
import User from './models/User.js';
import Branch from './models/Branch.js';

import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import moneyReceiptRoutes from './routes/moneyReceiptRoutes.js';
import salesReturnRoutes from './routes/salesReturnRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

import { summary } from './controllers/dashboardController.js';
import { authenticate, resolveBranch } from './middleware/auth.js';
import { startNotificationWorker } from './services/notifications/queue.js';

dotenv.config();

const app = express();

// Prometheus metrics
const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'pos_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'pos_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDuration);

const httpRequestsInProgress = new client.Gauge({
  name: 'pos_http_requests_in_progress',
  help: 'Number of HTTP requests currently being processed',
  registers: [register]
});

// Request metrics middleware
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();
  httpRequestsInProgress.inc();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    httpRequestsInProgress.dec();
  });

  next();
});

app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(',') || true
}));

app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pos-api' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Application routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/money-receipts', moneyReceiptRoutes);
app.use('/api/returns', salesReturnRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.get(
  '/api/dashboard/summary',
  authenticate,
  resolveBranch({ allowAllForOwner: true }),
  summary
);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  const status = err.status || (err.code === 11000 ? 409 : 500);

  res.status(status).json({
    message: err.code === 11000
      ? 'A record with this unique value already exists.'
      : err.message || 'Internal server error.'
  });
});

// Initial owner setup
async function seedOwner() {
  if (await User.exists({ role: 'owner' })) return;

  if (
    !process.env.OWNER_EMAIL ||
    !process.env.OWNER_PASSWORD ||
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      'Set OWNER_EMAIL, OWNER_PASSWORD and JWT_SECRET in the environment before first startup.'
    );
  }

  let branch = await Branch.findOne({ code: 'MAIN' });

  if (!branch) {
    branch = await Branch.create({
      name: process.env.DEFAULT_BRANCH_NAME || 'Main Branch',
      code: 'MAIN'
    });
  }

  await User.create({
    name: process.env.OWNER_NAME || 'Shop Owner',
    email: process.env.OWNER_EMAIL,
    passwordHash: await bcrypt.hash(process.env.OWNER_PASSWORD, 12),
    role: 'owner',
    branchId: null,
    permissions: []
  });

  console.log(`Initial owner created: ${process.env.OWNER_EMAIL}`);
}

const port = process.env.PORT || 5000;

connectDB()
  .then(seedOwner)
  .then(() => {
    app.listen(port, () => {
      console.log(`POS API listening on ${port}`);
      startNotificationWorker();
    });
  })
  .catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
