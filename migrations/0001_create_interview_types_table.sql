-- Migration to create the Interview_Types table
-- This table stores predefined categories for interviews.

CREATE TABLE IF NOT EXISTS Interview_Types (
    interview_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index to optimize queries on type_name
CREATE INDEX IF NOT EXISTS idx_interview_types_type_name ON Interview_Types(type_name);
