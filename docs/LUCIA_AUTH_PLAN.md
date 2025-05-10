# Lucia Auth Integration Plan for Perfect Pitch

## 1. Introduction

This document outlines the plan to replace the current basic cookie-based authentication in the Perfect Pitch application with Lucia Auth. Lucia Auth is a modern, session-based authentication library that is framework-agnostic and well-suited for serverless environments like Cloudflare Workers. This upgrade aims to enhance security, provide robust session management, and establish a more scalable authentication foundation.

This plan references:

- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for the existing system overview.
- [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) for the D1 database schema which will be extended.

## 1.A Development Tooling & Workflow

This project adheres to specific tooling and workflow guidelines:

- **Package Manager:** All project operations **must** use `pnpm`. This includes installing dependencies, running scripts, etc.
- **Cloudflare Worker Types:**
  - Cloudflare Worker types are generated using the command `wrangler types`.
  - Whenever Cloudflare Wrangler is updated, or changes are made that might affect worker types, run `pnpm run type-check` (or the relevant script for `tsc`) to refresh types and perform a type check.
  - **Crucially, the `@cloudflare/workers-types` package MUST NOT BE USED.** This package has been replaced by the `wrangler types` generation approach.
- **Testing Framework:** The project uses **Vitest** for all testing purposes.
- **Network Mocking:** Network requests in tests are mocked using **Mock Service Worker (MSW)**, specifically with `@mswjs/interceptors`.

## 2. Research (Action Required)

**Objective:** To confirm Lucia Auth's suitability, best practices, and specific integration patterns for Cloudflare Workers and Cloudflare D1.

**Status:** The SPARC Orchestrator can initiate research tasks (e.g., using Perplexity or context7) to obtain the most up-to-date and relevant documentation. Direct research using MCP tools (Perplexity, Firecrawl) by other modes may also be an option.

**Action Required:**

- The development team, potentially assisted by the SPARC Orchestrator, should conduct research on Lucia Auth, focusing on:
  - Official documentation and examples for Cloudflare Workers/Pages.
  - Community packages or adapters for Cloudflare D1 (e.g., `@lucia-auth/adapter-d1`).
  - Best practices for session management, password hashing (e.g., Argon2id, scrypt), and security in a serverless context with Lucia.
  - Compatibility with Hono framework.
  - Strategies for WebSocket authentication using Lucia sessions.

This plan will proceed based on general Lucia Auth principles and common integration patterns, which should be validated by the above research.

## 3. Architectural Design

This section details the proposed architecture for integrating Lucia Auth into Perfect Pitch.

### 3.1. Core Components

- **Lucia Auth Instance:** A configured instance of Lucia, initialized with an adapter for Cloudflare D1.
- **Cloudflare D1 Adapter:** A Lucia adapter (e.g., `@lucia-auth/adapter-d1`) to handle database interactions for users and sessions.
- **Hono Middleware:** Middleware to validate sessions and protect routes.
- **D1 Database:** Cloudflare D1 will store user credentials (hashed passwords) and session information.

### 3.2. Database Schema (Extending [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md))

The existing `Users` table from [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) will be modified, and new tables for sessions and potentially keys will be added.

**Modified `Users` Table:**

```sql
-- From docs/D1_DATABASE_PLAN.md, with additions for Lucia Auth
CREATE TABLE Users (
    user_id TEXT PRIMARY KEY, -- Lucia typically uses this as id
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL, -- Added for Lucia
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Existing indexes on Users table should be maintained or reviewed.
```

**New `user_sessions` Table (Lucia Default):**

```sql
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY, -- Session ID
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
```

