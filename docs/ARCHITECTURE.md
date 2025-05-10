# Project Perfect Pitch: System Architecture

## 1. Overview

Perfect Pitch is a web application designed to conduct AI-powered technical interviews. Users can participate in mock interviews where an AI acts as the interviewer, providing questions and feedback in real-time. The system leverages Cloudflare Workers for its backend, Durable Objects for stateful WebSocket management, Cloudflare AI for speech-to-text and language model capabilities, and Cloudflare D1 for data persistence.

## 2. Core Technologies

The system is built upon the following core technologies:

- **Cloudflare Workers**: Serverless execution environment for the backend logic.
- **Hono**: A small, simple, and ultrafast web framework for Cloudflare Workers, used for routing and request handling.
- **Durable Objects**: Provides strongly consistent, stateful coordination for features like real-time interview sessions via WebSockets.
- **WebSockets**: Enables bidirectional, real-time communication between the client (interviewee) and the server (Interview Durable Object).
- **Cloudflare AI**:
  - **Whisper**: Used for speech-to-text transcription of the interviewee's audio input.
  - **Llama 2**: A large language model used to generate AI interviewer questions and responses.
- **Cookie-based Authentication**: Simple username-based authentication with session management via HTTP-only cookies.
- **TypeScript**: The primary programming language for the backend.
- **Cloudflare D1**: A serverless SQL database used for persisting application data, including users, interview types, skills, and interview sessions. Replaces the previous implicit SQLite usage via Durable Object storage for primary data persistence.
- **HTML/CSS/JavaScript (Frontend)**: Static assets served from the [`public`](../public) directory, likely using HTML for structure, Tailwind CSS for styling (inferred common practice), and JavaScript for client-side interactions.

## 3. Key Components

### 3.1. Cloudflare Worker ([`src/index.ts`](../src/index.ts:1))

- **Entry Point**: The main entry point for all incoming requests, as defined in [`wrangler.jsonc`](../wrangler.jsonc:1).
- **Request Routing**: Uses Hono to route requests to different parts of the application.
  - API routes are versioned under `/api/v1/`.
  - Authentication routes are handled by [`src/routes/auth.ts`](../src/routes/auth.ts:1).
  - Interview-related routes are handled by [`src/routes/interview.ts`](../src/routes/interview.ts:1).
- **Middleware**: Implements global middleware for logging (`hono/logger`) and error handling ([`src/middleware/handleError.ts`](../src/middleware/handleError.ts:1)).
- **Durable Object Export**: Exports the `Interview` Durable Object class.
- **D1 Binding**: Configured in [`wrangler.jsonc`](../wrangler.jsonc:1) to provide the `DB` binding for accessing the Cloudflare D1 database.

### 3.2. Hono Web Framework

- Provides the routing mechanism for HTTP requests.
- Simplifies request and response handling within the Cloudflare Worker.

### 3.3. Authentication Service ([`src/routes/auth.ts`](../src/routes/auth.ts:1))

- **Endpoint**: `POST /api/v1/auth/login`
- **Functionality**:
  - Accepts a `username` in the request body.
  - Sets an HTTP-only, `SameSite=Strict` cookie named `username` to manage the user session.
  - This cookie is used to identify the user in subsequent requests.

### 3.4. Interview Durable Object ([`src/interview.ts`](../src/interview.ts:1))

- **Stateful WebSocket Management**: Each instance of this Durable Object manages a specific interview session.
- **WebSocket Lifecycle**: Handles WebSocket connection upgrades, message handling (binary audio and text), and connection closure.
- **Session Tracking**: Maintains a map of active WebSocket sessions, associating each connection with an `interviewId`.
- **Real-time Communication**: Broadcasts messages (transcribed user input, AI responses, status updates) to all clients connected to the same interview session.
- **Interaction with Services**:
  - Uses [`InterviewDatabaseService`](../src/services/InterviewDatabaseService.ts:1) to persist and retrieve interview data and messages from Cloudflare D1.
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

