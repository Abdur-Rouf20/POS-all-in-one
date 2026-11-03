# Phase 6 — Expense Tracker

## Included
- Owner-only expense management enforced by the backend.
- Branch-scoped expense records using the selected branch.
- Create, list, edit and delete expense records.
- Categories: Shop rent, Electricity, Internet, Utilities, Snacks, Transport, Maintenance, Packaging and Other.
- Cash, Bangla QR and mixed payment splits with server-side validation.
- Date and category filters, payment summaries, and browser printing.
- Audit events for create, update and delete.

## Apply
1. Stop containers (optional): `docker compose down`
2. Extract this patch into the project root (the folder containing `backend`, `frontend`, and `compose.yaml`).
3. Merge folders and replace the listed existing files.
4. Keep `.env`, `compose.yaml`, MongoDB data and unrelated files unchanged.
5. Rebuild: `docker compose up -d --build`
6. Sign in as Owner, select a branch, and open **Expense Tracker** from the sidebar.

Do not run `docker compose down -v`; it can delete the MongoDB data volume.

## Files
- Create `backend/src/models/Expense.js`
- Create `backend/src/controllers/expenseController.js`
- Create `backend/src/routes/expenseRoutes.js`
- Replace `backend/src/server.js`
- Create `frontend/src/pages/Expenses.jsx`
- Replace `frontend/src/App.jsx`
- Replace `frontend/src/components/Layout.jsx`
- Replace `frontend/src/services/api.js`
- Replace `PROJECT_PROGRESS.md`

## Notes
- Expense data is branch-specific; the selected branch is sent in `X-Branch-Id`.
- Only an Owner can access the API. Backend routes enforce the role.
- Editing or deleting an expense creates an audit log. This phase does not implement bank-account reconciliation.
- Date filters are interpreted using the server's local timezone.
