# Core Infrastructure: BetterAuth Implementation - Specification and Pseudocode

## 1. Overview

This document provides the detailed specification and high-level pseudocode for implementing BetterAuth within the Perfect Pitch project. It aims to replace the current basic cookie-based authentication with a robust, secure, and scalable session-based authentication system.

## 2. References

- Project Action Plan: [`todo/ACTIONS.MD`](../todo/ACTIONS.MD)
- BetterAuth Detailed Plan: [`docs/BETTERAUTH_PLAN.MD`](./BETTERAUTH_PLAN.MD)
- Existing Architecture: [`docs/ARCHITECTURE.MD`](./ARCHITECTURE.MD)
- D1 Database Plan: [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md)

## 2.A Development Tooling & Workflow

This project and its BetterAuth implementation adhere to specific tooling and workflow guidelines:

- **Package Manager:** All project operations **must** use `pnpm`.
- **Cloudflare Worker Types:** Generated via `wrangler types`. Run `pnpm run type-check` after Wrangler updates. **`@cloudflare/workers-types` package MUST NOT BE USED.**
- **Testing Framework:** **Vitest**.
- **Network Mocking:** **Mock Service Worker (MSW)** with `@mswjs/interceptors`.
- **Password Hashing:** A strong algorithm like **Argon2id, scrypt, or bcrypt** will be chosen during BetterAuth definition.
- **Orchestration & Research:** SPARC Orchestrator can assist with research if BetterAuth is a specific library.

## 3. Objectives

- Replace basic cookie-based authentication.
- Implement secure session management using BetterAuth.
- Provide a scalable authentication foundation.
- Integrate with Cloudflare D1 for user/session storage.
- Utilize Hono framework for routing/middleware.
- Secure WebSockets via BetterAuth sessions.
- Manage all auth secrets via environment variables.

## 4. Scope

### 4.1. In Scope

- **BetterAuth Core Setup:**
  - Installation of BetterAuth library (if applicable) and necessary dependencies (e.g., hashing library, D1 adapter).
  - Configuration of BetterAuth instance/modules.
- **Database Schema Modifications:**
  - Modifying/Creating user, session, and credential tables in D1.
  - D1 migrations for schema changes.
- **Authentication API Endpoints:**
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me` (Optional)
- **Authentication Middleware:**
  - Hono middleware for BetterAuth session validation.
- **WebSocket Authentication:**
  - Update WebSocket upgrade handler ([`src/routes/interview.ts`](../src/routes/interview.ts)) for BetterAuth.
  - Modify `Interview` DO ([`src/interview.ts`](../src/interview.ts)) for authenticated `user_id`.
- **Frontend Updates:**
  - Modify [`public/auth.html`](../public/auth.html) for new auth API.
- **Security Measures:**
  - Password hashing.
  - Secure session cookie configuration.
  - Design considerations for CSRF, input validation, rate limiting.
- **User Migration Strategy:** Re-registration required.
- **Testing:** Unit/integration tests (Vitest, MSW).

### 4.2. Out of Scope

- Migration of historical user data.
- Advanced auth features (OAuth, MFA, password reset via email) unless part of core BetterAuth.
- Major UI redesign of auth pages.
- Specific rate-limiting infrastructure implementation.
- Detailed authorization logic post-authentication.

## 5. Constraints

- **Technology Stack:** BetterAuth, Cloudflare D1, Hono, Cloudflare Workers, chosen password hasher.
- **Security:** No hardcoded secrets; adhere to security best practices from [`docs/BETTERAUTH_PLAN.MD`](./BETTERAUTH_PLAN.MD).
- **Data Management:** "Start fresh" D1 strategy.
- **Development Process:** `pnpm`, `wrangler types`, Vitest, MSW, D1 migrations.

## 6. Acceptance Criteria

- **User Registration:** Successful registration, password hashing. Tests for valid/invalid/duplicate cases.
- **User Login:** Successful login, session creation, cookie setting. Tests for valid/invalid credentials.
- **User Logout:** Successful logout, session invalidation, cookie clearing. Tests for various scenarios.
- **Session Management:** Correct creation, storage, expiry. Secure cookie attributes. Tests for validation scenarios.
- **Protected Routes:** Inaccessible without valid session (401 error). Tests for access with/without valid session.
- **WebSocket Authentication:** Rejection without valid session; `user_id` passed to DO. Tests for various scenarios.
- **Error Handling:** Graceful handling of auth errors with appropriate responses.
- **Security Compliance:** No hardcoded secrets, input validation.
- **Tooling & Workflow Compliance:** Adherence to specified tools and processes.

## 7. Domain Model (Key Entities for Auth - Generic)

- **User:**
  - `user_id` (TEXT, PK)
  - `username` (TEXT, UNIQUE, NOT NULL)
  - `created_at` (TIMESTAMP, NOT NULL)
  - `updated_at` (TIMESTAMP, NOT NULL)
- **UserCredential:** (Stores hashed passwords and other credential types)
  - `id` (TEXT, PK)
  - `user_id` (TEXT, FK, NOT NULL)
  - `type` (TEXT, NOT NULL) (e.g., 'password', 'oauth_google')
  - `hashed_secret` (TEXT, NULLABLE) (Hashed password)
  - `created_at` (TIMESTAMP, NOT NULL)
  - `updated_at` (TIMESTAMP, NOT NULL)
- **UserSession:**
  - `id` (TEXT, PK) (Session ID)
  - `user_id` (TEXT, FK, NOT NULL)
  - `expires_at` (TIMESTAMP, NOT NULL)
  - `created_at` (TIMESTAMP, NOT NULL)
  - (Consider: `user_agent`, `ip_address` for auditing)

## 8. High-Level Pseudocode with TDD Anchors

This pseudocode is generic and will need to be adapted based on the specific BetterAuth solution.
Testing: **Vitest** with **MSW**. Password Hashing: **Chosen strong algorithm**.

### 8.1. Module: BetterAuth Configuration ([`src/lib/betterAuth.ts`](../src/lib/betterAuth.ts) or `src/auth/betterAuth.ts`)

```typescript
// FUNCTION initializeBetterAuth(d1_binding, environment_variables):
// // TEST (Vitest): BetterAuth initializes successfully with D1 integration and env vars.
// // TEST (Vitest): BetterAuth uses production-safe cookie settings if env is 'production'.
// // TEST (Vitest): BetterAuth uses development-friendly cookie settings if env is 'development'.

