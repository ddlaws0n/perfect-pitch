# Interview Types and Skills D1 Database Migration Plan

## 1. Introduction

This document outlines the detailed plan for migrating and integrating `Interview_Types` and `Skills` into the Cloudflare D1 database for the 'Perfect Pitch' AI interview platform. This enhancement aims to provide a more structured and customizable interview experience.

**Goals:**

- Allow users to define or select specific types for their interviews (e.g., "Behavioral", "Technical").
- Enable users to associate multiple skills with an interview (e.g., "JavaScript", "Problem Solving").
- Improve the AI's ability to select relevant questions and tailor interview conversations based on these types and skills.
- Provide better filtering, categorization, and search capabilities for past and future interviews.
- Enhance the user experience by suggesting relevant skills based on the chosen interview type.

This plan builds upon the existing database structure outlined in [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:1) and considers the application architecture detailed in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md:1) and frontend changes from [`docs/HONO_JSX_MIGRATION_PLAN.md`](./docs/HONO_JSX_MIGRATION_PLAN.md:1).

## 2. D1 Schema Design for Interview Types and Skills

The schema will leverage and extend the tables already proposed in the [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:1).

### 2.1. Core Tables

These tables are foundational for storing interview types and skills.

- **`Interview_Types` Table**: Stores predefined categories for interviews.

  ```sql
  CREATE TABLE Interview_Types (
      interview_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  CREATE INDEX idx_interview_types_type_name ON Interview_Types(type_name);
  ```

- **`Skills` Table**: Stores individual skills that can be assessed.
  ```sql
  CREATE TABLE Skills (
      skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT UNIQUE NOT NULL,
      description TEXT, -- Added for more context
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  CREATE INDEX idx_skills_skill_name ON Skills(skill_name);
  ```

### 2.2. Relationship and Junction Tables

These tables establish the connections between interview types, skills, interviews, and questions.

- **`Interviews` Table (Modification)**:
  The existing `Interviews` table will continue to link to `Interview_Types`.

  ```sql
  CREATE TABLE Interviews (
      interview_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled', 'error')),
      interview_type_id INTEGER, -- Foreign Key to Interview_Types
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (interview_type_id) REFERENCES Interview_Types(interview_type_id) ON DELETE SET NULL
  );
  -- Existing indexes: idx_interviews_user_id, idx_interviews_status
  CREATE INDEX idx_interviews_interview_type_id ON Interviews(interview_type_id);
  ```

- **`Interview_Skills` Junction Table**: Links specific interview instances to multiple skills (Many-to-Many).

  ```sql
  CREATE TABLE Interview_Skills (
      interview_id TEXT NOT NULL,
      skill_id INTEGER NOT NULL,
      PRIMARY KEY (interview_id, skill_id),
      FOREIGN KEY (interview_id) REFERENCES Interviews(interview_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
  );
  CREATE INDEX idx_interview_skills_interview_id ON Interview_Skills(interview_id);
  CREATE INDEX idx_interview_skills_skill_id ON Interview_Skills(skill_id);
  ```

- **`Questions` Table (Relationship to Skills)**:
  The existing `Questions` table links a question to a primary skill.

  ```sql
  CREATE TABLE Questions (
      question_id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER, -- Foreign Key to Skills (can be primary skill)
      question_text TEXT NOT NULL,
      difficulty_level TEXT CHECK(difficulty_level IN ('easy', 'medium', 'hard')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE SET NULL
  );
  CREATE INDEX idx_questions_skill_id ON Questions(skill_id);
  ```

  _Consideration for future_: A `Question_Associated_Skills` junction table could allow a single question to be tagged with multiple skills if needed, beyond a single primary `skill_id`.

- **`Interview_Type_Suggested_Skills` Junction Table (NEW)**: Links interview types to commonly associated skills to improve UX by providing suggestions (Many-to-Many).
  ```sql
  CREATE TABLE Interview_Type_Suggested_Skills (
      interview_type_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      PRIMARY KEY (interview_type_id, skill_id),
      FOREIGN KEY (interview_type_id) REFERENCES Interview_Types(interview_type_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
  );
  CREATE INDEX idx_itss_interview_type_id ON Interview_Type_Suggested_Skills(interview_type_id);
  CREATE INDEX idx_itss_skill_id ON Interview_Type_Suggested_Skills(skill_id);
  ```

