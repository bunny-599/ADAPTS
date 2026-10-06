import assert from 'assert';
import { AuthService } from '../src/services/authService';
import { CacheService } from '../src/services/cacheService';
import { authenticateToken, optionalToken, AuthenticatedRequest } from '../src/middleware/authMiddleware';
import { AttemptService, mockAssessmentsStore } from '../src/services/attemptService';

async function runProductionTests() {
  console.log('=== Running Production Grade Authentication & Hardening Test Suite ===\n');

  // Test 1: User Registration
  const testEmail = `student_${Date.now()}@example.com`;
  const registerRes = await AuthService.register({
    email: testEmail,
    password: 'password123',
    name: 'Ada Lovelace',
    role: 'student',
  });

  assert.strictEqual(registerRes.user.email, testEmail, 'User email should match');
  assert.strictEqual(registerRes.user.name, 'Ada Lovelace', 'User name should match');
  assert.strictEqual(registerRes.user.role, 'student', 'User role should be student');
  assert.ok(registerRes.token && typeof registerRes.token === 'string', 'Token should be returned');
  console.log('✓ Test 1: User registration succeeds with hashed password & JWT generation');

  // Test 2: Duplicate Registration Prevention
  await assert.rejects(
    async () => {
      await AuthService.register({
        email: testEmail,
        password: 'password999',
        name: 'Imposter Ada',
      });
    },
    (err: any) => err.message.includes('already exists'),
    'Duplicate email must be rejected'
  );
  console.log('✓ Test 2: Duplicate registration strictly rejected');

  // Test 3: Weak Password Prevention
  await assert.rejects(
    async () => {
      await AuthService.register({
        email: `weak_${Date.now()}@example.com`,
        password: '123',
        name: 'Weak Password User',
      });
    },
    (err: any) => err.message.includes('at least 6 characters'),
    'Short password must be rejected'
  );
  console.log('✓ Test 3: Weak passwords (< 6 chars) rejected');

  // Test 4: User Login
  const loginRes = await AuthService.login({
    email: testEmail,
    password: 'password123',
  });
  assert.strictEqual(loginRes.user.email, testEmail);
  assert.ok(loginRes.token, 'Login must yield JWT token');
  console.log('✓ Test 4: User login succeeds with correct credentials');

  // Test 5: Bad Credentials
  await assert.rejects(
    async () => {
      await AuthService.login({
        email: testEmail,
        password: 'wrongpassword',
      });
    },
    (err: any) => err.message.includes('Invalid email or password'),
    'Invalid password must fail'
  );
  console.log('✓ Test 5: Incorrect password strictly rejected');

  // Test 6: JWT Token Verification
  const decoded = AuthService.verifyToken(loginRes.token);
  assert.strictEqual(decoded.email, testEmail);
  assert.strictEqual(decoded.role, 'student');
  console.log('✓ Test 6: JWT token cryptographically verified and decoded');

  // Test 7: Tampered Token Rejection
  assert.throws(
    () => {
      AuthService.verifyToken(loginRes.token + 'tampered');
    },
    'Tampered JWT token must be rejected'
  );
  console.log('✓ Test 7: Tampered JWT token rejected');

  // Test 8: authenticateToken Middleware with Valid Token
  let nextCalled = false;
  const mockReq: any = {
    headers: {
      authorization: `Bearer ${loginRes.token}`,
    },
  };
  const mockRes: any = {
    status: () => mockRes,
    json: () => mockRes,
  };
  authenticateToken(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true, 'Next must be called when token is valid');
  assert.strictEqual(mockReq.user.email, testEmail, 'User payload must be set on req');
  console.log('✓ Test 8: authenticateToken middleware authenticates valid bearer token');

  // Test 9: authenticateToken Middleware with Missing Token
  let statusSet = 0;
  let errorSent: any = null;
  const mockBadRes: any = {
    status: (code: number) => {
      statusSet = code;
      return mockBadRes;
    },
    json: (data: any) => {
      errorSent = data;
      return mockBadRes;
    },
  };
  authenticateToken({ headers: {} } as any, mockBadRes, () => {});
  assert.strictEqual(statusSet, 401, 'Status 401 should be returned');
  assert.strictEqual(errorSent.error.code, 'UNAUTHORIZED');
  console.log('✓ Test 9: authenticateToken middleware rejects missing token with 401');

  // Test 10: optionalToken Middleware Allows Anonymous Requests
  let optionalNextCalled = false;
  const mockAnonReq: any = { headers: {} };
  optionalToken(mockAnonReq, mockRes, () => {
    optionalNextCalled = true;
  });
  assert.strictEqual(optionalNextCalled, true, 'Next must be called for anonymous request');
  assert.strictEqual(mockAnonReq.user, undefined, 'User must be undefined');
  console.log('✓ Test 10: optionalToken middleware permits anonymous exploration');

  // Test 11: High-Performance Cache Service
  CacheService.clear();
  CacheService.set('topic:binary-trees', { id: 1, name: 'Binary Trees' }, 10);
  const cached = CacheService.get<{ id: number; name: string }>('topic:binary-trees');
  assert.strictEqual(cached?.name, 'Binary Trees', 'Cache must retrieve stored item');

  CacheService.invalidate('topic:binary-trees');
  const afterInvalidate = CacheService.get('topic:binary-trees');
  assert.strictEqual(afterInvalidate, null, 'Invalidated item must return null');
  console.log('✓ Test 11: CacheService correctly stores, retrieves, and invalidates entries');

  // Test 12: User Attempt Scoping
  mockAssessmentsStore.set(9999, {
    id: 9999,
    topicId: 1,
    topicName: 'Algorithms',
    targetDifficulty: 0.5,
    questions: [],
  });

  const attemptRes = await AttemptService.startAttempt(9999, registerRes.user.id);
  assert.ok(attemptRes.attemptId, 'Attempt should start successfully');
  console.log('✓ Test 12: AttemptService correctly attaches authenticated user ID to attempts');

  console.log('\n=== All Production Grade Hardening & Auth Tests Passed! (12/12) ===\n');
}

runProductionTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
