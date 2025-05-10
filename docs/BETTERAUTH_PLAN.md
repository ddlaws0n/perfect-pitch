# BetterAuth Integration Plan for Perfect Pitch

## 1. Introduction

This document outlines the plan to replace the current basic cookie-based authentication in the Perfect Pitch application with BetterAuth. BetterAuth is envisioned as a modern, session-based authentication library/solution that is framework-agnostic and well-suited for serverless environments like Cloudflare Workers. This upgrade aims to enhance security, provide robust session management, and establish a more scalable authentication foundation.

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

**Objective:** To define the specifics of BetterAuth, confirm its suitability, best practices, and integration patterns for Cloudflare Workers and Cloudflare D1.

**Status:** If BetterAuth is a specific library, research should be conducted. If it's a placeholder for a custom or yet-to-be-defined solution, this section will involve defining its core requirements.

**Action Required:**

- The development team should:
  - If BetterAuth is a known library:
    - Research official documentation and examples for Cloudflare Workers/Pages.
    - Identify community packages or adapters for Cloudflare D1 (e.g., a generic D1 adapter or one specific to BetterAuth if it exists).
    - Determine best practices for session management, password hashing (e.g., Argon2id, scrypt, bcrypt), and security in a serverless context with BetterAuth.
    - Confirm compatibility with Hono framework.
    - Define strategies for WebSocket authentication using BetterAuth sessions.
  - If BetterAuth is a placeholder:
    - Define core requirements for a secure and robust authentication system (e.g., password policies, session characteristics, MFA capabilities if needed).
    - Outline the desired features and security standards.
    - Mark sections in this plan that will require specific details once BetterAuth's implementation is chosen/defined.

This plan will proceed based on general principles of a robust authentication system, which should be validated and detailed by the above research/definition.

## 3. Architectural Design

This section details the proposed architecture for integrating BetterAuth into Perfect Pitch.

### 3.1. Core Components

- **BetterAuth Instance/Module:** A configured instance or set of modules for BetterAuth, initialized with an adapter for Cloudflare D1 or direct D1 integration logic.
- **Cloudflare D1 Adapter/Integration:** Logic to handle database interactions for users and sessions with Cloudflare D1.
- **Hono Middleware:** Middleware to validate sessions and protect routes.
- **D1 Database:** Cloudflare D1 will store user credentials (hashed passwords) and session information.

### 3.2. Database Schema (Extending [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md))

The existing `Users` table from [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) will be modified, and new tables for sessions and potentially keys/credentials will be added.

**Modified `Users` Table:**

```sql
-- From docs/D1_DATABASE_PLAN.md, with additions for BetterAuth
CREATE TABLE Users (
    user_id TEXT PRIMARY KEY, -- Standard identifier for the user
    username TEXT UNIQUE NOT NULL,
    -- hashed_password TEXT NOT NULL, -- This might move to a separate 'user_credentials' table depending on BetterAuth design
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Existing indexes on Users table should be maintained or reviewed.
```

**New `user_sessions` Table (Generic Example):**

```sql
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY, -- Session ID
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Additional fields like user_agent, ip_address might be considered for security auditing
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
```

**New `user_credentials` Table (Example, if separating credentials):**
This table would store various credential types, including hashed passwords.

```sql
CREATE TABLE user_credentials (
    id TEXT PRIMARY KEY, -- e.g., 'password:johndoe' or a UUID
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'password', 'oauth_google', 'totp'
    hashed_secret TEXT, -- Hashed password, or other relevant secret
    -- Other provider-specific fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_type ON user_credentials(type);
```

_Note: The exact schema will depend on the chosen/defined BetterAuth solution. The research/definition step must confirm this._

### 3.3. Password Handling

