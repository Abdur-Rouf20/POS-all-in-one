# POS Project Progress

## Completed / delivered phases
- Phase 1–3: POS foundation, core sales/inventory/customer flows, branches and role access.
- Phase 4: Owner-controlled invoice editing, stock reconciliation and invoice revision history (patch delivered; user reports project currently working).
- Phase 5: Sales returns and refunds (patch delivered; user reports returns working).
- Phase 6: Expense Tracker (this patch).

## Phase 6 scope
- Owner-only expense management.
- Branch-specific expenses.
- Create, list, edit and delete.
- Expense categories and descriptions.
- Cash, Bangla QR and mixed payment split.
- Date/category filters and summary totals.
- Audit events for create, edit and delete.

## Deferred until after UAT
Do not silently implement these during remaining planned phases. Review with the user after UAT based on feedback:
- Automatic redemption of customer credit against future invoices.
- MongoDB multi-document transactions and stronger concurrent stock operation protection.
- Other bugs and feedback collected by the user; discuss each with the user before changing behavior.

## Current next step
Apply Phase 6 patch and test as Owner:
1. Create an expense paid fully by cash.
2. Create an expense paid fully by Bangla QR.
3. Create a mixed payment expense where cash + Bangla QR equals total.
4. Edit an expense and confirm audit history is recorded.
5. Delete a test expense.
6. Switch branches and confirm records remain branch-specific.
7. Sign in as Salesman and confirm Expense Tracker is not visible and API access is forbidden.

## Remaining roadmap
Continue with the next planned project phases after Phase 6 is confirmed working. Keep CSS redesign and UAT feedback fixes until the agreed later stage.


## Phase 7 — Dashboard & Analytics
- Date filters, net sales, returns, due, payments, product performance and low-stock metrics.
- Owner-only gross/net profit, expenses, stock valuation and branch comparison.
- Salesmen receive assigned-branch operational metrics only; no cost/profit fields.
- Partial profit warning where batch costs are not confirmed.
