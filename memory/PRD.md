# PRD — Aplicație Agenție de Turism (Staff-only ERP)

## Original Problem
Internal web app to manage a Romanian travel agency: clients, employees, destinations, packages, reservations, payments. Based on university-project SQL schema, replicated in FastAPI + MongoDB with Pydantic validation and atomic seat operations.

## Users
- Agency staff (single role): agents and administrators managing everything internally.
- No public client-facing portal.

## Architecture
- **Backend**: FastAPI single-file (`/app/backend/server.py`), MongoDB via Motor. JWT (Bearer, 7d) auth. Startup seeds admin + demo data (idempotent).
- **Frontend**: React 19 + shadcn/ui + Tailwind + Recharts. Sidebar Layout with 8 modules. All UI in Romanian.
- **Atomic seat logic**: `packages.update_one({..., "locuri_disponibile": {"$gte": persoane}}, {"$inc": {"locuri_disponibile": -persoane}})`.

## Implemented (Feb 2026)
- Staff login (email + password, JWT localStorage, `/api/auth/login`, `/api/auth/me`)
- Clients CRUD with unique email + status filter + search
- Employees CRUD with salary ≥ 2500 validation
- Destinations CRUD grouped by MARE/MUNTE/CITY BREAK/CULTURAL, delete blocked when packages exist
- Packages CRUD with destination join + live seat badge
- Reservations: create decrements seats atomically, status change restores/re-deducts seats, delete cascades payments + restores seats. Auto-computed `valoare` and `sold`.
- Payments: partial payments per reservation, sold overpay guard, method-tagged (CARD/CASH/TRANSFER)
- Dashboard: 4 KPIs + 3 Recharts (popular packages bar, revenue pie, reservations per client bar)
- Reports page with 4 tabs (per client / popular packages / revenue by method / detailed view)
- Romanian labels + error messages across all forms
- Seed: 10 clients, 5 employees, 5 destinations, 8 packages, 10 reservations + associated payments

## Test Credentials
- `ragemonster069@gmail.com` / `admin123` (see `/app/memory/test_credentials.md`)

## Testing Status
- Iteration 1 (Feb 2026): 100% pass backend & frontend. Full CRUD, atomic seat logic, payment overpay guard, status transitions, all 8 pages verified.

## Backlog (P2, optional)
- Export rapoarte în PDF/Excel
- Istoric prețuri pachete
- Sistem fidelizare clienți
- Audit log pentru modificări
