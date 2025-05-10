-- Migration script to create the Users table
-- This table stores user authentication and profile information.

CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,                            -- Unique identifier for the user (e.g., UUID, Lucia Auth compatible ID)
    username TEXT UNIQUE NOT NULL,                  -- User's chosen username, must be unique
    email TEXT UNIQUE NOT NULL,                     -- User's email address, must be unique
    hashed_password TEXT NOT NULL,                  -- Hashed password for authentication
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- Timestamp of when the user was created
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL  -- Timestamp of when the user was last updated (managed by application)
);

-- Indexes are automatically created for PRIMARY KEY (id) and UNIQUE constraints (username, email).
-- Additional indexes can be added if specific query patterns require them.

-- TDD Anchor: Test user creation with valid data
-- TDD Anchor: Test user creation fails with duplicate username
-- TDD Anchor: Test user creation fails with duplicate email
-- TDD Anchor: Test user retrieval by id
-- TDD Anchor: Test user retrieval by username
-- TDD Anchor: Test user retrieval by email
-- TDD Anchor: Test password verification (requires application logic)
-- TDD Anchor: Test updating user details also updates 'updated_at' (requires application logic)