// // [Placeholder for BetterAuth]: Specific initialization logic for BetterAuth.
// // This will involve setting up any adapters (e.g., for D1), configuring
// // session parameters, cookie settings, and user attribute handling.

// DEFINE betterAuth_instance = CONFIGURE_BETTERAUTH_SOLUTION({
//   adapter: CONFIGURE_D1_ADAPTER(d1_binding, { /* table names */ }),
//   sessionCookie: {
//     attributes: {
//       secure: IS_PRODUCTION_ENVIRONMENT(environment_variables),
//       sameSite: "lax",
//       httpOnly: true
//     }
//   },
//   getUserAttributes: (attributes) => { /* return non-sensitive user data */ },
//   // Other BetterAuth specific configurations (e.g., password hashing rounds, token issuers)
// });

// // [Placeholder for BetterAuth]: Type definitions if BetterAuth requires them.
// DECLARE_MODULE_TYPES_FOR_BETTERAUTH;

// RETURN betterAuth_instance;
// END FUNCTION
```

### 8.2. Module: Database Schema (Conceptual for D1 Migrations)

Refer to [`docs/BETTERAUTH_PLAN.MD`](./BETTERAUTH_PLAN.MD) for SQL table definitions.
Migrations: `.sql` files (e.g., `migrations/XXXX_create_betterauth_tables.sql`).
  - // TEST (Vitest): Migrations for Users, UserCredentials, UserSessions tables are correct.
  - // TEST (Vitest): Migrations apply successfully to D1.

### 8.3. Module: Auth API Routes ([`src/routes/auth.ts`](../src/routes/auth.ts))

Using Hono and `betterAuth_instance`. Password hashing via chosen library.

```typescript
// IMPORT hono_framework, betterAuth_instance, validation_utilities, error_handling_utilities;
// IMPORT password_hashing_library; // e.g., argon2, bcrypt

// DEFINE auth_app = new Hono();

// ROUTE POST /api/v1/auth/register:
// HANDLER async (context):
// // TEST (Vitest with MSW): Valid registration creates user/credentials, returns success.
// // TEST (Vitest with MSW): Registration with existing username returns 409.
// // TEST (Vitest with MSW): Registration with invalid input returns 400.
// READ username, password FROM context.req.json();
// VALIDATE username, password;
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
//   hashed_password = await password_hashing_library.hash(password);
//   user_id = generate_unique_id();

//   // [Placeholder for BetterAuth]: API to create user and credentials.
//   // This might involve creating a user entity and then a credential entity linked to it.
//   await betterAuth_instance.createUserAndCredential({
//     userId: user_id,
//     username: username,
//     credentialType: "password",
//     hashedSecret: hashed_password
//   });

//   // Optionally create session:
//   // session = await betterAuth_instance.createSession(user_id, {});
//   // session_cookie = betterAuth_instance.createSessionCookie(session.id);
//   // context.header("Set-Cookie", session_cookie.serialize());

