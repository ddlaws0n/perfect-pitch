# Project Perfect Pitch: System Architecture

## 1. Overview

Perfect Pitch is a web application designed to conduct AI-powered technical interviews. Users can participate in mock interviews where an AI acts as the interviewer, providing questions and feedback in real-time. The system leverages Cloudflare Workers for its backend, Durable Objects for stateful WebSocket management, Cloudflare AI for speech-to-text and language model capabilities, and Cloudflare D1 for data persistence. This document outlines the integration of BetterAuth for robust session-based authentication.

## 2. Core Technologies

The system is built upon the following core technologies:

- **Cloudflare Workers**: Serverless execution environment for the backend logic.
- **Hono**: A small, simple, and ultrafast web framework for Cloudflare Workers, used for routing and request handling.
- **BetterAuth**: A modern, secure, session-based authentication library/solution. Used for user registration, login, logout, and session management. Integrates with Cloudflare D1 via a D1 adapter or direct D1 integration logic.
- **Durable Objects**: Provides strongly consistent, stateful coordination for features like real-time interview sessions via WebSockets.
- **WebSockets**: Enables bidirectional, real-time communication between the client (interviewee) and the server (Interview Durable Object), secured by BetterAuth sessions.
- **Cloudflare AI**:
  - **Whisper**: Used for speech-to-text transcription of the interviewee's audio input.
  - **Llama 2**: A large language model used to generate AI interviewer questions and responses.
- **TypeScript**: The primary programming language for the backend.
- **Cloudflare D1**: A serverless SQL database used for persisting application data, including `Users`, BetterAuth `user_sessions` and `user_credentials` (or equivalent, depending on BetterAuth design), `Interview_Types`, `Skills`, and interview session data.
- **HTML/CSS/JavaScript (Frontend)**: Static assets served from the [`public`](../public) directory, likely using HTML for structure, Tailwind CSS for styling (inferred common practice), and JavaScript for client-side interactions with authentication and interview APIs.

## 3. Key Components

### 3.1. Cloudflare Worker ([`src/index.ts`](../src/index.ts:1))

- **Entry Point**: The main entry point for all incoming requests, as defined in [`wrangler.jsonc`](../wrangler.jsonc:1).
- **Request Routing**: Uses Hono to route requests to different parts of the application.
  - API routes are versioned under `/api/v1/`.
  - Authentication routes (`/api/v1/auth/*`) are handled by [`src/routes/auth.ts`](../src/routes/auth.ts:1) using BetterAuth.
  - Interview-related routes (`/api/v1/interview/*`) are handled by [`src/routes/interview.ts`](../src/routes/interview.ts:1).
- **Middleware**:
  - Implements global middleware for logging (`hono/logger`) and error handling ([`src/middleware/handleError.ts`](../src/middleware/handleError.ts:1)).
  - Integrates BetterAuth middleware (e.g., defined in [`src/middleware/auth.ts`](../src/middleware/auth.ts:1) or a dedicated `betterAuth.ts`) for session validation and populating user context (`c.var.user`, `c.var.session`) on protected routes.
- **Durable Object Export**: Exports the `Interview` Durable Object class.
- **D1 Binding**: Configured in [`wrangler.jsonc`](../wrangler.jsonc:1) to provide the `DB` binding for accessing the Cloudflare D1 database.
- **BetterAuth Initialization**: Initializes the BetterAuth instance/module (e.g., in `src/lib/betterAuth.ts` or `src/auth/betterAuth.ts`) with the D1 adapter/integration, environment-specific settings (e.g., for cookie security), and user/session attribute definitions. Secrets for BetterAuth are managed via environment variables.

### 3.2. Hono Web Framework

- Provides the routing mechanism for HTTP requests.
- Simplifies request and response handling within the Cloudflare Worker.
- Facilitates the integration of BetterAuth middleware for protecting routes and managing user sessions.

### 3.3. BetterAuth Authentication Service (Conceptual: `src/lib/betterAuth.ts`, [`src/routes/auth.ts`](../src/routes/auth.ts:1), [`src/middleware/auth.ts`](../src/middleware/auth.ts:1) or `src/middleware/betterAuth.ts`)

