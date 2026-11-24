# TableTap

TableTap is a guest-first QR table ordering website with a private restaurant admin dashboard. Customers choose a table, pick from a 50-item Kolkata-style starter menu, enter their name and required phone number, then pay at the counter or use Razorpay Standard Checkout for UPI, cards, and other account-enabled payment methods. Admins receive a prominent dashboard alert for new orders, confirm orders, update kitchen status, and see provider-confirmed payments automatically. Orders, payment references, item snapshots, tax, and customer details are stored in PostgreSQL.

## Razorpay payments

Online checkout uses Razorpay Standard Checkout. The API creates a Razorpay order using the database-calculated total in paise. The browser never receives the secret key. After checkout, the backend verifies Razorpay's signature and fetches the payment to confirm the order, amount, currency, and `captured` status. A signed `payment.captured` webhook provides the same automatic update if the customer closes the page before the checkout callback completes. The webhook uses the raw request body, validates HMAC-SHA256, and deduplicates Razorpay event IDs.

Keep Razorpay credentials private. For deployment, add the existing values for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to Vercel's environment variables. Configure the matching webhook in the Razorpay Dashboard (test mode while testing) with URL `https://YOUR_VERCEL_DOMAIN/api/payments/razorpay/webhook` and event `payment.captured`. The webhook secret in the dashboard must match `RAZORPAY_WEBHOOK_SECRET` in Vercel. The checkout callback also verifies payment immediately; the webhook covers delayed or closed-browser cases.

Razorpay test keys simulate transactions and do not collect real money. Before live use, replace both keys with live-mode credentials, configure a live-mode webhook, and confirm the merchant account and desired methods are enabled. Set Razorpay to auto-capture payments; TableTap only treats a captured payment as paid. Never put `RAZORPAY_KEY_SECRET` or the webhook secret in a `VITE_` variable.

## Run locally on Windows

Install Node.js 20+ and use any PostgreSQL 15+ database. TableTap uses the standard `pg` Node.js driver and PostgreSQL SQL, not a provider-specific SDK. Local PostgreSQL, Neon, Supabase, Railway, Render, and other PostgreSQL-compatible hosts use the same `DATABASE_URL` setting.

1. Open PowerShell in the project folder. If using Docker, start PostgreSQL:

   ```powershell
   docker run --name tabletap-db -e POSTGRES_PASSWORD=tabletap-local -e POSTGRES_DB=tabletap -p 5432:5432 -d postgres:16
   ```

2. Make sure `backend/.env` has the database, admin, and payment settings. If that private file is already configured, keep its values. If you need a template, copy `backend/.env.example` to `backend/.env` and fill in your own values. Never commit `.env` files.

   Set `DATABASE_URL`, a random `JWT_SECRET` with at least 24 characters, a private `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` with at least 12 characters. For local PostgreSQL, a typical URL is `postgresql://postgres:YOUR_PASSWORD@localhost:5432/tabletap`. For a hosted database, paste its PostgreSQL URL; include provider-required TLS options such as `sslmode=require`. Neon users can use its pooled URL for serverless hosting. Set the initial `RESTAURANT_NAME`, `RESTAURANT_TAX_RATE`, `RESTAURANT_TABLE_COUNT`, and UPI display values if useful. Optional `STAFF_NAME`, `STAFF_EMAIL`, and `STAFF_PASSWORD` (12+ characters) bootstrap a staff account; leave all three blank to create staff from Admin → Settings. Optional `KITCHEN_NAME`, `KITCHEN_EMAIL`, and `KITCHEN_PASSWORD` (12+ characters) bootstrap the kitchen display account.

3. Install dependencies and start both services. In development, the Vite server forwards `/api` requests to the local Express server on port 4000:

   ```powershell
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   npm run dev
   ```

4. The API creates/upgrades its tables and installs the 50-item starter menu once. Visit `/admin` or use the **Admin login** or **Staff login** link at the bottom of the customer website.

## Customer and admin workflow

1. Customer picks table and menu items, then opens checkout.
2. Checkout collects their name and required phone number. The backend verifies menu prices and calculates tax from database settings.
3. Counter orders and Razorpay checkout orders appear in the admin list and open a prominent popup within two seconds while the dashboard is open. Staff can view the live floor map and choose **SEND TO KITCHEN**; only sent tickets appear in the kitchen display. Admins can search by customer name, phone, or order ID. An online order cannot be confirmed for kitchen fulfillment until Razorpay marks its payment captured.
4. Admin or staff updates order status (confirmed, preparing, ready, served, **ALL DONE**, or cancelled). **ALL DONE** releases the table for the next customer. The current tab tracks only its newly placed order IDs in `sessionStorage`; refresh keeps status available, while a new browser session starts clean. Final statuses automatically clear active tracking. Customers can use the top bag icon and checkout name plus phone to explicitly look up past orders.
5. Admin marks a counter payment paid after receiving it. Razorpay payments change to paid automatically after server verification. Only a paid order exposes the itemized bill print dialog; use the browser's **Save as PDF** option to download a PDF.

Keep the admin or staff dashboard open to receive new-order and waiter-request popups; it checks every two seconds. If disconnected, the order remains in the dashboard list and is loaded again when the dashboard reconnects. Staff accounts are created by an admin in dashboard Settings; staff do not see daily order or revenue totals and can update payment only for counter orders. Kitchen sign-in is available at `/kitchen`; tickets update every two seconds, include a selectable prep timer, and sync statuses to the customer's fixed order panel.

## Table reservations

