import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { testDbConnection } from './db';

// Route Handlers
import authRoutes from './routes/auth';
import sankalpamRoutes from './routes/sankalpam';
import dashboardRouter from './routes/dashboard';
import contentStatsRouter from './routes/contentStats';
import offeringsRouter from './routes/offerings';
import devoteeRouter from './routes/devotee';
import devoteeAuthRouter from './routes/devoteeAuth';
import sevaPaymentRouter from './routes/sevaPayment';
import sevaWebhookRouter from './routes/sevaWebhook';
// import donationPaymentRouter from './routes/donationPayment'; // old donations system, replaced by donation-booking
import donationFundsRouter from './routes/donationFunds';
import panchangamRouter from './routes/panchangam';
import { syncPendingBookings } from './services/sevaPendingSync';
import donationPublicRouter from './routes/donationPublic';
import donationBookingRouter, { syncPendingDonations } from './routes/donationBooking';
import donationProfileRouter from './routes/donationProfile';
import accountHistoryRouter from './routes/accountHistory';
import campsRouter from './routes/camps'; 
import './services/campsSchema';

const app = express();
const IS_PROD = process.env.NODE_ENV === 'production';

// Behind a proxy or hosting panel, set TRUST_PROXY=1 so rate limits see the real visitor IP
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

// 1. Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Static uploads directory with CORS headers (Before routes)
app.use(
  '/uploads',
  (_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(uploadDir)
);

// 3. CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// 4. Razorpay webhooks: MUST come before express.json() because the
//    signature check needs the raw, unparsed request body.
app.use(
  '/api/v1/payment/seva/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  sevaWebhookRouter
);


// 5. Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. API Route Mounts
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Vedaneri API Engine', timestamp: new Date() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/content-stats', contentStatsRouter);
app.use('/api/v1/offerings', offeringsRouter);
app.use('/api/v1/sankalpam', sankalpamRoutes);
app.use('/api/v1/devotee', devoteeRouter);
app.use('/api/v1/devotee-auth', devoteeAuthRouter);
app.use('/api/v1/payment/seva', sevaPaymentRouter);
// app.use('/api/v1/payment/donation', donationPaymentRouter);
app.use('/api/v1/donation-funds', donationFundsRouter);
app.use('/api/v1/panchangam', panchangamRouter);
app.use('/api/v1/donate', donationPublicRouter);
app.use('/api/v1/donation-booking', donationBookingRouter);
app.use('/api/v1/donation-profile', donationProfileRouter);
app.use('/api/v1/account', accountHistoryRouter);
app.use('/api/v1/camps', campsRouter);

// 7. Global Error Handler (Must be after all routes)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err?.message || err);
  const status = Number(err?.status) || 500;
  // Server errors never show internal details in production
  const message = status >= 500 && IS_PROD ? 'Internal Server Error' : err?.message || 'Internal Server Error';
  res.status(status).json({ message });
});

// 8. Start Server
app.listen(config.port, async () => {
  console.log(`Vedaneri API listening on http://localhost:${config.port}/api/v1`);
  await testDbConnection();

  // Every minute: settle Seva bookings left PENDING by closed or cancelled payment windows
  const runSevaSync = () => syncPendingBookings().catch((e) => console.error('[PendingSync]', e?.message || e));
  setTimeout(runSevaSync, 10_000);
  setInterval(runSevaSync, 60_000);

  // Same for donations
  const runDonationSync = () => syncPendingDonations().catch((e) => console.error('[DonationSync]', e?.message || e));
  setTimeout(runDonationSync, 15_000);
  setInterval(runDonationSync, 60_000);
});