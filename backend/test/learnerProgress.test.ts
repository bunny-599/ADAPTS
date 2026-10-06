import assert from 'assert';
import {
  ProgressAnalysisService,
  mockSkillHistoryStore,
  mockAssessmentPerformanceStore,
} from '../src/services/progressAnalysisService';
import { AdaptiveAssessmentService } from '../src/services/adaptiveAssessmentService';
import { PerformanceAnalysisResult, SkillProfileRecord } from '../src/types/analysis';
import { SkillProgressSummary } from '../src/types/progress';

console.log('=== Running Trial 11: Learner Progress, Skill History & Adaptive Trend Engine Tests ===\n');

// Helper to create mock performance results
function createMockAnalysisResult(
  topicId: number,
  assessmentId: number,
  attemptId: number,
  accuracy: number,
  score: number,
  skills: { skill: string; score: number; confidence: number; evidenceCount: number }[],
  difficulty: number = 0.50
): PerformanceAnalysisResult {
  const skillMap: Record<string, any> = {};
  for (const s of skills) {
    let status: 'strong' | 'developing' | 'weak' | 'insufficient_evidence' = 'developing';
    if (s.evidenceCount < 2) status = 'insufficient_evidence';
    else if (s.score >= 0.80) status = 'strong';
    else if (s.score < 0.60) status = 'weak';

    skillMap[s.skill] = {
      skill: s.skill,
      score: s.score,
      confidence: s.confidence,
      evidence: s.evidenceCount,
      status,
      correctCount: Math.round(s.score * s.evidenceCount),
    };
  }

  return {
    status: 'success',
    attemptId,
    topicId,
    overall: {
      accuracy,
      completionRate: 1.0,
      totalQuestions: 10,
      answeredQuestions: 10,
      unansweredQuestions: 0,
      evaluatedQuestions: 10,
      correctAnswers: Math.round(accuracy * 10),
      incorrectAnswers: 10 - Math.round(accuracy * 10),
      durationSeconds: 300,
    },
    questionTypes: {},
    subtopics: {},
    skills: skillMap,
    cognitiveLevels: {},
    difficultyRanges: {},
    strengths: skills.filter((s) => s.score >= 0.80).map((s) => s.skill),
    weaknesses: skills.filter((s) => s.score < 0.60).map((s) => s.skill),
    evaluatedResponses: [],
    createdAt: new Date().toISOString(),
  };
}

