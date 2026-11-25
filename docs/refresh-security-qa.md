# Refresh-token security QA

## Files in implementation order

1. `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261125220500_team_chat_refresh/migration.sql` store hashed refresh-token records.
2. `apps/api/src/config/env.ts` defines access and refresh lifetimes.
3. `apps/api/src/lib/jwt.ts`, `auth.service.ts`, and `refreshCookie.ts` issue short-lived access JWTs and rotate opaque refresh tokens.
4. `apps/api/src/modules/auth/auth.controller.ts` and `auth.routes.ts` implement login, refresh, and logout.
5. `apps/web/src/lib/api.ts`, `auth/session.ts`, and `auth/AuthContext.tsx` keep access tokens in memory, refresh on expiry, and restore the session from the cookie.
6. `apps/web/src/realtime/useRealtime.ts` renews the access token after a socket reconnect is refused.
7. `apps/api/tests/integration/auth.test.ts` checks cookie attributes, rotation, replay rejection, and logout.

## Code flow

```text
Login -> create short-lived access JWT + random refresh token
      -> store SHA-256(refresh token) in database
      -> send access JWT in response; set refresh token as httpOnly cookie
Protected request -> memory-only access JWT
                  -> on 401, POST /auth/refresh with cookie
                  -> atomically revoke old token + store replacement
Logout -> revoke cookie's database record -> clear cookie
Socket reconnect -> refresh access JWT -> reconnect using fresh token
```

## Design choices

- Access tokens last 15 minutes by default and remain only in JavaScript memory. Refresh tokens last 30 days by default and use `httpOnly`, `SameSite=Strict`, `Secure` in production cookies.
- Refresh tokens are opaque random values stored as SHA-256 hashes and rotated once per refresh. Reuse of a revoked token is rejected.
- `SameSite=Strict` plus the same-origin API/Vite proxy is used instead of adding a cross-origin CORS/cookie setup. Deployments that split web and API origins need a deliberate cookie/CORS/CSRF design.
- Refresh values are not returned in JSON or stored in browser storage. The UI persists only the non-secret profile and restores authentication via the cookie.

## Viva Q&A

**Why use an httpOnly cookie?** Browser JavaScript cannot read it, reducing exposure of the long-lived credential to injected scripts.

**Why keep an access token at all?** The short-lived bearer token is convenient for API and Socket.IO authentication; its exposure window is much smaller.

**What does rotation prevent?** Once a refresh token is used, it is revoked. Replaying a stolen old token fails instead of creating another session.

**What happens after a teammate is removed?** Their business membership is deleted and their sockets subscribed to that business are disconnected; database membership checks deny subsequent REST requests.
