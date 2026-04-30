# Refresh Token Authentication — Express + Nest (Comprehensive Guide)

Table of Contents

- Introduction
- What Are Refresh Tokens?
- Why Refresh Tokens Matter
- Access Token vs Refresh Token
- Token Lifecycle
- Stateless vs Stateful Auth
- Rotation Strategy
- Blacklisting / Revocation
- Security Risks & Mitigations
- Best Practices
- Real Production Architecture
- ExpressJS Implementation
- NestJS Implementation
- Testing
- Deployment
- Interview Questions
- Troubleshooting
- Advanced Concepts

## Introduction

This repository contains two fully worked backend implementations that teach modern refresh-token authentication patterns:

- `express-app/` — Express + TypeScript + Prisma (SQLite sample). A focused implementation of JWT access tokens and opaque refresh tokens with rotation and hashed storage.
- `nest-app/` — NestJS + TypeScript + Prisma (SQLite sample). A modular Nest implementation demonstrating similar concepts using services, controllers, and guards.

The goal: a production-aware, well-documented mini-project that helps you deeply understand refresh token flows, rotation, multi-device sessions, logout and revocation.

## What Are Refresh Tokens?

Refresh tokens are long-lived credentials used to obtain new short-lived access tokens without requiring the user to re-enter credentials. They allow access tokens to have short expiry (reducing risk if leaked) while enabling a seamless user experience.

## Why Refresh Tokens Matter

- Access tokens are frequently sent to APIs and have short lifetimes (e.g., 15 minutes). If they are long-lived, an attacker with a leaked token has long-lasting access.
- Refresh tokens allow safe rotation and session management: when a refresh token is used, it can be invalidated and replaced (rotation), preventing reuse by attackers.

## Access Token vs Refresh Token

- Access Token: JWT, short expiry (e.g., 15m), used in Authorization header, contains claims (user id, roles).
- Refresh Token: opaque random string (or long-lived JWT), long expiry (7d–30d), stored securely (httpOnly cookie or secure storage), used only to request new access tokens.

## Token Lifecycle

- User logs in -> server issues access token + refresh token.
- Access token used for API calls until expiry.
- When expired, client calls /auth/refresh with refresh token.
- Server validates refresh token: if valid, issues new access token and rotates (invalidates old refresh token and issues a new one).
- On logout, server revokes the refresh token used; on logout-all, server revokes all user's sessions.

## Stateless vs Stateful Auth

- Stateless: only access tokens (JWT) used; server does not store sessions. Easy to scale but hard to revoke tokens early.
- Stateful: refresh tokens stored in DB (sessions). Allows revocation, device tracking, and audit logs. Common production approach: short-lived JWT + stateful refreshs.

## Rotation Strategy

Rotation means issuing a brand new refresh token every time a refresh is performed and marking the previous one revoked. Benefits:

- Prevents replay: if an attacker obtains an old refresh token after rotation, it is already revoked.
- Enables detection of suspicious reuse: reuse of a revoked token indicates possible theft.

## Blacklisting / Revocation

- Store refresh token hashes and mark revoked = true when logging out or rotating.
- For access tokens (JWT), short TTL limits damage; if you must revoke immediately, use a revocation list (Redis) keyed by JWT id (jti).

## Security Risks & Mitigations

# Refresh Token Authentication — Single Consolidated Guide

This single README consolidates everything: concepts, security guidance, full implementation details, setup, API docs, example requests, and advanced topics for both the Express and Nest implementations included in this repo.

Table of contents

- Introduction
- Core Concepts
  - What Are Refresh Tokens?
  - Why Refresh Tokens Matter
  - Access Token vs Refresh Token
  - Token Lifecycle
  - Stateless vs Stateful
  - Rotation & Reuse Detection
- Security & Best Practices
  - Storage, Cookies, CSRF, XSS
  - Hashing refresh tokens
  - Rate limiting & brute-force protections
  - Secret rotation & auditing
- Production Architecture
- ExpressJS Implementation (detailed)
  - Folder structure
  - Prisma schema
  - Setup & run
  - API routes, request/response examples
  - Important files explained
- NestJS Implementation (detailed)
  - Folder structure
  - Prisma schema
  - Setup & run
  - API routes, request/response examples
  - Important files explained
- Testing & Postman
- Deployment notes
- Advanced topics
- Troubleshooting & FAQ
- Interview questions

## Introduction

This repository demonstrates a production-oriented refresh token strategy using two server frameworks: Express and NestJS. Each implementation shows:

- Short-lived JWT access tokens (15 minutes)
- Long-lived opaque refresh tokens (7 days default)
- Hashed refresh-token storage in DB (SHA-256)
- Refresh rotation: revoke old refresh tokens and issue new ones
- Multi-device sessions with device metadata
- Logout (single device) and logout-all (revoke all sessions)
- Role-based access control (admin route)
- Input validation, error handling, logging, and rate limiting

