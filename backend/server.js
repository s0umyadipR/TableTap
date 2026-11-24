import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || '';
const allowedOrigins = (process.env.FRONTEND_URL || ''). split(',').map(value => value.trim());
// Standard node-postgres pool: supports URLs from any PostgreSQL provider.
const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Prefer SSL options in DATABASE_URL (for example sslmode=require).
  // DATABASE_SSL remains for existing deployments that use the legacy flag.
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_MAX || (serverless ? 5 : 10)),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10000),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
  keepAlive: true,
});
let databaseReady;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(async (_req, _res, next) => {
  try {
    if (!process.env.DATABASE_URL || jwtSecret.length < 24) throw new Error('Set DATABASE_URL to a reachable PostgreSQL connection URL and set a JWT_SECRET with at least 24 characters.');
    databaseReady ??= initializeDatabase().catch(error => { databaseReady = null; throw error; });
    await databaseReady;
    next();
  } catch (error) { next(error); }
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const claims = jwt.verify(token, jwtSecret);
    const result = await pool.query('SELECT id, name, email, phone, role FROM users WHERE id = $1', [claims.sub]);
    if (!result.rowCount) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

function requireStaff(req, res, next) {
  if (!['admin', 'staff'].includes(req.user?.role)) return res.status(403).json({ error: 'Restaurant staff access is required.' });
  next();
}

function requireKitchen(req, res, next) {
  if (req.user?.role !== 'kitchen') return res.status(403).json({ error: 'Kitchen display access is required.' });
  next();
}

function requireMenuManager(req, res, next) {
  if (!['admin', 'staff', 'kitchen'].includes(req.user?.role)) return res.status(403).json({ error: 'Restaurant team access is required.' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Restaurant administrator access is required.' });
  next();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

const orderSelect = `SELECT o.id, o.user_id, COALESCE(o.customer_name, u.name, 'Guest') AS customer_name,
    COALESCE(o.customer_email, u.email) AS customer_email,
    COALESCE(o.customer_phone, u.phone) AS customer_phone,
    o.razorpay_order_id, o.table_number, o.status, o.payment_method, o.payment_status,
    o.subtotal, o.tax_rate, o.tax_amount, o.total, o.reservation_id, o.reservation_charge, o.created_at, o.updated_at,
    o.kitchen_sent_at, o.prep_minutes, o.prep_started_at
  FROM orders o LEFT JOIN users u ON u.id = o.user_id`;

async function getOrder(orderId) {
  const orderResult = await pool.query(`${orderSelect} WHERE o.id = $1`, [orderId]);
  if (!orderResult.rowCount) return null;
  const order = orderResult.rows[0];
  const items = await pool.query('SELECT id, menu_item_id, name, price, quantity, line_total FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
  return { ...order, items: items.rows };
}

async function insertOrderItems(client, orderId, items) {
  await client.query(`INSERT INTO order_items(order_id, menu_item_id, name, price, quantity, line_total)
    SELECT $1, menu_item_id, name, price, quantity, line_total
    FROM UNNEST($2::bigint[], $3::text[], $4::numeric[], $5::integer[], $6::numeric[])
      AS order_item(menu_item_id, name, price, quantity, line_total)`, [
    orderId,
    items.map(item => item.id),
    items.map(item => item.name),
    items.map(item => item.price),
    items.map(item => item.quantity),
    items.map(item => item.line.toFixed(2)),
  ]);
}

function kitchenTicket(order) {
  const { customer_email, customer_phone, subtotal, tax_rate, tax_amount, total, items = [], ...ticket } = order;
  return { ...ticket, items: items.map(({ id, name, quantity }) => ({ id, name, quantity })) };
}

function hashTrackingToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function orderSessionCookieName(orderId) {
  return `tabletap-order-${String(orderId).replace(/[^a-f0-9-]/gi, '')}`;
}

function hasOrderSession(req, orderId, expectedHash) {
  const cookieName = `${orderSessionCookieName(orderId)}=`;
  const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName));
  if (!cookie) return false;
  try { return matchesSignature(expectedHash, hashTrackingToken(decodeURIComponent(cookie.slice(cookieName.length)))); }
  catch { return false; }
}

function setOrderSessionCookie(res, orderId, token) {
  const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  res.cookie(orderSessionCookieName(orderId), token, {
    httpOnly: true,
    secure: production || false,
    sameSite: production ? 'none' : 'lax',
    path: '/api',
  });
}

function orderSessionCookieOptions() {
  const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', path: '/api' };
}

function matchesSignature(expectedHex, suppliedHex) {
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex || '')) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function razorpayIsConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
}

function razorpayAuthHeader() {
  const credentials = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function razorpayRequest(path, options = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Razorpay API request failed:', response.status, data.error?.code || 'provider_error');
    throw Object.assign(new Error('Razorpay could not start or verify this payment. Please retry.'), { status: 502 });
  }
  return data;
}

function razorpayPublicConfig(order) {
  return {
    key_id: process.env.RAZORPAY_KEY_ID,
    order_id: order.razorpay_order_id,
    amount: Math.round(Number(order.total) * 100),
    currency: 'INR',
  };
}

async function createRazorpayOrder(orderId, total, customer) {
  const razorpayOrder = await razorpayRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: Math.round(Number(total) * 100),
      currency: 'INR',
      receipt: orderId,
      notes: { tabletap_order_id: orderId, customer_name: customer.name.slice(0, 120) },
    }),
  });
  return razorpayOrder.id;
}

function paymentMethodFromRazorpay(method) {
  return ['upi', 'card', 'netbanking', 'wallet'].includes(method) ? method : 'online';
}