### 2.3. Updated Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    Users ||--o{ Interviews : "conducts"

    Interview_Types ||--o{ Interviews : "categorizes"
    Interview_Types ||--o{ Interview_Type_Suggested_Skills : "suggests"

    Skills ||--o{ Interview_Skills : "is_skill_for_interview"
    Skills ||--o{ Questions : "relates_to_question"
    Skills ||--o{ Interview_Type_Suggested_Skills : "is_suggested_for_type"

    Interviews ||--o{ Interview_Skills : "focuses_on"
    Interviews ||--o{ Messages : "contains"
    Interviews ||--o{ Interview_Questions : "includes"

    Users {
        TEXT user_id PK
        TEXT username UK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    Interview_Types {
        INTEGER interview_type_id PK
        TEXT type_name UK
        TEXT description
        TIMESTAMP created_at
    }
    Interviews {
        TEXT interview_id PK
        TEXT user_id FK
        TEXT title
        TEXT status
        INTEGER interview_type_id FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP started_at
        TIMESTAMP completed_at
    }
    Skills {
        INTEGER skill_id PK
        TEXT skill_name UK
        TEXT description
        TIMESTAMP created_at
    }
    Interview_Skills {
        TEXT interview_id PK FK
        INTEGER skill_id PK FK
    }
    Interview_Type_Suggested_Skills {
        INTEGER interview_type_id PK FK
        INTEGER skill_id PK FK
    }
    Questions {
        INTEGER question_id PK
        INTEGER skill_id FK
        TEXT question_text
        TEXT difficulty_level
        TIMESTAMP created_at
    }
    Messages {
        TEXT message_id PK
        TEXT interview_id FK
        TEXT user_id FK
        TEXT role
        TEXT content
        TIMESTAMP timestamp
        TEXT audio_url
        TEXT processing_status
        TIMESTAMP created_at
    }
    Interview_Questions {
        TEXT interview_question_id PK
        TEXT interview_id FK
        INTEGER question_bank_id FK
        TEXT question_text_snapshot
        INTEGER order_in_interview
        TIMESTAMP timestamp_asked
        TEXT ai_question_message_id FK UK
        TEXT user_answer_message_id FK UK
        TIMESTAMP created_at
    }
```

## 3. Architectural Approach for Application Usage

### 3.1. Data Access Layer ([`src/services/InterviewDatabaseService.ts`](./src/services/InterviewDatabaseService.ts:1))

The `InterviewDatabaseService` will be extended with functions to manage and query interview types and skills.

**New/Updated Functions:**

- `async getInterviewTypes(): Promise<InterviewType[]>`: Fetches all interview types.
- `async getInterviewTypeById(id: number): Promise<InterviewType | null>`: Fetches a single interview type.
- `async createInterviewType(name: string, description?: string): Promise<InterviewType>`
- `async getSkills(): Promise<Skill[]>`: Fetches all skills.
- `async getSkillById(id: number): Promise<Skill | null>`: Fetches a single skill.
- `async createSkill(name: string, description?: string): Promise<Skill>`
- `async getSuggestedSkillsForType(interviewTypeId: number): Promise<Skill[]>`: Fetches skills suggested for a given interview type via `Interview_Type_Suggested_Skills`.
- `async addSkillToInterview(interviewId: string, skillId: number): Promise<void>`: Adds a skill to an interview instance.
- `async removeSkillFromInterview(interviewId: string, skillId: number): Promise<void>`: Removes a skill from an interview instance.
- `async getSkillsForInterview(interviewId: string): Promise<Skill[]>`: Fetches skills associated with a specific interview instance.
- `async setInterviewTypeForInterview(interviewId: string, interviewTypeId: number): Promise<void>`: Updates the type of an interview instance.
- `async getQuestionsBySkillIds(skillIds: number[]): Promise<Question[]>`: Fetches questions from the bank based on a list of skill IDs.
- `async getQuestionsByInterviewTypeAndSkillIds(interviewTypeId: number | null, skillIds: number[]): Promise<Question[]>`: A more complex query that could fetch questions primarily by skills, and potentially refine or prioritize if an interview type also influences question selection (e.g., if questions were also tagged by type, or if type implies certain skill priorities).

### 3.2. Backend Logic Integration

- **Interview Creation/Management ([`src/routes/interview.ts`](./src/routes/interview.ts:1)):**

  - API endpoints for creating/updating interviews will accept `interview_type_id` and an array of `skill_ids`.
  - The route handlers will call the respective `InterviewDatabaseService` functions to store these associations.
  - Example: `POST /api/v1/interviews` body could include `{ title: "...", interview_type_id: 1, skill_ids: [1, 2, 3] }`.

- **Interview Durable Object ([`src/interview.ts`](./src/interview.ts:1)):**

  - May need to fetch and hold `interviewType` and `skills` as part of its state for the current session if this information is frequently used during the interview flow (e.g., for display or AI context).
  - Alternatively, `AIService` can fetch this on demand.

- **AI Service ([`src/services/AIService.ts`](./src/services/AIService.ts:1)):**
  - The `processLLMResponse` method will be enhanced:
    1.  Fetch the `interview_type_id` and associated `skill_ids` for the current `interviewId` using `InterviewDatabaseService`.
    2.  Retrieve the actual `InterviewType` name and `Skill` names.
    3.  Incorporate this information into the system prompt for the LLM. For example:
        `"You are an AI interviewer conducting a [Technical] interview. The candidate is being assessed on the following skills: [JavaScript, Problem Solving, Algorithms]. Ask relevant questions and provide feedback related to these areas."`
    4.  To select questions:
        - Call `InterviewDatabaseService.getQuestionsBySkillIds(skillIds)` to get a pool of relevant questions from the `Questions` table.
        - The AI can then apply its logic to choose an appropriate question from this pool based on difficulty, previous questions, etc.

### 3.3. Frontend Integration (as per [`docs/HONO_JSX_MIGRATION_PLAN.md`](./docs/HONO_JSX_MIGRATION_PLAN.md:1))

- **Dashboard/Interview Setup Page (e.g., `src/frontend/pages/DashboardPage.tsx` or a new `CreateInterviewPage.tsx`):**
  - **Fetch Data**: Client-side JavaScript will call new API endpoints to fetch available `InterviewTypes` and `Skills`.
  - **Selection UI**:
    - Display `InterviewTypes` in a dropdown or radio button group.
    - Display `Skills` in a multi-select checklist or tag input field.
    - When an `InterviewType` is selected, optionally fetch and highlight/pre-select suggested skills using `getSuggestedSkillsForType`.
  - **Submission**: Selected `interviewTypeId` and `skillIds` will be sent to the backend when creating or updating an interview.
- **Interview Page (e.g., `src/frontend/pages/InterviewPage.tsx`):**
  - Display the selected `InterviewType` and `Skills` for the current interview to provide context to the user.
  - This data would be fetched when the interview page loads.

## 4. Implementation Steps

1.  **D1 Schema Definition & Migration:**
    a. Create a new migration file (e.g., `migrations/000X_add_interview_types_skills.sql`) or update the initial schema file if it hasn't been applied yet.
    b. Include `CREATE TABLE` statements for `Interview_Types`, `Skills`, `Interview_Skills`, and `Interview_Type_Suggested_Skills`.
    c. Add necessary `ALTER TABLE` statements if modifying existing tables (e.g., adding `interview_type_id` to `Interviews` if not already present, though it is in the D1 plan).
    d. Define all foreign keys and indexes as specified in Section 2.
    e. Apply the migration using Wrangler:
    `bash

    # Local

    wrangler d1 execute perfect-pitch-db --local --file=./migrations/000X_add_interview_types_skills.sql

    # Remote

    wrangler d1 execute perfect-pitch-db --remote --file=./migrations/000X_add_interview_types_skills.sql
    `

2.  **Update Data Access Layer ([`src/services/InterviewDatabaseService.ts`](./src/services/InterviewDatabaseService.ts:1)):**
    a. Implement all new and updated functions listed in Section 3.1 for CRUD operations and querying related to types and skills.
    b. Write unit tests for these new database service methods.

3.  **Update Backend Logic:**
    a. Modify API route handlers in [`src/routes/interview.ts`](./src/routes/interview.ts:1) (and potentially [`src/index.ts`](./src/index.ts:1) if routes are defined there) to accept `interview_type_id` and `skill_ids` during interview creation/update.
    b. Update the `AIService` ([`src/services/AIService.ts`](./src/services/AIService.ts:1)) to fetch and utilize interview type and skills for prompt engineering and question selection logic as described in Section 3.2.
    c. Update the `Interview` Durable Object ([`src/interview.ts`](./src/interview.ts:1)) if it needs to be directly aware of or pass this information.

4.  **Update Frontend Components (Hono JSX):**
    a. Create new API client functions in the frontend to call the backend endpoints for fetching types/skills and for creating/updating interviews with this new data.
    b. In `src/frontend/pages/DashboardPage.tsx` (or a dedicated interview setup page):
    i. Implement UI elements (dropdowns, checklists) for selecting `InterviewType` and `Skills`.
    ii. Implement logic to fetch and display suggested skills when an interview type is selected.
    c. In `src/frontend/pages/InterviewPage.tsx`:
    i. Display the active interview's type and skills.

5.  **Initial Data Population (Seeding):**
    a. Create a SQL seeding script (e.g., `migrations/000Y_seed_initial_types_skills.sql`).
    b. Add `INSERT` statements for initial `Interview_Types` (e.g., "Technical", "Behavioral", "System Design").
    c. Add `INSERT` statements for initial `Skills` (e.g., "JavaScript", "Python", "Communication", "Problem Solving", "System Architecture").
    d. Add `INSERT` statements for `Interview_Type_Suggested_Skills` to link initial types with relevant skills.
    e. Run this script using `wrangler d1 execute`.

6.  **Testing:**
    a. **Unit Tests**: For `InterviewDatabaseService` methods and `AIService` logic.
    b. **Integration Tests**: For API endpoints handling interview creation/updates with types and skills. Test AI question selection based on these parameters.
    c. **End-to-End (E2E) Tests**: Simulate user flow:
    i. User selects an interview type and skills.
    ii. User starts an interview.
    iii. Verify AI asks questions relevant to the selected type/skills.
    iv. Verify the interview type/skills are displayed correctly.

## 5. Initial Data Population Strategy

A seeding script executed via a Wrangler migration is the recommended approach for populating initial data.

**Example Seed Data (`migrations/000Y_seed_initial_types_skills.sql`):**

```sql
-- Interview Types
INSERT INTO Interview_Types (type_name, description) VALUES
('Technical', 'Assesses technical knowledge and problem-solving abilities in a specific domain.'),
('Behavioral', 'Assesses soft skills, past experiences, and situational judgment.'),
('System Design', 'Focuses on designing complex systems and architectural trade-offs.'),
('Product Sense', 'Assesses understanding of product development, user needs, and market fit.');

-- Skills
INSERT INTO Skills (skill_name, description) VALUES
('JavaScript', 'Proficiency in JavaScript programming language and its ecosystem.'),
('Python', 'Proficiency in Python programming language and its ecosystem.'),
('Java', 'Proficiency in Java programming language and its ecosystem.'),
('Go', 'Proficiency in Go programming language and its ecosystem.'),
('Problem Solving', 'Ability to analyze problems and devise effective solutions.'),
('Communication', 'Ability to articulate thoughts clearly and effectively.'),
('Teamwork', 'Ability to collaborate effectively with others in a team setting.'),
('System Architecture', 'Knowledge of designing and implementing scalable and robust system architectures.'),
('Algorithms & Data Structures', 'Understanding of fundamental algorithms and data structures.'),
('Databases (SQL)', 'Knowledge of SQL and relational database concepts.'),
('Databases (NoSQL)', 'Knowledge of NoSQL database concepts and systems.'),
('API Design', 'Ability to design clean, efficient, and maintainable APIs.'),
('Leadership', 'Ability to guide, motivate, and manage individuals or teams.');

-- Suggested Skills for Interview Types (Example)
-- Assuming IDs are auto-incremented starting from 1
-- Technical (ID 1)
INSERT INTO Interview_Type_Suggested_Skills (interview_type_id, skill_id) VALUES
(1, 1), -- Technical -> JavaScript
(1, 2), -- Technical -> Python
(1, 5), -- Technical -> Problem Solving
(1, 9); -- Technical -> Algorithms & Data Structures

-- Behavioral (ID 2)
INSERT INTO Interview_Type_Suggested_Skills (interview_type_id, skill_id) VALUES
(2, 6), -- Behavioral -> Communication
(2, 7), -- Behavioral -> Teamwork
(2, 13);-- Behavioral -> Leadership

-- System Design (ID 3)
INSERT INTO Interview_Type_Suggested_Skills (interview_type_id, skill_id) VALUES
(3, 8), -- System Design -> System Architecture
(3, 10),-- System Design -> Databases (SQL)
(3, 11),-- System Design -> Databases (NoSQL)
(3, 12);-- System Design -> API Design
```

_(Note: Actual IDs in the seed script would need to correspond to the auto-incremented values after `Interview_Types` and `Skills` are populated, or use subqueries if SQLite version supports it in `wrangler d1 execute` context, otherwise manual ID mapping might be needed for this junction table seeding)._

## 6. Potential Challenges and Considerations

- **Data Consistency**:
  - Ensuring `skill_id` and `interview_type_id` exist when creating links in junction tables. Foreign key constraints are crucial.
  - Managing uniqueness for `type_name` and `skill_name`.
- **Impact on Existing Interviews**:
  - Existing interviews in the database will have `NULL` for `interview_type_id` and no entries in `Interview_Skills`.
  - **Strategy**: Allow these to remain `NULL`. Future enhancements could include a UI for users to retrospectively categorize old interviews. New interviews should ideally require selection.
- **Query Complexity and Performance**:
  - Fetching questions based on multiple skills, or combining type and skill criteria, could lead to complex SQL queries. Ensure proper indexing on all foreign keys and frequently queried columns.
  - The `getQuestionsByInterviewTypeAndSkillIds` function might require careful optimization.
- **UI/UX for Skill Selection**:
  - Presenting a potentially large list of skills in a user-friendly way (e.g., search, categories, pagination).
  - The `Interview_Type_Suggested_Skills` table aims to mitigate this by offering relevant defaults.
- **Scalability of Types and Skills Management**:
  - Currently, new types and skills would be added via migrations or direct database insertion.
  - A future admin interface might be needed if these lists become very dynamic or user-managed.
- **LLM Prompt Engineering**:
  - Effectively incorporating the interview type and skills into the LLM's system prompt to achieve the desired nuanced behavior (question style, focus areas) will require careful crafting and iteration.
- **Migration of `interview_skills` from old `InterviewDatabaseService`**:
  - The existing [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md:1) mentions `InterviewDatabaseService` already has a table `interview_skills`. If this table exists in the DO SQLite and contains data, a one-time data migration script from DO storage to D1 might be needed for this specific table, or a decision to start fresh for D1. The current D1 plan implies a fresh start. This plan assumes D1 is the new source of truth.
- **Alignment with Overall D1 "Start Fresh" Strategy**: This plan aligns with the broader strategy outlined in [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:365) to "start fresh" with D1 for new data. Therefore, any data in an old `interview_skills` table within Durable Object SQLite is considered out of scope for this migration. D1 will be the source of truth for all new `Interview_Skills` associations. If migration of historical `interview_skills` data is deemed necessary, it would require a separate, dedicated sub-project.
- **Transactionality**: For operations involving multiple table inserts (e.g., creating an interview and linking skills), ensure atomicity if possible, or handle partial failures gracefully. D1 supports transactions via `await env.DB.batch([...])` or `await env.DB.transaction(async (txn) => {...})`.

This plan provides a comprehensive approach to integrating interview types and skills into the Perfect Pitch platform using Cloudflare D1.
