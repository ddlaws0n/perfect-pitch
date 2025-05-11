# BetterAuth Integration Plan for Perfect Pitch

## 1. Introduction

This document outlines the plan to replace the current basic cookie-based authentication in the Perfect Pitch application with `better-auth` (version 1.2.7). `better-auth` is a modern, session-based authentication library, framework-agnostic, and well-suited for serverless environments like Cloudflare Workers. This upgrade aims to enhance security, provide robust session management, and establish a more scalable authentication foundation.

This plan references:

- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for the existing system overview.
- [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) for the D1 database schema which will be integrated with `better-auth`.

## 1.A Development Tooling & Workflow

This project adheres to specific tooling and workflow guidelines:

- **Package Manager:** All project operations **must** use `pnpm`. This includes installing dependencies, running scripts, etc.
- **Cloudflare Worker Types:**
  - Cloudflare Worker types are generated using the command `wrangler types`.
  - Whenever Cloudflare Wrangler is updated, or changes are made that might affect worker types, run `pnpm run type-check` (or the relevant script for `tsc`) to refresh types and perform a type check.
  - **Crucially, the `@cloudflare/workers-types` package MUST NOT BE USED.** This package has been replaced by the `wrangler types` generation approach.
- **Testing Framework:** The project uses **Vitest** for all testing purposes.
- **Network Mocking:** Network requests in tests are mocked using **Mock Service Worker (MSW)**, specifically with `@mswjs/interceptors`.

## 2. Research (Completed)

**Objective:** To define the specifics of `better-auth` (version 1.2.7), confirm its suitability, best practices, and integration patterns for Cloudflare Workers and Cloudflare D1.

**Status: Completed.**

**Key Research Findings Summary:**

