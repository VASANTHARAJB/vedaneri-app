import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { pool, testDbConnection } from './db';
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
import './services/campsSchema';
import campsRouter, { syncPendingCampPayments } from './routes/camps';
import { ensureMagazineTables } from './services/magazineSchema';
import magazineRouter, { syncMagazine } from './routes/magazine';
import './services/discoverSchema';
import discoverRouter from './routes/discover';
import aboutPagesRouter from './routes/aboutPages';
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
app.use('/uploads', (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(uploadDir));
// 3. CORS Configuration
app.use(cors({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
            return callback(null, true);
        }
        if (/^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
// 4. Razorpay webhooks: MUST come before express.json() because the
//    signature check needs the raw, unparsed request body.
app.use('/api/v1/payment/seva/webhook', express.raw({ type: 'application/json', limit: '1mb' }), sevaWebhookRouter);
// 5. Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// 6. API Route Mounts
app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Vedaneri API Engine', timestamp: new Date() });
});
// TEMPORARY: open http://localhost:4000/api/v1/magazine-check in the browser.
// It shows exactly which magazine step fails and the database's own message. Remove it once the page works.
if (!IS_PROD) {
    app.get('/api/v1/magazine-check', async (_req, res) => {
        const out = {};
        const step = async (name, fn) => {
            try {
                const r = await fn();
                out[name] = r === undefined ? 'ok' : `ok (${r})`;
            }
            catch (e) {
                out[name] = `FAILED: ${e?.sqlMessage || e?.message || String(e)}`;
            }
        };
        await step('create tables', async () => ((await ensureMagazineTables()) ? 'ready' : 'not ready, see the API terminal'));
        await step('read issues', async () => { const [r] = await pool.query('SELECT id FROM magazine_issues LIMIT 1'); return `${r.length} row`; });
        await step('issue columns', async () => {
            const [r] = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'magazine_issues'`);
            return r.map((x) => x.COLUMN_NAME).join(', ');
        });
        await step('read plans', async () => { const [r] = await pool.query('SELECT id FROM magazine_plans LIMIT 1'); return `${r.length} row`; });
        await step('read subscriptions', async () => { const [r] = await pool.query('SELECT id FROM magazine_subscriptions LIMIT 1'); return `${r.length} row`; });
        await step('receipt counters', async () => { await pool.query('SELECT 1 FROM receipt_counters LIMIT 1'); });
        res.json(out);
    });
}
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
app.use('/api/v1/magazine', magazineRouter);
app.use('/api/v1/discover', discoverRouter);
app.use('/api/v1/pages', aboutPagesRouter);
// 7. Global Error Handler (Must be after all routes)
app.use((err, _req, res, _next) => {
    console.error('API Error:', err?.sqlMessage || err?.message || err);
    const status = Number(err?.status) || 500;
    // Server errors never show internal details in production
    const message = status >= 500 && IS_PROD ? 'Internal Server Error' : err?.sqlMessage || err?.message || 'Internal Server Error';
    res.status(status).json({ message });
});
// 8. Start Server
app.listen(config.port, async () => {
    console.log(`Vedaneri API listening on http://localhost:${config.port}/api/v1`);
    await testDbConnection();
    // Every minute: settle Seva bookings left PENDING by closed or cancelled payment windows
    const runSevaSync = () => syncPendingBookings().catch((e) => console.error('[PendingSync]', e?.message || e));
    setTimeout(runSevaSync, 10000);
    setInterval(runSevaSync, 60000);
    // Same for donations
    const runDonationSync = () => syncPendingDonations().catch((e) => console.error('[DonationSync]', e?.message || e));
    setTimeout(runDonationSync, 15000);
    setInterval(runDonationSync, 60000);
    // Camp payments
    const runCampSync = () => syncPendingCampPayments().catch((e) => console.error('[CampSync]', e?.message || e));
    setTimeout(runCampSync, 20000);
    setInterval(runCampSync, 60000);
    // Magazine: expiry, unpaid orders and renewal reminders
    const runMagazineSync = () => syncMagazine().catch((e) => console.error('[MagazineSync]', e?.message || e));
    setTimeout(runMagazineSync, 25000);
    setInterval(runMagazineSync, 60000);
});