- **Core Functionality**: Manages user authentication and session lifecycle using BetterAuth.
- **Key Endpoints** (handled by [`src/routes/auth.ts`](../src/routes/auth.ts:1)):
  - `POST /api/v1/auth/register`: Handles new user registration. Accepts username and password. Uses BetterAuth to create a new user and a credential (with a hashed password) in the D1 database.
  - `POST /api/v1/auth/login`: Authenticates existing users with username and password. Uses BetterAuth to validate credentials against the `user_credentials` table (or equivalent), create a session in the `user_sessions` table, and set a secure, HTTP-only session cookie.
  - `POST /api/v1/auth/logout`: Invalidates the user's current session in D1 (via BetterAuth) and clears the session cookie from the client.
  - `GET /api/v1/auth/me`: (Protected by BetterAuth middleware) Retrieves details (e.g., `userId`, `username`) of the currently authenticated user based on their valid session.
- **Session Management**:
  - BetterAuth handles the creation, validation, refresh, and invalidation of sessions.
  - Sessions are stored in the `user_sessions` D1 table.
  - Session cookies are configured securely (HttpOnly, Secure in production, SameSite=Lax/Strict).
- **Password Hashing**: Utilizes strong password hashing algorithms (e.g., Argon2id, scrypt, or bcrypt via a library like `oslo/password` or directly) as configured with BetterAuth's credential management for the `user_credentials` table.
- **Database Interaction**: BetterAuth's D1 adapter/integration manages all direct interactions with the D1 tables:
  - `Users`: Stores user identity (e.g., `user_id`, `username`). Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
  - `user_sessions`: Stores active user sessions with expiration. Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
  - `user_credentials`: Stores authentication credentials for users, primarily username/password with hashed passwords. Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
- **Middleware Integration** ([`src/middleware/auth.ts`](../src/middleware/auth.ts:1) or `src/middleware/betterAuth.ts`):
  - Validates incoming session cookies using BetterAuth's session validation logic (e.g., `betterAuth.validateSession()`).
  - Populates `context.var.user` and `context.var.session` with validated user and session data.
  - Handles session cookie refresh if necessary, as per BetterAuth's capabilities.
  - Protects routes by denying access if a valid session is not present and required.

### 3.4. Interview Durable Object ([`src/interview.ts`](../src/interview.ts:1))

