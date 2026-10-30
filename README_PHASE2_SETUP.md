# POS Phase 2 — Product Categories and Product Setup

This patch adds owner-managed product categories and a category-linked product catalog. It is designed to be copied over the Phase 1 project already running on your Windows PC.

## What Phase 2 changes

- Adds a `Category` MongoDB model with a case-insensitive unique key (`normalizedName`).
- Adds authenticated category APIs. Only the Owner can create, update, deactivate, or delete categories.
- Adds Product Categories page at `/categories` (Owner only).
- Adds category selection to Product Setup.
- Adds SKU, barcode, description, unit, and default selling price fields.
- Keeps buying price out of Product Setup. Buying price belongs to a stock batch and is deferred to Phase 3.
- Keeps stock receiving separate from product creation. Product setup no longer accepts an opening stock quantity.
- Salesmen can view active products but cannot create, edit, deactivate, or manage categories.
- Deactivates products instead of hard-deleting them so historical invoices and movements retain references.
- Migrates existing product category text into Category documents and links products using `categoryId`.

## Files to copy

Extract this patch and merge its `backend` and `frontend` folders into your existing `pos-mvp` project folder. Replace files when Windows asks.

New files:

- `backend/src/models/Category.js`
- `backend/src/controllers/categoryController.js`
- `backend/src/routes/categoryRoutes.js`
- `backend/src/scripts/migrateCategories.js`
- `frontend/src/pages/Categories.jsx`

Modified files:

- `backend/package.json`
- `backend/src/models/Product.js`
- `backend/src/controllers/productController.js`
- `backend/src/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/pages/Products.jsx`
- `frontend/src/services/api.js`

## Apply on Windows

1. Stop containers from the project root:

   ```powershell
   docker compose down
   ```

   This does not remove the MongoDB volume. Do not use `docker compose down -v`.

2. Extract this ZIP to a temporary folder.
3. Copy the extracted `backend` and `frontend` folders into your existing `pos-mvp` folder. Merge folders and replace matching files.
4. From the project root, rebuild and start:

   ```powershell
   docker compose build
   docker compose up -d
   docker compose ps
   ```

5. Run the category migration once:

   ```powershell
   docker compose exec backend npm run migrate:categories
   ```

   It creates category documents from the category names already stored on products and links each product to its category. It does not delete products, invoices, or inventory.

6. Check backend logs:

   ```powershell
   docker compose logs --tail=100 backend
   ```

7. Open `http://localhost:3000` and sign in as Owner.

## Test sequence

1. Open **Product Categories** in the sidebar.
2. Create categories such as Electronics, Accessories, and Household.
3. Try creating a duplicate category with different letter casing (for example `electronics` after `Electronics`). The database unique key should reject the duplicate.
4. Open **Products** and create a product with name, SKU, barcode (optional), category, default selling price, and unit.
5. Confirm that the product appears with its selected category.
6. Edit the product and change its category.
7. Deactivate a product. It should disappear from the Salesman product list and invoice product selector, while remaining in the Owner product list as inactive.
8. Sign in as Salesman. Confirm Products is read-only and Product Categories is not in the navigation.
9. Confirm Salesman can still receive stock through the existing Inventory page.

## Important design boundary

Phase 2 does not yet implement stock batches, buying prices, FIFO, or batch selection. Existing branch inventory remains in its current shape until Phase 3 migrates it to batch-level stock. Do not manually edit MongoDB documents to imitate batches.

The existing `Product.price` field remains the default selling price for compatibility with the current invoice form. Phase 3 will add batch-specific selling price and buying cost snapshots, then update invoice stock deduction accordingly.
