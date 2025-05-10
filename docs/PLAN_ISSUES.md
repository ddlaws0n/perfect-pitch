# Planning Documents Review: Identified Issues and Clarifications

This document summarizes issues and points for clarification identified during a review of the planning documents in the `docs/` directory. The review focused on accuracy, feasibility, harmony, consistency, and redundancy across the following plans:

- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md)
- [`docs/LUCIA_AUTH_PLAN.md`](./LUCIA_AUTH_PLAN.md)
- [`docs/HONO_JSX_MIGRATION_PLAN.md`](./HONO_JSX_MIGRATION_PLAN.md)
- [`docs/TTS_INTEGRATION_PLAN.md`](./TTS_INTEGRATION_PLAN.md)
- [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1)
- [`docs/AI_PROMPT_ENHANCEMENT_PLAN.md`](./AI_PROMPT_ENHANCEMENT_PLAN.md)

Overall, the plans demonstrate good cohesion. The identified points are primarily for ensuring clarity and confirming dependencies.

## Issues and Clarifications

### 1. Definitive Schema for `Interview_Types` and `Skills` Tables

- **Affected Files & Sections**:
  - [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) (Section 3.2, definitions for `Interview_Types`, `Skills`, `Interview_Skills`)
  - [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) (Section 2.1, 2.2, definitions for `Interview_Types`, `Skills`, `Interview_Skills`)
- **Issue Description**:
  Both the main D1 database plan and the specific "Interview Types and Skills" plan define the `Interview_Types`, `Skills`, and `Interview_Skills` tables. The [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) provides a slightly more detailed and evolved version of these tables (e.g., adding `description` fields to `Interview_Types` and `Skills`, and specifying additional indexes). The `Interview_Type_Suggested_Skills` table is a net new addition from the latter plan.
- **Potential Conflict/Redundancy**: This presents a minor redundancy in schema definition.
- **Recommendation**:
  It should be explicitly stated that the schema definitions for `Interview_Types`, `Skills`, and `Interview_Skills` as detailed in [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) are to be considered the definitive versions, superseding the initial definitions for these specific tables in [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md). The remainder of the [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) (covering other tables and general D1 migration strategy) remains valid.

**RESOLVED (2025-05-10):** A note has been added to [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:51) (Section 3.2) clarifying that [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) is the definitive source for `Interview_Types`, `Skills`, and `Interview_Skills` schemas.

### 2. Migration of Existing Data from Durable Object SQLite

- **Affected Files & Sections**:
  - [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) (Section 3.6, regarding current DO SQLite usage)
  - [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) (Section 4.5 "Data Migration", Section 5 "Potential Challenges & Considerations")
  - [`docs/LUCIA_AUTH_PLAN.md`](./LUCIA_AUTH_PLAN.md) (Section 6.1 "Migration from Current Basic Auth")
  - [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) (Section 6.6, line 383, regarding old `interview_skills` table)
- **Issue Description**:
  The initial architecture ([`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)) uses SQLite within Durable Objects for data persistence. The [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) recommends a "start fresh" approach for new data in D1 due to the complexity of migrating sharded data from potentially many Durable Object instances. The [`docs/LUCIA_AUTH_PLAN.md`](./LUCIA_AUTH_PLAN.md) notes that existing users (identified by username cookies) will need to re-register under the new system, as there's no direct mapping to new `user_id`s. The [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:1) also acknowledges the D1 plan's "fresh start" approach concerning the old `interview_skills` table.
- **Potential Conflict/Redundancy**: This is not a direct conflict between plans but a significant operational consideration. The plans are consistent in recommending a "fresh start" for D1. However, the fate of any existing data within Durable Objects (interviews, messages, skills associations) needs to be explicitly addressed.
- **Recommendation**:
  **RESOLVED (2025-05-10):** Clarifying notes confirming the "start fresh" approach for D1 data and the out-of-scope nature of historical DO data migration have been added to:
  - [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:382) (Section 4.5)
  - [`docs/LUCIA_AUTH_PLAN.md`](./docs/LUCIA_AUTH_PLAN.md:248) (Section 6.1)
  - [`docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md`](./docs/INTERVIEW_TYPES_DB_MIGRATION_PLAN.md:384) (Section 6.6)
    Reiterate and confirm that the current scope of these migration plans is to use D1 for _new_ data only. Any migration of _existing_ data from Durable Object SQLite (including interviews, messages, and the old `interview_skills` table contents) is considered out of scope for these initial plans and would need to be addressed as a separate, dedicated sub-project if deemed necessary. This clarification will reinforce the "start fresh" strategy and manage expectations regarding historical data.

### 3. Pending Research Dependencies

- **Affected Files & Sections**:
  - [`docs/D1_DATABASE_PLAN.md`](./D1_DATABASE_PLAN.md) (Section 2, "Research & Best Practices")
  - [`docs/LUCIA_AUTH_PLAN.md`](./LUCIA_AUTH_PLAN.md) (Section 2, "Research (Action Required)")
  - [`docs/TTS_INTEGRATION_PLAN.md`](./TTS_INTEGRATION_PLAN.md) (Section 2, "Research: TTS Options for Cloudflare Workers")
  - [`docs/AI_PROMPT_ENHANCEMENT_PLAN.md`](./AI_PROMPT_ENHANCEMENT_PLAN.md) (Section 2, "Research: Advanced Prompt Engineering Techniques")
    **RESOLVED (2025-05-10):** A standardized note emphasizing the dependency on dedicated research phases has been added to the beginning of the research sections in the following documents:
  - [`docs/D1_DATABASE_PLAN.md`](./docs/D1_DATABASE_PLAN.md:17) (Section 2)
  - [`docs/LUCIA_AUTH_PLAN.md`](./docs/LUCIA_AUTH_PLAN.md:14) (Section 2)
  - [`docs/TTS_INTEGRATION_PLAN.md`](./docs/TTS_INTEGRATION_PLAN.md:11) (Section 2)
  - [`docs/AI_PROMPT_ENHANCEMENT_PLAN.md`](./docs/AI_PROMPT_ENHANCEMENT_PLAN.md:18) (Section 2)
- **Issue Description**:
  Several key planning documents explicitly state that a research phase (e.g., using MCP tools, manual investigation by the development team) could not be performed during the drafting of the plan or relies on general knowledge. These sections are marked as "Action Required" or note the limitations.
- **Potential Conflict/Redundancy**: This is not a conflict but highlights a critical prerequisite for the successful and optimal implementation of these plans. The feasibility, specific technical choices, and best practices detailed in these plans are contingent upon this pending research.
- **Recommendation**:
  Emphasize that the successful execution of the D1 database integration (especially best practices), Lucia Auth integration, TTS service selection and integration, and AI Prompt Enhancement strategies is dependent on dedicated research phases. These research tasks should be prioritized to validate assumptions, select the most suitable tools/techniques for the Cloudflare Workers environment, and refine the implementation details proposed in the plans.

## Conclusion

The reviewed plans provide a strong foundation for the next phases of development for 'Perfect Pitch'. Addressing these points of clarification will help ensure all stakeholders have a common understanding and that the development proceeds smoothly and consistently across different feature implementations.