//   RETURN context.json({ message: "User registered successfully" }, 201);
// CATCH error
//   IF error IS UniqueConstraintFailed THEN RETURN error_response(409, "Username already taken");
//   ELSE RETURN error_response(500, "Could not register user");
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/login:
// HANDLER async (context):
// // TEST (Vitest with MSW): Valid login creates session, sets cookie, returns success.
// // TEST (Vitest with MSW): Invalid username/password returns 400/401.
// READ username, password FROM context.req.json();
// VALIDATE username, password;
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
//   // [Placeholder for BetterAuth]: API to verify credentials and get user.
//   verified_user_context = await betterAuth_instance.verifyCredentialsAndGetUser({
//     username: username,
//     password: password, // BetterAuth will handle hashing comparison
//     credentialType: "password"
//   });
//   // TEST (Vitest): BetterAuth correctly validates password.

//   IF NOT verified_user_context OR NOT verified_user_context.userId THEN
//     RETURN error_response(400, "Invalid username or password");
//   END IF

//   session = await betterAuth_instance.createSession(verified_user_context.userId, {});
//   // TEST (Vitest): BetterAuth creates session for valid user.
//   session_cookie = betterAuth_instance.createSessionCookie(session.id);
//   // TEST (Vitest): BetterAuth creates valid session cookie string.

//   context.header("Set-Cookie", session_cookie.serialize());
//   RETURN context.json({ message: "Logged in successfully" });
// CATCH error
//   LOG_INFO("Login failed for user:", username, error.message);
//   RETURN error_response(400, "Invalid username or password");
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/logout:
// HANDLER async (context):
// // TEST (Vitest with MSW): Valid logout invalidates session, clears cookie.
// // TEST (Vitest with MSW): Logout without/invalid session still clears cookie and succeeds.
// session_cookie_value = context.req.cookie(betterAuth_instance.sessionCookieName);
// IF session_cookie_value THEN
//   TRY
//     // [Placeholder for BetterAuth]: API to validate and invalidate session.
//     session_to_invalidate = await betterAuth_instance.getSessionForInvalidation(session_cookie_value);
//     IF session_to_invalidate THEN
//       await betterAuth_instance.invalidateSession(session_to_invalidate.id);
//       // TEST (Vitest): BetterAuth invalidates session in D1.
//     END IF
//   CATCH error // Log error but proceed to clear cookie
//     LOG_INFO("Error during session invalidation on logout:", error.message);
//   END TRY
// END IF

// blank_cookie = betterAuth_instance.createBlankSessionCookie();
// // TEST (Vitest): BetterAuth creates effective blank cookie.
// context.header("Set-Cookie", blank_cookie.serialize());
// RETURN context.json({ message: "Logged out successfully" });
// END HANDLER

// ROUTE GET /api/v1/auth/me: (Protected by betterAuthMiddleware)
// HANDLER async (context):
// // TEST (Vitest with MSW): /me with valid session returns user data (non-sensitive).
// user = context.var.user; // Populated by middleware
// IF NOT user THEN RETURN error_response(401, "Unauthorized");
// RETURN context.json({ userId: user.id, username: user.username /* other non-sensitive fields */ });
// END HANDLER

// EXPORT auth_app;
```

### 8.4. Module: Auth Middleware ([`src/middleware/betterAuth.ts`](../src/middleware/betterAuth.ts))

```typescript
// IMPORT hono_framework, betterAuth_instance, error_handling_utilities;

// FUNCTION betterAuthMiddleware():
// RETURN async (context, next_handler):
// // TEST (Vitest): Middleware sets c.var.user/session for valid cookie.
// // TEST (Vitest): Middleware returns 401 or allows pass-through for invalid/missing cookie based on route protection strategy.
// // TEST (Vitest): Middleware handles BetterAuth validation errors.
// session_cookie_value = context.req.cookie(betterAuth_instance.sessionCookieName);
// context.set("user", null); // Default to no user/session
// context.set("session", null);

// IF session_cookie_value THEN
//   TRY
//     // [Placeholder for BetterAuth]: API to validate session and get user/session context.
//     // This might also handle session renewal and provide a new cookie.
//     validated_auth_context = await betterAuth_instance.validateSessionAndRefresh(session_cookie_value);

//     IF validated_auth_context AND validated_auth_context.user AND validated_auth_context.session THEN
//       context.set("user", validated_auth_context.user);
//       context.set("session", validated_auth_context.session);