- **Library & Version:** The target is `better-auth` npm package, version 1.2.7. Official documentation is at [`https://www.better-auth.com/docs`](https://www.better-auth.com/docs).
- **`BETTER_AUTH_URL`:** This environment variable (e.g., `https://your-worker.your-account.workers.dev`) defines the base URL of the application where `better-auth` is running, not a separate service URL.
- **Cloudflare D1 Integration:** `better-auth` integrates with D1 using `kysely-d1`. It supports database configuration via Kysely dialects and is expected to handle automatic database management and migrations for its necessary tables (users, sessions, credentials).
- **Password Management:** `better-auth` provides secure email and password authentication. While the specific default hashing algorithm for v1.2.7 was not explicitly detailed, it's expected to use a strong, modern algorithm. Given `argon2` is a project dependency, `better-auth` might leverage it or a similar robust method.
- **Session Management:** `better-auth` has built-in account and session management, storing sessions in the configured D1 database. Session validation will occur via Hono middleware, likely using a cookie named `auth-session`.
- **Core API:** `better-auth` provides methods/handlers for user registration, login, logout, and retrieving authenticated user details.
- **Hono & WebSocket:** Integration with Hono is achieved via middleware for route protection. WebSocket authentication involves validating the `better-auth` session cookie during the upgrade request.
- **Dependencies:** Key dependencies include `better-auth`, `kysely`, and `kysely-d1`.

These findings have been incorporated into the architectural design and implementation steps below.

## 3. Architectural Design

This section details the proposed architecture for integrating `better-auth` into Perfect Pitch.

### 3.1. Core Components

- **`better-auth` Instance:** A configured instance of the `better-auth` library, initialized within the Cloudflare Worker (e.g., in `src/lib/auth.ts`). This instance will use `kysely-d1` for Cloudflare D1 integration.
- **Cloudflare D1 Integration (`kysely-d1`):** The `better-auth` instance will be configured with a `D1Dialect` for database interactions. `better-auth` is expected to manage its own required tables within D1.
- **Hono Middleware:** Middleware to validate sessions using `better-auth` and protect routes.
- **D1 Database:** Cloudflare D1 will store user credentials (hashed passwords) and session information, managed by `better-auth`.

### 3.2. Database Schema (Managed by `better-auth`, Extending [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md))

While `better-auth` is expected to automatically manage its necessary tables (for users, sessions, credentials, etc.) in D1, we may still maintain our existing `Users` table from [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) for application-specific user data not directly managed by `better-auth`, or link to `better-auth`'s user identifiers.

**Existing `Users` Table (Review for `better-auth` integration):**
If `better-auth` creates its own user table, this table might store a foreign key to `better-auth`'s user ID or be used for application-specific profile data.

```sql
-- From docs/D1_DATABASE_PLAN.md
CREATE TABLE IF NOT EXISTS Users (
    user_id TEXT PRIMARY KEY, -- Standard identifier for the user in our application
    username TEXT UNIQUE NOT NULL, -- Application-specific username
    -- Consider adding a better_auth_user_id TEXT UNIQUE to link to better-auth's user table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**`better-auth` Managed Tables (Conceptual):**
`better-auth` will create and manage tables similar to the following. The exact schema will be determined by `better-auth`'s internal migrations.

- `ba_users` (or similar for user identity)
- `ba_sessions` (for session management)
- `ba_credentials` (for storing hashed passwords, etc.)

_Note: The D1 integration setup for `better-auth` using `kysely-d1` will allow it to perform these operations. We will not manually create these `ba_\*`tables;`better-auth` handles this.\_

### 3.3. Password Handling

- **Hashing Algorithm:** `better-auth` employs a strong, modern hashing algorithm for password security. This is a core feature of the library.
- **Storage:** Hashed passwords will be securely stored by `better-auth` in its designated D1 table (e.g., `ba_credentials`). Plaintext passwords will never be stored.
- **Salt Management:** Salt management and key derivation are handled internally by `better-auth` as part of its secure password handling mechanisms.

### 3.4. Session Management

- **Session Creation:** Upon successful login, `better-auth` will create a session and store its details in D1.
- **Session ID:** A unique, cryptographically strong session ID will be generated by `better-auth`.
- **Session Cookie:** The session ID will be sent to the client via a secure, HTTP-only, SameSite cookie.
  - `Name`: e.g., `auth-session` (this is a common convention and was seen in middleware examples; likely configurable within `better-auth`).
  - `HttpOnly`: true
  - `Secure`: true (in production)
  - `SameSite`: `Lax` or `Strict` (default `Lax` is common)
  - `Path`: `/`
  - `Max-Age` or `Expires`: Appropriate session duration, configurable via `better-auth`.
- **Session Validation:** For each authenticated request, Hono middleware will:
  1.  Read the session cookie.
  2.  Validate the session ID using `better-auth`'s methods (checking against stored session data in D1 and expiry).
  3.  If valid, retrieve user information from `better-auth` and attach it to the request context.
  4.  If invalid or expired, reject the request or redirect to login.
- **Session Expiration:** Sessions will have an expiration time, managed by `better-auth`.
- **Logout:** `better-auth` will provide a method to invalidate the session (e.g., in D1) and the application will be responsible for clearing the session cookie on the client.
- **Advanced Features:** Session renewal, idle timeout, or other advanced session features will depend on `better-auth`'s capabilities and configuration.

### 3.5. API Route Protection

- A Hono middleware function will be created, leveraging `better-auth`'s session validation methods (e.g., `auth.validateSession()`).
- This middleware will be applied to all routes requiring authentication.
- Unauthenticated access will result in a `401 Unauthorized` error or redirect.

### 3.6. WebSocket Authentication

The current WebSocket connection logic will be updated:

1.  **Connection Upgrade Request:** The client will send the `better-auth` session cookie with the WebSocket upgrade request.
2.  **Server-Side Validation:**
    - Before upgrading the connection, the Hono route handler for WebSockets (in [`src/routes/interview.ts`](../src/routes/interview.ts)) will use `better-auth`'s methods to validate the session cookie.
    - If the session is valid, the user ID (obtained from `better-auth`'s session object) will be extracted and associated with the WebSocket connection within the `Interview` Durable Object.
    - If the session is invalid, the WebSocket connection upgrade will be rejected.
3.  **Durable Object Context:** The authenticated `user_id` will be passed to or made available within the `Interview` Durable Object instance to authorize actions and associate data correctly.

### 3.7. Data Flow Diagram (Conceptual - `better-auth` integrated)

```mermaid
graph TD
    A[Client Browser] -- 1. Navigate to Login Page --> F[Frontend UI (public/*.html)]
    F -- 2. Submit Credentials (e.g., username, password) --> B(Cloudflare Worker / Hono API)
    B -- 3. /api/v1/auth/register or /api/v1/auth/login --> C{`better-auth` Lib (in Worker)}
    C -- 4. Validate Credentials / Hash Password / Manage User --> D[Cloudflare D1 (`better-auth` tables)]
    C -- 5. Create Session --> E[Cloudflare D1 (`better-auth` session table)]
    C -- 6. Instruct Worker to Set Session Cookie --> B
    B -- 7. Respond with Success / Session Cookie --> A
    A -- 8. Subsequent Authenticated HTTP Request (with Session Cookie) --> B
    B -- 9. Validate Session Cookie (Hono Middleware using `better-auth` Lib) --> C
    C -- 10. Check Session --> E
    C -- 11. Fetch User --> D
    B -- 12. Grant Access / Process Request --> B
    A -- 13. WebSocket Upgrade Request (with Session Cookie) --> B
    B -- 14. Validate Session Cookie (using `better-auth` Lib) before upgrade --> C
    C -- 15. Check Session --> E
    C -- 16. Fetch User --> D
    B -- 17. If Valid, Upgrade to WebSocket & Pass User Context --> G[Interview Durable Object]
    G -- 18. Handle WebSocket Communication (Authenticated User) --> G
```

## 4. Implementation Steps

1.  **Research `better-auth` Solution: (Completed)**

    - Key features, D1 integration (`kysely-d1`), and API structure are understood.

2.  **Install Dependencies:**

    - `better-auth@1.2.7`: The core library.
      ```bash
      pnpm install better-auth@1.2.7
      ```
    - `kysely` and `kysely-d1`: For D1 database interaction with `better-auth`.
      ```bash
      pnpm install kysely kysely-d1
      ```
    - `argon2`: Already listed in [`package.json`](../package.json) - `better-auth` will use its own secure hashing, but `argon2` can remain for other potential uses or if `better-auth` offers pluggable hashing.
    - `vitest`: The testing framework (already set up).
    - `@mswjs/interceptors`: For network mocking in tests (already set up).

3.  **Configure `better-auth`:**

    - Create a `better-auth` configuration module (e.g., `src/lib/auth.ts`).
    - Initialize `better-auth` with:
      - `secret`: `env.BETTER_AUTH_SECRET_KEY`
      - `baseUrl`: `env.BETTER_AUTH_URL`
      - `database`: Using `D1Dialect` with `database: env.DB` (D1 binding).
    - Define `User` and `Session` types/interfaces if needed for interaction with `better-auth`, or use types provided by `better-auth`.
    - Store `BETTER_AUTH_SECRET_KEY` securely in Worker environment variables (e.g., via `.dev.vars` for local development and Wrangler secrets for production).

4.  **D1 Schema & Migrations:**

    - `better-auth` is expected to handle the creation and migration of its own required tables (e.g., for users, sessions, credentials) through its `kysely-d1` integration.
    - Review if any modifications are needed for the existing `Users` table (e.g., adding a column to link to `better-auth`'s user ID if maintaining a separate application-level user profile). If so, create a new D1 migration script.
      ```bash
      # Example: If needed, create migrations/000X_update_users_for_betterauth.sql
      # wrangler d1 execute perfect-pitch-db --local --file=./migrations/000X_update_users_for_betterauth.sql
      # wrangler d1 execute perfect-pitch-db --file=./migrations/000X_update_users_for_betterauth.sql
      ```
    - The primary schema setup for `better-auth` itself should be automatic upon its initialization if it includes migration capabilities.

5.  **Develop New Authentication Service/Routes (e.g., in [`src/routes/auth.ts`](../src/routes/auth.ts)):**
    Refer to `better-auth` official documentation for exact API method names and request/response structures.

    - **`POST /api/v1/auth/register`**:
      - Takes registration details (e.g., email/username, password).
      - Uses `better-auth` methods to create a new user and credentials.
      - Optionally, creates a session and logs the user in immediately, as per `better-auth` features.
    - **`POST /api/v1/auth/login`**:
      - Takes login credentials.
      - Uses `better-auth` methods to retrieve the user and verify credentials.
      - If valid, uses `better-auth` to create a session.
      - Sets the session cookie in the response via `better-auth`'s cookie handling or by using headers provided by `better-auth`.
    - **`POST /api/v1/auth/logout`**:
      - Validates the current session using `better-auth`.
      - Uses `better-auth` methods to invalidate the session.
      - Clears the session cookie.
    - **`GET /api/v1/auth/me` (Optional):**
      - Validates the session using `better-auth`.
      - Returns current user information (excluding sensitive data) obtained from `better-auth`.
    - Address other potential endpoints like password reset, email verification as per `better-auth`'s capabilities and project requirements.

6.  **Create/Update Authentication Middleware (e.g., new file `src/middleware/auth.ts` or update existing):**

    - Create Hono middleware that:
      - Reads the session cookie (e.g., `auth-session`) from the request.
      - Uses `better-auth`'s session validation method (e.g., `auth.validateSession(token)`).
      - If valid, attaches user and session objects (provided by `better-auth`) to `c.set('user', user)` (Hono context).
      - If invalid, throws an unauthorized error or redirects.
    - Apply this middleware to protected routes.

7.  **Update WebSocket Authentication:**

    - Modify the WebSocket upgrade handler in [`src/routes/interview.ts`](../src/routes/interview.ts).
    - Before upgrading, extract the session cookie.
    - Use `better-auth`'s session validation method.
    - If valid, pass the `user.id` (or relevant user identifier from `better-auth`'s session object) to the Durable Object.
    - The `Interview` DO ([`src/interview.ts`](../src/interview.ts)) will need to be updated to receive and use this `user_id`.

8.  **Update Frontend:**

    - Modify [`public/auth.html`](../public/auth.html) to collect necessary details for login and registration compatible with `better-auth`.
    - Update client-side JavaScript to call the new `better-auth` API endpoints.
    - Implement logout functionality.

9.  **Testing:**
    - Write unit and integration tests for auth logic using **Vitest**.
    - Utilize **Mock Service Worker (MSW)** with `@mswjs/interceptors` for network mocking, particularly for any interactions `better-auth` might make if it had external dependencies (though it primarily interacts with D1).
    - Test all authentication flows: registration, login, logout, session expiry/renewal, protected routes, WebSocket auth as handled by `better-auth`.
    - Test with `wrangler dev --local` and in a deployed Cloudflare environment.

## 5. Security Considerations

- **CSRF Protection:** Implement CSRF protection mechanisms if not handled by `better-auth` itself (e.g., double-submit cookies, custom header checks). This is crucial for any state-changing requests.
- **Password Policy:** Rely on `better-auth`'s enforced password policies. If configurable, ensure they meet project requirements (length, complexity).
- **Session Cookie Security:** `better-auth` should handle setting secure cookie attributes (`HttpOnly`, `Secure`, `SameSite`). Verify these defaults or configure them.
- **Rate Limiting:** Implement rate limiting on authentication endpoints (`/login`, `/register`) to prevent brute-force attacks. Cloudflare's features can be leveraged.
- **Input Validation:** Thoroughly validate and sanitize all user inputs on the server-side before passing to `better-auth` methods, though `better-auth` should also perform its own validation.
- **Secure Secrets:** Store `BETTER_AUTH_SECRET_KEY` as an environment variable in Cloudflare Workers.
- **HTTPS:** Ensure the entire application is served over HTTPS in production.
- **Regular Dependency Updates:** Keep `better-auth`, `kysely`, `kysely-d1`, and related dependencies updated.
- **Permissions & Authorization:** `better-auth` handles authentication. Authorization logic (what a user can do) must be implemented separately within the application.
- **MFA (Multi-Factor Authentication):** If `better-auth` supports MFA and it's a project requirement, plan for its integration.
- **Audit Logging:** Implement logging for significant authentication events (logins, failures, password changes), potentially using hooks or events from `better-auth` if available.

## 6. Potential Challenges & Migration Steps

### 6.1. Migration from Current Basic Auth

- **Existing Users:** The current system only stores `username` in a cookie. There are no passwords or user accounts in a database.
  - **Strategy: Force Re-registration:** Users will need to create new accounts with `better-auth`. This is the simplest and cleanest approach.
- **Data Association:** Align with the D1 "start fresh" strategy ([`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md#section-4-5)). Focus on new user registrations. Migration of historical data associated with old `username` cookies is out of scope.

### 6.2. Other Potential Challenges

- **`better-auth` D1 Integration with `kysely-d1`:** Ensuring seamless and performant integration, and understanding how `better-auth` manages its migrations.
- **Cold Starts:** Serverless cold starts impacting initial auth requests (general serverless consideration).
- **Testing Complexity:** Thoroughly testing all `better-auth` flows.
- **Durable Object Interaction:** Reliably passing authenticated user context (obtained from `better-auth`) to Durable Objects.
- **Learning Curve:** Team familiarization with `better-auth` v1.2.7 API and its `kysely-d1` integration.

## 7. Conclusion

Integrating `better-auth` (v1.2.7) will significantly improve the security and robustness of Perfect Pitch's authentication system. The research has clarified its operation with Cloudflare Workers, D1 (via `kysely-d1`), and Hono. This plan outlines the necessary database considerations, new service logic, and updates to middleware and WebSocket handling. Thorough implementation and rigorous testing will be key to a successful upgrade.
