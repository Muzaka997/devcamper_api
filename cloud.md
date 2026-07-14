# Cloud Configuration — `devcamper_api`

Reference for every cloud/external service the backend depends on: what it does,
where it's configured in code, and which environment variables drive it.

> **Secrets note:** all live credentials currently sit in [`config/config.env`](config/config.env)
> (gitignored). This file documents the **variable names only** — never commit real
> secret values into this doc. For production, set these in the Vercel dashboard, not in a file.

---

## Overview

| Service         | Purpose                          | Configured in                                              | Key env vars |
|-----------------|----------------------------------|------------------------------------------------------------|--------------|
| Vercel          | Serverless hosting               | `vercel.json`, `api/index.js`                              | (all of the below) |
| MongoDB Atlas   | Primary database                 | `config/db.js`                                             | `MONGODB_URI` |
| Cloudinary      | Image storage / uploads          | `controllers/users.js`, `scripts/migrateImages.js`        | `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `CLOUDINARY_URL` |
| Gmail SMTP      | Transactional / contact email    | `utils/sendEmail.js`                                      | `SMTP_*`, `FROM_*`, `CONTACT_RECIPIENT_EMAIL` |
| MapQuest        | Geocoding (configured, unused)   | `utils/geocoder.js`                                       | `GEOCODER_PROVIDER`, `GEOCODER_API_KEY` |

---

## 1. Vercel (hosting)

The Express app is deployed as a single serverless function.

- [`server.js`](server.js) builds and **exports** the Express `app`; it only calls
  `app.listen()` when run directly (`require.main === module`), so local dev works
  while serverless does not double-listen.
- [`api/index.js`](api/index.js) wraps the app with `serverless-http`:
  ```js
  const serverless = require("serverless-http");
  const app = require("../server");
  module.exports = serverless(app);
  ```
- [`vercel.json`](vercel.json) builds `api/index.js` with `@vercel/node` and routes
  **all** paths (`/(.*)`) to it.

**Env vars to set in the Vercel project** (Production + Preview):
`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`,
`CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `CLOUDINARY_URL`,
`SMTP_SERVICE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASSWORD`,
`FROM_EMAIL`, `FROM_NAME`, `CONTACT_RECIPIENT_EMAIL`,
`FRONTEND_URL`, `FRONTEND_LOCAL_URL`, `ALLOWED_ORIGINS` (optional, CSV),
`GEOCODER_PROVIDER`, `GEOCODER_API_KEY`.

> On Vercel, env vars come from the dashboard — `config/config.env` is **not** deployed
> (it's gitignored). Make sure every var above exists in the Vercel project settings.

**Health check:** `GET /api/health` → `{ status: "ok", uptime }`.

---

## 2. MongoDB Atlas (database)

- Configured in [`config/db.js`](config/db.js). Connection is **serverless-tuned**:
  - `mongoose.set("bufferCommands", false)` — fail fast instead of queueing ops when
    disconnected.
  - `serverSelectionTimeoutMS: 10000`.
  - Disconnect / reconnect events are logged.
- [`server.js`](server.js) connects at startup **and** re-checks the connection on every
  request via `ensureDBConnected` (readyState `1` → continue, else reconnect). This
  handles cold-started serverless instances where the socket may have dropped.

**Env var:** `MONGODB_URI` (Atlas SRV connection string).

**Ops checklist:**
- Atlas Network Access must allow Vercel egress — use `0.0.0.0/0` (Atlas serverless/shared)
  or Atlas' Vercel integration, since Vercel functions don't have static IPs.
- Rotate the DB user password (it's currently in `config.env`).

---

## 3. Cloudinary (image uploads)

Used for user profile photos and (via migration) book cover images.

**Currently configured inline in two places** — there is no shared config module:
- [`controllers/users.js`](controllers/users.js) — `userPhotoUpload` streams a Multer
  memory buffer to Cloudinary (`folder: "users"`) with `streamifier`, deletes the old
  image by derived `publicId`, and stores `result.secure_url` on `user.profilePhoto`.
- [`scripts/migrateImages.js`](scripts/migrateImages.js) — one-off migration that uploads
  local `public/uploads` book images to Cloudinary (`folder: "book-covers"`).

Both call:
```js
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
```

**Env vars:** `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `CLOUDINARY_URL`.
(The `CLOUDINARY_URL` form alone is enough for the SDK to auto-config if present.)

**Related upload middleware:** [`middleware/uploadPdf.js`](middleware/uploadPdf.js) uses
Multer memory storage (PDF only, 10 MB) intended for streaming PDFs to Cloudinary.

**Known inconsistency (not changed):** `Book.image` and `Course.image` are declared as
objects `{ url, publicId }` in the models, but the code writes a plain URL string
(`migrateImages.js`, `userPhotoUpload`). `User.profilePhoto` is a string. Worth
reconciling if/when you standardize image storage.

---

## 4. Gmail SMTP (email)

- [`utils/sendEmail.js`](utils/sendEmail.js) — nodemailer, SMTP-only. Strips spaces from
  the app password, tries multiple transports in order (service shortcut → explicit
  host/port 465 SMTPS → 587 STARTTLS), with 10–20s timeouts.
- Consumers: [`controllers/contact.js`](controllers/contact.js) (authenticated contact
  form; failure is swallowed so the UI still succeeds) and
  [`controllers/auth.js`](controllers/auth.js) (`forgotPassword` reset email).

**Env vars:** `SMTP_SERVICE` (`gmail`), `SMTP_HOST`, `SMTP_PORT` (`465`),
`SMTP_EMAIL`, `SMTP_PASSWORD` (Gmail **app password**), `FROM_EMAIL`, `FROM_NAME`,
`CONTACT_RECIPIENT_EMAIL`.

> Many serverless hosts block outbound SMTP on some ports. If email silently fails in
> prod, consider a HTTP email API (e.g. SendGrid — `@sendgrid/mail` is already a
> dependency) instead of raw SMTP.

---

## 5. MapQuest (geocoding)

- [`utils/geocoder.js`](utils/geocoder.js) sets up `node-geocoder` with MapQuest over
  HTTPS. **Not referenced by any active route** currently (legacy bootcamp geocoding).

**Env vars:** `GEOCODER_PROVIDER` (`mapquest`), `GEOCODER_API_KEY`.

---

## CORS & cookies (cross-origin cloud concern)

Because the API and frontend live on different Vercel domains, cross-origin handling is
central ([`server.js`](server.js)):

- Allowed origins = `ALLOWED_ORIGINS` (CSV) + `FRONTEND_URL` + `FRONTEND_LOCAL_URL` +
  defaults (`learning-app-inky-tau.vercel.app`, `http://localhost:5173`), plus **any**
  `https://*.vercel.app` (covers preview deployments).
- In non-production, all origins are allowed to avoid local CORS friction.
- `credentials: true`, `Set-Cookie` exposed, explicit preflight handler for all routes.
- Auth cookie (`controllers/auth.js` → `sendTokenResponse`): in prod `secure: true` +
  `sameSite: "none"` so the cookie survives cross-site; `lax` locally.

---

## Security TODOs (surfaced, not applied)

1. **Rotate & remove committed secrets.** `config/config.env` contains live Mongo, JWT,
   Cloudinary, Gmail, and MapQuest credentials. Move to Vercel env vars and rotate them.
2. **Centralize Cloudinary config** into a single `config/cloudinary.js` (currently
   duplicated in `users.js` and `migrateImages.js`).
3. **Reconcile image field shapes** (`{ url, publicId }` object vs. plain string).
