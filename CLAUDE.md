# CLAUDE.md

## Project Overview
靶机商城 (Target Mall) — Vue 3 monorepo e-commerce platform with two frontend apps and shared utilities.

## Architecture

```
target/
├── h5-app/          # C-end e-commerce (14 pages, ~3200 LoC)
├── admin-app/       # Admin dashboard (5 pages, ~1800 LoC)
├── shared/utils/    # Shared utilities: encoding, format, storage
├── api.md           # REST API documentation
├── PRD.md           # Bug tracker & optimization roadmap
└── auth_service_patch.py / password_patch.py  # Backend patches
```

## Tech Stack (both apps)
- **Framework**: Vue 3 (Composition API, `<script setup>`)
- **Build**: Vite 8
- **Language**: TypeScript 6
- **UI Library**: Element Plus 2.14
- **State**: Pinia 3
- **Router**: Vue Router 4
- **HTTP**: Axios

## Dev Commands

### h5-app (port 3000)
```bash
cd h5-app && npm run dev      # Start dev server
cd h5-app && npm run build    # Type-check & build
```

### admin-app (port 3001)
```bash
cd admin-app && npm run dev   # Start dev server
cd admin-app && npm run build # Type-check & build
```

## Path Aliases
Both apps configure Vite aliases:
- `@/` → `src/` (app-specific)
- `@/utils` → `../shared/utils` (shared code)

## API Proxy
Dev server proxies `/api/v1/*` to backend microservices:
| Path | Service | Port |
|------|---------|------|
| `/api/v1/user` | User service | 8001 |
| `/api/v1/goods` | Goods service | 8002 |
| `/api/v1/order` | Order service | 8003 |
| `/api/v1/cart` | Order service | 8003 |
| `/api/v1/msg` | Message service | 8004 |
| `/api/v1/sys` | System service | 8005 |

## Shared Utilities (`shared/utils/`)
- `encoding.ts` — `deepFixEncoding<T>()`, `fixGarbledUtf8()` — Fixes double-encoded UTF-8 from MySQL CP1252 columns
- `format.ts` — `formatPrice(cents)`, `formatDate(dateStr)`
- `storage.ts` — Safe `getItem`/`setItem`/`removeItem` wrappers for localStorage

## Key Conventions
- Prices are in **cents** (integers), formatted with `formatPrice()` for display
- All API calls use `Authorization: Bearer <token>` header
- Response format: `{ code: 0, msg: "ok", data: {...} }`
- Known encoding issue: Backend stores UTF-8 in MySQL CP1252 columns → use `deepFixEncoding` on API responses

## Known Issues (from PRD.md)
- **P0**: h5-app OrderDetail — `handleRefund` undefined (B1)
- **P0**: h5-app GoodsDetail — stale data on route change (B2)
- **P0**: admin-app OrdersManage — `address_snapshot` type guard missing (B3)
- Multiple DRY violations, type safety gaps, and dead code documented in PRD.md
