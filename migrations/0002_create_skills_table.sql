-- Migration to create the Skills table
-- This table stores individual skills that can be assessed.

CREATE TABLE IF NOT EXISTS Skills (
    skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT UNIQUE NOT NULL,
    description TEXT, -- Added for more context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index to optimize queries on skill_name
CREATE INDEX IF NOT EXISTS idx_skills_skill_name ON Skills(skill_name);