## Core Concepts

What Are Refresh Tokens?

- Long-lived credentials used to obtain new access tokens without re-authenticating.

Why Refresh Tokens Matter

- Access tokens are intentionally short-lived to limit blast radius if leaked. Refresh tokens allow the user to stay logged in without storing long-lived access tokens.

Access Token vs Refresh Token

- Access Token: JWT, carries claims (sub, role), sent in Authorization header.
- Refresh Token: opaque random string stored secure (httpOnly cookie). Only sent to /auth/refresh.

Token Lifecycle

- Login -> issue access + refresh.
- Access token used for API calls until expiry.
- On expiry, client calls /auth/refresh -> server validates refresh, rotates, and returns new access.
- Logout revokes single refresh; logout-all revokes all sessions.

Stateless vs Stateful

- Stateless (JWT-only): scales easily but cannot revoke tokens early.
- Stateful (JWT + refresh sessions): store refresh hashes in DB for revocation, tracking, and session management (recommended).

Rotation & Reuse Detection

- Rotate refresh tokens on every use. On reuse of an already revoked token, flag potential theft and revoke all sessions.
- Use Redis with short TTL to detect rapid reuse patterns across regions.

## Security & Best Practices

- Store refresh tokens as httpOnly cookies (browser) with `SameSite=Lax` or `Strict` and `Secure` in production.
- Hash refresh tokens before storing (use SHA-256) to prevent raw token leakage from DB backups.
- Short-lived access tokens (15m). Long-lived refresh tokens (7d–30d) depending on UX needs.
- Implement rotation and mark previous refresh tokens as revoked.
- Rate-limit `/auth/login` and `/auth/refresh` endpoints; add exponential backoff.
- Use `bcrypt` for password hashing and strong cost factor (e.g., 10-12).
- Protect against CSRF when using cookies (SameSite helps; for cross-site flows add CSRF tokens).
- Log session creation, refresh, and revocation events; trigger alerts on suspicious patterns.

## Production Architecture

Minimal components:

