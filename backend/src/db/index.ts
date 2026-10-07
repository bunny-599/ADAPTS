import { Pool, PoolClient, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables: backend/.env takes highest priority, root .env fills in any gaps
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false });
dotenv.config();

export const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return {
        host: u.hostname,
        port: parseInt(u.port || '5432', 10),
        database: u.pathname.replace(/^\//, ''),
        user: u.username,
      };
    } catch {
      // fallback to standard env vars
    }
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'adaptive_assessment',
    user: process.env.DATABASE_USER || 'postgres',
  };
};

const isProduction = process.env.NODE_ENV === 'production';
const useSsl = process.env.DATABASE_SSL === 'true' || 
  (!!process.env.DATABASE_URL && process.env.DATABASE_SSL !== 'false' && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')) ||
  (isProduction && process.env.DATABASE_HOST !== 'localhost' && process.env.DATABASE_HOST !== '127.0.0.1');

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
      min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'adaptive_assessment',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
      min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error] Unexpected idle client error:', err.message);
});

let isDbAvailable = false;

export const isDatabaseAvailable = (): boolean => isDbAvailable;

/**
 * Executes a callback within a managed PostgreSQL ACID transaction.
 * Automatically BEGINs, COMMITs on success, or ROLLBACKs on error.
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!isDbAvailable) {
    throw new Error('Database is offline; transactions unavailable in in-memory mode.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      console.error('[PostgreSQL Transaction] Rollback error:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initializes and validates all database tables and indexes in strict dependency order.
 * Includes safe migrations for existing tables.
 */
