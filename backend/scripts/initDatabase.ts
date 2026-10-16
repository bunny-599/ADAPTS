import dotenv from 'dotenv';
import path from 'path';

// 1. Load environment variables with proper precedence
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });
dotenv.config();

import { pool, initDatabase, getDatabaseConfig } from '../src/db';

async function run() {
  console.log('====================================================');
  console.log('   ADAPTS PostgreSQL Database Initialization Tool   ');
  console.log('====================================================');

  const config = getDatabaseConfig();
  const isNeon = !!process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('pooler'));

  console.log(`[Target Environment] Provider: ${isNeon ? 'Neon PostgreSQL' : 'PostgreSQL'}`);
  console.log(`[Target Host]        ${config.host}`);
  console.log(`[Target Port]        ${config.port}`);
  console.log(`[Target Database]    ${config.database}`);
  console.log(`[Target User]        ${config.user}`);
  console.log('----------------------------------------------------');

  try {
    console.log('[1/3] Connecting to database...');
    const client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL cluster.');
    client.release();

    console.log('[2/3] Executing schema creation and migration passes...');
    const success = await initDatabase();
    if (!success) {
      throw new Error('Database initialization failed during DDL execution.');
    }
    console.log('✓ All base tables, constraints, foreign keys, and indexes executed successfully.');

    console.log('[3/3] Verifying table catalog in public schema...');
    const verificationRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    const existingTables = new Set(verificationRes.rows.map((r: { table_name: string }) => r.table_name));

    const requiredTables = [
      'users',
      'topics',
      'research_sessions',
      'research_sources',
      'research_knowledge_items',
      'candidate_questions',
      'assessments',
      'assessment_questions',
      'assessment_attempts',
      'assessment_responses',
      'performance_analyses',
      'skill_profiles',
      'adaptive_assessment_runs',
      'skill_history',
      'assessment_performance_history',
      'answer_evaluations',
      'coding_test_cases',
      'coding_evaluations',
      'coding_test_results',
      'user_activity_logs',
      'notifications',
    ];

    let missingCount = 0;
    console.log('\nTable Verification Checklist:');
    for (const table of requiredTables) {
      if (existingTables.has(table)) {
        console.log(`  ✓ ${table}`);
      } else {
        console.log(`  ✗ MISSING: ${table}`);
        missingCount++;
      }
    }

    if (missingCount > 0) {
      throw new Error(`Initialization incomplete: ${missingCount} required table(s) missing from public schema.`);
    }

    console.log('\n====================================================');
    console.log(`✓ Neon PostgreSQL initialization completed successfully!`);
    console.log(`  All ${requiredTables.length} tables and associated indexes are ready.`);
    console.log('====================================================\n');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Database initialization failed:', error.message);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

run();