- **Data Persistence**: Manages all database operations for interview data, interacting with the Cloudflare D1 database.
- **Storage**: Connects to the Cloudflare D1 database `perfect-pitch-db` via the `DB` binding defined in [`wrangler.jsonc`](../wrangler.jsonc:1).
- **Operations**:
  - Interacts with tables such as `Users`, `Interview_Types`, `Skills`, `Interview_Type_Suggested_Skills`, `Interview_Skills`, `interviews`, and `messages`.
  - Creates new interviews.
  - Retrieves interview details and all interviews.
  - Adds messages (user and assistant) to an interview.
  - Manages user, skill, and interview type data.

### 3.7. Frontend ([`public/`](../public))

- **Static Assets**: Consists of HTML, CSS (likely Tailwind CSS), and JavaScript files served directly by Cloudflare Workers.
  - [`public/auth.html`](../public/auth.html): Handles user login.
  - [`public/dashboard.html`](../public/dashboard.html): Displays available interviews.
  - [`public/interview.html`](../public/interview.html): The main interface for conducting an interview, handling audio input and displaying the conversation.
- **Client-Side Logic**:
  - Initiates WebSocket connections to the `Interview` Durable Object.
  - Captures microphone audio and sends it over WebSockets.
  - Receives and displays messages from the server in real-time.

### 3.8. Cloudflare D1 Database

