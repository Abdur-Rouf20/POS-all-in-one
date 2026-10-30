# Simple bilingual POS MVP (MERN + Docker)

A modular, single-deployment POS starter built with React/Vite, Express/Mongoose (MVC-style), and MongoDB. Frontend, backend, and database run as separate Docker services.

## Features
- English / বাংলা language switch (interface and printable invoice labels)
- Dashboard with sales, invoice, product, and low-stock summaries
- Product setup: create, edit, delete, search, stock, price, SKU
- Invoice creation with multiple products, quantity, discount, customer details, and automatic totals
- Persistent invoice storage in MongoDB; invoice list, detail, and edit
- Print-friendly invoice screen (`Print / PDF` uses the browser print dialog)
- Store settings for business name, address, phone, currency label, tax rate, and invoice footer
- Centralized UI labels and reusable components so feedback-driven changes are easier

## Run with Docker
Requirements: Docker Desktop (Windows/macOS) or Docker Engine + Compose.

1. Extract this ZIP.
2. Open a terminal in the extracted `pos-mvp` folder.
3. Run:
   ```bash
   docker compose up --build -d
   ```
4. Open the app at http://localhost:8080
   - API health: http://localhost:5000/api/health
   - MongoDB is available on localhost:27017 for local development tools.
5. Stop: `docker compose down`
6. Stop without deleting saved data: `docker compose down` (Mongo data stays in the named volume).
7. Delete all saved data permanently: `docker compose down -v` (use with care).

## Project structure
```
frontend/              React UI, pages, translations, API client
backend/src/models/    Mongoose schemas
backend/src/controllers/ request handlers
backend/src/routes/    REST endpoints
backend/src/config/    database connection
compose.yaml           frontend + backend + MongoDB services
```

## API endpoints
- `GET /api/health`
- `GET/POST /api/products`
- `GET/PUT/DELETE /api/products/:id`
- `GET/POST /api/invoices`
- `GET/PUT /api/invoices/:id`
- `GET/PUT /api/settings` (settings are created with defaults on first read)
- `GET /api/dashboard/summary`

## Customization notes
- Interface copy is centralized in `frontend/src/i18n.js`.
- Invoice print layout is in `frontend/src/pages/InvoiceDetail.jsx` and `frontend/src/styles.css`.
- Business settings are edited from **Settings** in the app.
- API validation and business logic are in backend controllers; data shape is in Mongoose models.
- This is an MVP, not a production-hardened retail system. Before real deployment, add authentication/roles, audit logs, automated backups, request rate limits, stronger validation, and a proper tax/accounting review. Do not expose MongoDB publicly on a production server.


## Multi-branch auth / RBAC update

1. Copy `.env.example` to `.env` in the project root and set a long random `JWT_SECRET`, `OWNER_EMAIL`, and a strong `OWNER_PASSWORD`. Never commit `.env`.
2. Run `docker compose up --build -d`. On an empty database the API seeds the owner account and a default Main Branch. Existing databases do not have credentials or branch data automatically migrated.
3. Sign in at http://localhost:8080 with the owner credentials. Create additional branches through `POST /api/branches` (owner only) and salesman accounts through `POST /api/auth/users/salesman`.

### API additions
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/branches`, `PUT /api/branches/:id`
- `GET /api/inventory`, `POST /api/inventory/receive`, `GET /api/inventory/movements`
- `POST /api/payments/invoices/:id/collect-due`, `GET /api/payments/invoices/:id`
- All branch-scoped calls use `X-Branch-Id`; salesman access is forced to the branch assigned to their account.

### Roles and audit attribution
Owner has all permissions. Salesman permissions include inventory.view, inventory.receive, invoice.create, invoice.view, and payment.receive. Invoice documents store `createdBy` (user id, name, role); payment documents store `receivedBy`; stock movements and audit logs store actor id, name, and role. This records who received stock, sold products/created an invoice, and collected due payments. Do not delete audit logs as part of ordinary editing.

### Important MVP caveats
This is an initial implementation, not yet production-hardened. Existing data needs a migration before upgrading a populated database because invoices now require `branchId` and `createdBy`. Stock receiving/sales are recorded as movements, but multi-document operations are not yet wrapped in MongoDB transactions; use a replica set and transactions or add a robust compensation strategy before real-money production use. Owner dashboard aggregation currently supports all branches when no branch is selected; the frontend branch selector chooses one branch. A separate all-branches UI option and full inventory/payment screens can be added next.
# POS-all-in-one
