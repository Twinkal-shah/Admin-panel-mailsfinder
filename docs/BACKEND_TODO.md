# Backend gaps blocking the admin panel

This file tracks endpoints / fields the admin panel needs but that don't exist
yet on `server.mailsfinder.com`. Each item is annotated with the calling
codepath so a backend engineer can pick it up.

## Audit logs

- **Need:** `GET /api/admin/userManagement/audits`
- **Query params:** `from`, `to`, `action`, `adminId`, `targetId`; paginated
  (`page`, `pageSize`).
- **Why:** the bootstrap response currently returns `audits: []` hardcoded in
  `admin.dashboard.service.ts`, so the AuditLogs page has no data to render.
- **Frontend caller:** `src/pages/AuditLogs.tsx` (renders an empty state until
  this lands).
