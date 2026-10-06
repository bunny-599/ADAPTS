-- PostgreSQL Schema for Adaptive Assessment Platform (Production Grade)

-- Users table (Authentication & Authorization with Clerk Integration)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL DEFAULT 'clerk_authenticated',
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student', -- 'student', 'instructor', 'admin'
    elo_score INTEGER NOT NULL DEFAULT 0,
    clerk_user_id VARCHAR(255) UNIQUE,
    image_url TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    last_ip VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);

-- Topics table (Trial 1 & 2)
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    input TEXT NOT NULL,
    field VARCHAR(255),
    domain VARCHAR(255),
    topic VARCHAR(255),
    subtopics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Research Sessions table (Trial 4)
CREATE TABLE IF NOT EXISTS research_sessions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    topic_title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sources table (Trial 4)
CREATE TABLE IF NOT EXISTS research_sources (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Items table (Trial 4)
CREATE TABLE IF NOT EXISTS research_knowledge_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    source_id INTEGER REFERENCES research_sources(id) ON DELETE SET NULL,
    concept VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    subtopic VARCHAR(255),
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Candidate Questions table (Trial 5 & 6)
CREATE TABLE IF NOT EXISTS candidate_questions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    research_session_id INTEGER REFERENCES research_sessions(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    difficulty NUMERIC(4, 3) NOT NULL,
    concept VARCHAR(255) NOT NULL,
    subtopic VARCHAR(255) NOT NULL,
    skills JSONB,
    cognitive_level VARCHAR(50) NOT NULL,
    source_references JSONB,
    code_snippet TEXT,
    scenario_text TEXT,
    validation_status VARCHAR(50) DEFAULT 'UNVALIDATED', -- VALID, FLAGGED, INVALID, UNVALIDATED
    quality_score NUMERIC(4, 3),
    validation_issues JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assessments table (Trial 7)
CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    target_question_count INTEGER NOT NULL,
    target_difficulty NUMERIC(4, 3) NOT NULL,
    fitness_score NUMERIC(4, 3) NOT NULL,
    fitness_breakdown JSONB NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assessment Question Join Table (Trial 7)
CREATE TABLE IF NOT EXISTS assessment_questions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES candidate_questions(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_assessment_question UNIQUE (assessment_id, question_id)
);

-- Assessment Attempts table (Trial 8)
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL DEFAULT 600,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'timed_out'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_id ON assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON assessment_attempts(status);

-- Assessment Responses table (Trial 8)
CREATE TABLE IF NOT EXISTS assessment_responses (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES candidate_questions(id) ON DELETE CASCADE,
    answer TEXT,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attempt_question_response UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_attempt_id ON assessment_responses(attempt_id);

-- Performance Analyses table (Trial 9)
CREATE TABLE IF NOT EXISTS performance_analyses (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    overall_score NUMERIC(4, 3),
    accuracy NUMERIC(4, 3) NOT NULL,
    completion_rate NUMERIC(4, 3) NOT NULL,
    total_questions INTEGER NOT NULL,
    answered_questions INTEGER NOT NULL,
    evaluated_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    unanswered_questions INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    type_breakdown JSONB NOT NULL,
    subtopic_breakdown JSONB NOT NULL,
    skill_breakdown JSONB NOT NULL,
    cognitive_breakdown JSONB NOT NULL,
    difficulty_breakdown JSONB NOT NULL,
    strengths JSONB NOT NULL,
    weaknesses JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attempt_analysis UNIQUE (attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_performance_analyses_attempt_id ON performance_analyses(attempt_id);

-- Skill Profiles table (Trial 9)
CREATE TABLE IF NOT EXISTS skill_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    score NUMERIC(4, 3) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'strong', 'developing', 'weak', 'insufficient_evidence'
    evaluated_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    last_assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_topic_skill UNIQUE (topic_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_skill_profiles_user_id ON skill_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_profiles_topic_id ON skill_profiles(topic_id);

-- Adaptive Assessment Runs table (Trial 10)
CREATE TABLE IF NOT EXISTS adaptive_assessment_runs (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    previous_attempt_id INTEGER REFERENCES assessment_attempts(id) ON DELETE SET NULL,
    generated_assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    target_difficulty NUMERIC(4, 3) NOT NULL,
    skill_targets JSONB NOT NULL,
    question_type_targets JSONB NOT NULL,
    cognitive_targets JSONB NOT NULL,
    reasoning JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adaptive_runs_topic_id ON adaptive_assessment_runs(topic_id);

-- Skill History table (Trial 11 - Append Only)
CREATE TABLE IF NOT EXISTS skill_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    score NUMERIC(4, 3) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    evidence_count INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_history_user_topic ON skill_history(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_skill_history_topic_id ON skill_history(topic_id);

-- Assessment Performance History table (Trial 11 - Append Only)
CREATE TABLE IF NOT EXISTS assessment_performance_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    overall_accuracy NUMERIC(4, 3) NOT NULL,
    completion_rate NUMERIC(4, 3) NOT NULL,
    evaluated_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    average_difficulty NUMERIC(4, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attempt_performance_history UNIQUE (attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_performance_history_user_topic ON assessment_performance_history(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_topic_id ON assessment_performance_history(topic_id);

-- Answer Evaluations table (Trial 12)
CREATE TABLE IF NOT EXISTS answer_evaluations (
    id SERIAL PRIMARY KEY,
    assessment_response_id INTEGER NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
    evaluation_status VARCHAR(50) NOT NULL, -- 'evaluated', 'not_evaluable', 'evaluator_error'
    score NUMERIC(4, 3), -- 0.0 to 1.0, null if error/not_evaluable
    correctness VARCHAR(50) NOT NULL, -- 'correct', 'mostly_correct', 'partially_correct', 'incorrect', 'not_evaluable', 'evaluator_error'
    reasoning TEXT,
    strengths JSONB DEFAULT '[]'::jsonb,
    missing_concepts JSONB DEFAULT '[]'::jsonb,
    skill_evidence JSONB DEFAULT '[]'::jsonb,
    confidence NUMERIC(4, 3),
    evaluator_type VARCHAR(50) NOT NULL, -- 'deterministic', 'llm'
    model_name VARCHAR(100),
    evaluator_version VARCHAR(50) NOT NULL,
    prompt_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_response_evaluation UNIQUE (assessment_response_id)
);

-- Coding Test Cases table (Trial 13)
CREATE TABLE IF NOT EXISTS coding_test_cases (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES candidate_questions(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    test_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coding_test_cases_question_id ON coding_test_cases(question_id);

-- Coding Evaluations table (Trial 13)
CREATE TABLE IF NOT EXISTS coding_evaluations (
    id SERIAL PRIMARY KEY,
    assessment_response_id INTEGER NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
    evaluation_status VARCHAR(50) NOT NULL, -- 'completed', 'compilation_error', 'runtime_error', 'timeout', 'memory_limit', 'output_limit', 'sandbox_error'
    score NUMERIC(4, 3) NOT NULL, -- 0.0 to 1.0
    passed_tests INTEGER NOT NULL DEFAULT 0,
    total_tests INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    memory_used_mb NUMERIC(6, 2) NOT NULL DEFAULT 0,
    compiler_output TEXT,
    runtime_output TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_response_coding_evaluation UNIQUE (assessment_response_id)
);

CREATE INDEX IF NOT EXISTS idx_coding_evaluations_response_id ON coding_evaluations(assessment_response_id);

-- Coding Test Results table (Trial 13)
CREATE TABLE IF NOT EXISTS coding_test_results (
    id SERIAL PRIMARY KEY,
    coding_evaluation_id INTEGER NOT NULL REFERENCES coding_evaluations(id) ON DELETE CASCADE,
    test_case_id INTEGER,
    status VARCHAR(50) NOT NULL, -- 'passed', 'failed', 'timeout', 'runtime_error'
    actual_output TEXT,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coding_test_results_eval_id ON coding_test_results(coding_evaluation_id);

-- User Activity Logs & Tracing
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_logs(user_id);

-- Real User Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
