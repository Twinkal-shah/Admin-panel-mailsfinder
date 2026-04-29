# Backend gaps blocking the admin panel

This file tracks endpoints / fields the admin panel needs but that don't exist
yet on `server.mailsfinder.com`. Each item is annotated with the calling
codepath so a backend engineer can pick it up.

## Auth refresh

- **Need:** `POST /api/admin/auth/refresh`
- **Body:** `{ refreshToken: string }` → `{ data: { accessToken: string } }`
- **Why:** the admin panel now stores `refreshToken` from the login response
  and tries to refresh on `401` responses with `jwtError: true`. Until this
  endpoint ships, the request silently fails and the user is logged out.
- **Frontend caller:** `src/utils/api.ts` (`refreshAccessToken`).

## Audit logs

- **Need:** `GET /api/admin/userManagement/audits`
- **Query params:** `from`, `to`, `action`, `adminId`, `targetId`; paginated
  (`page`, `pageSize`).
- **Why:** the bootstrap response currently returns `audits: []` hardcoded in
  `admin.dashboard.service.ts`, so the AuditLogs page has no data to render.
- **Frontend caller:** `src/pages/AuditLogs.tsx` (renders an empty state until
  this lands).