- **Name**: `perfect-pitch-db`
- **ID**: `00cb4b4a-7090-482a-b3fc-f2c143fb7998` (This ID is for reference and not used directly in code, the binding name `DB` is used).
- **Purpose**: Serves as the primary relational database for the application.
- **Access**: Accessed by Cloudflare Workers via the `DB` binding configured in [`wrangler.jsonc`](../wrangler.jsonc:1).
- **Schema Management**: Managed via migrations located in the [`migrations/`](../migrations/) directory.
- **Key Tables**:
  - `Users`: Stores user information. Schema defined in [`migrations/0000_create_users_table.sql`](../migrations/0000_create_users_table.sql:1).
  - `Interview_Types`: Stores different types of interviews (e.g., "Behavioral", "Technical Deep Dive"). Schema defined in [`migrations/0001_create_interview_types_table.sql`](../migrations/0001_create_interview_types_table.sql:1).
  - `Skills`: Stores various skills that can be assessed. Schema defined in [`migrations/0002_create_skills_table.sql`](../migrations/0002_create_skills_table.sql:1).
  - `Interview_Type_Suggested_Skills`: A join table linking interview types to suggested skills. Schema defined in [`migrations/0003_create_interview_type_suggested_skills_table.sql`](../migrations/0003_create_interview_type_suggested_skills_table.sql:1).
  - `Interview_Skills`: A join table linking specific interview instances to the skills being assessed. Schema defined in [`migrations/0004_create_interview_skills_table.sql`](../migrations/0004_create_interview_skills_table.sql:1).
  - (Note: `interviews` and `messages` tables previously managed by `InterviewDatabaseService` are now also part of this D1 database, though their specific migration scripts are not listed here but are implied by the service's functionality).

## 4. Data Flow

### 4.1. Authentication Flow

1.  User navigates to [`public/auth.html`](../public/auth.html).
2.  User submits their username.
3.  Client-side JavaScript sends a `POST` request to `/api/v1/auth/login` with the username.
4.  [`src/routes/auth.ts`](../src/routes/auth.ts:1) handles the request.
5.  A secure, HTTP-only cookie (`username`) is set in the user's browser.
6.  User is redirected to [`public/dashboard.html`](../public/dashboard.html).

### 4.2. Interview Session Flow (WebSocket)

1.  **Initiation**:
    - User selects or starts an interview from [`public/dashboard.html`](../public/dashboard.html), navigating to [`public/interview.html`](../public/interview.html).
    - Client-side JavaScript establishes a WebSocket connection to the `Interview` Durable Object, typically via a URL like `wss://<worker-url>/api/v1/interviews/<interviewId>/ws`. The `interviewId` is obtained either by creating a new interview or selecting an existing one.
2.  **Connection Handling**:
    - The request reaches the main Worker ([`src/index.ts`](../src/index.ts:1)), which routes it to [`src/routes/interview.ts`](../src/routes/interview.ts:1).
    - [`src/routes/interview.ts`](../src/routes/interview.ts:1) gets a stub for the `Interview` Durable Object using `env.INTERVIEW.get(id)`.
    - The request is forwarded to the `fetch()` method of the specific `Interview` DO instance.
    - The `Interview` DO ([`src/interview.ts`](../src/interview.ts:1)) upgrades the HTTP request to a WebSocket connection.
    - The server sends initial interview details to the client if available (retrieved from D1 via `InterviewDatabaseService`).
3.  **User Audio Input**:
    - User speaks into their microphone.
    - Client-side JavaScript captures the audio and sends it as binary data (ArrayBuffer) over the WebSocket.
4.  **Server-Side Processing**:
    - The `Interview` DO's `webSocketMessage()` method receives the audio data.
    - It calls `handleBinaryAudio()`:
      - Broadcasts a "processing" status message to the client for the user's input.
      - Calls `AIService.transcribeAudio()` with the audio data.
      - `AIService` uses Cloudflare AI (Whisper) to get the transcribed text.
      - The transcribed text is saved to the D1 database via `InterviewDatabaseService.addMessage()`. This method also broadcasts the complete user message (with ID, role, content, status: 'completed') to the client.
      - Broadcasts a "processing" status message for the assistant's upcoming response.
      - Calls `AIService.processLLMResponse()`, passing the full interview context (retrieved from D1).
      - `AIService` constructs a prompt and uses Cloudflare AI (Llama 2) to generate the AI interviewer's response.
      - The AI's response is saved to the D1 database via `InterviewDatabaseService.addMessage()`. This method also broadcasts the complete assistant message to the client.
5.  **Client-Side Update**:
    - Client-side JavaScript receives messages (status updates, user transcriptions, AI responses) via its WebSocket `onmessage` handler.
    - The UI is updated dynamically to display the conversation.
6.  **Connection Closure**:
    - When the user closes the page or the connection is otherwise terminated, `webSocketClose()` in the `Interview` DO is triggered, and the session is cleaned up.

## 5. Interactions Diagram (Conceptual)

```mermaid
graph LR
    subgraph "User Interface"
        ClientAuth[Client (auth.html)]
        ClientInterview[Client (interview.html)]
    end

    subgraph "Cloudflare Worker: API & Routing"
        AuthService[Auth Service (src/routes/auth.ts)]
        InterviewDurableObject[Interview Durable Object (src/interview.ts)]
        InterviewRoute[Interview Route (src/routes/interview.ts)]
        MainWorker[Main Worker (src/index.ts)]
    end

    subgraph "Cloudflare Services"
        CloudflareAI[Cloudflare AI (Whisper, Llama 2)]
        CloudflareD1[Cloudflare D1 (perfect-pitch-db)]
    end

    subgraph "Supporting Services (within Worker)"
        AIService[AI Service (src/services/AIService.ts)]
        DBService[InterviewDatabaseService (src/services/InterviewDatabaseService.ts)]
    end

    Browser[(User's Browser)]

    ClientAuth -- HTTP Login --> MainWorker
    MainWorker -- Route --> AuthService
    AuthService -- Set Cookie --> Browser
    Browser -- Cookie --> ClientInterview

    ClientInterview -- WebSocket --> MainWorker
    MainWorker -- Route --> InterviewRoute
    InterviewRoute -- Get DO Stub --> InterviewDurableObject

    InterviewDurableObject -- Audio Data --> AIService
    AIService -- Invoke Model --> CloudflareAI
    CloudflareAI -- Transcribed Text/LLM Response --> AIService
    AIService -- Processed Data --> InterviewDurableObject

    InterviewDurableObject -- Persist/Retrieve Data --> DBService
    DBService -- D1 SQL --> CloudflareD1
    CloudflareD1 -- Data --> DBService
    DBService -- Data --> InterviewDurableObject

    InterviewDurableObject -- WebSocket Messages (Updates, Transcripts, AI Responses) --> ClientInterview
```
