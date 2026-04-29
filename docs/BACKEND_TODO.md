# Backend gaps blocking the admin panel

This file tracks endpoints / fields the admin panel needs but that don't exist
yet on `server.mailsfinder.com`. Each item is annotated with the calling
codepath so a backend engineer can pick it up.

## Server-side pagination + filtering for getAllUsers

- **Need:** add `page`, `pageSize`, `search`, and `plan` query params to
  `GET /api/admin/userManagement/getAllUsers`. The handler should
  return `{ data, total, page, pageSize }`.
- **Why:** the admin UsersList currently fetches the entire collection
  in one request and paginates client-side at 50 / page. This is fine
  while we have hundreds of users but breaks at thousands.
- **Frontend caller:** `src/pages/UsersList.tsx`. Once the backend
  supports it, switch the Antd Table to controlled pagination and
  forward the page/search params to the request.

## Content publish toggle

- The Content update schema currently has `additionalProperties: false`
  with no `is_published` (or `published`) field, so PUT
  `{ published: true }` is silently dropped.
- **Need:** add an `is_published: boolean` column to the Content model
  and allow it in the update schema. Optional: a dedicated `POST
  /api/admin/contentManagement/publishContent/:id` route if the team
  prefers that shape.
- **Frontend caller:** `src/pages/CMSLite.tsx` (Publish button is
  currently removed pending backend support).

## API key encryption belongs server-side

- The Zustand store has helper code that encrypts API keys with
  `VITE_ADMIN_KEY_ENCRYPTION_SECRET` (was previously the literal string
  `demo-secret`). A Vite-injected constant is still client-visible — anyone
  with devtools can extract it.
- **Need:** the backend should be the source of truth for storing /
  decrypting API keys. The admin panel should only ever see prefixes and
  the one-time full key returned at create-time.
- **Frontend caller:** `src/utils/encrypt.ts`, `src/store/data.ts`.

