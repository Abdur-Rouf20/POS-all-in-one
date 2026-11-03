# Phase 4 — Owner-controlled invoice editing

## Included
- Owner-only invoice editing and revision-history access (enforced by the API).
- Mandatory edit reason (minimum 5 characters).
- Batch allocation reconciliation using net batch quantity changes.
- Append-only stock adjustment movements for successful invoice revisions.
- Original initial payment and its payment records remain unchanged; the revised total only recalculates the invoice due.
- Revision snapshots with before/after invoice data, editor, reason, revision number and timestamp.
- Salesman invoice detail pages do not show the edit action.
- Legacy invoices without complete batch allocations are blocked from editing rather than risking incorrect stock.

## Apply
This is a patch ZIP containing only the changed/new Phase 4 files. Extract it directly into your existing `pos-mvp` project root and allow the files to merge/replace. Keep your current `.env` and all other project files unchanged. The patch does not contain `.env`, `.git`, `node_modules`, or build output.

From the project root in PowerShell, run:

```powershell
docker compose down
docker compose up -d --build
```

The `docker compose down` command does not remove the named MongoDB volume. Do not use `docker compose down -v`.

Check logs:

```powershell
docker compose logs -f backend
```

## Verification checklist
1. Sign in as owner, open an existing invoice, choose Edit.
2. Try saving with no reason or a reason shorter than 5 characters — API should reject it.
3. Edit item quantities/products/prices and save with a reason.
4. Confirm invoice total and due are recalculated, while original paid/cash/QR amounts remain unchanged.
5. Confirm the branch batch quantities and Inventory totals reconcile.
6. Confirm new adjustment movements are recorded and earlier stock movements remain intact.
7. Confirm the revision history shows revision number, reason, editor, timestamp and old/new totals.
8. Sign in as salesman: no Edit action should appear; direct PUT and revision-history API calls should return 403.
9. Confirm an invoice with missing/incomplete legacy batch allocation data is blocked from editing.

## Important operational note
The current Compose MongoDB service is a standalone MongoDB instance, not a replica set, so multi-document transactions are not available. Phase 4 uses guarded batch updates and compensating rollback. For production-grade concurrent financial/stock writes, deploy MongoDB as a replica set and move this workflow into a database transaction before using concurrent multi-terminal editing.