- API Gateway (validates short-lived JWTs at edge) — caches public keys if using asymmetric JWTs.
- Auth Service (this repo's functionality) — issues and rotates tokens, persists hashed refresh tokens in DB.
- Data store (Postgres + Prisma) — store users and session records.
- Redis — store revocation lists, short-lived reuse detection sets, and rate-limiter counters.
- Monitoring & SIEM — track suspicious refresh activity.

## ExpressJS Implementation (detailed)

Folder structure (key files)

- express-app/
  - package.json
  - tsconfig.json
  - .env.example
  - prisma/schema.prisma
  - src/
    - index.ts (app entry)
    - routes/auth.ts (register/login/refresh/logout)
    - routes/users.ts (protected routes)
    - middleware/auth.ts (access token middleware + role guard)
    - utils/jwt.ts (access signing, refresh generation, hashing)

Prisma schema

- See [express-app/prisma/schema.prisma](express-app/prisma/schema.prisma) — defines `User` and `Session` models.

Setup & run

1. Clone repo and open terminal.
2. Install and run Express app:

```bash
cd express-app
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

.env variables of interest (see `express-app/.env.example`):

- `DATABASE_URL` — e.g. `file:./dev.db` for SQLite or Postgres URL for production
- `JWT_ACCESS_SECRET` — strong secret for signing access tokens
- `JWT_REFRESH_SECRET` — (not required for opaque tokens but kept for extensibility)
- `ACCESS_TOKEN_EXPIRES` — `15m`
- `REFRESH_TOKEN_EXPIRES` — `7d`

API routes (Express)

- POST /auth/register
  - Body: { name, email, password }
  - Response: created user (id, email, name)

- POST /auth/login
  - Body: { email, password, deviceName? }
  - Response: { accessToken }
  - Side effect: sets `refreshToken` httpOnly cookie

- POST /auth/refresh
  - Cookie: `refreshToken` (httpOnly)
  - Response: { accessToken }
  - Side effect: rotates refresh cookie (new httpOnly cookie)

- POST /auth/logout
  - Cookie: `refreshToken` — revokes session associated with cookie

- POST /auth/logout-all
  - Authorization: Bearer <accessToken>
  - Response: { ok: true }
  - Side effect: revokes all sessions for the access token's user

- GET /users/me
  - Authorization: Bearer <accessToken>
  - Response: user profile

- GET /users/admin/dashboard
  - Authorization: Bearer <accessToken>
  - Requires role: `admin`

Example curl flows (Express)

1. Register

```bash
curl -X POST http://localhost:4000/auth/register \
	-H "Content-Type: application/json" \
	-d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'
```

2. Login (receives access token and httpOnly refresh cookie)

```bash
curl -i -X POST http://localhost:4000/auth/login \
	-H "Content-Type: application/json" \
	-c cookie.txt \
	-d '{"email":"alice@example.com","password":"secret123","deviceName":"laptop"}'

# response body will include {"accessToken":"<JWT>"}
```

3. Call protected route

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://localhost:4000/users/me
```

4. Refresh (rotates refresh token)

```bash
curl -X POST http://localhost:4000/auth/refresh \
	-b cookie.txt -c cookie.txt
```

Important files explained (Express)

- [express-app/src/index.ts](express-app/src/index.ts) — configures middleware (Helmet, CORS, rate limiter), wires routers and starts server.
- [express-app/src/routes/auth.ts](express-app/src/routes/auth.ts) — core auth flows: registration, login (creates session with hashed refresh token), refresh (rotation), logout, logout-all.
- [express-app/src/utils/jwt.ts](express-app/src/utils/jwt.ts) — helper to sign access tokens and generate/ hash random refresh tokens. Refresh tokens are opaque random hex strings; their SHA-256 hash is stored in DB.
- [express-app/src/middleware/auth.ts](express-app/src/middleware/auth.ts) — `requireAuth` reads access token from `Authorization` header and attaches payload to `req.user`; `requireRole` enforces role-based access.
- [express-app/prisma/schema.prisma](express-app/prisma/schema.prisma) — `User`, `Session` models; session stores `tokenHash`, `deviceName`, `ipAddress`, `userAgent`, `expiresAt`, and `revoked`.

## NestJS Implementation (detailed)

Folder structure (key files)

- nest-app/
  - package.json
  - tsconfig.json
  - .env.example
  - prisma/schema.prisma
  - src/
    - main.ts
    - app.module.ts
    - auth/
      - auth.module.ts
      - auth.service.ts
      - auth.controller.ts
    - users/
      - users.module.ts
      - users.controller.ts

Prisma schema

- See [nest-app/prisma/schema.prisma](nest-app/prisma/schema.prisma) — same `User` and `Session` models as Express.

Setup & run

```bash
cd nest-app
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
# Start dev server (using Nest CLI if available)
npm run start:dev
```

API routes (Nest) — same endpoints as Express. The Nest `AuthService` includes helpers for signing access tokens, generating refresh tokens, hashing them, storing sessions, and rotating on refresh.

Important files explained (Nest)

- [nest-app/src/auth/auth.service.ts](nest-app/src/auth/auth.service.ts) — service implementing register, validateUser, signAccessToken, signRefreshToken, hashToken, rotateRefreshSession.
- [nest-app/src/auth/auth.controller.ts](nest-app/src/auth/auth.controller.ts) — controller mapping HTTP endpoints to service calls. Uses httpOnly cookies for refresh tokens.

## Testing & Postman

I can add a Postman collection and a set of example requests (login/register/refresh/logout/protected). If you want that now, I will add `postman_collection.json` in the repo and example environment variables.

## Deployment notes

- Use Postgres (or other production-grade DB) instead of SQLite and run proper migrations with Prisma.
- Use HTTPS and set `Secure` cookie flag in production.
- Consider using Redis for:
  - Revocation lists and rapid reuse detection
  - Distributed rate-limiting counters
- Rotate signing keys and maintain a key-rotation strategy (key ids `kid` in JWT headers) so tokens can be validated after rotation for a short period.

## Advanced topics

- Redis refresh token storage and reuse detection: store recent token hashes with short TTL. On rotation, check whether an incoming refresh token's hash is present in the "already-rotated" set; if so, this indicates reuse.
- Multi-region auth: centralize session DB or use a replication strategy plus a global Redis for reuse detection.
- API Gateway: validate access tokens at the gateway for low-latency auth checks and forward the `sub` to microservices.
- Mobile flows: store refresh tokens in secure keystore/keychain and use device attestation if possible.
- Session dashboard: implement session listing (`GET /sessions`), allow device-based logout.
- Suspicious activity detection: on reused revoked refresh token -> revoke all sessions and notify user via email + forced password reset.

## Troubleshooting & FAQ

- "Cookie not sent on refresh": ensure client sets `credentials: 'include'` and server CORS has `credentials: true`.
- "Invalid refresh token": ensure you hash the incoming token with SHA-256 before DB lookup and that the DB value stores the hash.
- "Access token expired frequently": use refresh flow to obtain new access tokens; short access expiry is intentional for security.

## Interview Questions

- Why rotate refresh tokens? How does rotation reduce replay attacks?
- How would you detect refresh token theft and what automated actions would you take?
- Where to store refresh tokens in SPA vs mobile apps?
- Trade-offs between opaque and JWT refresh tokens.

## Next steps I can take for you

- Add a Postman collection and example environment file (I can create `/postman/refresh-auth.postman_collection.json`).
- Flesh out NestJS guards, DTOs, and validation (class-validator + pipes) for production readiness.
- Add Redis-based reuse detection and a basic `GET /sessions` endpoint to list and revoke sessions per-device.

Tell me which of the above you'd like me to do next and I will proceed.