//       IF validated_auth_context.newSessionCookie THEN // If session was refreshed
//         context.header("Set-Cookie", validated_auth_context.newSessionCookie.serialize());
//       END IF
//     ELSE // Invalid session, clear cookie
//       blank_cookie = betterAuth_instance.createBlankSessionCookie();
//       context.header("Set-Cookie", blank_cookie.serialize());
//     END IF
//   CATCH error // Validation failed (e.g., expired, invalid)
//     LOG_INFO("Session validation failed in middleware:", error.message);
//     blank_cookie = betterAuth_instance.createBlankSessionCookie();
//     context.header("Set-Cookie", blank_cookie.serialize());
//   END TRY
// END IF

// // Decision to call next_handler() or return 401 depends on whether the route
// // strictly requires authentication or can operate without it.
// // For an API like /me, the route handler itself would check c.var.user.
// // For global protection, this middleware might return 401 if c.var.user is null.
// // This example assumes the middleware populates context, and route handlers check it.
// await next_handler();
// END FUNCTION
```

### 8.5. Module: WebSocket Auth Update ([`src/routes/interview.ts`](../src/routes/interview.ts))

```typescript
// IMPORT hono_framework, betterAuth_instance, InterviewDurableObjectStub;

// ROUTE GET /api/v1/interview/:id/ws:
// HANDLER async (context, env):
// // TEST (Vitest with MSW): WS upgrade with valid session succeeds, user_id passed to DO.
// // TEST (Vitest with MSW): WS upgrade with invalid/missing session rejected (401/403).
// interview_id = context.req.param("id");
// session_cookie_value = context.req.cookie(betterAuth_instance.sessionCookieName);

// IF NOT session_cookie_value THEN
//   RETURN context.text("Unauthorized: Missing session cookie", 401);
// END IF

// user = null;
// TRY
//   // [Placeholder for BetterAuth]: API to validate session and get user.
//   // For WS, session renewal via cookie might be tricky; focus on validation.
//   validated_user = await betterAuth_instance.validateSessionAndGetUser(session_cookie_value);
//   IF validated_user AND validated_user.id THEN
//     user = validated_user;
//   ELSE
//     RETURN context.text("Unauthorized: Invalid session", 401);
//   END IF
// CATCH error
//   LOG_ERROR("WS Auth: Session validation error", error);
//   RETURN context.text("Unauthorized: Session validation failed", 401);
// END TRY

// IF NOT user THEN RETURN context.text("Unauthorized: User not found", 401); // Should be caught above

// durable_object_stub = env.INTERVIEW.get(env.INTERVIEW.idFromString(interview_id));

// // Pass user_id to DO, e.g., via custom header
// const forwardedRequest = new Request(context.req.url, context.req.raw);
// forwardedRequest.headers.set("X-Authenticated-User-Id", user.id);
// forwardedRequest.headers.set("X-Authenticated-Username", user.username); // If needed by DO

// RETURN durable_object_stub.fetch(forwardedRequest);
// END HANDLER
```

### 8.6. Module: Interview Durable Object Update ([`src/interview.ts`](../src/interview.ts))

```typescript
// CLASS InterviewDurableObject:
// CONSTRUCTOR(state, env): /* ... */ END CONSTRUCTOR

// METHOD fetch(request):
//   // Extract user_id and username from custom headers
//   const authenticated_user_id = request.headers.get("X-Authenticated-User-Id");
//   const authenticated_username = request.headers.get("X-Authenticated-Username");
//   // TEST (Vitest): DO correctly extracts user_id/username from request headers.

//   IF request.headers.get("Upgrade") === "websocket" THEN
//     IF NOT authenticated_user_id THEN
//       // TEST (Vitest): DO rejects WebSocket upgrade if user_id is missing.
//       RETURN new Response("User ID missing for WebSocket connection", { status: 400 });
//     END IF
//     // Associate authenticated_user_id with the WebSocket session
//     // ... standard WebSocket upgrade logic ...
//     // server_websocket.accept();
//     // this.handleNewWebSocketSession(server_websocket, authenticated_user_id, authenticated_username);
//     // RETURN new Response(null, { status: 101, webSocket: client_websocket });
//   ELSE
//     // Handle HTTP requests if any, using authenticated_user_id if present and required
//   END IF
// END METHOD

// METHOD handleNewWebSocketSession(websocket, userId, username):
//   // TEST (Vitest): WebSocket messages processed in context of authenticated userId.
//   // All operations within this WebSocket session now use `userId`.
//   // websocket.addEventListener("message", async event => {
//   //   // PROCESS_MESSAGE(event.data, userId, username);
//   // });
// END METHOD
// END CLASS
```

This pseudocode provides a high-level structure. The actual implementation will depend heavily on the specific APIs provided by the chosen BetterAuth solution, Hono, and Cloudflare Workers. Remember to handle errors robustly and log appropriately.