- **Stateful WebSocket Management**: Each instance of this Durable Object manages a specific interview session.
- **WebSocket Lifecycle**: Handles WebSocket connection upgrades, message handling (binary audio and text), and connection closure.
- **Authenticated Access**: The WebSocket upgrade request is first validated by BetterAuth middleware in the main worker. The authenticated `user_id` is then passed to the Durable Object (e.g., via a custom header like `X-User-Id` on the request forwarded to the DO's `fetch` method).
- **Session Tracking**: Maintains a map of active WebSocket sessions.
- **Real-time Communication**: Broadcasts messages to clients connected to the same interview session.
- **Interaction with Services**:
  - Uses [`InterviewDatabaseService`](../src/services/InterviewDatabaseService.ts:1) to persist and retrieve interview data and messages from Cloudflare D1, associating actions with the authenticated `user_id`.
  - Uses [`AIService`](../src/services/AIService.ts:1) to process audio and generate AI responses.

### 3.5. AI Service ([`src/services/AIService.ts`](../src/services/AIService.ts:1))

- **Interface to Cloudflare AI**: Encapsulates interactions with Cloudflare AI models.
- **Audio Transcription**:
  - Receives audio data (`Uint8Array`).
  - Uses the `@cf/openai/whisper-tiny-en` model via the `env.AI` binding to transcribe audio to text.
- **LLM Response Generation**:
  - Takes the current `InterviewData` (including message history, title, skills).
  - Constructs a system prompt and message history for the LLM.
  - Uses the `@cf/meta/llama-2-7b-chat-int8` model via the `env.AI` binding to generate the AI interviewer's next response.

### 3.6. Database Service ([`src/services/InterviewDatabaseService.ts`](../src/services/InterviewDatabaseService.ts:1))

- **Data Persistence**: Manages all database operations for _interview-specific_ data, interacting with the Cloudflare D1 database. User and session data are managed by BetterAuth.
- **Storage**: Connects to the Cloudflare D1 database `perfect-pitch-db` via the `DB` binding.
- **Operations**:
  - Interacts with tables such as `Interview_Types`, `Skills`, `Interview_Type_Suggested_Skills`, `Interview_Skills`, `interviews`, and `messages`.
  - Creates new interviews, associating them with the authenticated user.
  - Retrieves interview details and all interviews for a user.
  - Adds messages (user and assistant) to an interview.
  - Manages skill and interview type data.

### 3.7. Frontend ([`public/`](../public))

- **Static Assets**: Consists of HTML, CSS, and JavaScript files served directly by Cloudflare Workers.
  - [`public/auth.html`](../public/auth.html): Handles user registration and login, interacting with the BetterAuth API endpoints.
  - [`public/dashboard.html`](../public/dashboard.html): Displays available interviews for the authenticated user.
  - [`public/interview.html`](../public/interview.html): The main interface for conducting an interview.
- **Client-Side Logic**:
  - Makes API calls to `/api/v1/auth/*` for registration, login, and logout.
  - Stores/manages UI state related to authentication.
  - Initiates WebSocket connections to the `Interview` Durable Object (session cookie is automatically sent by the browser).
  - Captures microphone audio and sends it over WebSockets.
  - Receives and displays messages from the server in real-time.

### 3.8. Cloudflare D1 Database

- **Name**: `perfect-pitch-db`
- **ID**: `00cb4b4a-7090-482a-b3fc-f2c143fb7998` (Reference ID, `DB` binding is used in code).
- **Purpose**: Serves as the primary relational database for the application.
- **Access**: Accessed by Cloudflare Workers via the `DB` binding.
- **Schema Management**: Managed via migrations located in the [`migrations/`](../migrations/) directory.
- **Key Tables**:
  - `Users`: Stores user information (e.g., `user_id` (PK, text), `username` (text, unique)). Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
  - `user_sessions`: Stores active user sessions (e.g., `id` (PK, text), `user_id` (FK to Users), `expires_at` (timestamp)). Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
  - `user_credentials`: Stores authentication credentials for users (e.g., `id` (PK, text), `user_id` (FK to Users), `type` (text, e.g., 'password'), `hashed_secret` (text)). Managed by BetterAuth. Schema defined in BetterAuth plan/migrations ([`docs/BETTERAUTH_PLAN.md`](./BETTERAUTH_PLAN.md)).
  - `Interview_Types`: Stores different types of interviews. Schema defined in [`migrations/0001_create_interview_types_table.sql`](../migrations/0001_create_interview_types_table.sql:1).
  - `Skills`: Stores various skills that can be assessed. Schema defined in [`migrations/0002_create_skills_table.sql`](../migrations/0002_create_skills_table.sql:1).
  - `Interview_Type_Suggested_Skills`: Join table. Schema defined in [`migrations/0003_create_interview_type_suggested_skills_table.sql`](../migrations/0003_create_interview_type_suggested_skills_table.sql:1).
  - `Interview_Skills`: Join table. Schema defined in [`migrations/0004_create_interview_skills_table.sql`](../migrations/0004_create_interview_skills_table.sql:1).
  - `interviews`: Stores interview session metadata.
  - `messages`: Stores messages exchanged during interviews.

## 4. Data Flow

### 4.1. Authentication Flow (BetterAuth)

#### 4.1.1. User Registration

1.  User navigates to [`public/auth.html`](../public/auth.html) and selects "Register".
2.  User submits username and password.
3.  Client-side JavaScript sends a `POST` request to `/api/v1/auth/register` with `username` and `password`.
4.  [`src/routes/auth.ts`](../src/routes/auth.ts:1) receives the request.
5.  It calls BetterAuth's functions to:
    - Hash the password.
    - Create a new user in the `Users` table in D1.
    - Create a new credential (with hashed password) in the `user_credentials` table in D1, linked to the user.
6.  A success response (e.g., 201 Created) is sent to the client. (Optionally, a session can be created and cookie set immediately).

#### 4.1.2. User Login

1.  User navigates to [`public/auth.html`](../public/auth.html) and selects "Login".
2.  User submits their username and password.
3.  Client-side JavaScript sends a `POST` request to `/api/v1/auth/login` with `username` and `password`.
4.  [`src/routes/auth.ts`](../src/routes/auth.ts:1) receives the request.
5.  It calls BetterAuth's functions to:
    - Validate the `username` and `password` against the `user_credentials` table in D1.
    - If valid, create a new session for the user in the `user_sessions` table in D1.
    - Generate a session cookie.
6.  The session cookie (secure, HTTP-only, SameSite) is set in the user's browser via the `Set-Cookie` header.
7.  User is redirected to [`public/dashboard.html`](../public/dashboard.html).

#### 4.1.3. User Logout

1.  User clicks a "Logout" button (e.g., on [`public/dashboard.html`](../public/dashboard.html)).
2.  Client-side JavaScript sends a `POST` request to `/api/v1/auth/logout`.
3.  [`src/routes/auth.ts`](../src/routes/auth.ts:1) receives the request. The browser automatically includes the session cookie.
4.  BetterAuth middleware (or route logic) validates the session.
5.  BetterAuth's `invalidateSession()` (or equivalent) is called, removing the session from the `user_sessions` table in D1.
6.  A blank session cookie is sent via `Set-Cookie` to clear the client's cookie.
7.  User is redirected to [`public/auth.html`](../public/auth.html).

#### 4.1.4. Accessing Protected Routes (e.g., `/api/v1/auth/me` or interview routes)

1.  User attempts to access a protected resource. The browser automatically sends the session cookie.
2.  BetterAuth middleware intercepts the request.
3.  BetterAuth's session validation logic (e.g., `betterAuth.validateSession()`) is called with the session ID from the cookie.
4.  If the session is valid (exists in D1 and not expired):
    - User and session data are attached to the request context (e.g., `c.var.user`, `c.var.session`).
    - If the session was refreshed by BetterAuth, a new `Set-Cookie` header might be sent.
    - The request proceeds to the route handler.
5.  If the session is invalid or missing:
    - An appropriate error (e.g., 401 Unauthorized) is returned.
    - A blank session cookie might be sent to clear an invalid client cookie.

### 4.2. Interview Session Flow (WebSocket with BetterAuth)

1.  **Authentication**: User logs in via BetterAuth as described above. A valid session cookie is present in the browser.
2.  **Initiation**:
    - User selects or starts an interview from [`public/dashboard.html`](../public/dashboard.html), navigating to [`public/interview.html`](../public/interview.html).
    - Client-side JavaScript establishes a WebSocket connection to `wss://<worker-url>/api/v1/interview/<interviewId>/ws`. The browser automatically includes the BetterAuth session cookie with the WebSocket upgrade request.
3.  **Connection Handling & Authentication**:
    - The request reaches the main Worker ([`src/index.ts`](../src/index.ts:1)), which routes it to [`src/routes/interview.ts`](../src/routes/interview.ts:1).
    - **Crucially, before upgrading, the BetterAuth middleware (or specific logic in the route handler) validates the session cookie.**
      - BetterAuth's session validation logic is used.
      - If the session is invalid, the WebSocket upgrade is rejected (e.g., with a 401 or 403 status).
      - If valid, the authenticated `user.id` is extracted from the session.
    - [`src/routes/interview.ts`](../src/routes/interview.ts:1) gets a stub for the `Interview` Durable Object using `env.INTERVIEW.get(id)`.
    - The request (potentially modified to include the authenticated `user.id`, e.g., via a custom header like `X-User-Id`) is forwarded to the `fetch()` method of the specific `Interview` DO instance.
    - The `Interview` DO ([`src/interview.ts`](../src/interview.ts:1)) upgrades the HTTP request to a WebSocket connection. It now trusts the `user_id` passed to it.
    - The server sends initial interview details to the client.
4.  **User Audio Input**: (Same as before)
    - User speaks; client sends audio over WebSocket.
5.  **Server-Side Processing**:
    - The `Interview` DO's `webSocketMessage()` receives audio.
    - It calls `handleBinaryAudio()`. All subsequent operations, including saving messages via `InterviewDatabaseService.addMessage()`, are performed in the context of the `user_id` established during WebSocket authentication.
    - Interactions with `AIService` and `InterviewDatabaseService` proceed as before, but now with user context.
6.  **Client-Side Update**: (Same as before)
    - UI updates with conversation.
7.  **Connection Closure**: (Same as before)
    - `webSocketClose()` in DO cleans up.

## 5. Interactions Diagram (with BetterAuth)

```mermaid
graph LR
    subgraph "User Interface (Browser)"
        ClientAuthHTML[Client (auth.html)]
        ClientDashboardHTML[Client (dashboard.html)]
        ClientInterviewHTML[Client (interview.html)]
    end

    subgraph "Cloudflare Worker: API & Routing (Hono)"
        MainWorker[Main Worker (src/index.ts)]
        BetterAuthRoutes[BetterAuth Routes (src/routes/auth.ts)]
        BetterAuthMiddleware[BetterAuth Middleware (src/middleware/auth.ts or betterAuth.ts)]
        InterviewRoute[Interview Route (src/routes/interview.ts)]
        InterviewDurableObject[Interview Durable Object (src/interview.ts)]
    end

    subgraph "Supporting Services (within Worker)"
        BetterAuthLib[BetterAuth Library/Instance (src/lib/betterAuth.ts)]
        AISvc[AI Service (src/services/AIService.ts)]
        InterviewDBSvc[InterviewDatabaseService (src/services/InterviewDatabaseService.ts)]
    end

    subgraph "Cloudflare Platform"
        CF_AI[Cloudflare AI (Whisper, Llama 2)]
        CF_D1[Cloudflare D1 (perfect-pitch-db)]
    end

    User[(User)] -- Interacts --> ClientAuthHTML
    User -- Interacts --> ClientDashboardHTML
    User -- Interacts --> ClientInterviewHTML

    ClientAuthHTML -- HTTP Register/Login/Logout --> MainWorker
    MainWorker -- Route --> BetterAuthRoutes
    BetterAuthRoutes -- Uses --> BetterAuthLib
    BetterAuthLib -- D1 Adapter/Integration --> CF_D1
    BetterAuthRoutes -- Set/Clear Session Cookie --> ClientAuthHTML

    ClientDashboardHTML -- HTTP Request (Cookie Auth) --> MainWorker
    ClientInterviewHTML -- HTTP Request (Cookie Auth) --> MainWorker
    MainWorker -- Apply Middleware --> BetterAuthMiddleware
    BetterAuthMiddleware -- Validate Session (Cookie) --> BetterAuthLib
    BetterAuthMiddleware -- Populate c.var.user --> MainWorker

    ClientInterviewHTML -- WebSocket Upgrade (Cookie Auth) --> MainWorker
    MainWorker -- Route to InterviewRoute, Apply Auth --> InterviewRoute
    InterviewRoute -- Validate Session (via Middleware/BetterAuthLib) --> BetterAuthLib
    InterviewRoute -- If Auth OK, Get DO Stub & Forward with UserID --> InterviewDurableObject

    InterviewDurableObject -- Receives UserID --> InterviewDurableObject
    InterviewDurableObject -- Audio Data --> AISvc
    AISvc -- Invoke Model --> CF_AI
    CF_AI -- Transcribed Text/LLM Response --> AISvc
    AISvc -- Processed Data --> InterviewDurableObject

    InterviewDurableObject -- Persist/Retrieve Interview Data (with UserID) --> InterviewDBSvc
    InterviewDBSvc -- D1 SQL (Interview Tables) --> CF_D1
    CF_D1 -- Data --> InterviewDBSvc
    InterviewDBSvc -- Data --> InterviewDurableObject

    InterviewDurableObject -- WebSocket Messages --> ClientInterviewHTML
```

## 6. Security Considerations

- **Session Management**: BetterAuth provides secure session management, including HttpOnly, Secure, and SameSite cookies. Session IDs are cryptographically random.
- **Password Hashing**: Strong password hashing (e.g., Argon2id, scrypt, or bcrypt) is used to protect user credentials.
- **CSRF Protection**: While BetterAuth itself is backend, for frontend forms interacting with POST endpoints (login, register), consider implementing CSRF protection mechanisms if not explicitly handled by BetterAuth or Hono (e.g., SameSite cookies offer some protection, but double-submit cookies or token-based methods can be stronger). Hono might have middleware for this.
- **Input Validation**: All inputs to authentication endpoints (username, password) and other API endpoints must be rigorously validated.
- **Rate Limiting**: Implement rate limiting on authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`) to prevent brute-force attacks. This can be done at the Cloudflare edge or within the Worker.
- **Environment Variables**: All secrets (BetterAuth secrets, API keys) MUST be stored as Cloudflare Worker environment variables and NOT hardcoded.
- **HTTPS**: Ensure all communication is over HTTPS (Cloudflare handles this by default for worker subdomains).
- **Durable Object Security**: The `user_id` passed to the Durable Object must be trusted, meaning it's derived from a validated BetterAuth session at the Worker/gateway level before the request is forwarded to the DO. The DO itself should not re-validate the session cookie unless it has direct access to BetterAuth and its context, which adds complexity.

## 7. Scalability and Performance

- **Cloudflare Workers & D1**: Inherently scalable due to the serverless nature of Cloudflare's platform.
- **BetterAuth**: Designed to be lightweight. Performance will largely depend on D1 query performance for session/user/credential lookups. Proper indexing on D1 tables (`Users.user_id`, `Users.username`, `user_sessions.id`, `user_credentials.id`, `user_credentials.user_id`) is crucial.
- **Durable Objects**: Scalable for managing individual WebSocket sessions.
- **WebSocket Connections**: Authentication at the gateway before upgrading to WebSocket reduces load on Durable Objects from unauthenticated connection attempts.

## 8. Extensibility

- **Modular Design**: The separation of concerns (Auth Service, AI Service, DB Service, Interview DO) allows for independent development and updates.
- **BetterAuth Features**: BetterAuth might support various adapters or be extensible for features like OAuth, password reset, email verification if needed in the future.
- **API Versioning**: `/api/v1/` allows for future API changes without breaking existing clients.
