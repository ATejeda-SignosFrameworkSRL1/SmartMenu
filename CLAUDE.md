# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This Project

SmartMenu is a full-stack digital menu system for restaurants. Customers scan QR codes to browse the menu, place orders, and pay from their smartphones. The system includes apps for clients, waiters, kitchen staff, cashiers, hosts, and administrators.

## Repository Structure

```
src/
  backend/          # .NET Clean Architecture solution
    SmartMenu.API           # Controllers, SignalR Hubs, Program.cs
    SmartMenu.Application   # Interfaces (IRepository, IService)
    SmartMenu.Domain        # Entities, Enums
    SmartMenu.Infrastructure # DbContext, EF Migrations, Repository/Service implementations
  frontend/
    client-app/     # Customer-facing PWA (port 3000)
    admin-panel/    # Restaurant admin dashboard (port 3001)
    kds-app/        # Kitchen Display System (port 3002)
    waiter-app/     # Waiter mobile-style app (port 3003)
    host-app/       # Host/hostess table management (port 3004)
    cashier-app/    # Cashier payment processing (port 3005)
    reservation-app/ # Reservation management (port 3007)
tests/
  SmartMenu.UnitTests/  # xUnit tests for domain entities and services
docker/
  docker-compose.yml
  docker-compose.dev.yml
  Dockerfile.backend
  Dockerfile.frontend
```

## Backend Commands

From `src/backend/`:

```powershell
# Run API (HTTP :5041, HTTPS :5042)
dotnet run --project SmartMenu.API

# Run tests
dotnet test

# Run a specific test file
dotnet test --filter "FullyQualifiedName~OrderTests"

# EF migrations (only when needed — startup auto-migrates in Development)
dotnet ef database update --project SmartMenu.Infrastructure --startup-project SmartMenu.API

# Build
dotnet build SmartMenu.sln
```

HTTPS dev certificate (run once as Administrator):
```powershell
.\SmartMenu.API\scripts\create-dev-cert.ps1
```

## Frontend Commands

Each frontend app is independent. From the app directory (e.g. `src/frontend/admin-panel/`):

```bash
npm run dev        # Start dev server on the app's assigned port
npm run build      # Production build
npm run lint       # ESLint
npm run type-check # TypeScript check without emitting
```

## Backend Architecture

The backend follows **Clean Architecture** with four projects:

- **Domain** — pure entities and enums, no dependencies
- **Application** — interfaces only (`IRepository<T>`, `IUserRepository`, `IOrderRepository`, `IAuthService`, `IOrderService`)
- **Infrastructure** — EF Core `ApplicationDbContext`, generic `Repository<T>`, and concrete service implementations
- **API** — ASP.NET Core controllers, SignalR hubs, DI wiring in `Program.cs`

**Database**: SQL Server via EF Core. Migrations live in `SmartMenu.Infrastructure`. In `Development`, `DbInitializer.SeedAsync` and a series of `Ensure*` methods run at startup to apply additive schema changes idempotently — you generally do not need to run `dotnet ef database update` manually during development.

**Real-time**: SignalR hubs at `/hubs/orders`, `/hubs/kitchen`, `/hubs/tables`, `/hubs/reservations`. JWT tokens for SignalR are passed as `?access_token=` query parameters (handled in `Program.cs`).

**Auth**: JWT Bearer. Settings in `appsettings.json` under `JwtSettings`.

**Redis**: Currently commented out in `Program.cs` (not required for MVP).

**File uploads**: Served as static files from `wwwroot/`. Max upload size is 20 MB.

## Frontend Architecture

All frontend apps use **Next.js 14 App Router** with TypeScript and Tailwind CSS. They do not share code via a monorepo tool — each is a standalone `npm` project.

**API routing**: Every app proxies `/api/*`, `/uploads/*`, and (where needed) `/hubs/*` to the backend via `next.config.mjs` rewrites. The backend HTTP URL defaults to `http://localhost:5041`. Set `BACKEND_HTTP_URL` to override.

**Environment variables**:
- `NEXT_PUBLIC_API_URL` — base URL for the API (used in client-side fetch)
- `NEXT_PUBLIC_WS_URL` — WebSocket/SignalR URL (defaults to `https://10.0.0.24:5042`)
- `BACKEND_HTTP_URL` — server-side proxy target (defaults to `http://localhost:5041`)

**Key libraries**:
- `@tanstack/react-query` — server state and caching (most apps)
- `@microsoft/signalr` — real-time hub connections (client, kds, waiter, host apps)
- `zustand` — client-side state (client-app)
- `shadcn/ui` + Radix UI — component primitives (admin-panel only)
- `react-hook-form` + `zod` — form validation (admin-panel)
- `axios` — HTTP client across all apps

**HTTPS in dev**: Use `npm run dev:https` to run with self-signed certificates from the `certificates/` folder inside each app.

## Dominican Republic Fiscal Compliance

Payments must account for:
- **ITBIS**: 18% VAT
- **Propina legal**: 10% mandatory tip (Ley 13-07)
- **ISR retention**: 10% on tips
- **e-CF (electronic fiscal receipts)** via DGII API — config under `DGII` in `appsettings.json`

The `PaymentController` and `Payment` entity handle fiscal receipt columns added by `EnsureFiscalReceiptColumnsAsync`.

## Docker

```bash
# Full stack (from repo root)
docker compose -f docker/docker-compose.yml up

# Development variant
docker compose -f docker/docker-compose.dev.yml up
```

The compose file starts SQL Server, Redis, the backend API, and the client-app frontend.
