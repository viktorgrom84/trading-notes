# AI Agent Instructions — trading-notes

## ⚠️ Run tests before every push

```bash
npm run test:run
```

All tests must pass (exit code 0) before pushing or finishing any task. If anything fails, fix it first.

---

## Test suite

| File | Covers |
|------|--------|
| `src/test/api.test.js` | Core API client methods |
| `src/test/api.comprehensive.test.js` | Error codes, edge cases, token handling |
| `src/test/core-logic.test.js` | Token expiry, 401 events, P&L calculations, strike display |

## Adding tests

- Logic change in `src/api.js` → update `api.test.js` or `core-logic.test.js`
- Profit / P&L logic change → update `tradeProfit()` tests in `core-logic.test.js`
- New utility → add test in the nearest existing test file

## Tech stack

- **Framework**: React 18 + Vite
- **Testing**: Vitest + @testing-library/react
- **Backend**: Vercel serverless functions (`/api/*.js`)
- **Database**: PostgreSQL (via `pg`)
- **Auth**: JWT (`jsonwebtoken`), `bcryptjs`
- **UI**: Mantine v8, @tabler/icons-react

## Shared utilities — always use these, never re-implement locally

| Import | What it does |
|--------|-------------|
| `import { formatCurrency, formatDate, getLocalDateString, toInputDate, getProfitColor, formatLargeNumber } from '../utils/format'` | All formatting helpers |
| `import { tradeProfit, isTradeClosed } from '../utils/tradeProfit'` | Canonical P&L calculation |
| `import { useTrades } from '../context/TradesContext'` | Shared trades list — **do not call `apiClient.getTrades()` in components** |
| `import { checkAdminAccess } from '../utils/admin'` | Admin check — **do not hardcode usernames** |

## Key conventions

- Token stored in `localStorage` as `authToken`; user object as `tradingUser`
- `apiClient.isTokenExpired()` checks JWT `exp` without a network call
- 401 responses dispatch a global `auth:unauthorized` event → `App.jsx` logs the user out
- Short options (covered calls): premium is realised P&L even without a closing trade
- Strike prices must display with `.toFixed(2)` (never `.toFixed(0)`)
- Vercel Hobby plan: max **12 serverless functions** — consolidate before adding new API files
