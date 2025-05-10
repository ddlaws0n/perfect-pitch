# Core Infrastructure: Lucia Auth Implementation - Specification and Pseudocode

## 1. Overview

This document provides the detailed specification and high-level pseudocode for implementing Lucia Auth within the Perfect Pitch project. It aims to replace the current basic cookie-based authentication with a robust, secure, and scalable session-based authentication system.

## 2. References

- Project Action Plan: [`todo/ACTIONS.MD`](../todo/ACTIONS.MD)
- Lucia Auth Detailed Plan: [`docs/LUCIA_AUTH_PLAN.MD`](./LUCIA_AUTH_PLAN.MD)
- Existing Architecture: [`docs/ARCHITECTURE.MD`](./ARCHITECTURE.MD)
- D1 Database Plan: [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md)

## 2.A Development Tooling & Workflow

This project and its Lucia Auth implementation adhere to specific tooling and workflow guidelines:

- **Package Manager:** All project operations **must** use `pnpm`. This includes installing dependencies, running scripts, etc.
- **Cloudflare Worker Types:**
  - Cloudflare Worker types are generated using the command `wrangler types`.
  - Whenever Cloudflare Wrangler is updated, or changes are made that might affect worker types, run `pnpm run type-check` (or the relevant script for `tsc`) to refresh types and perform a type check.
  - **Crucially, the `@cloudflare/workers-types` package MUST NOT BE USED.** This package has been replaced by the `wrangler types` generation approach.
- **Testing Framework:** The project uses **Vitest** for all testing purposes.
- **Network Mocking:** Network requests in tests are mocked using **Mock Service Worker (MSW)**, specifically with `@mswjs/interceptors`.
- **Password Hashing:** Password hashing will use **`argon2`**.
- **Orchestration & Research:** The SPARC Orchestrator can initiate research tasks (e.g., using Perplexity or context7) to obtain the most up-to-date and relevant documentation when needed.

## 3. Objectives

- Replace the existing basic cookie-based authentication mechanism.
- Implement a secure and modern session management system using Lucia Auth.
- Provide a scalable authentication foundation for future development.
- Integrate seamlessly with Cloudflare D1 for user and session storage.
- Utilize the Hono framework for routing and middleware.
- Secure WebSocket connections by authenticating users via Lucia Auth sessions.
- Ensure all authentication secrets are managed via environment variables, not hardcoded.

## 4. Scope

### 4.1. In Scope

- **Lucia Auth Core Setup:**
  - Installation of `lucia`, `@lucia-auth/adapter-d1`, and `argon2`.
  - Configuration of the Lucia Auth instance, including D1 adapter and environment settings.
- **Database Schema Modifications:**
  - Modifying the `Users` table in D1.
  - Creating new `user_sessions` and `user_keys` tables in D1.
  - Generating and applying D1 migrations for these schema changes.
- **Authentication API Endpoints:**
  - `POST /api/v1/auth/register`: User registration with username and password.
  - `POST /api/v1/auth/login`: User login with username and password.
  - `POST /api/v1/auth/logout`: User logout and session invalidation.
  - `GET /api/v1/auth/me`: (Optional) Endpoint to retrieve current authenticated user details.
- **Authentication Middleware:**
  - Development of Hono middleware to validate Lucia sessions for protected routes.
  - Integration of this middleware into the application.
- **WebSocket Authentication:**
  - Updating the WebSocket upgrade handler in [`src/routes/interview.ts`](../src/routes/interview.ts) to validate Lucia sessions.
  - Modifying the `Interview` Durable Object ([`src/interview.ts`](../src/interview.ts)) to receive and utilize the authenticated `user_id`.
- **Frontend Updates:**
  - Modifying [`public/auth.html`](../public/auth.html) and its client-side JavaScript to interact with the new authentication API endpoints.
- **Security Measures:**
  - Implementation of password hashing using **`argon2`**.
  - Secure session cookie configuration (HttpOnly, Secure, SameSite).
  - Basic considerations for CSRF protection, input validation, and rate limiting in the design.
- **User Migration Strategy:**
  - Users will be required to re-register. No automatic migration of users from the old basic auth system.