async function markRazorpayOrderPaid(providerOrderId, payment) {
  if (!providerOrderId || payment?.order_id !== providerOrderId || payment.status !== 'captured' || payment.currency !== 'INR' || !Number.isSafeInteger(Number(payment.amount))) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`UPDATE orders SET payment_status='paid', payment_method=$1,
      razorpay_payment_id=$2, updated_at=NOW()
      WHERE razorpay_order_id=$3 AND payment_status <> 'paid'
        AND ROUND(total * 100)::bigint = $4
      RETURNING id`, [paymentMethodFromRazorpay(payment.method), payment.id, providerOrderId, Number(payment.amount)]);
    await client.query('COMMIT');
    if (!result.rowCount) return null;
    const order = await getOrder(result.rows[0].id);
    return order;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.get('x-razorpay-signature') || '';
  const eventId = req.get('x-razorpay-event-id') || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !Buffer.isBuffer(req.body)) return res.status(503).send('Webhook is not configured');
  const expected = createHmac('sha256', webhookSecret).update(req.body).digest('hex');
  if (!matchesSignature(expected, signature)) return res.status(400).send('Invalid signature');
  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); }
  catch { return res.status(400).send('Invalid JSON'); }
  if (!eventId || typeof payload.event !== 'string') return res.status(400).send('Missing event identity');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`INSERT INTO payment_webhook_events(event_id,event_type)
      VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`, [eventId, payload.event]);
    if (inserted.rowCount && payload.event === 'payment.captured') {
      const payment = payload.payload?.payment?.entity;
      const amount = Number(payment?.amount);
      if (payment?.status === 'captured' && payment.currency === 'INR' && Number.isSafeInteger(amount) && payment.order_id) {
        await client.query(`UPDATE orders SET payment_status='paid',
          payment_method=$1, razorpay_payment_id=$2, updated_at=NOW()
          WHERE razorpay_order_id=$3 AND payment_status <> 'paid'
            AND ROUND(total * 100)::bigint=$4`, [
          paymentMethodFromRazorpay(payment.method), payment.id || null, payment.order_id, amount,
        ]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not persist Razorpay webhook event:', error.message);
    return res.status(503).send('Webhook processing failed');
  } finally {
    client.release();
  }
  return res.sendStatus(200);
});

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'TableTap API' }); }
  catch { res.status(503).json({ ok: false, error: 'Database connection failed' }); }
});

app.get('/api/public/menu', async (_req, res, next) => {
  try {
    const [menu, settings, occupiedTables] = await Promise.all([
      pool.query('SELECT id, name, description, price, category, is_veg, is_available, image_url FROM menu_items WHERE is_available = TRUE ORDER BY category, name'),
      pool.query('SELECT restaurant_name, tax_rate, reservation_charge, table_count, upi_id, upi_name FROM restaurant_settings WHERE id = 1'),
      pool.query(`SELECT table_number FROM orders WHERE status NOT IN ('all_done','cancelled')
        UNION SELECT table_number FROM reservations WHERE status='accepted'
          AND reservation_at <= NOW() + INTERVAL '2 hours'
          AND reservation_at + INTERVAL '2 hours' > NOW()
        ORDER BY table_number`)
    ]);
    res.json({ menu: menu.rows, settings: settings.rows[0] || null, occupied_tables: occupiedTables.rows.map(row => Number(row.table_number)) });
  } catch (error) { next(error); }
});

