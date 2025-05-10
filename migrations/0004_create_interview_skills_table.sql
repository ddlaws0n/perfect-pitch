-- Migration to create the Interview_Skills table
-- This table links specific interview instances to multiple skills (Many-to-Many).

CREATE TABLE Interview_Skills (
    interview_id TEXT NOT NULL,
    skill_id INTEGER NOT NULL,
    PRIMARY KEY (interview_id, skill_id),
    FOREIGN KEY (interview_id) REFERENCES Interviews(interview_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
);

-- Indexes to optimize queries
CREATE INDEX idx_interview_skills_interview_id ON Interview_Skills(interview_id);
CREATE INDEX idx_interview_skills_skill_id ON Interview_Skills(skill_id);