- **Hashing Algorithm:** Use a strong, modern hashing algorithm (e.g., **Argon2id, scrypt, or bcrypt**). The specific choice should be confirmed during the BetterAuth definition phase.
- **Storage:** Hashed passwords will be stored securely, likely in the `user_credentials` table. Plaintext passwords will never be stored.
- **[Placeholder for BetterAuth]:** Specific salt management or key derivation details if applicable to BetterAuth.

### 3.4. Session Management

- **Session Creation:** Upon successful login, BetterAuth will create a session and store its details.
- **Session ID:** A unique, cryptographically strong session ID will be generated.
- **Session Cookie:** The session ID will be sent to the client via a secure, HTTP-only, SameSite cookie.
  - `Name`: e.g., `auth_session` (configurable)
  - `HttpOnly`: true
  - `Secure`: true (in production)
  - `SameSite`: `Lax` or `Strict`
  - `Path`: `/`
  - `Max-Age` or `Expires`: Define appropriate session duration.
- **Session Validation:** For each authenticated request, middleware will:
  1. Read the session cookie.
  2. Validate the session ID with BetterAuth (checking against stored session data and expiry).
  3. If valid, retrieve user information and attach it to the request context.
  4. If invalid or expired, reject the request or redirect to login.
- **Session Expiration:** Sessions will have an expiration time, managed by BetterAuth.
- **Logout:** Invalidates the session (e.g., in the database or via a revocation list) and clears the session cookie on the client.
- **[Placeholder for BetterAuth]:** Specifics on session renewal, idle timeout, or advanced session features.

### 3.5. API Route Protection

- A Hono middleware function will be created using BetterAuth's session validation logic.
- This middleware will be applied to all routes requiring authentication.
- Unauthenticated access will result in a `401 Unauthorized` error or redirect.

### 3.6. WebSocket Authentication

The current WebSocket connection likely relies on the existing `username` cookie. This will need to be updated:

1.  **Connection Upgrade Request:** The client will send the BetterAuth session cookie with the WebSocket upgrade request.
2.  **Server-Side Validation:**
    - Before upgrading the connection, the Hono route handler for WebSockets (in [`src/routes/interview.ts`](../src/routes/interview.ts)) will use BetterAuth to validate the session cookie.
    - If the session is valid, the user ID will be extracted and associated with the WebSocket connection within the `Interview` Durable Object.
    - If the session is invalid, the WebSocket connection upgrade will be rejected.
3.  **Durable Object Context:** The authenticated `user_id` will be passed to or made available within the `Interview` Durable Object instance to authorize actions and associate data correctly.
- **[Placeholder for BetterAuth]:** Any specific mechanisms BetterAuth provides for token-based auth or passing auth context.

### 3.7. Data Flow Diagram (Conceptual - BetterAuth)

```mermaid
graph TD
    A[Client Browser] -- 1. Navigate to Login Page --> F[Frontend UI (public/*.html)]
    F -- 2. Submit Credentials (e.g., username, password) --> B(Cloudflare Worker / Hono API)
    B -- 3. /api/v1/auth/register or /api/v1/auth/login --> C{Auth Service (BetterAuth)}
    C -- 4. Validate Credentials / Hash Password --> D[Cloudflare D1 (Users, user_credentials)]
    C -- 5. Create Session --> E[Cloudflare D1 (user_sessions)]
    C -- 6. Set Session Cookie --> B
    B -- 7. Respond with Success / Session Cookie --> A
    A -- 8. Subsequent Authenticated HTTP Request (with Session Cookie) --> B
    B -- 9. Validate Session Cookie (BetterAuth Middleware) --> C
    C -- 10. Check Session --> E
    C -- 11. Fetch User --> D
    B -- 12. Grant Access / Process Request --> B
    A -- 13. WebSocket Upgrade Request (with Session Cookie) --> B
    B -- 14. Validate Session Cookie (BetterAuth) before upgrade --> C
    C -- 15. Check Session --> E
    C -- 16. Fetch User --> D
    B -- 17. If Valid, Upgrade to WebSocket & Pass User Context --> G[Interview Durable Object]
    G -- 18. Handle WebSocket Communication (Authenticated User) --> G
```

