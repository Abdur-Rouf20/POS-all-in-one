# Phase 5 — Sales returns and refunds

## Included
- Sales returns must reference an existing invoice in the selected branch.
- Partial returns are supported; the API prevents returning more than the unreturned sold quantity.
- Refund unit price is manually entered for each returned invoice line.
- Returned quantity is restored to the original invoice batch allocation(s), not to an arbitrary current batch.
- StockMovement records are created with type `return` and reference the SalesReturn document.
- Settlement options: customer credit, adjustment against the customer's branch grand due, or cash/Bangla QR/mixed refund.
- Cash and Bangla QR refund splits must exactly match the return total.
- Customer ledger includes sales returns, due adjustments and customer credit totals.
- Branch scoping is enforced through the authenticated user's resolved branch.

## Apply
Extract this patch into the existing `pos-mvp` project root (the folder containing `backend`, `frontend`, and `compose.yaml`) and allow folders to merge. Replace existing files when prompted. Do not replace `.env` or `compose.yaml`.

Then run in PowerShell from the project root:

```powershell
docker compose up -d --build
```

Do not run `docker compose down -v`.

## Suggested verification
1. Sign in as a salesman and open Sales Returns.
2. Select an invoice in the assigned branch.
3. Return part of one line, entering a manual refund unit price.
4. Choose Customer credit and confirm the return. Verify the original batch quantity, branch inventory, stock movement and customer ledger.
5. Try returning more than the remaining sold quantity; the backend must reject it.
6. Return a different item using Due adjustment. Verify the customer's grand due is reduced and that the return amount does not exceed the available due.
7. Test Cash, Bangla QR and Mixed cash refunds. Mixed cash and QR must sum exactly to the return total.
8. Confirm a return against an invoice from another branch is rejected.
9. Confirm repeated returns cannot exceed the original invoice item quantity.

## Important notes
- Customer credit is recorded as a credit balance in the customer ledger; this phase does not automatically redeem that credit against future invoices or money receipts.
- Cash/Bangla QR refunds are recorded on the return document; they are not incoming `MoneyReceipt` records.
- The existing MongoDB Compose service is standalone. The return operation uses guarded updates and compensating cleanup, not multi-document transactions. Avoid concurrent sales/returns against the same batch until replica-set transactions are implemented and tested.
- Phase 5 source checks are not a substitute for local Docker/MongoDB functional testing. Do not mark this phase production-ready until the verification checklist passes.
