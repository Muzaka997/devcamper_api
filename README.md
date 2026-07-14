# DevCamper API

Backend REST API for **DevCamper**, a learning platform (courses, books, tests, user
accounts). Built with **Node.js + Express + MongoDB (Mongoose)** and deployed as a
**serverless function on Vercel**.

Frontend: <https://learning-app-inky-tau.vercel.app> (local dev at `http://localhost:5173`).

---

## Tech Stack

- **Runtime:** Node.js, Express 4
- **Database:** MongoDB Atlas via Mongoose
- **Auth:** JWT (httpOnly cookie) + bcrypt
- **File uploads:** Multer (memory) → Cloudinary
- **Email:** Nodemailer (Gmail SMTP)
- **Hosting:** Vercel (`serverless-http`)
- **Security:** helmet, express-mongo-sanitize, xss-clean, hpp, express-rate-limit, CORS

---

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB Atlas connection string
- Cloudinary account (for image uploads)
- Gmail account with an **app password** (for email)

### Install

```bash
cd devcamper_api
npm install        # or: yarn
```

### Environment variables

Create `config/config.env` (gitignored). See [cloud.md](cloud.md) for the full breakdown.

```env
NODE_ENV=development
PORT=5001

MONGODB_URI=<your-atlas-connection-string>

GEOCODER_PROVIDER=mapquest
GEOCODER_API_KEY=<mapquest-key>

FILE_UPLOAD_PATH=./public/uploads
MAX_FILE_UPLOAD=1000000

JWT_SECRET=<random-secret>
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

SMTP_SERVICE=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_EMAIL=<your-email>
SMTP_PASSWORD=<gmail-app-password>
FROM_EMAIL=<your-email>
FROM_NAME=devcamper_api
CONTACT_RECIPIENT_EMAIL=<recipient-email>

FRONTEND_URL=https://learning-app-inky-tau.vercel.app
FRONTEND_LOCAL_URL=http://localhost:5173
# ALLOWED_ORIGINS=https://a.com,https://b.com   # optional, comma-separated

CLOUD_NAME=<cloudinary-cloud-name>
CLOUD_API_KEY=<cloudinary-api-key>
CLOUD_API_SECRET=<cloudinary-api-secret>
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud-name>
```

> **Never commit real secrets.** In production, set these in the Vercel dashboard.

### Run

```bash
npm run dev     # nodemon, development mode
npm start       # production mode (NODE_ENV=production)
```

Server runs on `http://localhost:5001`. Health check: `GET /api/health`.

---

## Scripts

| Command                   | Description                                              |
|---------------------------|----------------------------------------------------------|
| `npm run dev`             | Start with nodemon (development)                         |
| `npm start`               | Start in production mode                                 |
| `npm run migrate:images`  | One-off: upload local book images to Cloudinary          |
| `node seeder.js`          | Seed / destroy sample data (see file for flags)          |

---

## Project Structure

```
devcamper_api/
├── api/index.js          # Vercel serverless entry (wraps Express app)
├── server.js             # Express app: middleware, routes, exports app
├── vercel.json           # Vercel build + routing config
├── config/
│   ├── db.js             # Mongoose connection (serverless-tuned)
│   └── config.env        # Environment variables (gitignored)
├── controllers/          # Route handlers (auth, users, courses, books, tests, contact)
├── routes/               # Express routers, mounted under /api/v1
├── models/               # Mongoose schemas (User, Course, Book, Test)
├── middleware/           # auth, error, async, advancedResults, uploadPdf, logger
├── utils/                # sendEmail, geocoder, errorResponse
├── scripts/migrateImages.js
├── _data/                # Seed JSON (courses, books, tests, users)
└── public/uploads/       # Local upload storage
```

---

## API Endpoints

Base path: `/api/v1`

### Auth — `/auth`
| Method | Endpoint                     | Access  | Description                     |
|--------|------------------------------|---------|---------------------------------|
| POST   | `/register`                  | Public  | Register + sign in              |
| POST   | `/login`                     | Public  | Log in                          |
| GET    | `/logout`                    | Private | Clear auth cookie               |
| GET    | `/me`                        | Private | Current user                    |
| PUT    | `/updatedetails`             | Private | Update name/email               |
| PUT    | `/updatepassword`            | Private | Update password                 |
| POST   | `/forgotpassword`            | Public  | Send reset token email          |
| PUT    | `/resetpassword/:resettoken` | Public  | Reset password                  |

### Users — `/users`
| Method | Endpoint            | Access            | Description               |
|--------|---------------------|-------------------|---------------------------|
| GET    | `/`                 | Private/publisher | List users (paginated)    |
| POST   | `/`                 | Private/publisher | Create user               |
| GET    | `/:id`              | Private/publisher | Get user                  |
| PUT    | `/:id`              | Private/publisher | Update user               |
| DELETE | `/:id`              | Private/publisher | Delete user               |
| PUT    | `/:id/photo`        | Private           | Upload profile photo      |
| POST   | `/:id/submit`       | Private           | Submit test answers       |

### Courses — `/courses`
| Method | Endpoint | Access | Description        |
|--------|----------|--------|--------------------|
| GET    | `/`      | Public | List courses       |
| GET    | `/:id`   | Public | Get single course  |

### Books — `/books`
| Method | Endpoint | Access | Description   |
|--------|----------|--------|---------------|
| GET    | `/`      | Public | List books    |

### Tests — `/tests`
| Method | Endpoint | Access | Description                                |
|--------|----------|--------|--------------------------------------------|
| GET    | `/`      | Public | List tests                                 |
| GET    | `/:id`   | Public | Get test (correct answers stripped)        |

### Contact — `/contact`
| Method | Endpoint | Access  | Description                          |
|--------|----------|---------|--------------------------------------|
| POST   | `/`      | Private | Send contact email (uses account email) |

### Health
| Method | Endpoint       | Access | Description        |
|--------|----------------|--------|--------------------|
| GET    | `/api/health`  | Public | Uptime / liveness  |

---

## Authentication

- On register/login, a JWT is signed and returned in the body **and** set as an
  httpOnly cookie (`token`).
- Protected routes accept the token via `Authorization: Bearer <token>`, an
  `x-auth-token` header, or the cookie.
- In production, the cookie is `secure` + `sameSite=none` to support the cross-domain
  frontend.

---

## Security

helmet (with CSP `frame-ancestors` allow-list), Mongo injection sanitization, XSS
cleaning, HTTP param pollution protection, and rate limiting (100 requests / 10 min).
CORS allows configured origins plus any `*.vercel.app` preview deployment.

---

## Deployment

Deployed on Vercel. `vercel.json` routes all requests to `api/index.js`, which wraps the
Express app with `serverless-http`. Set all environment variables in the Vercel project
dashboard (they are **not** read from `config/config.env` in production).

See **[cloud.md](cloud.md)** for the full cloud-services reference (MongoDB Atlas,
Cloudinary, Gmail SMTP, MapQuest, Vercel).

---

## License

MIT
