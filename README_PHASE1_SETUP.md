# POS implementation — Phase 1 (Customers and Money Receipts)

This patch adds the first customer/accounting foundation to the existing POS project.

## Before copying files

1. Stop the POS containers from the project root:
   ```powershell
   docker compose down
   ```
2. Back up MongoDB before running the migration. Do not delete the `mongo_data` volume.
3. Keep a copy of the current project folder.

## Copying this patch

Extract `pos-mvp-phase1-patch.zip`. It contains files using the same `backend/...` and `frontend/...` paths as your project. Copy those folders into your existing `pos-mvp` folder and allow Windows to merge folders and replace matching files.

## What this phase adds

- Customer records identified by normalized phone number.
- Generated Customer IDs.
- Customer lookup by phone.
- Customer list and customer ledger pages.
- Automatic customer creation when a new invoice is created.
- Initial invoice payment split into Cash and Bangla QR, including mixed payment.
- Initial invoice payment records for Cash and Bangla QR.
- Separate Money Receipts linked to customers, never linked to invoices.
- Money Receipt list and printable receipt with blank salesman signature area.
- Customer grand due calculation: sum of invoice outstanding amounts minus Money Receipts.
- Later invoice due collection endpoint removed; further collections must use Money Receipts.

## Important limitations in this phase

- Existing invoices must be linked to Customer records using the migration script below. Invoices without a valid phone number are skipped and reported.
- Existing invoices with direct due collections retain their existing paid/due values and old Payment records. The new system does not rewrite that history.
- Batch inventory, full audited invoice revisions, returns/refunds, expenses, cash/QR dashboard analytics, and the report builder are subsequent phases.
- Full multi-document transaction support is not enabled yet. The current MongoDB container is standalone; replica-set configuration must be applied and verified before we rely on transactions for invoice/stock/return workflows.
- Do not treat the current invoice edit handler as the final audited editing implementation. The stock reconciliation and revision history are still pending.

## Migration existing invoices to customers

After copying files and starting MongoDB/backend, open PowerShell in the `backend` folder and run:

```powershell
npm run migrate:customers
```

The script:
- Finds invoices that do not have `customerId`.
- Normalizes their phone numbers.
- Reuses an existing customer with the same normalized phone number.
- Creates a customer when none exists.
- Links the invoice to that customer.
- Skips invoices without a valid phone number.
- Adds customer lookup/creation permissions to existing salesman accounts so they can use the new customer workflow.

Run this migration only once after taking a database backup. It is designed to be safe to rerun because it only processes invoices without `customerId`.

## Install/build/run

From the project root:

```powershell
docker compose build --no-cache
docker compose up -d
```

Check:

```powershell
docker compose ps
docker compose logs -f backend
```

Frontend local build (optional, from `frontend`):

```powershell
npm install
npm run build
```

## First verification checklist

1. Log in as Owner and open Customers.
2. Create a new invoice using a new phone number. Verify the customer is created.
3. Create another invoice using the same phone number. Verify it reuses the same Customer ID.
4. Create a fully paid invoice using Cash. Verify the PAID watermark.
5. Create a mixed-payment invoice and verify Cash + Bangla QR equals initial paid amount.
6. Create a partially paid invoice. Verify its due appears in the customer ledger.
7. Create a Money Receipt for that customer. Verify the receipt is listed separately and grand due decreases.
8. Open and print the Money Receipt. Verify the salesman signature space is blank.
9. Verify there is no longer a Collect Due action on an invoice.
10. Log in as a Salesman and verify only the assigned branch data is visible.
