# Core Infrastructure: `better-auth` Implementation - Specification and Pseudocode

## 1. Overview

This document provides the detailed specification and high-level pseudocode for implementing `better-auth` (version 1.2.7) within the Perfect Pitch project. It aims to replace the current basic cookie-based authentication with a robust, secure, and scalable session-based authentication system provided by the `better-auth` library.

## 2. References

- Project Action Plan: [`todo/ACTIONS.md`](../todo/ACTIONS.md)
- `better-auth` Detailed Plan: [`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)
- Existing Architecture: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- D1 Database Plan: [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md)

## 2.A Development Tooling & Workflow

This project and its `better-auth` implementation adhere to specific tooling and workflow guidelines:

- **Package Manager:** All project operations **must** use `pnpm`.
- **Cloudflare Worker Types:** Generated via `wrangler types`. Run `pnpm run type-check` after Wrangler updates. **`@cloudflare/workers-types` package MUST NOT BE USED.**
- **Testing Framework:** **Vitest**.
- **Network Mocking:** **Mock Service Worker (MSW)** with `@mswjs/interceptors`.
- **Password Hashing:** Handled securely by the `better-auth` library, which employs strong, modern hashing algorithms.
- **Library Version:** `better-auth@1.2.7`.

## 3. Objectives

- Replace basic cookie-based authentication.
- Implement secure session management using the `better-auth` library.
- Provide a scalable authentication foundation.
- Integrate `better-auth` with Cloudflare D1 (via `kysely-d1`) for user/session storage.
- Utilize Hono framework for routing/middleware.
- Secure WebSockets via `better-auth` sessions.
- Manage all auth secrets (e.g., `BETTER_AUTH_SECRET_KEY`) via environment variables.

## 4. Scope

### 4.1. In Scope

- **`better-auth` Core Setup:**
  - Installation of `better-auth@1.2.7` and dependencies (`kysely`, `kysely-d1`).
  - Configuration of the `better-auth` instance (e.g., in `src/lib/auth.ts`).
- **Database Schema Integration:**
  - `better-auth` will manage its own tables in D1 via `kysely-d1`.
  - Review and potentially adapt existing `Users` table to link with `better-auth`'s user identities if needed.
- **Authentication API Endpoints:**
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me` (Optional)
- **Authentication Middleware:**
  - Hono middleware for `better-auth` session validation.
- **WebSocket Authentication:**
  - Update WebSocket upgrade handler ([`src/routes/interview.ts`](../src/routes/interview.ts)) for `better-auth`.
  - Modify `Interview` DO ([`src/interview.ts`](../src/interview.ts)) for authenticated `user_id` obtained from `better-auth`.
- **Frontend Updates:**
  - Modify [`public/auth.html`](../public/auth.html) for new auth API.
- **Security Measures:**
  - Rely on `better-auth` for password hashing and secure session cookie configuration.
  - Design considerations for CSRF, input validation, rate limiting.
- **User Migration Strategy:** Re-registration required.
- **Testing:** Unit/integration tests (Vitest, MSW).

### 4.2. Out of Scope

- Migration of historical user data.
- Advanced auth features (OAuth, MFA, password reset via email) unless core to `better-auth` v1.2.7 and simple to enable.
- Major UI redesign of auth pages.
- Specific rate-limiting infrastructure implementation beyond Cloudflare capabilities.
- Detailed authorization logic post-authentication.

## 5. Constraints

- **Technology Stack:** `better-auth@1.2.7`, `kysely`, `kysely-d1`, Cloudflare D1, Hono, Cloudflare Workers.
- **Security:** No hardcoded secrets; adhere to security best practices from [`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md).
- **Data Management:** "Start fresh" D1 strategy; `better-auth` manages its own data tables.
- **Development Process:** `pnpm`, `wrangler types`, Vitest, MSW, D1 migrations (if needed for app-specific tables).

## 6. Acceptance Criteria

- **User Registration:** Successful registration using `better-auth` methods. Tests for valid/invalid/duplicate cases.
- **User Login:** Successful login using `better-auth`, session creation, cookie setting. Tests for valid/invalid credentials.
- **User Logout:** Successful logout using `better-auth`, session invalidation, cookie clearing. Tests for various scenarios.
- **Session Management:** Correct creation, storage, expiry by `better-auth`. Secure cookie attributes. Tests for validation scenarios.
- **Protected Routes:** Inaccessible without valid `better-auth` session (401 error). Tests for access with/without valid session.
- **WebSocket Authentication:** Rejection without valid `better-auth` session; `user_id` passed to DO. Tests for various scenarios.
- **Error Handling:** Graceful handling of auth errors with appropriate responses.
- **Security Compliance:** No hardcoded secrets, input validation.
- **Tooling & Workflow Compliance:** Adherence to specified tools and processes.

## 7. Domain Model (Key Entities - `better-auth` Managed)

`better-auth` will internally manage its D1 tables for users, credentials, and sessions. Conceptually, these might include:

- **`ba_users` (or similar):** Stores user identity information.
  - `id` (PK)
  - `email` / `username` (identifier)
  - Timestamps
- **`ba_credentials` (or similar):** Stores hashed passwords and other credential types.
  - Linked to `ba_users`.
  - `type` (e.g., 'password')
  - `hashed_secret`
- **`ba_sessions` (or similar):** Stores active user sessions.
  - `id` (PK - Session ID)
  - Linked to `ba_users`.
  - `expires_at`
  - Timestamps

Our application might maintain its own `Users` table for application-specific profile data, potentially linking to `better-auth`'s user ID.

```sql
-- Application-specific Users table (example)
CREATE TABLE IF NOT EXISTS Users (
    user_id TEXT PRIMARY KEY,         -- App-specific ID
    username TEXT UNIQUE NOT NULL,    -- App-specific username
    better_auth_user_id TEXT UNIQUE,  -- FK to better-auth's user table ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## 8. High-Level Pseudocode with TDD Anchors

This pseudocode reflects interaction with the `better-auth` library.
Testing: **Vitest** with **MSW**. Password Hashing: Handled by `better-auth`.

### 8.1. Module: `better-auth` Configuration ([`src/lib/auth.ts`](../src/lib/auth.ts))

```typescript
// IMPORT { BetterAuth } from 'better-auth';
// IMPORT { D1Dialect } from 'kysely-d1';
// IMPORT { Env } from 'hono'; // Or your specific Env type for Cloudflare Worker

// FUNCTION initializeBetterAuth(env: Env): BetterAuth
// // TEST (Vitest): BetterAuth initializes successfully with D1Dialect and env vars.
// // TEST (Vitest): BetterAuth uses production-safe cookie settings if env is 'production'.
// // TEST (Vitest): BetterAuth uses development-friendly cookie settings if env is 'development'.

// // env.DB is the D1 binding
// // env.BETTER_AUTH_SECRET_KEY is the secret
// // env.BETTER_AUTH_URL is the application's base URL

// const authInstance = new BetterAuth({
//   secret: env.BETTER_AUTH_SECRET_KEY,
//   baseUrl: env.BETTER_AUTH_URL,
//   database: {
//     dialect: new D1Dialect({ database: env.DB })
//   }
//   // Potentially other configurations for cookie names, session duration, etc.
//   // Refer to better-auth v1.2.7 documentation for specific options.
// });

// // Type definitions for User, Session will likely be provided by better-auth itself.
// // e.g., import { User as BetterAuthUser, Session as BetterAuthSession } from 'better-auth';

// RETURN authInstance;
// END FUNCTION

// // Export the initialized instance for use across the application
// // export const auth = initializeBetterAuth(workerEnv); // Assuming workerEnv is available
```

### 8.2. Module: Database Schema (Managed by `better-auth`)

`better-auth` is expected to manage its own D1 tables via `kysely-d1`. No manual SQL migration scripts should be needed for `better-auth`'s core tables.
If the application maintains its own `Users` table (as in section 7), migrations for that table would be handled separately.

- // TEST (Vitest): Confirm `better-auth` initializes and potentially creates/migrates its tables in D1. (This might be an integration test).

### 8.3. Module: Auth API Routes ([`src/routes/auth.ts`](../src/routes/auth.ts))

Using Hono and the initialized `auth` instance from `src/lib/auth.ts`.

```typescript
// IMPORT hono_framework, { HonoContextWithUser } from 'hono'; // Assuming HonoContextWithUser extends with c.var.user
// IMPORT { auth } from '../lib/auth'; // The initialized better-auth instance
// IMPORT validation_utilities, error_handling_utilities;

// DEFINE auth_app = new Hono();

// ROUTE POST /api/v1/auth/register:
// HANDLER async (context: HonoContext):
// // TEST (Vitest with MSW): Valid registration calls auth.register, returns success.
// // TEST (Vitest with MSW): Registration with existing username/email returns appropriate error from auth.register.
// // TEST (Vitest with MSW): Registration with invalid input returns 400.
// READ email, password, username FROM context.req.json(); // Or whatever fields better-auth requires
// VALIDATE email, password, username;
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
//   // Refer to better-auth v1.2.7 docs for exact method signature and options
//   const { user, session, cookie } = await auth.register({ email, password, username /* other attributes */ });
//   // TEST: auth.register hashes password and creates user/credentials/session correctly.

//   IF cookie THEN context.header("Set-Cookie", cookie.serialize());
//   RETURN context.json({ message: "User registered successfully", userId: user.id }, 201);
// CATCH error // e.g., from better-auth if user exists, or validation error
//   LOG_ERROR("Registration failed:", error.message);
//   // Map better-auth specific errors to appropriate HTTP responses
//   IF error.name === 'UserExistsError' THEN RETURN error_response(409, "User already exists");
//   ELSE RETURN error_response(500, "Could not register user");
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/login:
// HANDLER async (context: HonoContext):
// // TEST (Vitest with MSW): Valid login calls auth.login, sets cookie, returns success.
// // TEST (Vitest with MSW): Invalid credentials return appropriate error from auth.login.
// READ identifier, password FROM context.req.json(); // identifier could be email or username
// VALIDATE identifier, password;
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
//   // Refer to better-auth v1.2.7 docs for exact method signature
//   const { user, session, cookie } = await auth.login({ identifier, password });
//   // TEST: auth.login validates credentials and creates session.

//   IF cookie THEN context.header("Set-Cookie", cookie.serialize());
//   RETURN context.json({ message: "Logged in successfully", userId: user.id });
// CATCH error // e.g., InvalidCredentialsError from better-auth
//   LOG_INFO("Login failed for:", identifier, error.message);
//   RETURN error_response(400, "Invalid username or password"); // Or 401
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/logout:
// HANDLER async (context: HonoContextWithUser):
// // TEST (Vitest with MSW): Valid logout calls auth.logout, clears cookie.
// // TEST (Vitest with MSW): Logout without/invalid session still clears cookie and succeeds.
// const sessionToken = context.req.cookie(auth.sessionCookieName || 'auth-session'); // Get cookie name from auth instance if possible

// IF sessionToken THEN
//   TRY
//     // Refer to better-auth v1.2.7 docs for exact method signature
//     await auth.logout(sessionToken);
//     // TEST: auth.logout invalidates session in D1.
//   CATCH error
//     LOG_INFO("Error during session invalidation on logout:", error.message);
//   END TRY
// END IF

// const blankCookie = auth.createBlankSessionCookie(); // Assuming better-auth provides this
// // TEST: auth.createBlankSessionCookie creates effective blank cookie.
// IF blankCookie THEN context.header("Set-Cookie", blankCookie.serialize());
// RETURN context.json({ message: "Logged out successfully" });
// END HANDLER

// ROUTE GET /api/v1/auth/me: (Protected by betterAuthMiddleware)
// HANDLER async (context: HonoContextWithUser):
// // TEST (Vitest with MSW): /me with valid session returns user data.
// const user = context.get('user'); // Populated by middleware
// IF NOT user THEN RETURN error_response(401, "Unauthorized");
// // Return non-sensitive user data provided by better-auth
// RETURN context.json({ id: user.id, email: user.email /* other fields from better-auth user object */ });
// END HANDLER

// EXPORT auth_app;
```

### 8.4. Module: Auth Middleware ([`src/middleware/auth.ts`](../src/middleware/auth.ts))

```typescript
// IMPORT hono_framework, { Next } from 'hono';
// IMPORT { auth } from '../lib/auth'; // The initialized better-auth instance
// IMPORT error_handling_utilities;
// IMPORT { User as BetterAuthUser, Session as BetterAuthSession } from 'better-auth'; // Example types

// DECLARE TYPE HonoContextWithOptionalUser = HonoContext & {
//   set: (key: 'user' | 'session', value: BetterAuthUser | BetterAuthSession | null) => void;
//   get: (key: 'user') => BetterAuthUser | null;
// };

// FUNCTION betterAuthMiddleware():
// RETURN async (context: HonoContextWithOptionalUser, next: Next):
// // TEST (Vitest): Middleware sets context.get('user')/session for valid cookie.
// // TEST (Vitest): Middleware allows pass-through for invalid/missing cookie (route handler will check).
// // TEST (Vitest): Middleware handles better-auth validation errors gracefully.
// const sessionToken = context.req.cookie(auth.sessionCookieName || 'auth-session');
// context.set("user", null);
// context.set("session", null);

// IF sessionToken THEN
//   TRY
//     // Refer to better-auth v1.2.7 docs for exact method signature
//     const validated = await auth.validateSession(sessionToken); // Or similar method

//     IF validated AND validated.user AND validated.session THEN
//       context.set("user", validated.user);
//       context.set("session", validated.session);

//       // IF better-auth handles session renewal and provides a new cookie string:
//       // IF validated.newCookieString THEN
//       //   context.header("Set-Cookie", validated.newCookieString);
//       // END IF
//     ELSE // Invalid session, clear cookie
//       const blankCookie = auth.createBlankSessionCookie();
//       IF blankCookie THEN context.header("Set-Cookie", blankCookie.serialize());
//     END IF
//   CATCH error
//     LOG_INFO("Session validation failed in middleware:", error.message);
//     const blankCookie = auth.createBlankSessionCookie();
//     IF blankCookie THEN context.header("Set-Cookie", blankCookie.serialize());
//   END TRY
// END IF

// await next(); // Always call next; route handlers are responsible for checking c.get('user')
// END FUNCTION
```

### 8.5. Module: WebSocket Auth Update ([`src/routes/interview.ts`](../src/routes/interview.ts))

```typescript
// IMPORT hono_framework;
// IMPORT { auth } from '../lib/auth'; // The initialized better-auth instance
// IMPORT { InterviewDurableObjectStub, Env } from '../types'; // Assuming Env includes DO binding

// ROUTE GET /api/v1/interview/:id/ws:
// HANDLER async (context: HonoContext, env: Env):
// // TEST (Vitest with MSW): WS upgrade with valid session succeeds, user_id passed to DO.
// // TEST (Vitest with MSW): WS upgrade with invalid/missing session rejected (401/403).
// const interview_id = context.req.param("id");
// const sessionToken = context.req.cookie(auth.sessionCookieName || 'auth-session');

// IF NOT sessionToken THEN
//   RETURN context.text("Unauthorized: Missing session cookie", 401);
// END IF

// let authUser = null;
// TRY
//   // Refer to better-auth v1.2.7 docs for exact method signature
//   const validationResult = await auth.validateSession(sessionToken);
//   IF validationResult AND validationResult.user THEN
//     authUser = validationResult.user;
//   ELSE
//     RETURN context.text("Unauthorized: Invalid session", 401);
//   END IF
// CATCH error
//   LOG_ERROR("WS Auth: Session validation error", error);
//   RETURN context.text("Unauthorized: Session validation failed", 401);
// END TRY

// IF NOT authUser OR NOT authUser.id THEN
//   RETURN context.text("Unauthorized: User not found after validation", 401);
// END IF

// const durableObjectStub = env.INTERVIEW.get(env.INTERVIEW.idFromString(interview_id));

// const forwardedRequest = new Request(context.req.url, context.req.raw);
// forwardedRequest.headers.set("X-Authenticated-User-Id", authUser.id);
// // Add other user details if needed by DO, e.g., authUser.email or authUser.username
// // forwardedRequest.headers.set("X-Authenticated-User-Email", authUser.email);

// RETURN durableObjectStub.fetch(forwardedRequest);
// END HANDLER
```

### 8.6. Module: Interview Durable Object Update ([`src/interview.ts`](../src/interview.ts))

```typescript
// CLASS InterviewDurableObject:
// CONSTRUCTOR(state, env): /* ... */ END CONSTRUCTOR

// METHOD fetch(request: Request):
//   const authenticated_user_id = request.headers.get("X-Authenticated-User-Id");
//   // const authenticated_user_email = request.headers.get("X-Authenticated-User-Email");
//   // TEST (Vitest): DO correctly extracts user_id from request headers.

//   IF request.headers.get("Upgrade") === "websocket" THEN
//     IF NOT authenticated_user_id THEN
//       // TEST (Vitest): DO rejects WebSocket upgrade if user_id is missing.
//       RETURN new Response("User ID missing for WebSocket connection", { status: 400 });
//     END IF
//     // Associate authenticated_user_id with the WebSocket session
//     // ... standard WebSocket upgrade logic ...
//     // Example: this.sessions.push({ socket: server_websocket, userId: authenticated_user_id });
//     // server_websocket.accept();
//     // this.handleNewWebSocketSession(server_websocket, authenticated_user_id /*, other user details */);
//     // RETURN new Response(null, { status: 101, webSocket: client_websocket });
//   ELSE
//     // Handle HTTP requests if any
//   END IF
// END METHOD

// METHOD handleNewWebSocketSession(websocket, userId /*, otherUserDetails */):
//   // TEST (Vitest): WebSocket messages processed in context of authenticated userId.
//   // All operations within this WebSocket session now use `userId`.
//   // websocket.addEventListener("message", async event => {
//   //   // PROCESS_MESSAGE(event.data, userId /*, otherUserDetails */);
//   // });
// END METHOD
// END CLASS
```

This pseudocode provides a more concrete structure based on integrating a library like `better-auth`. The exact method names and object structures from `better-auth` v1.2.7 documentation will need to be used during actual implementation.
