# Phase 10 — API Testing (Initial Suite)

## Files
- `POS_Phase10_API_Tests.postman_collection.json` — Postman collection.
- `POS_Local.postman_environment.json` — local environment template.

## Import
1. Open Postman.
2. Import both JSON files.
3. Select the `POS MVP - Local` environment.
4. Set `owner_email` and `owner_password` locally in Postman. Do not commit real credentials.
5. Confirm the backend is running and `api_base_url` matches its port (default from the supplied server code: `http://localhost:5000`).

## Run order
Run the collection in order. The valid login request stores its token in the collection variable `access_token`; the `/api/auth/me` valid-token request uses it.

## Included tests
- `GET /api/health`
- `POST /api/auth/login` — valid credentials, incorrect password, missing credentials
- `GET /api/auth/me` — valid token, missing token, invalid token
- Checks that authentication responses do not expose `passwordHash`.

## Scope note
This is the verified initial Phase 10 suite. It deliberately does not invent request paths or payloads for products, inventory, invoices, payments, returns, expenses, reports, or other modules. Those tests should be added after inspecting each route/controller implementation and its actual validation/business rules.

## Newman (optional local CLI)
From the project root, after installing Newman:
```powershell
npm install --save-dev newman
npx newman run .\tests\api\POS_Phase10_API_Tests.postman_collection.json `
  -e .\tests\api\POS_Local.postman_environment.json
```
For CI, use protected GitHub Actions secrets for credentials; never store real passwords in the exported environment file.