Customers can choose **Reserve a table** in the top bar and request a visit with their name, phone number, group size, and date/time. The request is saved as pending and appears in the Reservations tab for both admin and staff; a new request also opens an in-dashboard alert. Staff accepts or rejects the request, and acceptance requires assigning a table. The database prevents the same table being accepted for another two-hour booking window.

The booking charge is set in Admin → Settings. It is saved with the reservation so later setting changes do not alter existing bookings. When staff choose **Take food order** for an accepted reservation, the existing menu order form opens with its customer and table filled in; the booking charge is included in that order total and bill. The schema change is additive and safe to rerun: existing restaurant, menu, order, and payment rows are preserved.

## Deploy the frontend and backend together on Vercel

The root `vercel.json` configures two services in one Vercel project. Vercel builds `frontend/` as the Vite site and `backend/` as the Express API; `/api/*` goes to the API and all other routes go to the site. Vercel currently offers Services in beta on all plans. See [Vercel Services](https://vercel.com/docs/services) and [Services routing](https://vercel.com/docs/services/routing).

1. Choose any hosted PostgreSQL provider, create a database, and copy the PostgreSQL connection URL it provides. For Neon on Vercel, use its pooled connection URL. Preserve URL options like `sslmode=require` when the provider requires TLS. The backend uses the standard `pg` driver and initializes `backend/db/schema.sql` plus `backend/db/seed.sql` on first request. Vercel cannot connect to a database running only on your computer.
2. Push this project to a Git repository you control, then import that repository in Vercel. Set the project Root Directory to the repository root (the folder containing this `README.md` and `vercel.json`). Keep the configured services in `vercel.json`; do not set `frontend/` as the project root.
3. In Vercel → Project Settings → Environment Variables, add the values you already use in `backend/.env` for: `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `JWT_SECRET`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESTAURANT_NAME`, `RESTAURANT_TAX_RATE`, `RESTAURANT_TABLE_COUNT`, `RESTAURANT_UPI_ID`, `RESTAURANT_UPI_NAME`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. `DATABASE_POOL_MAX` is optional; the default is 5 connections per serverless instance. Optionally add `STAFF_NAME`, `STAFF_EMAIL`, and `STAFF_PASSWORD` to bootstrap one staff login; add `KITCHEN_NAME`, `KITCHEN_EMAIL`, and `KITCHEN_PASSWORD` to bootstrap the kitchen display login. Keep secret values in Vercel's server environment settings; never create `VITE_` variables for secrets. `FRONTEND_URL` is only needed if you intentionally allow a separate browser origin.
4. Deploy. The API initializes/upgrades the database schema and starter menu on first request. Visit `/api/health` on the Vercel domain, then use **Admin login**, **Staff login**, or **Kitchen display** in the site footer. The restaurant dashboard refreshes orders every two seconds and shows a prominent popup when a new order arrives.
5. In Razorpay Dashboard, configure a `payment.captured` webhook pointing to `https://YOUR_VERCEL_DOMAIN/api/payments/razorpay/webhook`. Use the same webhook secret already configured as `RAZORPAY_WEBHOOK_SECRET` in Vercel. The test credentials only simulate transactions; use your Razorpay live credentials to collect real payments.

When you change an environment variable in Vercel, redeploy so the new value is applied. Check Vercel's current plan limits and beta availability before using it for a production restaurant.

## Branding and menu

- Edit **`frontend/src/restaurantContent.js`** to change the default restaurant name, optional logo URL, hero title, hero description, hero/story/visit photos, descriptions, opening hours, phone, address, visit banner, and footer copy. Photo fields accept an Unsplash photo ID or a direct `https://` URL. A logo can be a URL or a file such as `/restaurant-logo.png` placed in `frontend/public/`.
- The restaurant name and tax rate persist in the database after the first run. Use Admin → Settings to change live values; use `RESTAURANT_NAME` and `RESTAURANT_TAX_RATE` for the initial database defaults.
- Use Admin → Menu to edit dishes and prices. The 50 starter items are in `backend/db/seed.sql`; the seed migration runs once. Older dishes from the previous 100-item Kolkata seed are marked unavailable, not deleted, so old order bills and item snapshots remain intact.
- Change the look in `frontend/src/premium.css` and component-level styles in `index.css`, `customer.css`, and `admin.css`.
- For QR stickers, use `https://your-site.example/?table=7` for table 7. Customers can still change the table selection.

## Database tables

- `users`: restaurant admin, staff, kitchen, and any existing account rows; passwords are hashed. Customer ordering no longer requires an account.
- `restaurant_settings`: restaurant name, tax percent, table count, and UPI display details.
- `menu_items`: current name, description, price, category, availability, and photo URL.
- `orders`: customer name/email/required phone, table, payment method/status, order status, Razorpay order/payment IDs, kitchen handoff time, prep timer, timestamps, subtotal, tax rate/amount and total. Guest tracking secrets are stored as hashes. `payment_webhook_events` deduplicates verified Razorpay webhook events.
- `reservations`: customer name/phone, party size, requested date/time, snapshot booking charge, assigned table, review status, and timestamps. Reservation-linked table orders store the reservation ID and booking-charge amount.
- `order_items`: item name and price snapshot, quantity and line total at the time of order.
- `waiter_alerts`: table calls for service and staff acknowledgements. `order_reviews` stores a customer's one-to-five-star rating after service.

The backend enforces separate admin, staff, and kitchen permissions. Never place database credentials, JWT secrets, or gateway secrets in frontend variables beginning with `VITE_`.