## 4. Implementation Steps

1.  **Define/Select BetterAuth Solution:**
    - Complete research or internal definition as per Section 2.
    - Finalize core features, security parameters, and any specific library choices.

2.  **Install Dependencies (if applicable):**
    - The core BetterAuth library (if it's a third-party lib).
    - Any D1 adapter or database interaction library needed for BetterAuth.
    - Chosen password hashing library (e.g., `argon2`, `bcrypt`).
    - `vitest`: The testing framework.
    - `@mswjs/interceptors`: For network mocking in tests.

3.  **Configure BetterAuth:**
    - Create a BetterAuth configuration module (e.g., `src/lib/betterAuth.ts` or `src/auth/betterAuth.ts`).
    - Initialize BetterAuth with D1 integration, environment (dev/prod), and session cookie options.
    - Define `User` and `Session` types/interfaces as needed.
    - Store BetterAuth secrets (e.g., for signing session tokens, encryption keys) securely in Worker environment variables.

4.  **Update D1 Schema & Migrations:**
    - Modify the `Users` table definition in your D1 migration scripts as per section 3.2.
    - Add `CREATE TABLE` statements for `user_sessions` and `user_credentials` (or equivalent) to the migration script.
    - Follow the migration process outlined in [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md#4-implementation-steps) (section 4.3) to apply schema changes.
      ```bash
      # Example: Create a new migration file migrations/000X_betterauth_tables.sql
      # wrangler d1 execute perfect-pitch-db --local --file=./migrations/000X_betterauth_tables.sql
      # wrangler d1 execute perfect-pitch-db --file=./migrations/000X_betterauth_tables.sql
      ```

5.  **Develop New Authentication Service/Routes (e.g., in [`src/routes/auth.ts`](../src/routes/auth.ts)):**
    - **`POST /api/v1/auth/register`**:
      - Takes necessary registration details (e.g., `username`, `password`).
      - Hashes the password using the chosen algorithm.
      - Creates a new user and associated credentials.
      - Optionally, creates a session and logs the user in immediately.
    - **`POST /api/v1/auth/login`**:
      - Takes login credentials (e.g., `username`, `password`).
      - Retrieves the user and verifies credentials.
      - If valid, creates a BetterAuth session.
      - Sets the session cookie in the response.
    - **`POST /api/v1/auth/logout`**:
      - Validates the current session.
      - Invalidates the session with BetterAuth.
      - Clears the session cookie.
    - **`GET /api/v1/auth/me` (Optional):**
      - Validates the session.
      - Returns current user information (excluding sensitive data).
    - **[Placeholder for BetterAuth]:** Endpoints for password reset, email verification, MFA setup, etc., if in scope.

6.  **Update Authentication Middleware (e.g., new file `src/middleware/betterAuth.ts`):**
    - Create Hono middleware that:
      - Reads the session cookie from the request.
      - Uses BetterAuth to validate it.
      - If valid, attaches `user` and `session` objects to `c.var` (Hono context).
      - If invalid, throws an unauthorized error or redirects.
    - Replace the current simple cookie check in [`src/index.ts`](../src/index.ts) or other protected routes with this new middleware.

7.  **Update WebSocket Authentication:**
    - Modify the WebSocket upgrade handler in [`src/routes/interview.ts`](../src/routes/interview.ts).
    - Before calling `env.INTERVIEW.get(id).fetch(request)`, extract the session cookie.
    - Use BetterAuth to validate the session.
    - If valid, pass the `user.id` (or relevant user identifier) to the Durable Object.
    - The `Interview` DO ([`src/interview.ts`](../src/interview.ts)) will need to be updated to receive and use this `user_id`.

8.  **Update Frontend:**
    - Modify [`public/auth.html`](../public/auth.html) to collect necessary details for login and registration.
    - Update client-side JavaScript to call the new BetterAuth API endpoints.
    - Implement logout functionality.

9.  **Testing:**
    - Write unit and integration tests for auth logic using **Vitest**.
    - Utilize **Mock Service Worker (MSW)** with `@mswjs/interceptors` for network mocking.
    - Test all authentication flows: registration, login, logout, session expiry/renewal, protected routes, WebSocket auth.
    - Test password policies, MFA flows (if applicable).
    - Test with `wrangler dev --local` and in a deployed Cloudflare environment.

## 5. Security Considerations

- **CSRF Protection:** Implement CSRF protection mechanisms (e.g., double-submit cookies, origin checking, or framework-provided solutions). This is crucial for any state-changing requests.
- **Password Policy:** Enforce strong password policies (length, complexity, disallow common passwords) on client and server-side.
- **Session Cookie Security:** Ensure session cookies are configured with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` (or `Strict`). Set appropriate expiry.
- **Rate Limiting:** Implement rate limiting on authentication endpoints (`/login`, `/register`, password reset) to prevent brute-force and denial-of-service attacks. Cloudflare's features can be leveraged.
- **Input Validation:** Thoroughly validate and sanitize all user inputs on the server-side.
- **Secure Secrets:** Store all secrets (BetterAuth instance secrets, API keys, encryption keys) as environment variables in Cloudflare Workers, not hardcoded.
- **HTTPS:** Ensure the entire application is served over HTTPS in production.
- **Regular Dependency Updates:** Keep BetterAuth (if third-party) and related dependencies updated.
- **Permissions & Authorization:** BetterAuth handles authentication. Authorization logic (what a user can do) must be implemented separately within the application.
- **MFA (Multi-Factor Authentication):** Consider requirements for MFA (e.g., TOTP, WebAuthn) and plan for its integration if part of BetterAuth's scope.
- **Audit Logging:** Implement logging for significant authentication events (logins, failures, password changes).
- **[Placeholder for BetterAuth]:** Any security features or considerations specific to the chosen BetterAuth solution.

## 6. Potential Challenges & Migration Steps

### 6.1. Migration from Current Basic Auth

- **Existing Users:** The current system only stores `username` in a cookie. There are no passwords or user accounts in a database.
  - **Option 1 (Recommended): Force Re-registration:** Users will need to create new accounts with BetterAuth. This is the simplest and cleanest approach for a new, robust system.
  - **Option 2 (Complex, Not Recommended): Attempt to "Claim" Usernames:** This adds significant complexity and potential security risks.
- **Data Association:** Align with the D1 "start fresh" strategy ([`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md#section-4-5)). Focus on new user registrations. Migration of historical data associated with old `username` cookies is out of scope for this initial phase.

### 6.2. Other Potential Challenges

- **BetterAuth D1 Integration:** Ensuring seamless and performant integration with Cloudflare D1.
- **Cold Starts:** Serverless cold starts impacting initial auth requests (general serverless consideration).
- **Testing Complexity:** Thoroughly testing all auth flows, especially if custom logic is involved in BetterAuth.
- **Durable Object Interaction:** Reliably passing authenticated user context to Durable Objects.
- **Learning Curve:** If BetterAuth is a new library or custom solution, team familiarization will be needed.
- **Defining "BetterAuth":** If BetterAuth is currently a placeholder, the primary challenge is defining its requirements and choosing/designing the actual solution.

## 7. Conclusion

Integrating BetterAuth will significantly improve the security and robustness of Perfect Pitch's authentication system. This requires careful definition (if BetterAuth is a placeholder) or research (if it's a specific library), database schema changes, new service logic, and updates to middleware and WebSocket handling. The benefits of a modern, dedicated, and well-understood authentication solution are substantial. Thorough planning, clear definition/research, and rigorous testing will be key to a successful implementation.