**New `user_keys` Table (If using Lucia's key feature for password-based login):**
Lucia Auth often uses a `Key` entity to store provider information (e.g., "email", "github") and provider-specific user IDs, including hashed passwords for username/password auth.

```sql
CREATE TABLE user_keys (
    id TEXT PRIMARY KEY, -- e.g., 'username:johndoe'
    user_id TEXT NOT NULL,
    hashed_password TEXT, -- Hashed password, if this key is for password auth
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_user_keys_user_id ON user_keys(user_id);
```

_Note: The exact schema for `user_keys` might vary based on Lucia's version and adapter specifics. The research step should confirm this._

### 3.3. Password Handling

- **Hashing Algorithm:** Use **`argon2`** for password hashing, as it is a strong, modern hashing algorithm recommended by Lucia Auth and security best practices.
- **Storage:** Hashed passwords will be stored in the `Users` table (or `user_keys` table). Plaintext passwords will never be stored.

### 3.4. Session Management

- **Session Creation:** Upon successful login, Lucia Auth will create a session and store it in the `user_sessions` table.
- **Session ID:** A unique session ID will be generated.
- **Session Cookie:** The session ID will be sent to the client via a secure, HTTP-only, SameSite cookie.
  - `Name`: e.g., `auth_session`
  - `HttpOnly`: true
  - `Secure`: true (in production)
  - `SameSite`: `Lax` or `Strict`
  - `Path`: `/`
- **Session Validation:** For each authenticated request, middleware will:
  1. Read the session cookie.
  2. Validate the session ID with Lucia (checking against the `user_sessions` table and expiry).
  3. If valid, retrieve user information and attach it to the request context.
  4. If invalid or expired, reject the request or redirect to login.
- **Session Expiration:** Sessions will have an expiration time, managed by Lucia and stored in `user_sessions.expires_at`.
- **Logout:** Invalidates the session in the database and clears the session cookie on the client.

### 3.5. API Route Protection

- A Hono middleware function will be created using Lucia's session validation logic.
- This middleware will be applied to all routes requiring authentication.
- Unauthenticated access will result in a `401 Unauthorized` error or redirect.

### 3.6. WebSocket Authentication

The current WebSocket connection likely relies on the existing `username` cookie. This will need to be updated:

1.  **Connection Upgrade Request:** The client will send the Lucia session cookie with the WebSocket upgrade request.
2.  **Server-Side Validation:**
    - Before upgrading the connection, the Hono route handler for WebSockets (in [`src/routes/interview.ts`](../src/routes/interview.ts)) will use Lucia to validate the session cookie.
    - If the session is valid, the user ID will be extracted and associated with the WebSocket connection within the `Interview` Durable Object.
    - If the session is invalid, the WebSocket connection upgrade will be rejected.
3.  **Durable Object Context:** The authenticated `user_id` will be passed to or made available within the `Interview` Durable Object instance to authorize actions and associate data correctly.

### 3.7. Data Flow Diagram (Conceptual - Lucia Auth)

```mermaid
graph TD
    A[Client Browser] -- 1. Navigate to Login Page --> F[Frontend UI (public/*.html)]
    F -- 2. Submit Credentials (username, password) --> B(Cloudflare Worker / Hono API)
    B -- 3. /api/v1/auth/register or /api/v1/auth/login --> C{Auth Service (Lucia)}
    C -- 4. Validate Credentials / Hash Password --> D[Cloudflare D1 (Users, user_keys)]
    C -- 5. Create Session --> E[Cloudflare D1 (user_sessions)]
    C -- 6. Set Session Cookie --> B
    B -- 7. Respond with Success / Session Cookie --> A
    A -- 8. Subsequent Authenticated HTTP Request (with Session Cookie) --> B
    B -- 9. Validate Session Cookie (Lucia Middleware) --> C
    C -- 10. Check Session --> E
    C -- 11. Fetch User --> D
    B -- 12. Grant Access / Process Request --> B
    A -- 13. WebSocket Upgrade Request (with Session Cookie) --> B
    B -- 14. Validate Session Cookie (Lucia) before upgrade --> C
    C -- 15. Check Session --> E
    C -- 16. Fetch User --> D
    B -- 17. If Valid, Upgrade to WebSocket & Pass User Context --> G[Interview Durable Object]
    G -- 18. Handle WebSocket Communication (Authenticated User) --> G
```

## 4. Implementation Steps

1.  **Install Dependencies:**

    - `lucia`: The core Lucia Auth library.
    - `@lucia-auth/adapter-d1`: The D1 adapter for Lucia.
    - `argon2`: For password hashing.
    - `vitest`: The testing framework.
    - `@mswjs/interceptors`: For network mocking in tests.

2.  **Configure Lucia Auth:**

    - Create a Lucia configuration file (e.g., `src/lib/lucia.ts` or `src/auth/lucia.ts`).
    - Initialize Lucia with the D1 adapter, environment (dev/prod), and session cookie options.
    - Define `User` and `Session` types if necessary.
    - Store Lucia secrets (e.g., for signing session cookies if applicable) securely in Worker environment variables.

3.  **Update D1 Schema & Migrations:**

    - Modify the `Users` table definition in your D1 migration scripts as per section 3.2.
    - Add `CREATE TABLE` statements for `user_sessions` and `user_keys` (if used) to the migration script.
    - Follow the migration process outlined in [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md#4-implementation-steps) (section 4.3) to apply schema changes.
      ```bash
      # Example: Create a new migration file migrations/000X_lucia_auth_tables.sql
      # wrangler d1 execute perfect-pitch-db --local --file=./migrations/000X_lucia_auth_tables.sql
      # wrangler d1 execute perfect-pitch-db --file=./migrations/000X_lucia_auth_tables.sql
      ```

4.  **Develop New Authentication Service/Routes (e.g., in [`src/routes/auth.ts`](../src/routes/auth.ts)):**

    - **`POST /api/v1/auth/register`**:
      - Takes `username` and `password`.
      - Hashes the password.
      - Creates a new user in the `Users` table (and `user_keys` table if applicable).
      - Optionally, creates a session and logs the user in immediately.
    - **`POST /api/v1/auth/login`**:
      - Takes `username` and `password`.
      - Retrieves the user from D1.
      - Verifies the password against the stored hash.
      - If valid, creates a Lucia session.
      - Sets the session cookie in the response.
    - **`POST /api/v1/auth/logout`**:
      - Validates the current session.
      - Invalidates the session in D1 using Lucia.
      - Clears the session cookie.
    - **`GET /api/v1/auth/me` (Optional):**
      - Validates the session.
      - Returns current user information (excluding sensitive data like password hash).

5.  **Update Authentication Middleware (e.g., new file `src/middleware/luciaAuth.ts`):**

    - Create Hono middleware that:
      - Reads the session cookie from the request.
      - Uses `lucia.validateSession()` to validate it.
      - If valid, attaches `user` and `session` objects to `c.var` (Hono context).
      - If invalid, throws an unauthorized error or redirects.
    - Replace the current simple cookie check in [`src/index.ts`](../src/index.ts) or other protected routes with this new middleware.

6.  **Update WebSocket Authentication:**

    - Modify the WebSocket upgrade handler in [`src/routes/interview.ts`](../src/routes/interview.ts).
    - Before calling `env.INTERVIEW.get(id).fetch(request)`, extract the session cookie.
    - Use `lucia.validateSession()` to validate.
    - If valid, pass the `user.id` to the Durable Object (e.g., via a header or by modifying the request passed to the DO's `fetch` method).
    - The `Interview` DO ([`src/interview.ts`](../src/interview.ts)) will need to be updated to receive and use this `user_id`.

7.  **Update Frontend:**

    - Modify [`public/auth.html`](../public/auth.html) to collect username and password for login and registration.
    - Update client-side JavaScript to call the new `/api/v1/auth/register` and `/api/v1/auth/login` endpoints.
    - Implement logout functionality to call `/api/v1/auth/logout`.

8.  **Testing:**
    - Write unit and integration tests for auth logic using **Vitest**.
    - Utilize **Mock Service Worker (MSW)** with `@mswjs/interceptors` for network mocking during tests.
    - Test all authentication flows: registration, login, logout, session expiry, protected routes, WebSocket auth.
    - Test with `wrangler dev --local` and in a deployed Cloudflare environment.

## 5. Security Considerations

- **CSRF Protection:** Lucia Auth may provide guidance or built-in mechanisms for CSRF protection (e.g., origin checking, CSRF tokens for form submissions). This needs to be implemented, especially for state-changing operations initiated by forms.
- **Password Policy:** Enforce strong password policies on the client and server-side during registration (length, complexity).
- **Session Cookie Security:** Ensure session cookies are configured with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` (or `Strict`) attributes.
- **Rate Limiting:** Implement rate limiting on authentication endpoints (`/login`, `/register`) to prevent brute-force attacks. Cloudflare's Rate Limiting features can be leveraged.
- **Input Validation:** Thoroughly validate all user inputs (username, password format) on the server-side.
- **Secure Secrets:** Store all secrets (Lucia instance secrets, any API keys for hashing services if used externally) as environment variables in Cloudflare Workers, not hardcoded.
- **HTTPS:** Ensure the entire application is served over HTTPS in production to protect session cookies and data in transit.
- **Regular Dependency Updates:** Keep Lucia Auth and related dependencies updated to patch security vulnerabilities.
- **Permissions & Authorization:** While Lucia handles authentication (who the user is), authorization (what the user can do) logic will still need to be implemented within the application (e.g., ensuring a user can only access their own interviews).

## 6. Potential Challenges & Migration Steps

### 6.1. Migration from Current Basic Auth

- **Existing Users:** The current system only stores `username` in a cookie. There are no passwords or user accounts in a database.
  - **Option 1 (Recommended): Force Re-registration:** Users will need to create new accounts (register) with a username and password. This is the simplest and cleanest approach.
  - **Option 2 (Complex, Not Recommended): Attempt to "Claim" Usernames:** If existing `username` cookies are still active for some users when the new system rolls out, you could theoretically allow them to set a password for their existing username upon first interaction with the new login page. This adds complexity for minimal gain.
- **Data Association:** If existing interview data in Durable Objects is associated only by `username` (from the old cookie), a strategy will be needed to link this data to the new `user_id` from Lucia Auth if historical data access is required under the new auth system. This might involve a one-time migration script or logic to associate data upon a user's first login/registration if their old username matches. Given the D1 plan's recommendation to start fresh for new data ([`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md#section-4-5)), this might be less of a concern for interview data itself.

- **Alignment with D1 "Start Fresh" Strategy**: It is crucial to align with the overall D1 data migration strategy, which advocates for a "start fresh" approach for new data in D1 (see [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:365)). This means that for the initial Lucia Auth integration, the focus is on new user registrations and their associated data. Migration or linking of historical user activity from the old cookie-based system (or any data in Durable Objects not covered by a specific migration plan) is considered out of scope for this phase. Any such historical data migration would need to be a separate, dedicated effort.

### 6.2. Other Potential Challenges

- **Lucia Adapter for D1:** Ensure the chosen D1 adapter is stable, well-maintained, and performs well in the Cloudflare Workers environment.
- **Cold Starts:** Serverless function cold starts could slightly impact the performance of initial authentication requests. This is a general serverless consideration.
- **Testing Complexity:** Thoroughly testing all authentication and session management edge cases can be complex.
- **Durable Object Interaction:** Passing authenticated user context reliably to Durable Objects for WebSocket sessions requires careful implementation.
- **Learning Curve:** The team will need to familiarize themselves with Lucia Auth's concepts and API.

## 7. Conclusion

Integrating Lucia Auth will significantly improve the security and robustness of Perfect Pitch's authentication system. While it involves a considerable amount of work, including database schema changes, new service logic, and updates to middleware and WebSocket handling, the benefits of a modern, dedicated authentication library are substantial. Careful planning, thorough research (as noted in Section 2), and rigorous testing will be key to a successful implementation.
