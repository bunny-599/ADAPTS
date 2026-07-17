-- ==========================================
-- ADAPTS PostgreSQL DDL Schema Structure
-- ==========================================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS assessment_questions;
DROP TABLE IF EXISTS assessments;

-- Create assessments base table
CREATE TABLE assessments (
    id BIGSERIAL PRIMARY KEY,
    field VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    topic TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create assessment_questions mapping table
CREATE TABLE assessment_questions (
    assessment_id BIGINT NOT NULL,
    question TEXT NOT NULL,
    CONSTRAINT fk_assessment
        FOREIGN KEY(assessment_id) 
        REFERENCES assessments(id) 
        ON DELETE CASCADE
);

-- Add index on subject and field for faster historical analysis queries
CREATE INDEX idx_assessments_field ON assessments(field);
CREATE INDEX idx_assessments_subject ON assessments(subject);
CREATE INDEX idx_assessment_questions_id ON assessment_questions(assessment_id);
