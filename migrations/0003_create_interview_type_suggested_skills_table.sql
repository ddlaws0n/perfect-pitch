-- Migration to create the Interview_Type_Suggested_Skills table
-- This table links interview types to commonly associated skills to improve UX by providing suggestions.

CREATE TABLE Interview_Type_Suggested_Skills (
    interview_type_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    PRIMARY KEY (interview_type_id, skill_id),
    FOREIGN KEY (interview_type_id) REFERENCES Interview_Types(interview_type_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
);

-- Indexes to optimize queries
CREATE INDEX idx_itss_interview_type_id ON Interview_Type_Suggested_Skills(interview_type_id);
CREATE INDEX idx_itss_skill_id ON Interview_Type_Suggested_Skills(skill_id);