export const initDatabase = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    try {
      // Pass 1: Create all base tables and their indexes
      await client.query(`
        -- 1. Users table (Authentication & RBAC)
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'student',
            elo_score INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        -- 2. Topics table
        CREATE TABLE IF NOT EXISTS topics (
            id SERIAL PRIMARY KEY,
            input TEXT NOT NULL,
            field VARCHAR(255),
            domain VARCHAR(255),
            topic VARCHAR(255),
            subtopics JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_topics_topic ON topics(topic);

        -- 3. Research Sessions & Knowledge
        CREATE TABLE IF NOT EXISTS research_sessions (
            id SERIAL PRIMARY KEY,
            topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
            topic_title VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS research_sources (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            domain VARCHAR(255) NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

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

        -- 4. Candidate Questions
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
            validation_status VARCHAR(50) DEFAULT 'UNVALIDATED',
            quality_score NUMERIC(4, 3),
            validation_issues JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_candidate_questions_topic_id ON candidate_questions(topic_id);
        CREATE INDEX IF NOT EXISTS idx_candidate_questions_status ON candidate_questions(validation_status);

        -- 5. Assessments & Joined Questions
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

        CREATE TABLE IF NOT EXISTS assessment_questions (
            id SERIAL PRIMARY KEY,
            assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES candidate_questions(id) ON DELETE CASCADE,
            question_order INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_assessment_question UNIQUE (assessment_id, question_id)
        );

        -- 6. Assessment Attempts & Responses
        CREATE TABLE IF NOT EXISTS assessment_attempts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON assessment_attempts(status);

        CREATE TABLE IF NOT EXISTS assessment_responses (
            id SERIAL PRIMARY KEY,
            attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES candidate_questions(id) ON DELETE CASCADE,
            answer TEXT,
            answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_attempt_question_response UNIQUE (attempt_id, question_id)
        );
        CREATE INDEX IF NOT EXISTS idx_assessment_responses_attempt_id ON assessment_responses(attempt_id);

        -- 7. Performance Analyses
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

        -- 8. Skill Profiles
        CREATE TABLE IF NOT EXISTS skill_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            skill VARCHAR(255) NOT NULL,
            score NUMERIC(4, 3) NOT NULL,
            confidence NUMERIC(4, 3) NOT NULL,
            status VARCHAR(50) NOT NULL,
            evaluated_questions INTEGER NOT NULL,
            correct_answers INTEGER NOT NULL,
            last_assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_topic_skill UNIQUE (topic_id, skill)
        );
        CREATE INDEX IF NOT EXISTS idx_skill_profiles_topic_id ON skill_profiles(topic_id);

        -- 9. Adaptive Runs
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

        -- 10. Skill History & Performance History
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
        CREATE INDEX IF NOT EXISTS idx_skill_history_topic ON skill_history(topic_id);

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
        CREATE INDEX IF NOT EXISTS idx_performance_history_topic ON assessment_performance_history(topic_id);

        -- 11. Answer Evaluations
        CREATE TABLE IF NOT EXISTS answer_evaluations (
            id SERIAL PRIMARY KEY,
            assessment_response_id INTEGER NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
            evaluation_status VARCHAR(50) NOT NULL,
            score NUMERIC(4, 3),
            correctness VARCHAR(50) NOT NULL,
            reasoning TEXT,
            strengths JSONB DEFAULT '[]'::jsonb,
            missing_concepts JSONB DEFAULT '[]'::jsonb,
            skill_evidence JSONB DEFAULT '[]'::jsonb,
            confidence NUMERIC(4, 3),
            evaluator_type VARCHAR(50) NOT NULL,
            model_name VARCHAR(100),
            evaluator_version VARCHAR(50) NOT NULL,
            prompt_version VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_response_evaluation UNIQUE (assessment_response_id)
        );

        -- 12. Coding Test Cases & Evaluations
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

        CREATE TABLE IF NOT EXISTS coding_evaluations (
            id SERIAL PRIMARY KEY,
            assessment_response_id INTEGER NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
            evaluation_status VARCHAR(50) NOT NULL,
            score NUMERIC(4, 3) NOT NULL,
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

        CREATE TABLE IF NOT EXISTS coding_test_results (
            id SERIAL PRIMARY KEY,
            coding_evaluation_id INTEGER NOT NULL REFERENCES coding_evaluations(id) ON DELETE CASCADE,
            test_case_id INTEGER,
            status VARCHAR(50) NOT NULL,
            actual_output TEXT,
            execution_time_ms INTEGER NOT NULL DEFAULT 0,
            is_hidden BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_coding_test_results_eval_id ON coding_test_results(coding_evaluation_id);

        -- 13. User Activity Logs & Tracing
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

        -- 14. Real User Notifications Table
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'system',
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      `);


      // Pass 2: Safe schema migrations — ALTER TABLE first, then indexes on new columns
      try {
        await client.query(`
          -- Safe Alterations for smooth schema evolution
          ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS elo_score INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS image_url TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(100);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS user_agent TEXT;

          ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
          ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 600;
          ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
          ALTER TABLE skill_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
          ALTER TABLE assessment_performance_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
          ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
        `);
      } catch (pass2Error: any) {
        console.warn('[Database Init] Migration Pass 2 notice:', pass2Error.message);
      }

      // Pass 3: Indexes on migrated columns (must be after ALTER TABLE commits)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
          CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_id ON assessment_attempts(user_id);
          CREATE INDEX IF NOT EXISTS idx_skill_profiles_user_id ON skill_profiles(user_id);
          CREATE INDEX IF NOT EXISTS idx_skill_history_user_topic ON skill_history(user_id, topic_id);
          CREATE INDEX IF NOT EXISTS idx_performance_history_user_topic ON assessment_performance_history(user_id, topic_id);
        `);
      } catch (pass3Error: any) {
        console.warn('[Database Init] Migration Pass 3 notice:', pass3Error.message);
      }

      // Pass 4: Safe auto-repair for assessments and performance history
      try {
        await client.query(`
          -- Link any assessment with null topic_id to the most relevant or recent topic
          UPDATE assessments a
          SET topic_id = (SELECT id FROM topics ORDER BY id DESC LIMIT 1)
          WHERE a.topic_id IS NULL AND EXISTS (SELECT 1 FROM topics);

          -- Fix performance history where topic_id defaulted to 1 when a Java topic exists
          UPDATE assessment_performance_history h
          SET topic_id = (SELECT id FROM topics WHERE topic ILIKE '%Java%' ORDER BY id DESC LIMIT 1)
          WHERE (h.topic_id = 1 OR h.topic_id IS NULL)
            AND EXISTS (SELECT 1 FROM topics WHERE topic ILIKE '%Java%');
        `);
      } catch (pass4Error: any) {
        console.warn('[Database Init] Migration Pass 4 notice:', pass4Error.message);
      }

      return true;

    } finally {
      client.release();
    }
  } catch (error) {
    console.warn('[Database Init] Initialization warning:', error);
    return false;
  }
};

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    client.release();
    const initialized = await initDatabase();
    isDbAvailable = initialized;
    return initialized;
  } catch (error) {
    isDbAvailable = false;
    return false;
  }
};

export { PoolClient };
