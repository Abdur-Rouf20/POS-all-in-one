# Phase 7 — Dashboard & Analytics
1. Extract this patch ZIP.
2. Copy the `POS-all-in-one-main` folder contents into your existing project root (the folder containing `compose.yaml`), replacing matching files.
3. Keep `.env` and Docker volumes unchanged.
4. From the project root run:

```powershell
docker compose up -d --build
```

5. Refresh the POS dashboard and test date filters.

Owner dashboard includes profit, expenses, inventory valuation, payment split and branch comparison. The All branches checkbox is owner-only. Salesmen are restricted to their assigned branch and receive no purchase-cost/profit/expense fields.

Profit calculation: invoice totals less return refunds, minus confirmed batch COGS; returned stock cost is credited using the original invoice batch cost where available; net profit subtracts recorded expenses. Due is displayed separately, not counted as revenue. Inventory cost valuation counts only batches with confirmed purchase costs. Unknown historical costs make profit partial and are flagged.

MongoDB transactions and automatic customer-credit redemption remain deferred. Validate financial results with test data before operational use.
