# Backend gaps blocking the admin panel

This file tracks endpoints / fields the admin panel needs but that don't exist
yet on `server.mailsfinder.com`. Each item is annotated with the calling
codepath so a backend engineer can pick it up.

## API key encryption belongs server-side

- The Zustand store has helper code that encrypts API keys with
  `VITE_ADMIN_KEY_ENCRYPTION_SECRET` (was previously the literal string
  `demo-secret`). A Vite-injected constant is still client-visible — anyone
  with devtools can extract it.
- **Need:** the backend should be the source of truth for storing /
  decrypting API keys. The admin panel should only ever see prefixes and
  the one-time full key returned at create-time.
- **Frontend caller:** `src/utils/encrypt.ts`, `src/store/data.ts`.

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