app.post('/api/reservations', async (req, res, next) => {
  const name = String(req.body?.customer_name || '').trim();
  const phone = String(req.body?.customer_phone || '').replace(/[\s()-]/g, '');
  const partySize = Number(req.body?.party_size);
  const reservationAt = new Date(req.body?.reservation_at);
  if (!name || name.length > 120 || !/^\+?[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter your name and a valid phone number.' });
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) return res.status(400).json({ error: 'Choose a group size from 1 to 20.' });
  if (!Number.isFinite(reservationAt.getTime()) || reservationAt.getTime() <= Date.now() || reservationAt.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'Choose a future date and time within the next 90 days.' });
  try {
    const result = await pool.query(`INSERT INTO reservations(customer_name,customer_phone,party_size,reservation_at,booking_charge)
      SELECT $1,$2,$3,$4,reservation_charge FROM restaurant_settings WHERE id=1
      RETURNING id,customer_name,customer_phone,party_size,reservation_at,booking_charge,table_number,status,created_at`, [name, phone, partySize, reservationAt.toISOString()]);
    if (!result.rowCount) return res.status(503).json({ error: 'Restaurant settings are not ready. Please try again.' });
    res.status(201).json({ reservation: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/reservations/:id', async (req, res, next) => {
  const phone = String(req.query?.phone || '').replace(/[\s()-]/g, '');
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !/^\+?[0-9]{7,15}$/.test(phone)) return res.status(404).json({ error: 'Reservation not found.' });
  try {
    const result = await pool.query(`SELECT r.id,r.customer_name,r.party_size,r.reservation_at,r.booking_charge,r.table_number,r.status,r.created_at,r.updated_at,o.id AS linked_order_id
      FROM reservations r LEFT JOIN orders o ON o.reservation_id=r.id WHERE r.id=$1 AND r.customer_phone=$2`, [req.params.id, phone]);
    if (!result.rowCount) return res.status(404).json({ error: 'Reservation not found.' });
    res.json({ reservation: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/admin/reservations', requireAuth, requireStaff, async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT r.id,r.customer_name,r.customer_phone,r.party_size,r.reservation_at,r.booking_charge,r.table_number,r.status,r.created_at,r.updated_at,
        o.id AS linked_order_id,o.payment_status AS order_payment_status
      FROM reservations r LEFT JOIN orders o ON o.reservation_id=r.id
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, r.reservation_at ASC LIMIT 250`);
    res.json({ reservations: result.rows });
  } catch (error) { next(error); }
});

app.patch('/api/admin/reservations/:id', requireAuth, requireStaff, async (req, res, next) => {
  const { status } = req.body || {};
  const tableNumber = Number(req.body?.table_number);
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Choose accept or reject for this reservation.' });
  if (status === 'accepted' && (!Number.isInteger(tableNumber) || tableNumber < 1)) return res.status(400).json({ error: 'Choose a table number before accepting.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const booking = await client.query('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!booking.rowCount) throw Object.assign(new Error('Reservation not found.'), { status: 404 });
    if (booking.rows[0].status !== 'pending') throw Object.assign(new Error('This reservation has already been reviewed.'), { status: 409 });
    let assignedTable = null;
    if (status === 'accepted') {
      const settings = await client.query('SELECT table_count FROM restaurant_settings WHERE id=1');
      if (!settings.rowCount || tableNumber > Number(settings.rows[0].table_count)) throw Object.assign(new Error('Choose a table in this restaurant.'), { status: 400 });
      await client.query('SELECT pg_advisory_xact_lock(3918,$1)', [tableNumber]);
      const conflict = await client.query(`SELECT 1 FROM reservations
        WHERE table_number=$1 AND status='accepted' AND id<>$2
          AND reservation_at < $3::timestamptz + INTERVAL '2 hours'
          AND reservation_at + INTERVAL '2 hours' > $3::timestamptz
        UNION ALL
        SELECT 1 FROM orders WHERE table_number=$1 AND status NOT IN ('all_done','cancelled')
          AND $3::timestamptz <= NOW() + INTERVAL '2 hours'
        LIMIT 1`, [tableNumber, req.params.id, booking.rows[0].reservation_at]);
      if (conflict.rowCount) throw Object.assign(new Error('That table already has a reservation in this time slot.'), { status: 409 });
      assignedTable = tableNumber;
    }
    const updated = await client.query(`UPDATE reservations SET status=$1,table_number=$2,updated_at=NOW()
      WHERE id=$3 RETURNING id,customer_name,customer_phone,party_size,reservation_at,booking_charge,table_number,status,created_at,updated_at`, [status, assignedTable, req.params.id]);
    await client.query('COMMIT');
    res.json({ reservation: updated.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

app.post('/api/auth/customer/login', async (req, res, next) => {
  const { identifier, password, name } = req.body || {};
  if (!identifier || !password || password.length < 8) return res.status(400).json({ error: 'Enter your email or phone and a password of at least 8 characters.' });
  const isEmail = String(identifier).includes('@');
  const value = isEmail ? String(identifier).trim().toLowerCase() : String(identifier).replace(/[\s()-]/g, '');
  const field = isEmail ? 'email' : 'phone';
  try {
    let result = await pool.query(`SELECT * FROM users WHERE ${field} = $1 AND role = 'customer'`, [value]);
    let customer = result.rows[0];
    if (!customer) {
      if (!name?.trim()) return res.status(400).json({ error: 'Enter your name to create an account on your first visit.' });
      const passwordHash = await bcrypt.hash(password, 12);
      try {
        const values = isEmail ? [name.trim(), value, null, passwordHash] : [name.trim(), null, value, passwordHash];
        result = await pool.query('INSERT INTO users(name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING *', values);
        customer = result.rows[0];
      } catch (error) {
        if (error.code !== '23505') throw error;
        return res.status(409).json({ error: 'That contact is already in use. Please sign in with your password.' });
      }
    } else if (!(await bcrypt.compare(password, customer.password_hash))) {
      return res.status(401).json({ error: 'That password does not match this account.' });
    }
    const user = publicUser(customer);
    res.json({ token: signToken(user), user });
  } catch (error) { next(error); }
});

app.post('/api/auth/admin/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your admin email and password.' });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1 AND role = 'admin'", [String(email).trim().toLowerCase()]);
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: 'Admin email or password is incorrect.' });
    const user = publicUser(admin);
    res.json({ token: signToken(user), user });
  } catch (error) { next(error); }
});

app.post('/api/auth/staff/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your staff email and password.' });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1 AND role='staff'", [String(email).trim().toLowerCase()]);
    const staff = result.rows[0];
    if (!staff || !(await bcrypt.compare(password, staff.password_hash))) return res.status(401).json({ error: 'Staff email or password is incorrect.' });
    const user = publicUser(staff);
    res.json({ token: signToken(user), user });
  } catch (error) { next(error); }
});

app.post('/api/auth/kitchen/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your kitchen email and password.' });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1 AND role='kitchen'", [String(email).trim().toLowerCase()]);
    const kitchen = result.rows[0];
    if (!kitchen || !(await bcrypt.compare(password, kitchen.password_hash))) return res.status(401).json({ error: 'Kitchen email or password is incorrect.' });
    const user = publicUser(kitchen);
    res.json({ token: signToken(user), user });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/orders', async (req, res, next) => {
  const { table_number, payment_method = 'counter', items, customer } = req.body || {};
  const name = String(customer?.name || '').trim();
  const email = String(customer?.email || '').trim().toLowerCase() || null;
  const phone = String(customer?.phone || '').replace(/[\s()-]/g, '') || null;
  if (!name || name.length > 120 || !phone) return res.status(400).json({ error: 'Enter your name and phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!/^\+?[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (!Number.isInteger(Number(table_number)) || Number(table_number) < 1) return res.status(400).json({ error: 'Choose a valid table number.' });
  if (!['counter', 'online'].includes(payment_method)) return res.status(400).json({ error: 'Choose pay at the counter or online with Razorpay.' });
  if (payment_method === 'online' && !razorpayIsConfigured()) return res.status(503).json({ error: 'Razorpay is not fully configured. Choose pay at the counter or try again later.' });
  if (!Array.isArray(items) || items.length < 1 || items.length > 40) return res.status(400).json({ error: 'Your cart is empty or has too many items.' });
  const token = randomBytes(32).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settingsResult = await client.query('SELECT tax_rate, table_count FROM restaurant_settings WHERE id = 1');
    const settings = settingsResult.rows[0] || { tax_rate: 0, table_count: 24 };
    if (Number(table_number) > Number(settings.table_count)) throw Object.assign(new Error('That table number is not available.'), { status: 400 });
    await client.query('SELECT pg_advisory_xact_lock(3917, $1)', [Number(table_number)]);
    const occupied = await client.query("SELECT 1 FROM orders WHERE table_number=$1 AND status NOT IN ('all_done','cancelled') LIMIT 1", [Number(table_number)]);
    if (occupied.rowCount) throw Object.assign(new Error(`Table ${table_number} is already occupied. Choose another table.`), { status: 409 });
    const quantities = new Map();
    for (const item of items) {
      const id = Number(item.menu_item_id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw Object.assign(new Error('One of the quantities is invalid.'), { status: 400 });
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    const menu = await client.query('SELECT id, name, price FROM menu_items WHERE id = ANY($1::bigint[]) AND is_available = TRUE FOR UPDATE', [[...quantities.keys()]]);
    if (menu.rowCount !== quantities.size) throw Object.assign(new Error('One of those menu items is unavailable now. Refresh the menu and try again.'), { status: 400 });
    const orderItems = menu.rows.map(item => ({ ...item, quantity: quantities.get(Number(item.id)), line: Number(item.price) * quantities.get(Number(item.id)) }));
    const subtotal = orderItems.reduce((sum, item) => sum + item.line, 0);
    const taxRate = Number(settings.tax_rate);
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const created = await client.query(`INSERT INTO orders(user_id, customer_name, customer_email, customer_phone, tracking_token_hash, table_number, payment_method, subtotal, tax_rate, tax_amount, total)
      VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [name, email, phone, hashTrackingToken(token), Number(table_number), payment_method, subtotal.toFixed(2), taxRate, taxAmount.toFixed(2), total.toFixed(2)]);
    const orderId = created.rows[0].id;
    let providerOrderId = null;
    if (payment_method === 'online') {
      providerOrderId = await createRazorpayOrder(orderId, total, { name, email, phone });
      await client.query('UPDATE orders SET razorpay_order_id=$1 WHERE id=$2', [providerOrderId, orderId]);
    }
    await insertOrderItems(client, orderId, orderItems);
    await client.query('COMMIT');
    const order = await getOrder(orderId);
    setOrderSessionCookie(res, orderId, token);
    res.status(201).json({ order, razorpay: providerOrderId ? razorpayPublicConfig(order) : null });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

app.post('/api/payments/razorpay/session', async (req, res, next) => {
  const { order_id } = req.body || {};
  if (!razorpayIsConfigured()) return res.status(503).json({ error: 'Razorpay is not fully configured.' });
  if (!order_id) return res.status(404).json({ error: 'Order not found.' });
  try {
    const result = await pool.query(`SELECT id,total,razorpay_order_id,tracking_token_hash,payment_method,payment_status,status FROM orders WHERE id=$1`, [order_id]);
    if (!result.rowCount || !hasOrderSession(req, order_id, result.rows[0].tracking_token_hash)) return res.status(404).json({ error: 'Order not found.' });
    const order = result.rows[0];
    if (!order.razorpay_order_id || order.payment_status === 'paid' || order.status === 'cancelled' || !['online','upi','card','netbanking','wallet'].includes(order.payment_method)) return res.status(404).json({ error: 'This order has no pending Razorpay payment.' });
    res.json({ razorpay: razorpayPublicConfig(order) });
  } catch (error) { next(error); }
});

app.post('/api/payments/razorpay/verify', async (req, res, next) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpayIsConfigured()) return res.status(503).json({ error: 'Razorpay is not fully configured.' });
  if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ error: 'Payment confirmation details are incomplete.' });
  try {
    const result = await pool.query(`SELECT id,total,razorpay_order_id,tracking_token_hash FROM orders
      WHERE id=$1`, [order_id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
    const order = result.rows[0];
    if (!hasOrderSession(req, order_id, order.tracking_token_hash)) return res.status(404).json({ error: 'Order not found.' });
    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) return res.status(400).json({ error: 'The payment does not match this order.' });
    const expectedSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${order.razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!matchesSignature(expectedSignature, razorpay_signature)) return res.status(400).json({ error: 'Razorpay could not verify this payment signature.' });

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(razorpay_payment_id)}`);
    if (payment.order_id !== order.razorpay_order_id || Number(payment.amount) !== Math.round(Number(order.total) * 100) || payment.currency !== 'INR') {
      return res.status(400).json({ error: 'The payment details do not match this order.' });
    }
    const updatedOrder = payment.status === 'captured'
      ? await markRazorpayOrderPaid(order.razorpay_order_id, payment)
      : null;
    const currentOrder = updatedOrder || await getOrder(order.id);
    res.json({ order: currentOrder, payment_confirmed: currentOrder.payment_status === 'paid' });
  } catch (error) { next(error); }
});

app.get('/api/orders/:id/status', async (req, res, next) => {
  try {
    const [result, secret] = await Promise.all([
      pool.query(`${orderSelect} WHERE o.id=$1`, [req.params.id]),
      pool.query('SELECT tracking_token_hash FROM orders WHERE id=$1', [req.params.id]),
    ]);
    if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
    const order = result.rows[0];
    if (!hasOrderSession(req, req.params.id, secret.rows[0]?.tracking_token_hash)) return res.status(404).json({ error: 'Order not found.' });
    order.items = (await pool.query('SELECT id,name,price,quantity,line_total FROM order_items WHERE order_id=$1 ORDER BY id', [order.id])).rows;
    const waiterAlert = await pool.query('SELECT EXISTS(SELECT 1 FROM waiter_alerts WHERE order_id=$1 AND acknowledged_at IS NULL) AS waiter_alert_open', [order.id]);
    order.waiter_alert_open = waiterAlert.rows[0].waiter_alert_open;
    if (['all_done','served','cancelled'].includes(order.status)) res.clearCookie(orderSessionCookieName(order.id), orderSessionCookieOptions());
    res.json({ order });
  } catch (error) { next(error); }
});

app.post('/api/orders/recover', async (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (!name || name.length > 120 || !/^[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter the name and phone number used at checkout.' });
  try {
    const result = await pool.query(`SELECT o.id,o.customer_name,o.tracking_token_hash,o.table_number,o.status,o.payment_method,o.payment_status,o.subtotal,o.tax_rate,o.tax_amount,o.total,o.created_at,o.updated_at,r.rating
      FROM orders o LEFT JOIN order_reviews r ON r.order_id=o.id
      WHERE LOWER(BTRIM(o.customer_name))=LOWER($1) AND regexp_replace(o.customer_phone,'[^0-9]','','g')=$2
      ORDER BY o.created_at DESC LIMIT 50`, [name, phone]);
    const orders = await Promise.all(result.rows.map(async order => {
      const { tracking_token_hash: trackingHash, ...publicOrder } = order;
      if (!['all_done', 'served', 'delivered', 'cancelled'].includes(order.status) && !hasOrderSession(req, order.id, trackingHash)) {
        const token = randomBytes(32).toString('hex');
        await pool.query('UPDATE orders SET tracking_token_hash=$1 WHERE id=$2', [hashTrackingToken(token), order.id]);
        setOrderSessionCookie(res, order.id, token);
      }
      return {
        ...publicOrder,
        items: (await pool.query('SELECT id,name,price,quantity,line_total FROM order_items WHERE order_id=$1 ORDER BY id', [order.id])).rows,
      };
    }));
    res.json({ orders });
  } catch (error) { next(error); }
});

app.post('/api/orders/:id/waiter-alert', async (req, res, next) => {
  try {
    const order = await pool.query('SELECT id,table_number,tracking_token_hash FROM orders WHERE id=$1', [req.params.id]);
    if (!order.rowCount || !hasOrderSession(req, req.params.id, order.rows[0].tracking_token_hash)) return res.status(404).json({ error: 'Order not found.' });
    await pool.query(`INSERT INTO waiter_alerts(order_id,table_number) VALUES($1,$2)
      ON CONFLICT (order_id) WHERE acknowledged_at IS NULL DO NOTHING`, [order.rows[0].id, order.rows[0].table_number]);
    res.status(201).json({ sent: true });
  } catch (error) { next(error); }
});

app.post('/api/orders/:id/review', async (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  const rating = Number(req.body?.rating);
  if (!name || name.length > 120 || !/^[0-9]{7,15}$/.test(phone) || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Enter the checkout name, phone number and a rating from 1 to 5.' });
  try {
    const order = await pool.query(`SELECT id,status FROM orders
      WHERE id=$1 AND LOWER(BTRIM(customer_name))=LOWER($2) AND regexp_replace(customer_phone,'[^0-9]','','g')=$3`, [req.params.id, name, phone]);
    if (!order.rowCount) return res.status(404).json({ error: 'Order not found for those details.' });
    if (!['served', 'all_done'].includes(order.rows[0].status)) return res.status(409).json({ error: 'You can rate this order after it has been served.' });
    await pool.query(`INSERT INTO order_reviews(order_id,rating) VALUES($1,$2)
      ON CONFLICT(order_id) DO UPDATE SET rating=EXCLUDED.rating,created_at=NOW()`, [req.params.id, rating]);
    res.json({ rating });
  } catch (error) { next(error); }
});

app.get('/api/admin/orders', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const phoneDigits = search.replace(/\D/g, '');
    const result = await pool.query(`${orderSelect}
      WHERE ($1 = '' OR COALESCE(o.customer_name,u.name,'Guest') ILIKE '%' || $1 || '%'
        OR COALESCE(o.customer_phone,u.phone,'') ILIKE '%' || $1 || '%'
        OR o.id::text ILIKE '%' || $1 || '%'
        OR ($2 <> '' AND regexp_replace(COALESCE(o.customer_phone,u.phone,''),'[^0-9]','','g') ILIKE '%' || $2 || '%'))
      ORDER BY o.created_at DESC LIMIT 200`, [search, phoneDigits]);
    const orders = await Promise.all(result.rows.map(async order => ({ ...order, items: (await pool.query('SELECT id, menu_item_id, name, price, quantity, line_total FROM order_items WHERE order_id=$1 ORDER BY id', [order.id])).rows })));
    res.json({ orders });
  } catch (error) { next(error); }
});

app.post('/api/admin/orders/:id/send-to-kitchen', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE orders SET kitchen_sent_at=COALESCE(kitchen_sent_at,NOW()),updated_at=NOW()
      WHERE id=$1 AND status NOT IN ('all_done','cancelled')
        AND (razorpay_order_id IS NULL OR payment_status='paid') RETURNING id`, [req.params.id]);
    if (!result.rowCount) return res.status(409).json({ error: 'This order cannot be sent to the kitchen yet.' });
    res.json({ order: await getOrder(req.params.id) });
  } catch (error) { next(error); }
});

app.post('/api/admin/orders/manual', requireAuth, requireStaff, async (req, res, next) => {
  const tableNumber = Number(req.body?.table_number);
  const name = String(req.body?.customer?.name || '').trim();
  const phone = String(req.body?.customer?.phone || '').replace(/[\s()-]/g, '');
  const paymentStatus = req.body?.payment_status === 'paid' ? 'paid' : 'pending';
  const reservationId = String(req.body?.reservation_id || '').trim() || null;
  const items = req.body?.items;
  if (!Number.isInteger(tableNumber) || tableNumber < 1) return res.status(400).json({ error: 'Choose a valid table number.' });
  if (!name || name.length > 120 || !/^\+?[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter the customer name and a valid phone number.' });
  if (!Array.isArray(items) || !items.length || items.length > 40) return res.status(400).json({ error: 'Add at least one menu item.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settingsResult = await client.query('SELECT tax_rate, table_count FROM restaurant_settings WHERE id=1');
    const settings = settingsResult.rows[0] || { tax_rate: 0, table_count: 24 };
    if (tableNumber > Number(settings.table_count)) throw Object.assign(new Error('That table number is not available.'), { status: 400 });
    await client.query('SELECT pg_advisory_xact_lock(3917, $1)', [tableNumber]);
    let reservationCharge = 0;
    if (reservationId) {
      const reservation = await client.query('SELECT status,table_number,booking_charge FROM reservations WHERE id=$1 FOR UPDATE', [reservationId]);
      if (!reservation.rowCount || reservation.rows[0].status !== 'accepted' || Number(reservation.rows[0].table_number) !== tableNumber) throw Object.assign(new Error('This accepted reservation is not assigned to the selected table.'), { status: 409 });
      const existingOrder = await client.query('SELECT 1 FROM orders WHERE reservation_id=$1 LIMIT 1', [reservationId]);
      if (existingOrder.rowCount) throw Object.assign(new Error('A table order is already attached to this reservation.'), { status: 409 });
      reservationCharge = Number(reservation.rows[0].booking_charge);
    }
    const quantities = new Map();
    for (const item of items) {
      const id = Number(item.menu_item_id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw Object.assign(new Error('One of the item quantities is invalid.'), { status: 400 });
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    const menu = await client.query('SELECT id,name,price FROM menu_items WHERE id=ANY($1::bigint[]) AND is_available=TRUE FOR UPDATE', [[...quantities.keys()]]);
    if (menu.rowCount !== quantities.size) throw Object.assign(new Error('A selected menu item is no longer available.'), { status: 400 });
    const orderItems = menu.rows.map(item => ({ ...item, quantity: quantities.get(Number(item.id)), line: Number(item.price) * quantities.get(Number(item.id)) }));
    const subtotal = orderItems.reduce((sum, item) => sum + item.line, 0);
    const taxRate = Number(settings.tax_rate);
    const taxAmount = Math.round((subtotal + reservationCharge) * taxRate) / 100;
    const total = Math.round((subtotal + reservationCharge + taxAmount) * 100) / 100;
    const created = await client.query(`INSERT INTO orders(customer_name,customer_phone,table_number,status,payment_method,payment_status,subtotal,tax_rate,tax_amount,total,kitchen_sent_at,reservation_id,reservation_charge)
      VALUES($1,$2,$3,'confirmed','counter',$4,$5,$6,$7,$8,NOW(),$9,$10) RETURNING id`, [name, phone, tableNumber, paymentStatus, subtotal.toFixed(2), taxRate, taxAmount.toFixed(2), total.toFixed(2), reservationId, reservationCharge.toFixed(2)]);
    const orderId = created.rows[0].id;
    await insertOrderItems(client, orderId, orderItems);
    await client.query('COMMIT');
    res.status(201).json({ order: await getOrder(orderId) });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

app.get('/api/admin/waiter-alerts', requireAuth, requireStaff, async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT a.id,a.order_id,a.table_number,a.created_at,o.customer_name
      FROM waiter_alerts a JOIN orders o ON o.id=a.order_id
      WHERE a.acknowledged_at IS NULL ORDER BY a.created_at DESC LIMIT 100`);
    res.json({ alerts: result.rows });
  } catch (error) { next(error); }
});

app.patch('/api/admin/waiter-alerts/:id/acknowledge', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE waiter_alerts SET acknowledged_at=NOW() WHERE id=$1 AND acknowledged_at IS NULL RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Waiter alert is no longer active.' });
    res.json({ acknowledged: true });
  } catch (error) { next(error); }
});

app.get('/api/kitchen/orders', requireAuth, requireKitchen, async (req, res, next) => {
  try {
    const archive = req.query.archive === 'true';
    const result = await pool.query(`${orderSelect}
      WHERE o.kitchen_sent_at IS NOT NULL AND ${archive
        ? "o.status IN ('prepared','ready','served','all_done','cancelled')"
        : "o.status NOT IN ('prepared','ready','served','all_done','cancelled')"}
      ORDER BY o.kitchen_sent_at ${archive ? 'DESC' : 'ASC'} LIMIT 100`);
    const orders = await Promise.all(result.rows.map(async order => kitchenTicket({
      ...order,
      items: (await pool.query('SELECT id,name,quantity FROM order_items WHERE order_id=$1 ORDER BY id', [order.id])).rows,
    })));
    res.json({ orders });
  } catch (error) { next(error); }
});

app.patch('/api/kitchen/orders/:id', requireAuth, requireKitchen, async (req, res, next) => {
  const { status, prep_minutes } = req.body || {};
  const kitchenStatuses = ['preparing','prepared','ready','unavailable'];
  const minutes = prep_minutes === undefined ? null : Number(prep_minutes);
  if (!kitchenStatuses.includes(status) || (minutes !== null && ![5,10,15,20].includes(minutes))) return res.status(400).json({ error: 'Choose a kitchen status and a 5, 10, 15 or 20 minute timer.' });
  try {
    const current = await pool.query('SELECT payment_status,razorpay_order_id FROM orders WHERE id=$1 AND kitchen_sent_at IS NOT NULL', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Kitchen ticket not found.' });
    if (['preparing','prepared','ready'].includes(status) && current.rows[0].razorpay_order_id && current.rows[0].payment_status !== 'paid') return res.status(409).json({ error: 'Wait for online payment confirmation before preparing this order.' });
    const updated = await pool.query(`UPDATE orders SET status=$1,
        prep_minutes=COALESCE($2,prep_minutes),
        prep_started_at=CASE WHEN $1='preparing' AND $2 IS NOT NULL THEN NOW() ELSE prep_started_at END,
        updated_at=NOW() WHERE id=$3 RETURNING id`, [status, minutes, req.params.id]);
    if (!updated.rowCount) return res.status(404).json({ error: 'Kitchen ticket not found.' });
    res.json({ order: kitchenTicket(await getOrder(req.params.id)) });
  } catch (error) { next(error); }
});

app.get('/api/admin/menu', requireAuth, requireMenuManager, async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, description, price, category, is_veg, is_available, image_url FROM menu_items ORDER BY category, name');
    res.json({ menu: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/admin/staff', requireAuth, requireAdmin, async (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 12 characters.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id,name,email,role", [name, email, passwordHash]);
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That email already has an account.' });
    next(error);
  }
});

app.patch('/api/admin/orders/:id', requireAuth, requireStaff, async (req, res, next) => {
  const { status, payment_status } = req.body || {};
  const statuses = ['pending', 'confirmed', 'preparing', 'prepared', 'ready', 'unavailable', 'served', 'all_done', 'cancelled'];
  const paymentStatuses = ['pending', 'paid', 'failed'];
  if ((status && !statuses.includes(status)) || (payment_status && !paymentStatuses.includes(payment_status)) || (!status && !payment_status)) return res.status(400).json({ error: 'Choose a valid order or payment status.' });
  try {
    const current = await pool.query('SELECT payment_method,razorpay_order_id,payment_status,table_number,status FROM orders WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Order not found.' });
    if (req.user.role === 'staff' && payment_status && current.rows[0].payment_method !== 'counter') return res.status(403).json({ error: 'Staff can only update payments made at the counter.' });
    if (payment_status === 'paid' && (current.rows[0].payment_method !== 'counter' || current.rows[0].razorpay_order_id)) return res.status(403).json({ error: 'Online payments must be confirmed by Razorpay.' });
    if (status === 'all_done' && current.rows[0].status === 'cancelled') return res.status(409).json({ error: 'Cancelled orders cannot release a table.' });
    const fulfillmentStatuses = ['confirmed', 'preparing', 'prepared', 'ready', 'served', 'all_done'];
    if (status && fulfillmentStatuses.includes(status) && current.rows[0].razorpay_order_id && current.rows[0].payment_status !== 'paid') {
      return res.status(409).json({ error: 'Wait for Razorpay to confirm payment before confirming this order.' });
    }
    if (status === 'all_done') {
      const unpaidOnline = await pool.query("SELECT 1 FROM orders WHERE table_number=$1 AND status NOT IN ('all_done','cancelled') AND razorpay_order_id IS NOT NULL AND payment_status <> 'paid' LIMIT 1", [current.rows[0].table_number]);
      if (unpaidOnline.rowCount) return res.status(409).json({ error: 'Wait for every online payment at this table to be confirmed before marking it ALL DONE.' });
    }
    const result = status === 'all_done'
      ? await pool.query("UPDATE orders SET status='all_done', updated_at=NOW() WHERE table_number=$1 AND status NOT IN ('all_done','cancelled') RETURNING id", [current.rows[0].table_number])
      : await pool.query('UPDATE orders SET status=COALESCE($1,status), payment_status=COALESCE($2,payment_status), updated_at=NOW() WHERE id=$3 RETURNING id', [status || null, payment_status || null, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
    const order = await getOrder(req.params.id);
    res.json({ order });
  } catch (error) { next(error); }
});

app.patch('/api/admin/menu/:id', requireAuth, requireMenuManager, async (req, res, next) => {
  const { name, description, price, category, is_veg, is_available, image_url } = req.body || {};
  if (price === undefined || !Number.isFinite(Number(price)) || Number(price) < 0 || !category) return res.status(400).json({ error: 'Enter a valid price and category.' });
  try {
    const result = await pool.query(`UPDATE menu_items SET name=COALESCE(NULLIF($1,''),name), description=COALESCE($2,description), price=$3, category=$4, is_veg=COALESCE($5,is_veg), is_available=COALESCE($6,is_available), image_url=COALESCE($7,image_url), updated_at=NOW() WHERE id=$8 RETURNING *`, [name || null, description ?? null, Number(price).toFixed(2), category, typeof is_veg === 'boolean' ? is_veg : null, typeof is_available === 'boolean' ? is_available : null, image_url ?? null, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Menu item not found.' });
    res.json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/admin/menu', requireAuth, requireMenuManager, async (req, res, next) => {
  const { name, description, price, category, is_veg = true, image_url = '' } = req.body || {};
  if (!name?.trim() || !category?.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Enter a name, category and valid price.' });
  try {
    const result = await pool.query('INSERT INTO menu_items(name,description,price,category,is_veg,image_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [name.trim(), description || '', Number(price).toFixed(2), category.trim(), Boolean(is_veg), image_url || null]);
    res.status(201).json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

app.patch('/api/admin/settings', requireAuth, requireStaff, async (req, res, next) => {
  const { restaurant_name, tax_rate, reservation_charge, table_count, upi_id, upi_name } = req.body || {};
  const rate = Number(tax_rate);
  const bookingCharge = Number(reservation_charge);
  const tables = Number(table_count);
  if (!restaurant_name?.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isFinite(bookingCharge) || bookingCharge < 0 || bookingCharge > 100000 || !Number.isInteger(tables) || tables < 1 || tables > 200 || !upi_id?.trim() || !upi_name?.trim()) return res.status(400).json({ error: 'Check the restaurant name, tax, booking charge, table count and UPI details.' });
  try {
    const result = await pool.query(`INSERT INTO restaurant_settings(id,restaurant_name,tax_rate,reservation_charge,table_count,upi_id,upi_name) VALUES(1,$1,$2,$3,$4,$5,$6)
      ON CONFLICT(id) DO UPDATE SET restaurant_name=EXCLUDED.restaurant_name,tax_rate=EXCLUDED.tax_rate,reservation_charge=EXCLUDED.reservation_charge,table_count=EXCLUDED.table_count,upi_id=EXCLUDED.upi_id,upi_name=EXCLUDED.upi_name,updated_at=NOW()
      RETURNING restaurant_name,tax_rate,reservation_charge,table_count,upi_id,upi_name`, [restaurant_name.trim(), rate, bookingCharge, tables, upi_id.trim(), upi_name.trim()]);
    res.json({ settings: result.rows[0] });
  } catch (error) { next(error); }
});

async function initializeDatabase() {
  if (!process.env.DATABASE_URL || jwtSecret.length < 24) throw new Error('Set DATABASE_URL to a reachable PostgreSQL connection URL and set a JWT_SECRET with at least 24 characters.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(3916, 1)');
    const schemaUrl = new URL('./db/schema.sql', import.meta.url);
    await client.query(await readFile(schemaUrl, 'utf8'));
    const seedUrl = new URL('./db/seed.sql', import.meta.url);
    await client.query(await readFile(seedUrl, 'utf8'));
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) throw new Error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) in the Vercel project environment variables.');
    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existing = await client.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    if (existing.rowCount) await client.query("UPDATE users SET name=$1,email=$2,password_hash=$3 WHERE id=$4", [ADMIN_NAME || 'Restaurant Owner', email, passwordHash, existing.rows[0].id]);
    else await client.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash", [ADMIN_NAME || 'Restaurant Owner', email, passwordHash]);
    const { STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD } = process.env;
    if (STAFF_NAME || STAFF_EMAIL || STAFF_PASSWORD) {
      const staffEmail = String(STAFF_EMAIL || '').trim().toLowerCase();
      if (!String(STAFF_NAME || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail) || !STAFF_PASSWORD || STAFF_PASSWORD.length < 12) {
        throw new Error('Set STAFF_NAME, STAFF_EMAIL, and STAFF_PASSWORD (12+ characters) together, or leave all three blank.');
      }
      const existingStaff = await client.query('SELECT id, role FROM users WHERE email=$1', [staffEmail]);
      if (existingStaff.rowCount && existingStaff.rows[0].role !== 'staff') throw new Error('STAFF_EMAIL is already assigned to a non-staff account.');
      const staffPasswordHash = await bcrypt.hash(STAFF_PASSWORD, 12);
      if (existingStaff.rowCount) {
        await client.query('UPDATE users SET name=$1,password_hash=$2 WHERE id=$3', [STAFF_NAME.trim(), staffPasswordHash, existingStaff.rows[0].id]);
      } else {
        await client.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff')", [STAFF_NAME.trim(), staffEmail, staffPasswordHash]);
      }
    }
    const { KITCHEN_NAME, KITCHEN_EMAIL, KITCHEN_PASSWORD } = process.env;
    if (KITCHEN_NAME || KITCHEN_EMAIL || KITCHEN_PASSWORD) {
      const kitchenEmail = String(KITCHEN_EMAIL || '').trim().toLowerCase();
      if (!String(KITCHEN_NAME || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kitchenEmail) || !KITCHEN_PASSWORD || KITCHEN_PASSWORD.length < 12) {
        throw new Error('Set KITCHEN_NAME, KITCHEN_EMAIL, and KITCHEN_PASSWORD (12+ characters) together, or leave all three blank.');
      }
      const existingKitchen = await client.query('SELECT id, role FROM users WHERE email=$1', [kitchenEmail]);
      if (existingKitchen.rowCount && existingKitchen.rows[0].role !== 'kitchen') throw new Error('KITCHEN_EMAIL is already assigned to a non-kitchen account.');
      const kitchenPasswordHash = await bcrypt.hash(KITCHEN_PASSWORD, 12);
      if (existingKitchen.rowCount) {
        await client.query('UPDATE users SET name=$1,password_hash=$2 WHERE id=$3', [KITCHEN_NAME.trim(), kitchenPasswordHash, existingKitchen.rows[0].id]);
      } else {
        await client.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'kitchen')", [KITCHEN_NAME.trim(), kitchenEmail, kitchenPasswordHash]);
      }
    }
    const settings = await client.query('SELECT id FROM restaurant_settings WHERE id=1');
    if (!settings.rowCount) await client.query('INSERT INTO restaurant_settings(id,restaurant_name,tax_rate,table_count,upi_id,upi_name) VALUES(1,$1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [process.env.RESTAURANT_NAME || 'The Green Table', Number(process.env.RESTAURANT_TAX_RATE || 5), Number(process.env.RESTAURANT_TABLE_COUNT || 24), process.env.RESTAURANT_UPI_ID || 'your-restaurant@upi', process.env.RESTAURANT_UPI_NAME || 'The Green Table']);
    await client.query('COMMIT');
    console.log('Database schema and starter menu are ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'The server could not complete that request. Please try again.' });
});

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  databaseReady = initializeDatabase();
  databaseReady.then(() => app.listen(port, () => console.log(`TableTap API listening on port ${port}`))).catch(error => { console.error('Could not start TableTap:', error.message); process.exitCode = 1; });
}

export { app, pool };
export default app;
