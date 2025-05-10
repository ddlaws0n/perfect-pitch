# Project Perfect Pitch: Action Checklist

This document tracks the progress of the 'perfect-pitch' AI interview platform.

## 1. Completed Actions

- **Core Infrastructure: Cloudflare D1 Database Setup**
  - [x] Initial Review & Research Planning for D1 Setup (based on [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:1) and [`docs/PLAN_ISSUES.md`](./docs/PLAN_ISSUES.md:1))
  - [x] D1 Best Practices Research (documented in [`docs/D1_RESEARCH_FINDINGS.md`](./docs/D1_RESEARCH_FINDINGS.md:1))
  - [x] Provision Cloudflare D1 database `perfect-pitch-db` (ID `00cb4b4a-7090-482a-b3fc-f2c143fb7998`, Binding `DB`)
  - [x] Update [`wrangler.jsonc`](./wrangler.jsonc:1) with D1 binding
  - [x] Define `Users` table schema and create migration ([`migrations/0000_create_users_table.sql`](./migrations/0000_create_users_table.sql:1))
  - [x] Apply `Users` table migration
  - [x] Define `Interview_Types` table schema and create migration ([`migrations/0001_create_interview_types_table.sql`](./migrations/0001_create_interview_types_table.sql:1)) (based on [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1))
  - [x] Apply `Interview_Types` table migration
  - [x] Define `Skills` table schema and create migration ([`migrations/0002_create_skills_table.sql`](./migrations/0002_create_skills_table.sql:1))
  - [x] Apply `Skills` table migration
  - [x] Define `Interview_Type_Suggested_Skills` join table schema and create migration ([`migrations/0003_create_interview_type_suggested_skills_table.sql`](./migrations/0003_create_interview_type_suggested_skills_table.sql:1))
  - [x] Apply `Interview_Type_Suggested_Skills` join table migration
  - [x] Define `Interview_Skills` join table schema and create migration ([`migrations/0004_create_interview_skills_table.sql`](./migrations/0004_create_interview_skills_table.sql:1))
  - [x] Apply `Interview_Skills` join table migration

**Important Note:** After completing any significant feature implementation or architectural change, ensure the [`docs/ARCHITECTURE.MD`](./docs/ARCHITECTURE.MD:1) document is updated to reflect these changes.

## 2. Phase 1: Foundational Infrastructure & Core Data