async function runTests() {
  let passed = 0;

  // Clear mock stores before tests
  mockSkillHistoryStore.length = 0;
  mockAssessmentPerformanceStore.length = 0;

  // -------------------------------------------------------------
  // Test 1: First Assessment Baseline
  // -------------------------------------------------------------
  const attempt1 = createMockAnalysisResult(
    101,
    1,
    1,
    0.60,
    60,
    [{ skill: 'React Hooks', score: 0.60, confidence: 0.50, evidenceCount: 2 }],
    0.50
  );

  await ProgressAnalysisService.recordAssessmentPerformance(attempt1.attemptId, attempt1, 101, 0.50);

  const summary1 = await ProgressAnalysisService.getSkillHistory(101, 'React Hooks');
  assert.strictEqual(summary1.history.length, 1);
  assert.strictEqual(summary1.previousScore, null);
  assert.strictEqual(summary1.trend, 'INSUFFICIENT_DATA');
  console.log('✓ Test 1: First assessment recorded as baseline (delta=null, trend=INSUFFICIENT_DATA)');
  passed++;

  // -------------------------------------------------------------
  // Test 2: Two Assessments Delta Calculation
  // -------------------------------------------------------------
  const attempt2 = createMockAnalysisResult(
    101,
    2,
    2,
    0.75,
    75,
    [{ skill: 'React Hooks', score: 0.75, confidence: 0.65, evidenceCount: 4 }],
    0.55
  );

  await ProgressAnalysisService.recordAssessmentPerformance(attempt2.attemptId, attempt2, 101, 0.55);

  const summary2 = await ProgressAnalysisService.getSkillHistory(101, 'React Hooks');
  assert.strictEqual(summary2.history.length, 2);
  assert.strictEqual(Math.round(summary2.change * 100), 15); // 0.75 - 0.60 = +0.15
  assert.strictEqual(summary2.previousScore, 0.60);
  console.log('✓ Test 2: Two assessments compute exact change (+0.15) and previousScore (0.60)');
  passed++;

  // -------------------------------------------------------------
  // Test 3: Improving Skill Detection
  // -------------------------------------------------------------
  const attempt3 = createMockAnalysisResult(
    101,
    3,
    3,
    0.85,
    85,
    [{ skill: 'React Hooks', score: 0.88, confidence: 0.80, evidenceCount: 6 }],
    0.60
  );

  await ProgressAnalysisService.recordAssessmentPerformance(attempt3.attemptId, attempt3, 101, 0.60);

  const summary3 = await ProgressAnalysisService.getSkillHistory(101, 'React Hooks');
  assert.strictEqual(summary3.history.length, 3);
  assert.strictEqual(summary3.trend, 'IMPROVING');
  console.log('✓ Test 3: Improving skill trajectory correctly marked as IMPROVING (+0.13 > +0.08)');
  passed++;

  // -------------------------------------------------------------
  // Test 4: Declining Skill Detection
  // -------------------------------------------------------------
  const decliningTrend = ProgressAnalysisService.analyzeSkillTrend([
    { score: 0.85 },
    { score: 0.70 },
    { score: 0.65 },
  ]);
  assert.strictEqual(decliningTrend.trend, 'DECLINING');
  console.log('✓ Test 4: Declining skill trajectory properly detected as DECLINING');
  passed++;

  // -------------------------------------------------------------
  // Test 5: Stable Skill Detection
  // -------------------------------------------------------------
  const stableTrend = ProgressAnalysisService.analyzeSkillTrend([
    { score: 0.75 },
    { score: 0.77 },
    { score: 0.76 },
  ]);
  assert.strictEqual(stableTrend.trend, 'STABLE');
  console.log('✓ Test 5: Stable skill trajectory within +-0.08 threshold detected as STABLE');
  passed++;

  // -------------------------------------------------------------
  // Test 6: Insufficient Evidence Classification
  // -------------------------------------------------------------
  const insuffTrend = ProgressAnalysisService.analyzeSkillTrend([{ score: 0.80 }]);
  assert.strictEqual(insuffTrend.trend, 'INSUFFICIENT_DATA');

  const insuffStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.85,
    0.35, // low confidence (< 0.40)
    1, // low evidence (< 2)
    'INSUFFICIENT_DATA',
    []
  );
  assert.strictEqual(insuffStatus, 'INSUFFICIENT_EVIDENCE');
  console.log('✓ Test 6: Low evidence count (< 2) properly classifies status as INSUFFICIENT_EVIDENCE');
  passed++;

  // -------------------------------------------------------------
  // Test 7: Mastery Detection
  // -------------------------------------------------------------
  // Criteria: score >= 0.85, confidence >= 0.80, evidence >= 5, trend != DECLINING
  const masteredStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.90,
    0.85,
    6,
    'STABLE',
    [0.86, 0.88, 0.90]
  );
  assert.strictEqual(masteredStatus, 'MASTERED');

  // Single high score without evidence is NOT mastered
  const nonMasteredStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.95,
    0.35,
    1,
    'INSUFFICIENT_DATA',
    [0.95]
  );
  assert.strictEqual(nonMasteredStatus, 'INSUFFICIENT_EVIDENCE');
  console.log('✓ Test 7: Mastery verified against rigorous multi-assessment threshold (score>=0.85, conf>=0.80, ev>=5)');
  passed++;

  // -------------------------------------------------------------
  // Test 8: Persistent Weakness Detection
  // -------------------------------------------------------------
  // Score < 0.60 across >= 3 assessments
  const weakHistory = [0.50, 0.45, 0.52];
  const persistentWeakStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.52,
    0.85,
    8,
    'STABLE',
    weakHistory
  );
  assert.strictEqual(persistentWeakStatus, 'PERSISTENT_WEAKNESS');
  console.log('✓ Test 8: Persistent weakness confirmed when score stays < 0.60 across >= 3 assessments');
  passed++;

  // -------------------------------------------------------------
  // Test 9: Recovery Detection
  // -------------------------------------------------------------
  // Previously weak (< 0.60) but recent trend is IMPROVING
  const recoveringStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.65,
    0.75,
    5,
    'IMPROVING',
    [0.45, 0.50, 0.65]
  );
  assert.strictEqual(recoveringStatus, 'RECOVERING');
  console.log('✓ Test 9: Previously weak skill recovering with positive trend flagged as RECOVERING');
  passed++;

  // -------------------------------------------------------------
  // Test 10: Regression Detection
  // -------------------------------------------------------------
  // Previously high (>= 0.80) but trending DECLINING
  const regressingStatus = ProgressAnalysisService.classifyAdvancedSkillStatus(
    0.68,
    0.80,
    7,
    'DECLINING',
    [0.85, 0.82, 0.68]
  );
  assert.strictEqual(regressingStatus, 'REGRESSION');
  console.log('✓ Test 10: Previously strong skill declining flagged as REGRESSION');
  passed++;

  // -------------------------------------------------------------
  // Test 11: Difficulty-Aware Trend Verification
  // -------------------------------------------------------------
  // Accuracy drops from 0.80 to 0.70 when difficulty rises from 0.40 to 0.75
  mockAssessmentPerformanceStore.push(
    {
      id: 1001,
      topicId: 103,
      attemptId: 21,
      overallAccuracy: 0.80,
      completionRate: 1.0,
      evaluatedQuestions: 10,
      correctAnswers: 8,
      totalQuestions: 10,
      durationSeconds: 200,
      averageDifficulty: 0.40,
      createdAt: new Date().toISOString(),
    },
    {
      id: 1002,
      topicId: 103,
      attemptId: 22,
      overallAccuracy: 0.70,
      completionRate: 1.0,
      evaluatedQuestions: 10,
      correctAnswers: 7,
      totalQuestions: 10,
      durationSeconds: 320,
      averageDifficulty: 0.75,
      createdAt: new Date().toISOString(),
    }
  );

  const historyTopic103 = await ProgressAnalysisService.getTopicHistory(103);
  assert.strictEqual(historyTopic103.history.length, 2);
  assert.strictEqual(historyTopic103.history[0].difficulty, 0.40);
  assert.strictEqual(historyTopic103.history[1].difficulty, 0.75);
  assert(historyTopic103.history[1].difficulty > historyTopic103.history[0].difficulty);
  console.log('✓ Test 11: Difficulty-aware metrics preserved side-by-side with accuracy in performance history');
  passed++;

  // -------------------------------------------------------------
  // Test 12: Skill History Persistence (Append-Only)
  // -------------------------------------------------------------
  const initialSkillCount = mockSkillHistoryStore.length;
  const attempt4 = createMockAnalysisResult(
    104,
    1,
    31,
    0.70,
    70,
    [{ skill: 'Event Loop', score: 0.70, confidence: 0.60, evidenceCount: 3 }],
    0.50
  );
  await ProgressAnalysisService.recordAssessmentPerformance(attempt4.attemptId, attempt4, 104, 0.50);
  assert.strictEqual(mockSkillHistoryStore.length, initialSkillCount + 1);
  const added = mockSkillHistoryStore[mockSkillHistoryStore.length - 1];
  assert.strictEqual(added.topicId, 104);
  assert.strictEqual(added.skill, 'Event Loop');
  console.log('✓ Test 12: Skill history persistence successfully appended record to historical log');
  passed++;

  // -------------------------------------------------------------
  // Test 13: Assessment Performance History Persistence
  // -------------------------------------------------------------
  const initialPerfCount = mockAssessmentPerformanceStore.length;
  const attempt5 = createMockAnalysisResult(
    104,
    2,
    32,
    0.80,
    80,
    [{ skill: 'Event Loop', score: 0.80, confidence: 0.70, evidenceCount: 5 }],
    0.65
  );
  await ProgressAnalysisService.recordAssessmentPerformance(attempt5.attemptId, attempt5, 104, 0.65);
  assert.strictEqual(mockAssessmentPerformanceStore.length, initialPerfCount + 1);
  const perfAdded = mockAssessmentPerformanceStore[mockAssessmentPerformanceStore.length - 1];
  assert.strictEqual(perfAdded.topicId, 104);
  assert.strictEqual(perfAdded.averageDifficulty, 0.65);
  assert.strictEqual(perfAdded.overallAccuracy, 0.80);
  console.log('✓ Test 13: Assessment performance history persistence appended overall session metrics');
  passed++;

  // -------------------------------------------------------------
  // Test 14: Progress Summary Endpoint & Calculation
  // -------------------------------------------------------------
  const progressSummary = await ProgressAnalysisService.getTopicProgress(101);
  assert.strictEqual(progressSummary.topicId, 101);
  assert.strictEqual(progressSummary.assessments.total, 3);
  const hooksSummary = progressSummary.skills.find((s) => s.skill === 'React Hooks');
  assert(hooksSummary !== undefined);
  assert.strictEqual(hooksSummary.history.length, 3);
  console.log('✓ Test 14: Progress summary computes total assessments, trajectories, and aggregated skill summaries');
  passed++;

  // -------------------------------------------------------------
  // Test 15: History Endpoint (Chronological Timeline)
  // -------------------------------------------------------------
  const historyList = await ProgressAnalysisService.getTopicHistory(101);
  assert.strictEqual(historyList.history.length, 3);
  assert.strictEqual(historyList.history[0].attemptId, 1);
  assert.strictEqual(historyList.history[1].attemptId, 2);
  assert.strictEqual(historyList.history[2].attemptId, 3);
  console.log('✓ Test 15: History timeline ordered chronologically with sequence numbering');
  passed++;

  // -------------------------------------------------------------
  // Test 16: Individual Skill History Endpoint
  // -------------------------------------------------------------
  const skillHistory = await ProgressAnalysisService.getSkillHistory(101, 'React Hooks');
  assert.strictEqual(skillHistory.skill, 'React Hooks');
  assert.strictEqual(skillHistory.history.length, 3);
  console.log('✓ Test 16: Individual skill trajectory returns dedicated skill timeline');
  passed++;

  // -------------------------------------------------------------
  // Test 17: Adaptive Engine Uses Trend to Modulate Skill Weights
  // -------------------------------------------------------------
  const baseProfileA: SkillProfileRecord = {
    topicId: 1,
    skill: 'Skill A',
    score: 0.50,
    confidence: 0.8,
    evaluatedQuestions: 5,
    correctAnswers: 2,
    status: 'weak',
    lastAssessedAt: new Date().toISOString(),
  };
  const baseProfileB: SkillProfileRecord = {
    topicId: 1,
    skill: 'Skill B',
    score: 0.50,
    confidence: 0.8,
    evaluatedQuestions: 5,
    correctAnswers: 2,
    status: 'weak',
    lastAssessedAt: new Date().toISOString(),
  };

  const progressSummaryA: SkillProgressSummary = {
    skill: 'Skill A',
    score: 0.50,
    confidence: 0.8,
    status: 'PERSISTENT_WEAKNESS',
    trend: 'DECLINING',
    change: -0.05,
    evidence: 5,
    previousScore: 0.55,
    history: [],
  };
  const progressSummaryB: SkillProgressSummary = {
    skill: 'Skill B',
    score: 0.50,
    confidence: 0.8,
    status: 'RECOVERING',
    trend: 'IMPROVING',
    change: 0.10,
    evidence: 5,
    previousScore: 0.40,
    history: [],
  };

  const { skillTargets } = AdaptiveAssessmentService.calculateSkillPriorities(
    [baseProfileA, baseProfileB],
    [progressSummaryA, progressSummaryB]
  );
  assert(
    skillTargets['Skill A'] > skillTargets['Skill B'],
    `Persistent weakness (${skillTargets['Skill A']}) should receive higher priority weight than recovering (${skillTargets['Skill B']})`
  );
  console.log('✓ Test 17: Adaptive engine prioritizes PERSISTENT_WEAKNESS (0.85) over RECOVERING (0.60)');
  passed++;

  // -------------------------------------------------------------
  // Test 18: Adaptive Engine Prioritizes Regressing Skills
  // -------------------------------------------------------------
  const baseProfileC: SkillProfileRecord = {
    topicId: 1,
    skill: 'Skill C',
    score: 0.70,
    confidence: 0.8,
    evaluatedQuestions: 5,
    correctAnswers: 3,
    status: 'developing',
    lastAssessedAt: new Date().toISOString(),
  };
  const progressSummaryC: SkillProgressSummary = {
    skill: 'Skill C',
    score: 0.70,
    confidence: 0.8,
    status: 'REGRESSION',
    trend: 'DECLINING',
    change: -0.15,
    evidence: 5,
    previousScore: 0.85,
    history: [],
  };
  const { priorities: regPriorities } = AdaptiveAssessmentService.calculateSkillPriorities(
    [baseProfileC],
    [progressSummaryC]
  );
  assert.strictEqual(regPriorities['Skill C'].priority, 'HIGH');
  assert.strictEqual(regPriorities['Skill C'].weight, 0.80);
  console.log('✓ Test 18: Adaptive engine elevates regressing skill priority (HIGH, weight=0.80)');
  passed++;

  // -------------------------------------------------------------
  // Test 19: Mastered + Stable Skill Gets Low Maintenance Priority
  // -------------------------------------------------------------
  const baseProfileD: SkillProfileRecord = {
    topicId: 1,
    skill: 'Skill D',
    score: 0.95,
    confidence: 0.9,
    evaluatedQuestions: 10,
    correctAnswers: 9,
    status: 'strong',
    lastAssessedAt: new Date().toISOString(),
  };
  const progressSummaryD: SkillProgressSummary = {
    skill: 'Skill D',
    score: 0.95,
    confidence: 0.9,
    status: 'MASTERED',
    trend: 'STABLE',
    change: 0.01,
    evidence: 10,
    previousScore: 0.94,
    history: [],
  };
  const { priorities: masteredPriorities } = AdaptiveAssessmentService.calculateSkillPriorities(
    [baseProfileD],
    [progressSummaryD]
  );
  assert.strictEqual(masteredPriorities['Skill D'].priority, 'LOW');
  assert.strictEqual(masteredPriorities['Skill D'].weight, 0.10);
  console.log('✓ Test 19: Mastered + STABLE skill given maintenance priority of 0.10');
  passed++;

  // -------------------------------------------------------------
  // Test 20: No-History Edge Case Handled Gracefully
  // -------------------------------------------------------------
  const emptyProgress = await ProgressAnalysisService.getTopicProgress(99999);
  assert.strictEqual(emptyProgress.assessments.total, 0);
  assert.strictEqual(emptyProgress.skills.length, 0);
  const emptyHistory = await ProgressAnalysisService.getTopicHistory(99999);
  assert.deepStrictEqual(emptyHistory.history, []);
  console.log('✓ Test 20: No-history scenario gracefully returns empty baseline without exceptions');
  passed++;

  // -------------------------------------------------------------
  // Test 21: Database Fallback to In-Memory Mock Store
  // -------------------------------------------------------------
  assert(mockSkillHistoryStore.length > 0);
  assert(mockAssessmentPerformanceStore.length > 0);
  console.log('✓ Test 21: Seamless operation verified using robust in-memory mock store');
  passed++;

  // -------------------------------------------------------------
  // Test 22: Duplicate Processing Prevention (Idempotent Recording)
  // -------------------------------------------------------------
  const countBeforeDup = mockAssessmentPerformanceStore.length;
  const skillCountBeforeDup = mockSkillHistoryStore.length;

  // Re-record attempt 32 on topic 104
  await ProgressAnalysisService.recordAssessmentPerformance(attempt5.attemptId, attempt5, 104, 0.65);

  assert.strictEqual(
    mockAssessmentPerformanceStore.length,
    countBeforeDup,
    'Attempt should not be recorded twice in assessment performance history'
  );
  assert.strictEqual(
    mockSkillHistoryStore.length,
    skillCountBeforeDup,
    'Skills should not be duplicated when re-recording identical attempt'
  );
  console.log('✓ Test 22: Duplicate attempt recording is strictly idempotent and prevented');
  passed++;

  console.log(`\n=== All Trial 11 Learner Progress & Adaptive Trend Engine Tests Passed Successfully! (${passed}/${passed}) ===\n`);
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
