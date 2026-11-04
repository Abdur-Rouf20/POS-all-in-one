# Phase 8 — Reports, Export & Print

## Apply
1. Extract this patch ZIP.
2. Copy the `frontend` and `backend` folders into your existing POS project root.
3. Choose **Replace files** when Windows asks.
4. From the project root run:

```powershell
docker compose up -d --build
```

No database migration or new npm dependency is required.

## Included
- Dashboard CSV export with role-appropriate metrics.
- Dashboard print layout.
- Reports page with Sales, Returns, Money Receipts, Expenses (Owner only), and Inventory reports.
- Date range and Owner all-branches filters.
- CSV export and print for each report.
- Server-side branch scoping and Owner-only expense/cost fields.

## Notes
- Sales report known gross profit is before returns and excludes unknown/unconfirmed historical batch costs. It is labelled accordingly.
- Inventory report is a current snapshot; its date filters do not alter stock quantities.
- Expenses and purchase-cost fields are restricted on the backend, not merely hidden in the frontend.
- No data migration is required.
