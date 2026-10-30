# POS Phase 3 — Batch Inventory

This is an incremental patch for the existing Phase 1 + Phase 2 `pos-mvp` project.
It is not a standalone project.

## Included

- Batch model with branch/product references, generated batch number, received quantity,
  remaining quantity, received date, selling price, and owner-only buying price.
- Salesman can receive stock without seeing or submitting buying price. Such batches are
  marked `pending_owner` until the Owner records the buying cost.
- Owner can record/update buying cost on a batch.
- Branch inventory now shows aggregate stock and batch breakdown.
- Invoice creation allocates stock FIFO by received date by default.
- Owner can select a specific batch manually in the invoice form.
- Invoice batch allocation snapshots are stored on invoice lines.
- Stock movements record batch references and unit cost internally.
- Buying prices are removed from salesman inventory, movement, and invoice API responses.
- Migration converts current aggregate branch inventory into legacy batches.

## Apply the patch

Project root:
`C:\Users\rouf3\Downloads\pos-mvp-branch-rbac\pos-mvp`

1. Extract this ZIP into a temporary folder.
2. Copy its `backend` and `frontend` folders into the existing `pos-mvp` root.
3. Choose **Replace files** when Windows asks.
4. Do not replace `.env`, `compose.yaml`, Dockerfiles, or your MongoDB volume.

Files replaced/added:
- `backend/package.json`
- `backend/src/models/Batch.js` (new)
- `backend/src/models/Invoice.js`
- `backend/src/models/StockMovement.js`
- `backend/src/controllers/inventoryController.js`
- `backend/src/controllers/invoiceController.js`
- `backend/src/routes/inventoryRoutes.js`
- `backend/src/scripts/migrateBatches.js` (new)
- `frontend/src/pages/Inventory.jsx`
- `frontend/src/pages/InvoiceForm.jsx`
- `frontend/src/services/api.js`
- `frontend/src/styles.css`

## Rebuild

Run from the project root in PowerShell:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend
```

Wait for the backend to start successfully.

## Migrate existing stock

Run once after the backend is running:

```powershell
docker compose exec backend npm run migrate:batches
```

The migration creates one `LEGACY-...` batch for each branch/product inventory record with a positive quantity. It does not delete or change the aggregate Inventory quantity.

Legacy batches have no known buying price and are marked `pending_owner`. The Owner must enter the correct buying cost on the Inventory page before relying on profit reports. Do not guess historical buying costs.

The migration is idempotent for existing legacy batches and can be rerun; it skips a branch/product that already has its legacy batch.

## Test in this order

1. Owner selects a branch and opens Inventory.
2. Owner receives stock with quantity, selling price, buying price, and received date.
3. Confirm a generated `B-YYYYMMDD-...` batch appears.
4. Confirm Owner sees buying price.
5. Sign in as Salesman and receive stock against an existing product.
6. Confirm Salesman does not see a buying-price field or buying-price values.
7. Confirm Salesman-created batch says cost is pending Owner review.
8. Sign in as Owner and enter the buying cost for that pending batch.
9. Create an invoice as Salesman. It should consume the oldest available batch first.
10. Create an invoice as Owner and optionally select a specific batch manually.
11. Confirm batch remaining quantities and aggregate branch inventory both decrease by the sold quantity.
12. Confirm stock movement history shows batch references.

## Important behavior / current limitations

- Invoice editing is temporarily paused in this phase. It will be re-enabled in Phase 4 with stock
  reconciliation and before/after audit revisions. This prevents editing an invoice while its
  batch allocations are not yet reconciled.
- Old invoices remain historical records. Only new invoices receive batch-allocation snapshots.
- Existing stock migrated to legacy batches has unknown buying cost until the Owner enters it.
- This phase uses guarded updates and compensating rollback, not MongoDB multi-document transactions.
  Before expanding financial workflows further, configure MongoDB as a replica set and move
  stock/invoice/return operations to actual transactions.
- The frontend production build should be verified in your Docker build environment. The copied
  Linux test environment lacked Rollup's Linux optional package, so local Vite build verification
  could not complete there.
