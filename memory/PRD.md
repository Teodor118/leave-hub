# PRD — Employee Leave Hub (DRAXLMAIER)

## Original Problem
Internal web application for DRAXLMAIER employees to submit leave requests, managers to approve/reject them, and admins to configure users/departments/leave types. Replaces manual paper/Excel workflow. Full Romanian UI. Based on schema in `Tema Proiect Practica - Employee Leave Hub.pdf`.

## Roles
- USER (angajat): manage own requests + balance
- DEPT_RESP (manager departament): approve/reject team requests
- ADMIN: full access, CRUD users/departments/leave_types

## Architecture
- **Backend** (`/app/backend/server.py`): FastAPI + Motor + Pydantic + JWT Bearer + ReportLab for PDF.
- **Frontend** (`/app/frontend/src`): React 19 + shadcn/ui + Tailwind + Recharts. Role-based routes with `<Protected>`.
- **Working days**: excludes weekends + hardcoded RO holidays 2025-2026.
- **Balance**: decremented `$inc` on APPROVE for paid leave; refunded when admin deletes an APPROVED request.
- **Attachments**: base64 stored in Mongo (max 2MB) for leave types with `requires_attachment=true`.
- **PDF**: ReportLab, only for APPROVED requests.

## Implemented (Feb 2026)
- Full JWT auth (3 roles) with idempotent admin + demo seed on startup
- Complete leave-request lifecycle: DRAFT → PENDING → APPROVED/REJECTED/CANCELLED with `leave_workflow` audit log
- Role-scoped listings (self/department/all) + status filters
- Attachment upload + retrieval endpoints
- Working-days preview endpoint with RO holidays
- Dashboards per role (KPIs + Recharts pie/bar)
- Calendar view (month grid, department-scoped)
- Admin CRUD: users, departments, leave types with all constraints
- PDF export for approved requests
- Romanian UI + all validation messages in Romanian

## Testing (Iteration 2)
- 30/30 pytest backend tests pass (auth, lifecycle, attachments, dashboard, calendar, PDF, admin CRUD)
- Frontend E2E: employee create request → manager approve → PDF button works
- Role-based sidebar verified for all 3 roles

## Test Credentials
See `/app/memory/test_credentials.md`.
- Admin: ragemonster069@gmail.com / admin123
- Managers: manager.{it,hr,prod}@draxlmaier.ro / parola123
- Employees: 5 accounts / parola123

## Backlog (P2)
- Pagination on list endpoints (>500 rows)
- Refactor server.py into routers
- Wrap APPROVE balance+status in Mongo transaction
- Email notifications on status change
- Bulk import employees CSV