- **Testing:**
  - Unit and integration tests for authentication logic using **Vitest**.
  - Network mocking in tests using **MSW** (`@mswjs/interceptors`).

### 4.2. Out of Scope

- Migration of any historical user activity or data associated with the old cookie-based authentication system.
- Advanced authentication features not part of the core username/password flow (e.g., OAuth providers, password reset via email, two-factor authentication), unless trivially supported by Lucia's default setup.
- Extensive UI/UX redesign of authentication pages beyond functional updates to [`public/auth.html`](../public/auth.html).
- Implementation of specific rate-limiting infrastructure (though design should consider it).
- Detailed authorization logic beyond authenticating the user (i.e., what a user can do post-login is a separate concern).

## 5. Constraints

- **Technology Stack:**
  - Must use Lucia Auth for authentication.
  - Must use Cloudflare D1 as the database for user and session data.
  - Must integrate with the Hono web framework.
  - The application runs in the Cloudflare Workers serverless environment.
  - Password hashing must use `argon2`.
- **Security:**
  - No hard-coded secrets (API keys, Lucia internal secrets); all sensitive configuration must be managed via Cloudflare Worker environment variables.
  - Adherence to security best practices outlined in [`docs/LUCIA_AUTH_PLAN.MD#5-security-considerations`](./LUCIA_AUTH_PLAN.MD#section-5).
  - Strong password hashing algorithms must be used (`argon2`).
- **Data Management:**
  - Adherence to the "start fresh" D1 data strategy for new user registrations, as per [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md).
- **Development Process:**
  - D1 schema changes must be managed via migration files.
  - All project operations must use `pnpm`.
  - Cloudflare Worker types must be generated using `wrangler types`; `@cloudflare/workers-types` package is forbidden.
  - Type checking (`pnpm run type-check` or equivalent) must be performed after Wrangler updates.
  - Testing must be done using Vitest, with network mocking via MSW.

## 6. Acceptance Criteria

- **User Registration:**
  - A new user can successfully register using a unique username and a password.
  - Passwords are securely hashed using `argon2` and stored.
  - // TEST: User registration with valid unique username and password succeeds.
  - // TEST: User registration with an already taken username fails.
  - // TEST: User registration with an invalid password (e.g., too short) fails if policy is enforced.
- **User Login:**
  - A registered user can successfully log in using their username and password.
  - Upon successful login, a session is created, and a secure session cookie is set.
  - // TEST: Login with correct credentials succeeds and returns a session cookie.
  - // TEST: Login with incorrect password fails.
  - // TEST: Login with non-existent username fails.
- **User Logout:**
  - A logged-in user can successfully log out.
  - Upon logout, the user's session is invalidated in the database, and the session cookie is cleared.
  - // TEST: Logout successfully invalidates session and clears cookie.
- **Session Management:**
  - Sessions are correctly created, stored in D1, and associated with a user.
  - Sessions have an expiration time and are invalidated upon expiry.
  - Session cookies are configured with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` (or `Strict`) attributes.
  - // TEST: Session validation succeeds for an active session.
  - // TEST: Session validation fails for an expired session.
  - // TEST: Session validation fails for an invalid session ID.
- **Protected Routes:**
  - API routes designated as protected are inaccessible without a valid session.
  - Access attempts to protected routes without a valid session result in a `401 Unauthorized` error (or appropriate redirect).
  - // TEST: Access to a protected route with a valid session succeeds.
  - // TEST: Access to a protected route without a session fails with 401.
  - // TEST: Access to a protected route with an invalid/expired session fails with 401.
- **WebSocket Authentication:**
  - WebSocket connection upgrades are rejected if a valid Lucia session is not present.
  - If the session is valid, the `user_id` is successfully extracted and made available to the `Interview` Durable Object.
  - // TEST: WebSocket connection with a valid session cookie is upgraded.
  - // TEST: WebSocket connection without a session cookie is rejected.
  - // TEST: WebSocket connection with an invalid session cookie is rejected.
  - // TEST: Authenticated user_id is correctly passed to and usable by the Interview DO.
- **Error Handling:**
  - The system gracefully handles common authentication errors (e.g., invalid input, user not found, incorrect password, session expired) by returning appropriate error messages/status codes.
  - // TEST: API returns clear error for invalid registration data (e.g., missing username).
  - // TEST: API returns clear error for invalid login data.
- **Security Compliance:**
  - No secrets are hardcoded in the application.
  - Input validation is performed for authentication-related inputs.
- **Tooling & Workflow Compliance:**
  - `pnpm` is used for package management.
  - Cloudflare types are generated via `wrangler types`.
  - Tests are written and executed with Vitest.
  - Network mocking uses MSW.

## 7. Domain Model (Key Entities for Auth)

- **User:**
  - `user_id` (TEXT, PK): Unique identifier for the user (typically generated by Lucia or a UUID).
  - `username` (TEXT, UNIQUE, NOT NULL): User's chosen username.
  - `created_at` (TIMESTAMP, NOT NULL): Timestamp of user creation.
  - `updated_at` (TIMESTAMP, NOT NULL): Timestamp of last user update.
- **UserKey:** (Used by Lucia to store provider-specific identifiers, including hashed passwords for 'username' provider)
  - `id` (TEXT, PK): Key identifier (e.g., `username:<username_value>`).
  - `user_id` (TEXT, FK, NOT NULL): Foreign key referencing `Users.user_id`.
  - `hashed_password` (TEXT, NULLABLE): Hashed password (using `argon2`) for the user, if this key is for password authentication.
  - `created_at` (TIMESTAMP, NOT NULL): Timestamp of key creation.
  - `updated_at` (TIMESTAMP, NOT NULL): Timestamp of last key update.
- **UserSession:**
  - `id` (TEXT, PK): Unique session identifier (generated by Lucia).
  - `user_id` (TEXT, FK, NOT NULL): Foreign key referencing `Users.user_id`.
  - `expires_at` (TIMESTAMP, NOT NULL): Timestamp when the session expires.
  - `created_at` (TIMESTAMP, NOT NULL): Timestamp of session creation.

## 8. High-Level Pseudocode with TDD Anchors

This pseudocode outlines the logical flow and key components. Actual implementation will use Lucia Auth's specific API.
Testing will be performed using **Vitest**, with network calls mocked by **MSW**.

### 8.1. Module: Lucia Configuration ([`src/lib/lucia.ts`](../src/lib/lucia.ts) or `src/auth/lucia.ts`)

\`\`\`typescript
// FUNCTION initializeLucia(d1_binding, environment_variables):
// // TEST (Vitest): Lucia initializes successfully with D1 adapter and environment variables.
// // TEST (Vitest): Lucia uses production-safe cookie settings if env is 'production'.
// // TEST (Vitest): Lucia uses development-friendly cookie settings if env is 'development'.

// DEFINE adapter = new D1Adapter(d1_binding, {
// user: "Users", // Table names
// session: "user_sessions",
// key: "user_keys"
// });

// DEFINE lucia = new Lucia(adapter, {
// sessionCookie: {
// attributes: {
// secure: IS_PRODUCTION_ENVIRONMENT(environment_variables), // Use env var to determine
// sameSite: "lax", // Or "strict"
// httpOnly: true
// }
// },
// getUserAttributes: (attributes) => {
// RETURN {
// username: attributes.username
// // Do NOT return hashed_password or other sensitive data
// };
// },
// // Potentially sessionExpiresIn, etc.
// });

// // Define types for Lucia if needed (e.g., Register<Lucia>)
// DECLARE_MODULE_TYPES_FOR_LUCIA_AUTH; // Placeholder for type augmentation

// RETURN lucia_instance;
// END FUNCTION
\`\`\`

### 8.2. Module: Database Schema (Conceptual for D1 Migrations)

Refer to [`docs/LUCIA_AUTH_PLAN.MD#32-database-schema`](./LUCIA_AUTH_PLAN.MD#section-3-2) for SQL table definitions. Migrations will be created as `.sql` files.

- `migrations/XXXX_update_users_add_lucia_fields.sql` (if modifying existing Users table, or combine with below)
- `migrations/YYYY_create_lucia_auth_tables.sql` (for `user_sessions`, `user_keys`)
  - // TEST (Vitest, potentially with D1 mock/local D1): Migration for Users table alteration/creation is correct.
  - // TEST (Vitest): Migration for user_sessions table creation is correct.
  - // TEST (Vitest): Migration for user_keys table creation is correct.
  - // TEST (Vitest): All migrations apply successfully to D1 database (local or mocked).

### 8.3. Module: Auth API Routes ([`src/routes/auth.ts`](../src/routes/auth.ts))

This module will use the Hono framework and the initialized `lucia` instance.
Password hashing will use `argon2`.

\`\`\`typescript
// IMPORT hono_framework, lucia_instance, validation_utilities, error_handling_utilities;
// IMPORT password_hashing_utilities (from argon2); // Updated

// DEFINE auth_app = new Hono();

// ROUTE POST /api/v1/auth/register:
// HANDLER async (context):
// // TEST (Vitest with MSW): Registration with valid data creates user and key, returns success.
// // TEST (Vitest with MSW): Registration with existing username returns 409 Conflict.
// // TEST (Vitest with MSW): Registration with invalid input (e.g., short password) returns 400 Bad Request.
// // TEST (Vitest with MSW): Registration handles database errors gracefully.
// READ username, password FROM context.req.json();
// VALIDATE username, password (e.g., length, format);
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
// hashed_password = await password_hashing_utilities.hash(password); // Using argon2
// user_id = generate_unique_id(); // e.g., cuid, nanoid or let Lucia handle it

// // Lucia's createUser and createKey might handle this in one go or separately
// // Depending on Lucia version and adapter specifics
// // This is a conceptual representation
// await lucia_instance.database_adapter.createUser({ // Or similar Lucia API
// user_id: user_id,
// username: username
// // any other attributes for Users table
// });
// await lucia_instance.database_adapter.createKey({ // Or similar Lucia API
// id: "username:" + username,
// user_id: user_id,
// hashed_password: hashed_password
// });

// // Optionally create session immediately after registration
// // session = await lucia_instance.createSession(user_id, {});
// // session_cookie = lucia_instance.createSessionCookie(session.id);
// // context.header("Set-Cookie", session_cookie.serialize());

// RETURN context.json({ message: "User registered successfully" }, 201);
// CATCH error
// IF error is UniqueConstraintFailed (e.g., username exists) THEN
// RETURN error_response(409, "Username already taken");
// ELSE
// LOG_ERROR(error);
// RETURN error_response(500, "Could not register user");
// END IF
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/login:
// HANDLER async (context):
// // TEST (Vitest with MSW): Login with valid credentials creates session, sets cookie, returns success.
// // TEST (Vitest with MSW): Login with invalid username returns 400 Bad Request (or 401).
// // TEST (Vitest with MSW): Login with incorrect password returns 400 Bad Request (or 401).
// // TEST (Vitest with MSW): Login handles database errors gracefully.
// READ username, password FROM context.req.json();
// VALIDATE username, password;
// IF validation_fails THEN RETURN error_response(400, "Invalid input");

// TRY
// key = await lucia_instance.useKey("username", username, password); // Lucia's method to verify password (argon2 will be used internally by Lucia if configured)
// // TEST (Vitest): lucia.useKey correctly validates password and retrieves key.
// // TEST (Vitest): lucia.useKey throws error for invalid credentials.

// session = await lucia_instance.createSession(key.userId, {});
// // TEST (Vitest): lucia.createSession successfully creates a session for a valid user ID.
// session_cookie = lucia_instance.createSessionCookie(session.id);
// // TEST (Vitest): lucia.createSessionCookie generates a valid cookie string.

// context.header("Set-Cookie", session_cookie.serialize());
// RETURN context.json({ message: "Logged in successfully" });
// CATCH error // Lucia typically throws specific errors for invalid credentials/key not found
// LOG_INFO("Login failed for user:", username, error.message);
// RETURN error_response(400, "Invalid username or password"); // Keep error generic for security
// END TRY
// END HANDLER

// ROUTE POST /api/v1/auth/logout:
// HANDLER async (context):
// // TEST (Vitest with MSW): Logout with valid session invalidates session, clears cookie, returns success.
// // TEST (Vitest with MSW): Logout without session cookie (or invalid session) still returns success or specific status.
// // TEST (Vitest with MSW): Logout handles errors during session invalidation.
// session_cookie_value = context.req.cookie(lucia_instance.sessionCookieName);
// IF NOT session_cookie_value THEN
// // No session to invalidate, but not an error for logout
// RETURN context.json({ message: "Logged out successfully" });
// END IF

// TRY
// session = await lucia_instance.validateSession(session_cookie_value); // Or get session from middleware
// // TEST (Vitest): lucia.validateSession correctly identifies an active session.
// IF session THEN
// await lucia_instance.invalidateSession(session.id);
// // TEST (Vitest): lucia.invalidateSession successfully removes session from D1.
// END IF
// CATCH error // If validateSession throws for an invalid cookie, still proceed to clear
// LOG_INFO("Error validating session on logout, proceeding to clear cookie:", error.message);
// END TRY

// // Always clear the cookie on the client
// blank_cookie = lucia_instance.createBlankSessionCookie();
// // TEST (Vitest): lucia.createBlankSessionCookie generates a cookie that effectively clears the client's cookie.
// context.header("Set-Cookie", blank_cookie.serialize());
// RETURN context.json({ message: "Logged out successfully" });
// END HANDLER

// ROUTE GET /api/v1/auth/me: (Protected by luciaAuthMiddleware)
// HANDLER async (context):
// // TEST (Vitest with MSW): /me route with valid session returns user data (username, id).
// // TEST (Vitest with MSW): /me route does not return sensitive data like password hash.
// // This route assumes luciaAuthMiddleware has run and populated c.var.user
// user = context.var.user;
// IF NOT user THEN
// // Should be caught by middleware, but as a safeguard
// RETURN error_response(401, "Unauthorized");
// END IF
// RETURN context.json({ userId: user.id, username: user.username });
// END HANDLER

// EXPORT auth_app;
\`\`\`

### 8.4. Module: Auth Middleware ([`src/middleware/luciaAuth.ts`](../src/middleware/luciaAuth.ts))

\`\`\`typescript
// IMPORT hono_framework, lucia_instance, error_handling_utilities;

// FUNCTION luciaAuthMiddleware():
// RETURN async (context, next_handler):
// // TEST (Vitest): Middleware allows access and sets c.var.user/session for valid session cookie.
// // TEST (Vitest): Middleware returns 401 for missing session cookie on protected route.
// // TEST (Vitest): Middleware returns 401 for invalid/expired session cookie.
// // TEST (Vitest): Middleware handles errors from lucia.validateSession gracefully.
// session_cookie_value = context.req.cookie(lucia_instance.sessionCookieName);
// IF NOT session_cookie_value THEN
// context.set("user", null);
// context.set("session", null);
// // For some routes, this might be acceptable (e.g. public pages that can optionally show user info)
// // For strictly protected routes, the route handler or a subsequent middleware would check c.var.user
// // For this example, let's assume if it's applied, it's for protection.
// // However, Lucia's model is often to validate and refresh, not just reject.
// // Let's refine this to be more Lucia-idiomatic: try to validate, if fails, clear context.
// // The route itself then decides if user/session is required.
// // For an API, if no cookie, it's likely an error if the endpoint _requires_ auth.
// // This middleware's primary job is to populate user/session if valid.
// // A secondary middleware or route logic enforces requirement.
// // For simplicity here, if it's applied to a route that _needs_ auth, and no cookie, it's an error.
// // This needs to be decided based on how it's used.
// // Let's assume for /api/v1/auth/me it's required.
// IF context.req.path === "/api/v1/auth/me" // Example of a strictly protected route
// RETURN error_response(401, "Unauthorized: No session cookie");
// END IF
// await next_handler();
// RETURN;
// END IF

// TRY
// // Lucia's validateSession often returns { user, session } or nulls
// // Or it might throw. The exact behavior depends on Lucia's API.
// // Let's assume it returns { user, session } or throws.
// validated_context = await lucia_instance.validateSession(session_cookie_value);
// IF validated_context.session AND validated_context.user THEN
// context.set("user", validated_context.user);
// context.set("session", validated_context.session);

// // If session is fresh, Lucia might provide a new cookie to set
// IF validated_context.session.fresh THEN
// new_session_cookie = lucia_instance.createSessionCookie(validated_context.session.id);
// context.header("Set-Cookie", new_session_cookie.serialize());
// END IF
// ELSE // Should not happen if validateSession throws on invalid, but as a fallback
// context.set("user", null);
// context.set("session", null);
// // Clear potentially invalid cookie from client
// blank_cookie = lucia_instance.createBlankSessionCookie();
// context.header("Set-Cookie", blank_cookie.serialize());
// IF context.req.path === "/api/v1/auth/me" // Example
// RETURN error_response(401, "Unauthorized: Invalid session");
// END IF
// END IF
// CATCH error // Catch if lucia.validateSession throws on invalid/expired
// context.set("user", null);
// context.set("session", null);
// blank_cookie = lucia_instance.createBlankSessionCookie();
// context.header("Set-Cookie", blank_cookie.serialize());
// LOG_INFO("Session validation failed in middleware:", error.message);
// IF context.req.path === "/api/v1/auth/me" // Example
// RETURN error_response(401, "Unauthorized: Session validation failed");
// END IF
// END TRY

// await next_handler();
// END FUNCTION
\`\`\`

**Note on Middleware Refinement**: The middleware logic above is a bit complex due to handling different scenarios (public vs. protected, Lucia's specific return values from `validateSession`). In practice, Lucia might offer a more streamlined way to handle this, or a pattern of multiple middlewares (one to populate, another to enforce). The key is that `c.var.user` and `c.var.session` are populated if valid.

### 8.5. Module: WebSocket Auth Update ([`src/routes/interview.ts`](../src/routes/interview.ts))

\`\`\`typescript
// IMPORT hono_framework, lucia_instance, InterviewDurableObjectStub;

// ROUTE GET /api/v1/interview/:id/ws:
// HANDLER async (context, env):
// // TEST (Vitest with MSW): WS upgrade with valid session succeeds, user_id passed to DO.
// // TEST (Vitest with MSW): WS upgrade with invalid/missing session is rejected with 401/403.
// // TEST (Vitest with MSW): WS upgrade handles errors from lucia.validateSession.
// interview_id = context.req.param("id");
// session_cookie_value = context.req.cookie(lucia_instance.sessionCookieName);

// IF NOT session_cookie_value THEN
// RETURN context.text("Unauthorized: Missing session cookie", 401);
// END IF

// user = null;
// session = null;
// TRY
// validated_context = await lucia_instance.validateSession(session_cookie_value);
// IF validated_context.user AND validated_context.session THEN
// user = validated_context.user;
// session = validated_context.session;
// // Potentially refresh cookie if session.fresh
// IF session.fresh THEN
// new_session_cookie = lucia_instance.createSessionCookie(session.id);
// // How to set cookie on WS upgrade response? May need to be done prior if possible,
// // or rely on HTTP requests to refresh. For WS, primary goal is auth.
// END IF
// ELSE
// RETURN context.text("Unauthorized: Invalid session", 401);
// END IF
// CATCH error
// LOG_ERROR("WS Auth: Session validation error", error);
// RETURN context.text("Unauthorized: Session validation failed", 401);
// END TRY

// IF NOT user OR NOT user.id THEN
// RETURN context.text("Unauthorized: User ID not found in session", 401);
// END IF

// // Pass user_id to Durable Object, e.g., via a custom header or modified request
// // The DO's fetch method will need to read this.
// // Example: adding a header to the request passed to the DO
// // This is conceptual; actual mechanism might differ.
// // Cloudflare Workers allows modifying the request before .fetch() to a DO.
// // Or, the DO itself could be given access to Lucia to re-validate if preferred,
// // but passing user_id is simpler if the gateway validates.

// // Create a new Request object to pass to the DO, potentially adding user_id in headers
// // or another mechanism.
// // For example, if the DO's `fetch` method is adapted to look for a specific header:
// // const doRequest = new Request(context.req.raw); // Clone original request
// // doRequest.headers.set("X-Authenticated-User-Id", user.id);

// // Get the Durable Object stub.
// durable_object_stub = env.INTERVIEW.get(env.INTERVIEW.idFromString(interview_id));

// // Forward the request to the Durable Object.
// // The DO's fetch method will handle the WebSocket upgrade.
// // It needs to be aware of the authenticated user_id.
// // One way is to pass it in a header that the DO reads.
// // Or, modify the URL to include it as a query param if secure and appropriate.
// // Or, the DO itself could be made aware of the Lucia instance (more complex).

// // Simplest conceptual way: modify request before passing to DO
// // This assumes the DO's `fetch` method is designed to extract this.
// // For a WebSocket upgrade, the original request object is passed.
// // The DO's `fetch` handler will need to access `user.id` from this context.
// // This might involve setting it on the `context` if Hono's context is passed,
// // or modifying the `Request` object if that's what the DO receives directly.

// // Let's assume the DO's `fetch` will be called with a modified Request or context
// // that includes `user.id`.
// // For now, we'll represent this as passing user.id conceptually.
// // The actual mechanism of making user.id available to the DO needs careful implementation.
// // One common pattern is to add a header to the request before calling `doStub.fetch(modifiedRequest)`.

// // Create a new request to forward, adding user_id as a header
// const forwardedRequest = new Request(context.req.url, context.req.raw);
// forwardedRequest.headers.set("X-User-Id", user.id); // Custom header for DO

// RETURN durable_object_stub.fetch(forwardedRequest);
// END HANDLER
\`\`\`

### 8.6. Module: Interview Durable Object Update ([`src/interview.ts`](../src/interview.ts))

\`\`\`typescript
// CLASS InterviewDurableObject:
// CONSTRUCTOR(state, env):
// this.state = state;
// this.env = env;
// this.sessions = []; // Store WebSocket sessions
// this.authenticated_user_id = null; // To be set during WebSocket connection
// END CONSTRUCTOR

// METHOD fetch(request):
// // ... existing logic ...
// // Extract user_id passed from the gateway (e.g., from "X-User-Id" header)
// // This user_id is now trusted because the gateway validated the session.
// const request_user_id = request.headers.get("X-User-Id");
// // TEST (Vitest): DO correctly extracts user_id from request headers.

// IF request.headers.get("Upgrade") === "websocket" THEN
// IF NOT request_user_id THEN
// // TEST (Vitest): DO rejects WebSocket upgrade if user_id is missing.
// RETURN new Response("User ID missing for WebSocket connection", { status: 400 });
// END IF
// // Store this user_id for the context of this DO instance if it's per-interview-session user
// // Or, associate it with the specific WebSocket connection if multiple users can connect to one DO (unlikely for this app)
// // For now, assume one primary user for the interview session this DO represents.
// // This might be set once when the DO is "claimed" or on first WS connection.
// // For simplicity, let's say it's associated with this connection.
// // The `handleSession` method would then use this `request_user_id`.

// // Upgrade to WebSocket
// // ... standard WebSocket upgrade logic ...
// // server_websocket.accept();
// // this.sessions.push({ ws: server_websocket, userId: request_user_id });
// // RETURN new Response(null, { status: 101, webSocket: client_websocket });
// ELSE
// // Handle HTTP requests if any
// END IF
// END METHOD

// METHOD handleSession(websocket_connection, user_id_for_this_connection):
// // TEST (Vitest): WebSocket messages are processed in context of the authenticated user_id.
// // All operations within this WebSocket session now use `user_id_for_this_connection`.
// // e.g., when saving messages to D1, associate with this user_id.
// // websocket_connection.addEventListener("message", async event => {
// // // PROCESS_MESSAGE(event.data, user_id_for_this_connection);
// // });
// END METHOD

// // ... other DO methods ...
// END CLASS
\`\`\`

This pseudocode provides a high-level structure. The actual implementation will depend heavily on the specific APIs provided by Lucia Auth, Hono, and Cloudflare Workers. Remember to handle errors robustly and log appropriately.
