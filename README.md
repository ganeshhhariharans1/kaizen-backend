# Kaizen Studio India — Backend

Express.js backend for the Kaizen Studio India website.  
Handles client applications, a shared slot counter, email notifications, and an admin dashboard.

---

## What this does

| Feature | Before | After |
|---|---|---|
| Form submission | Opens Gmail compose window | POST to `/api/apply` — saved to JSON + email sent automatically |
| Slot counter | `localStorage` (per-browser only) | Shared across all visitors via `/api/slots` |
| Admin panel | None | `/admin.html` — view, filter, update status, export CSV |
| Email | Manual | Auto-notifies owner on every submission |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Then edit `.env`:

```env
PORT=3000
TOTAL_SLOTS=20
ADMIN_KEY=pick-a-strong-random-string
EMAIL_USER=ganeshhariharan.s8@gmail.com
EMAIL_PASS=your-gmail-app-password    # See note below
OWNER_EMAIL=ganeshhariharan.s8@gmail.com
```

> **Gmail App Password:**  
> Go to [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → App Passwords  
> Generate one for "Mail" and paste it as `EMAIL_PASS`.  
> Never use your actual Gmail password here.

### 3. Run the server
```bash
# Development (auto-restarts on file changes — Node 18+)
npm run dev

# Production
npm start
```

### 4. Open the site
- **Website:** http://localhost:3000/kaizen_final.html
- **Admin dashboard:** http://localhost:3000/admin.html

---

## API Reference

### `GET /api/slots`
Returns current month's slot count. No auth required.

```json
{ "taken": 5, "total": 20, "remaining": 15, "month": "2025-6" }
```

### `POST /api/apply`
Submit a client application.

**Body (JSON):**
```json
{
  "name": "Ravi Kumar",
  "company": "RD Biryani",
  "phone": "9876543210",
  "selectedType": "dept",
  "department": "marketing",
  "services": ["Social Media Management", "Campaign Design"],
  "needs": "Looking to scale Instagram presence"
}
```
Or for a flagship package:
```json
{
  "name": "Ravi Kumar",
  "company": "RD Biryani",
  "phone": "9876543210",
  "selectedType": "flag",
  "flagPackage": "Full-Service Retainer",
  "flagPrice": "Rs. 1,00,000 / month",
  "flagDesc": "Complete end-to-end brand and marketing."
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Application received. We'll get back to you within 2 hours.",
  "id": "uuid-here",
  "slots": { "taken": 6, "total": 20, "remaining": 14 }
}
```

### `GET /api/applications` *(admin)*
Returns all applications. Requires `x-admin-key` header.

### `PATCH /api/applications/:id/status` *(admin)*
Update application status. Valid values: `new`, `contacted`, `onboarded`, `rejected`.

### `DELETE /api/applications/:id` *(admin)*
Delete an application permanently.

---

## Data storage

Applications are saved to `data/applications.json`.  
Slot counts are saved to `data/slots.json`.  
Both files are created automatically on first run.

> For production with higher traffic, swap the JSON file reads/writes in `server.js`  
> for a proper database (e.g. SQLite with `better-sqlite3`, or PostgreSQL with `pg`).

---

## Deployment (Railway / Render / VPS)

1. Push the `kaizen-backend/` folder to a GitHub repo.
2. Connect the repo to [Railway](https://railway.app) or [Render](https://render.com).
3. Set the environment variables in the platform's dashboard (same as `.env`).
4. Set start command: `node server.js`
5. Update `API_BASE` in both `kaizen_final.html` and `admin.html` to your deployed URL.

---

## File structure

```
kaizen-backend/
├── server.js            ← main backend (Express API)
├── admin.html           ← admin dashboard (open in browser)
├── kaizen_final.html    ← website (updated to call the API)
├── .env.example         ← copy to .env and fill in values
├── package.json
└── data/                ← auto-created on first run
    ├── applications.json
    └── slots.json
```