- **Core Infrastructure: Lucia Auth Implementation** (as per [`docs/LUCIA_AUTH_PLAN.md`](./docs/LUCIA_AUTH_PLAN.md:1))

  - [ ] Conduct research on Lucia Auth (focusing on official documentation, D1 adapters, best practices, Hono compatibility, WebSocket authentication)
  - [ ] Install Dependencies (`lucia`, `@lucia-auth/adapter-d1`, password hashing library)
  - [ ] Configure Lucia Auth (create config file, initialize with D1 adapter, define types, store secrets)
  - [ ] Update D1 Schema & Migrations (modify `Users` table, add `user_sessions` and `user_keys` tables, apply migrations)
  - [ ] Develop New Authentication Service/Routes (implement `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, optional `GET /api/v1/auth/me`)
  - [ ] Update Authentication Middleware (create Hono middleware for session validation, replace current cookie check)
  - [ ] Update WebSocket Authentication (modify handler in [`src/routes/interview.ts`](./src/routes/interview.ts:1) to use Lucia, update `Interview` DO)
  - [ ] Update Frontend (modify [`public/auth.html`](./public/auth.html:1) for new auth endpoints)
  - [ ] Testing (unit/integration tests for all auth flows)
  - [ ] Address Security Considerations (CSRF, password policy, cookie security, rate limiting, input validation, secure secrets, HTTPS, dependency updates, authorization logic)
    - [ ] Define and enforce a strong password policy (e.g., length, complexity, disallow common passwords).
    - [ ] Ensure session cookies use HttpOnly, Secure, and SameSite=Lax/Strict attributes.
    - [ ] Implement brute-force protection mechanisms (e.g., account lockout after multiple failed login attempts) in addition to rate limiting.
    - [ ] Detail specific CSRF protection mechanisms to be used with Hono and Lucia Auth (e.g., double-submit cookies, synchronizer token pattern).
    - [ ] Plan for secure session invalidation on logout, password change, and prolonged inactivity.
  - [ ] Address Migration from Current Basic Auth (decide on user re-registration, data association for historical data if needed)

- **Core Infrastructure: Further D1 Database Schema Expansion** (from [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:1))

  - [ ] Enforce use of parameterized queries/prepared statements for all D1 interactions to prevent SQL injection; explicitly forbid dynamic SQL string concatenation with user inputs.
  - [ ] Define schema and create migration for `Interviews` table (linking to `Users`, `Interview_Types`).
  - [ ] Define schema and create migration for `Messages` table (linking to `Interviews`, `Users`, storing prompt/response, timestamps).
  - [ ] Define schema and create migration for `Interview_Questions` table (linking to `Interviews`, `Skills`, storing question text, expected answer keywords, difficulty).
  - [ ] Define schema and create migration for `AI_Feedback` table (linking to `Messages` or `Interview_Questions`, storing feedback text, ratings, suggestions).
  - [ ] Define schema and create migration for `User_Feedback` table (linking to `Interviews` or `Messages`, storing user ratings, comments).
  - [ ] Apply all new D1 table migrations.
  - [ ] Refactor and expand `src/services/InterviewDatabaseService.ts` to support CRUD operations for the new tables (`Interviews`, `Messages`, `Interview_Questions`, `AI_Feedback`, `User_Feedback`).
  - [ ] Implement robust input validation (type, length, format, business rules) for all data written to or queried from the database via `src/services/InterviewDatabaseService.ts`.
  - [ ] Define and implement authorization logic within `src/services/InterviewDatabaseService.ts` to ensure users can only access/modify data they are permitted to (e.g., a user's own interviews, messages).
  - [ ] Review schemas for `Interviews`, `Messages`, `AI_Feedback`, `User_Feedback` for potential PII or sensitive data; plan for appropriate handling (e.g., encryption at rest if necessary, stricter access controls).

- **Core Features: Interview Types & Skills Integration** (from [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) and general context)

  - [ ] Create a seeding script (e.g., `migrations/seed_interview_data.sql` or a TypeScript script using Wrangler) to populate initial `Interview_Types` and `Skills` data.
  - [ ] Execute the seeding script for `Interview_Types` and `Skills`.
  - [ ] Ensure `src/services/InterviewDatabaseService.ts` is updated to include methods for fetching `Interview_Types`, `Skills`, and their relationships (e.g., suggested skills for an interview type).

## 3. Phase 2: Frontend Modernization & UI Integration

- **Frontend: Hono/JSX Migration** (as per [`docs/HONO_JSX_MIGRATION_PLAN.md`](./docs/HONO_JSX_MIGRATION_PLAN.md:1))

  - [ ] Setup Hono JSX: Install dependencies, configure [`tsconfig.json`](./tsconfig.json:1), update build process (e.g., in [`justfile`](./justfile:1))
  - [ ] Create Core Layout and Common Components: Implement `MainLayout.tsx` and common UI components (e.g., `Button.tsx`, `Input.tsx`)
  - [ ] Convert Pages (Iterative Approach):
    - [ ] Convert Auth Page: Create `AuthPage.tsx` from [`public/auth.html`](./public/auth.html:1), refactor JS, bundle JS, create Hono route
    - [ ] Convert Dashboard Page: Create `DashboardPage.tsx` from [`public/dashboard.html`](./public/dashboard.html:1), refactor JS, create Hono route, include UI elements for selecting/creating Interview Types and associated Skills.
    - [ ] Convert Interview Page: Create `InterviewPage.tsx` from [`public/interview.html`](./public/interview.html:1), break down UI, refactor JS, create Hono route, ensure UI displays selected Interview Type and Skills, and allows for interaction based on them.
  - [ ] Update Hono Routing: Create `src/routes/ui.ts` for serving JSX pages, integrate into main router in [`src/index.ts`](./src/index.ts:1), ensure [`wrangler.jsonc`](./wrangler.jsonc:1) correctly serves static assets and Hono routes.
  - [ ] Client-Side JavaScript Bundling: Use `esbuild` via [`justfile`](./justfile:1) to bundle client-side JS modules
  - [ ] Address UX Considerations: Maintain functionality, performance, visual consistency, consider progressive enhancement, and implement error handling
  - [ ] Implement and verify consistent output encoding/sanitization for all dynamic data rendered in JSX components to prevent XSS vulnerabilities.
  - [ ] Define and implement Content Security Policy (CSP) headers for the application.
  - [ ] Ensure secure handling of any client-side authentication tokens or session information, prioritizing HttpOnly cookies managed by Lucia Auth.

## 4. Phase 3: Advanced AI & User Experience Features

- **AI Features: AI Prompt Enhancement** (as per [`docs/AI_PROMPT_ENHANCEMENT_PLAN.md`](./docs/AI_PROMPT_ENHANCEMENT_PLAN.md:1))

  - [ ] Conduct Research on Advanced Prompt Engineering Techniques (Contextual Prompting, Role-Playing, CoT/Few-Shot, NLG, Targeted Question Generation, Constructive Feedback, Bias Mitigation, Prompt Chaining, Self-Correction)
  - [ ] Define D1 Database Schema for Prompts: Define and apply D1 schema migrations for `PromptTemplates`, `PromptTemplateVersions`, `ABTests`, and `ABTestVariants` tables.
  - [ ] Implement `PromptManagementService.ts`: Implement `PromptManagementService.ts` including CRUD operations for prompts, version management, A/B test variant selection logic, and the `getPrompt(context, userId?)` method for dynamic prompt construction and personalization.
    - [ ] Research and implement defenses against prompt injection vulnerabilities, especially for dynamic prompt construction using user-influenced context or userId.
  - [ ] Update [`AIService.ts`](./src/services/AIService.ts:1) (Integrate with `PromptManagementService`, pass context)
  - [ ] Plan and Design Admin Interface for Prompt Management: Plan and Design Admin Interface for Prompt Management (consider Hono/JSX for UI). Include features for CRUD operations on prompts, version control, A/B test setup and monitoring, prompt preview, filtering/searching prompts, and role-based access control for managing prompts.
    - [ ] Ensure the Admin Interface for Prompt Management is secured with strong authentication, fine-grained authorization (RBAC), input validation, XSS protection, and CSRF protection.
  - [ ] Seed Initial Prompts (Develop base set, create seeding script)
  - [ ] Define and Implement Evaluation Strategies:
    - [ ] Implement user feedback mechanisms (e.g., ratings, qualitative feedback on AI responses).
    - [ ] Define and track AI performance metrics (e.g., relevance, coherence, helpfulness, task completion rate).
    - [ ] Develop tools/scripts for analyzing A/B testing results for prompts.
  - [ ] Establish data privacy measures to prevent leakage of PII or sensitive user data into AI prompts during personalization or context building.

- **AI Features: TTS Integration** (as per [`docs/TTS_INTEGRATION_PLAN.md`](./docs/TTS_INTEGRATION_PLAN.md:1))

  - [ ] Research TTS Options for Cloudflare Workers (Prioritize Cloudflare's native AI TTS, then ElevenLabs, Google Cloud TTS, Amazon Polly, Microsoft Azure Cognitive Services TTS)
  - [ ] Setup & Configuration: Choose TTS provider, sign up & get API keys, configure Worker secrets
  - [ ] Backend Development (`src/services/TTSService.ts`): Create service to interact with TTS API, manage API keys, handle responses/errors
  - [ ] Backend API Endpoint (e.g., `src/routes/tts.ts`): Create Hono route for TTS generation, integrate with `TTSService.ts`, validate requests, handle streaming
  - [ ] Frontend Development (Hono JSX Components): Create `AudioPlayer` component, integrate it into interview question and AI feedback displays, implement API calls
  - [ ] Testing: Unit tests for `TTSService.ts`, integration tests for API endpoint, E2E tests for frontend playback
  - [ ] Documentation: Update [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md:1), document API endpoints
  - [ ] Address UX Considerations: Low latency, clear controls, voice selection (optional), accessibility, error handling, no autoplay by default
  - [ ] Confirm TTS Provider (Focused research on Cloudflare AI TTS, then others)
  - [ ] Develop Proof of Concept (PoC) with chosen TTS service
  - [ ] Detailed Implementation Planning based on PoC
  - [ ] Implement input sanitization for any user-provided or user-influenced text sent to the TTS service to prevent injection attacks or unexpected behavior.
  - [ ] Implement rate limiting on the TTS API endpoint ([`src/routes/tts.ts`](./src/routes/tts.ts:1)) to prevent resource abuse.

## 5. Phase 4: Ongoing: Security, Documentation & Review

- **General Security Measures & Practices (Ongoing)**

  - [ ] Implement comprehensive security logging for critical events (e.g., authentication attempts, authorization failures, significant errors, changes to sensitive data) and establish a monitoring strategy.
  - [ ] Ensure all API endpoints enforce appropriate authentication and authorization checks.
  - [ ] Implement consistent, secure error handling that does not leak sensitive information (e.g., stack traces, internal configurations) to clients.
  - [ ] Configure security headers (e.g., HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) across the application.

- **General Documentation & Review**
  - [ ] Review [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md:1) for any other high-level tasks not yet captured (No new tasks identified beyond existing plans).
  - [ ] Review [`docs/PLAN_ISSUES.md`](./docs/PLAN_ISSUES.md:1) for any outstanding issues that need to become actions (Research tasks from plans are the main actionable follow-ups).
